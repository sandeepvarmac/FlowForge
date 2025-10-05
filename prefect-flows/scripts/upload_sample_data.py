"""Utility to upload sample CSV files from ../sample-data into MinIO landing."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from utils.s3 import S3Client

WORKFLOW_ID = "demo_workflow"
JOB_PREFIX = "csv_ingest"
LANDING_ROOT = Path("..") / "sample-data"


def main() -> None:
    client = S3Client()

    if not LANDING_ROOT.exists():
        raise SystemExit(f"Sample data directory not found: {LANDING_ROOT}")

    for idx, csv_path in enumerate(sorted(LANDING_ROOT.glob("*.csv")), start=1):
        job_id = f"{JOB_PREFIX}_{idx:02d}"
        s3_key = f"landing/{WORKFLOW_ID}/{job_id}/{csv_path.name}"
        client.upload_file(csv_path, s3_key)
        print(f"Uploaded {csv_path.name} -> {s3_key}")


if __name__ == "__main__":
    main()
