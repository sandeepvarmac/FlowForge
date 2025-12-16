"""
Layer-Centric Pipeline Orchestration Flow

Orchestrates Landing→Bronze ingest jobs followed by Dataset Jobs (Silver/Gold)
by calling the FlowForge API endpoints. Designed for Prefect deployment
named "layer-centric-pipeline".
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, List

import requests
from prefect import flow, get_run_logger


def _api_base() -> str:
    """Resolve API base URL for FlowForge backend."""
    return os.getenv("FLOWFORGE_API_BASE", "http://localhost:3000")


def _require_ok(resp: requests.Response, context: str) -> Dict[str, Any]:
    """Raise with useful context if response is not OK."""
    if not resp.ok:
        raise RuntimeError(f"{context} failed ({resp.status_code}): {resp.text}")
    return resp.json()


def _list_ingest_jobs(pipeline_id: str) -> List[Dict[str, Any]]:
    resp = requests.get(f"{_api_base()}/api/workflows/{pipeline_id}/ingest-jobs")
    data = _require_ok(resp, "List ingest jobs")
    return data.get("jobs", [])


def _run_ingest_job(pipeline_id: str, job_id: str) -> Dict[str, Any]:
    resp = requests.post(f"{_api_base()}/api/workflows/{pipeline_id}/ingest-jobs/{job_id}/run")
    return _require_ok(resp, f"Run ingest job {job_id}")


def _poll_ingest_jobs(pipeline_id: str, job_ids: List[str], timeout_sec: int = 300, interval_sec: int = 2) -> Dict[str, Any]:
    """
    Poll ingest jobs until all listed job_ids have latestRun status in a terminal state
    or timeout is reached. Returns a map job_id -> latestRun (or None).
    """
    deadline = time.time() + timeout_sec
    latest: Dict[str, Any] = {}
    while time.time() < deadline:
        jobs = _list_ingest_jobs(pipeline_id)
        id_to_job = {j["id"]: j for j in jobs}
        all_done = True
        for jid in job_ids:
            job = id_to_job.get(jid)
            run = job.get("latestRun") if job else None
            latest[jid] = run
            status = (run or {}).get("status")
            if status not in {"succeeded", "failed", "completed"}:
                all_done = False
        if all_done:
            break
        time.sleep(interval_sec)
    return latest


def _list_dataset_jobs(pipeline_id: str) -> List[Dict[str, Any]]:
    resp = requests.get(f"{_api_base()}/api/workflows/{pipeline_id}/dataset-jobs")
    data = _require_ok(resp, "List dataset jobs")
    return data.get("jobs", [])


def _run_dataset_job(pipeline_id: str, job_id: str) -> Dict[str, Any]:
    resp = requests.post(f"{_api_base()}/api/workflows/{pipeline_id}/dataset-jobs/{job_id}/run")
    return _require_ok(resp, f"Run dataset job {job_id}")


def _poll_dataset_jobs(pipeline_id: str, job_ids: List[str], timeout_sec: int = 300, interval_sec: int = 2) -> Dict[str, Any]:
    """
    Poll dataset jobs until all listed job_ids have latestRun status in a terminal state
    or timeout is reached. Returns a map job_id -> latestRun (or None).
    """
    deadline = time.time() + timeout_sec
    latest: Dict[str, Any] = {}
    while time.time() < deadline:
        jobs = _list_dataset_jobs(pipeline_id)
        id_to_job = {j["id"]: j for j in jobs}
        all_done = True
        for jid in job_ids:
            job = id_to_job.get(jid)
            run = job.get("latestRun") if job else None
            latest[jid] = run
            status = (run or {}).get("status")
            if status not in {"succeeded", "failed", "completed", "success"}:
                all_done = False
        if all_done:
            break
        time.sleep(interval_sec)
    return latest


def _parse_dataset_job(job: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize dataset job fields we care about."""
    target_layer = job.get("targetLayer") or job.get("target_layer") or "silver"
    input_datasets = job.get("inputDatasets") or job.get("input_datasets") or []
    if isinstance(input_datasets, str):
        try:
            import json
            input_datasets = json.loads(input_datasets)
        except Exception:
            input_datasets = []
    dest = job.get("destinationConfig") or job.get("destination_config") or {}
    output_table = job.get("outputTableName") or job.get("output_table_name")
    if not output_table and target_layer == "silver":
        output_table = dest.get("silverConfig", {}).get("tableName") or dest.get("silver_config", {}).get("tableName")
    if not output_table and target_layer == "gold":
        output_table = dest.get("goldConfig", {}).get("tableName") or dest.get("gold_config", {}).get("tableName")
    run_order = job.get("runOrder") or job.get("run_order")
    return {
        **job,
        "target_layer": target_layer,
        "input_datasets": input_datasets,
        "output_table": output_table,
        "run_order": run_order,
    }


