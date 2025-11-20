"""
End-to-End Test: Run Bronze → Silver → Gold Pipeline
"""
import asyncio
from flows.bronze_ingestion_flow import bronze_ingestion_flow
from flows.silver_processing_flow import silver_processing_flow
from flows.gold_analytics_flow import gold_analytics_flow

async def run_end_to_end_test():
    """Test complete Bronze → Silver → Gold pipeline"""

    print("=" * 80)
    print("🚀 Starting End-to-End FlowForge Pipeline Test")
    print("=" * 80)

    # Test configuration
    job_config = {
        "job_id": "test-job-001",
        "source_type": "database",
        "db_type": "postgresql",
        "connection": {
            "host": "localhost",
            "port": 5432,
            "database": "bfsi_demo",
            "username": "flowforge",
            "password": "flowforge123"
        },
        "table_name": "bank_transactions",
        "bronze_config": {
            "storage_format": "parquet",
            "compression": "snappy",
            "incremental_load": True
        },
        "silver_config": {
            "primary_key": "transaction_id",
            "deduplication": "keep_last",
            "quality_rules": ["not_null", "unique"]
        },
        "gold_config": {
            "aggregation": "daily",
            "indexing": ["customer_id", "date"]
        }
    }

    # Step 1: Bronze Ingestion
    print("\n📥 Step 1: Bronze Layer Ingestion")
    print("-" * 80)
    try:
        bronze_result = await bronze_ingestion_flow(job_config)
        print(f"✅ Bronze completed: {bronze_result}")
    except Exception as e:
        print(f"❌ Bronze failed: {e}")
        return

    # Step 2: Silver Processing
    print("\n🔄 Step 2: Silver Layer Processing")
    print("-" * 80)
    try:
        silver_result = await silver_processing_flow(
            job_id=job_config["job_id"],
            bronze_path=bronze_result["s3_path"]
        )
        print(f"✅ Silver completed: {silver_result}")
    except Exception as e:
        print(f"❌ Silver failed: {e}")
        return

    # Step 3: Gold Analytics
    print("\n✨ Step 3: Gold Layer Analytics")
    print("-" * 80)
    try:
        gold_result = await gold_analytics_flow(
            job_id=job_config["job_id"],
            silver_path=silver_result["s3_path"]
        )
        print(f"✅ Gold completed: {gold_result}")
    except Exception as e:
        print(f"❌ Gold failed: {e}")
        return

    print("\n" + "=" * 80)
    print("🎉 End-to-End Pipeline Completed Successfully!")
    print("=" * 80)
    print(f"\n📊 Results:")
    print(f"  Bronze: {bronze_result['s3_path']}")
    print(f"  Silver: {silver_result['s3_path']}")
    print(f"  Gold:   {gold_result['s3_path']}")
    print(f"\n🔍 View in MinIO: http://localhost:9001")
    print(f"📈 View in Prefect: http://localhost:4200")

if __name__ == "__main__":
    asyncio.run(run_end_to_end_test())
