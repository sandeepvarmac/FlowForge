"""Configuration management for FlowForge Prefect flows."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # MinIO / S3 Configuration
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key_id: str = "prefect"
    s3_secret_access_key: str = "prefect123"
    s3_bucket_name: str = "flowforge-data"
    s3_region: str = "us-east-1"

    # Prefect Configuration
    prefect_api_url: Optional[str] = None
    prefect_api_key: Optional[str] = None

    # Database Configuration
    database_url: str = "postgresql://flowforge:flowforge123@localhost:5432/flowforge"

    # DuckDB Configuration
    duckdb_path: str = "./data/duckdb/analytics.duckdb"

    # Application Settings
    environment: str = "local"
    log_level: str = "INFO"

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() == "production"

    @property
    def is_using_aws_s3(self) -> bool:
        """Check if using AWS S3 (vs MinIO)."""
        return "amazonaws.com" in self.s3_endpoint_url


# Global settings instance
settings = Settings()