def _topo_sort_dataset_jobs(jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Topologically sort dataset jobs based on their input datasets and output table names.
    Falls back to the original order if dependencies are ambiguous.
    """
    # Normalize
    norm_jobs = [_parse_dataset_job(j) for j in jobs]

    # Order by layer first (silver before gold), then optional run_order if provided
    layer_rank = {"silver": 0, "gold": 1}
    norm_jobs.sort(key=lambda j: (layer_rank.get(j["target_layer"], 99), j["run_order"] if j["run_order"] is not None else 9999))

    id_to_job = {j["id"]: j for j in norm_jobs}
    output_names = {j["id"]: j.get("output_table") for j in norm_jobs}

    def deps(job: Dict[str, Any]) -> List[str]:
        # depend on other jobs whose outputTableName matches an input
        inputs = job.get("input_datasets") or []
        return [other_id for other_id, out_name in output_names.items() if out_name and out_name in inputs]

    temp_mark = set()
    perm_mark = set()
    ordered: List[Dict[str, Any]] = []
    cycle = False

    def visit(jid: str) -> None:
        nonlocal cycle
        if jid in perm_mark or cycle:
            return
        if jid in temp_mark:
            cycle = True
            return
        temp_mark.add(jid)
        for dep in deps(id_to_job[jid]):
            if dep in id_to_job:
                visit(dep)
        perm_mark.add(jid)
        ordered.append(id_to_job[jid])

    for jid in id_to_job:
        if jid not in perm_mark:
            visit(jid)

    return ordered if not cycle else jobs


@flow(name="layer-centric-pipeline")
def layer_centric_pipeline_flow(pipeline_id: str) -> Dict[str, Any]:
    """
    Execute a full layer-centric pipeline:
    1) Run all ingest jobs (Landing→Bronze)
    2) Wait for ingest jobs to finish
    3) Run all dataset jobs (Silver/Gold)
    """
    logger = get_run_logger()
    logger.info(f"Starting layer-centric pipeline: {pipeline_id}")

    results: Dict[str, Any] = {"pipeline_id": pipeline_id, "ingest": [], "dataset": []}

    # Step 1: Ingest jobs
    ingest_jobs = _list_ingest_jobs(pipeline_id)
    ingest_ids = [j["id"] for j in ingest_jobs]
    logger.info(f"Found {len(ingest_ids)} ingest jobs")

    for job in ingest_jobs:
        run_resp = _run_ingest_job(pipeline_id, job["id"])
        results["ingest"].append({"job_id": job["id"], "name": job.get("name"), "run": run_resp})

    # Step 2: Poll ingest completion
    if ingest_ids:
        latest = _poll_ingest_jobs(pipeline_id, ingest_ids)
        results["ingest_poll"] = latest
        failed = [jid for jid, run in latest.items() if (run or {}).get("status") in {"failed"}]
        if failed:
            logger.error(f"Ingest failures detected: {failed}")
            return {"status": "failed", **results}

    # Step 3: Dataset jobs (ordered + validated)
    dataset_jobs_raw = _list_dataset_jobs(pipeline_id)
    dataset_jobs = _topo_sort_dataset_jobs(dataset_jobs_raw)
    logger.info(f"Found {len(dataset_jobs)} dataset jobs")
    dataset_ids = [j["id"] for j in dataset_jobs]

    # Track available tables: bronze from ingest outputs + dataset outputs as we go
    available_tables = {job.get("targetTable") or job.get("target_table") for job in ingest_jobs} - {None}

    def _validate_inputs(job: Dict[str, Any]) -> None:
        inputs = job.get("input_datasets") or []
        if not inputs:
            raise ValueError(f"Dataset job {job['id']} has no input datasets configured")
        missing = [d for d in inputs if d not in available_tables]
        if missing:
            raise ValueError(f"Dataset job {job['id']} missing inputs not ready: {missing}")

    for job in dataset_jobs:
        _validate_inputs(job)
        run_resp = _run_dataset_job(pipeline_id, job["id"])
        results["dataset"].append({"job_id": job["id"], "name": job.get("name"), "run": run_resp})
        # If output table is known, add to available for downstream
        if job.get("output_table"):
            available_tables.add(job["output_table"])

    dataset_poll = _poll_dataset_jobs(pipeline_id, dataset_ids) if dataset_ids else {}
    results["dataset_poll"] = dataset_poll
    dataset_failed = [jid for jid, run in dataset_poll.items() if (run or {}).get("status") in {"failed"}]

    status = "failed" if dataset_failed else "started"
    logger.info(f"Layer-centric pipeline completed (status={status})")
    return {"status": status, **results}


# Convenience CLI
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python layer_centric_pipeline.py <pipeline_id>")
        sys.exit(1)

    pipeline_id = sys.argv[1]
    print(layer_centric_pipeline_flow(pipeline_id))
