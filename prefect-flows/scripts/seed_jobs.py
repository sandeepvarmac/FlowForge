"""Seed jobs for the Customer Data Pipeline to drive Prefect medallion runs."""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / 'apps/web/data/flowforge.db'
WORKFLOW_ID = 'wf_1759636024510_tvydba'

SCHEMA = [
    {
        "id": "job_prefect_customers",
        "name": "Customers",
        "landing_key": "landing/demo_workflow/csv_ingest_02/Customers.csv",
        "primary_keys": ["customer_id"],
        "order_index": 1,
    },
    {
        "id": "job_prefect_orders",
        "name": "Orders",
        "landing_key": "landing/demo_workflow/csv_ingest_03/orders.csv",
        "primary_keys": ["order_id"],
        "order_index": 2,
    },
    {
        "id": "job_prefect_products",
        "name": "Products",
        "landing_key": "landing/demo_workflow/csv_ingest_04/products.csv",
        "primary_keys": ["product_id"],
        "order_index": 3,
    },
    {
        "id": "job_prefect_countries",
        "name": "Countries",
        "landing_key": "landing/demo_workflow/csv_ingest_01/countries.csv",
        "primary_keys": ["country_code"],
        "order_index": 4,
    },
]


def main() -> None:
    if not DB_PATH.exists():
        raise SystemExit(f"Database not found at {DB_PATH}")

    now = int(time.time())
    conn = sqlite3.connect(DB_PATH)

    with conn:
        conn.execute('DELETE FROM jobs WHERE workflow_id = ?', (WORKFLOW_ID,))

        for job in SCHEMA:
            source_config = {
                "name": job["name"],
                "type": "csv",
                "landingKey": job["landing_key"],
                "fileConfig": {"filePath": Path(job["landing_key"]).name},
                "prefect": {
                    "deploymentName": "flowforge-medallion/customer-data",
                    "parameters": {
                        "primary_keys": job["primary_keys"],
                    },
                },
            }

            destination_config = {"medallionLayer": "gold"}

            conn.execute(
                """
                INSERT INTO jobs (
                    id, workflow_id, name, description, type, order_index, status,
                    source_config, destination_config, transformation_config,
                    validation_config, last_run, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job["id"],
                    WORKFLOW_ID,
                    job["name"],
                    f"Prefect medallion ingestion for {job['name']}",
                    "file-based",
                    job["order_index"],
                    "configured",
                    json.dumps(source_config),
                    json.dumps(destination_config),
                    None,
                    None,
                    None,
                    now,
                    now,
                ),
            )

    print(f"Seeded {len(SCHEMA)} jobs for workflow {WORKFLOW_ID}")


if __name__ == "__main__":
    main()
