"""Verify medallion architecture files in MinIO."""
from utils.s3 import S3Client

s3 = S3Client()

print("=== BRONZE LAYER ===")
bronze_objs = s3.list_objects("bronze/")
for obj in bronze_objs[:10]:
    print(f"  {obj}")

print(f"\n=== SILVER LAYER ===")
silver_objs = s3.list_objects("silver/")
for obj in silver_objs[:10]:
    print(f"  {obj}")

print(f"\n=== GOLD LAYER ===")
gold_objs = s3.list_objects("gold/")
for obj in gold_objs[:10]:
    print(f"  {obj}")

print(f"\nSummary:")
print(f"  Bronze: {len(bronze_objs)} objects")
print(f"  Silver: {len(silver_objs)} objects")
print(f"  Gold: {len(gold_objs)} objects")
