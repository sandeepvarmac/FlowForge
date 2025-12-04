"""
AI Configuration Assistant - Analyzes data and suggests optimal configurations
for Bronze, Silver, and Gold layers using Claude AI or OpenAI (fallback).
"""

from typing import Dict, List, Any, Optional
import polars as pl
import os
import json
from datetime import datetime


class AIConfigAssistant:
    """
    AI-powered configuration assistant that analyzes data and suggests
    optimal settings for Bronze, Silver, and Gold layers.
    Supports both Anthropic (primary) and OpenAI (fallback).
    """

    def __init__(self, api_key: Optional[str] = None, provider: Optional[str] = None):
        """
        Initialize AI Config Assistant

        Args:
            api_key: API key (if None, reads from environment)
            provider: 'anthropic' or 'openai' (if None, auto-detects based on available keys)
        """
        # Auto-detect provider if not specified
        if provider is None:
            anthropic_key = os.getenv("ANTHROPIC_API_KEY")
            openai_key = os.getenv("OPENAI_API_KEY")

            if anthropic_key:
                provider = "anthropic"
            elif openai_key:
                provider = "openai"
            else:
                raise ValueError("Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY environment variable is set")

        self.provider = provider.lower()
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._fallback_openai_client = None

        # Initialize the appropriate client
        if self.provider == "anthropic":
            import anthropic
            self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
            if not self.api_key:
                raise ValueError("ANTHROPIC_API_KEY environment variable not set")
            self.client = anthropic.Anthropic(api_key=self.api_key)
            self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")

        elif self.provider == "openai":
            from openai import OpenAI
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            if not self.api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self.client = OpenAI(api_key=self.api_key)
            self.model = self.openai_model

        else:
            raise ValueError(f"Unsupported provider: {provider}. Use 'anthropic' or 'openai'")

    def analyze_bronze_config(
        self,
        df: pl.DataFrame,
        table_name: str,
        source_type: str = "database"
    ) -> Dict[str, Any]:
        """
        Analyze source data and suggest Bronze layer configuration

        Args:
            df: Polars DataFrame with sample data
            table_name: Name of the source table
            source_type: Type of source (database, file, api)

        Returns:
            Dictionary with configuration suggestions:
            {
                "incremental_load": {...},
                "partitioning": {...},
                "schema_evolution": {...}
            }
        """
        # Generate data profile
        profile = self._generate_data_profile(df)

        # Detect temporal columns
        temporal_columns = self._detect_temporal_columns(df)

        # Build prompt
        prompt = self._build_bronze_prompt(
            table_name=table_name,
            profile=profile,
            temporal_columns=temporal_columns,
            source_type=source_type
        )

        # Call AI API based on provider
        response_text, used_fallback = self._call_ai_api(prompt)

        # Parse response
        suggestions = self._parse_bronze_response(response_text)

        # Add fallback indicator
        suggestions['_using_fallback'] = used_fallback

        return suggestions

    def _call_ai_api(self, prompt: str) -> tuple[str, bool]:
        """
        Call the appropriate AI API based on provider

        Args:
            prompt: The prompt to send to the AI

        Returns:
            Tuple of (response_text, used_fallback)
        """
        if self.provider == "anthropic":
            try:
                response = self._call_anthropic(prompt)
                return response, False
            except Exception as err:
                fallback_key = os.getenv("OPENAI_API_KEY")
                if fallback_key:
                    print("[AIConfigAssistant] Anthropic call failed, falling back to OpenAI:", err)
                    response = self._call_openai(prompt, fallback_key)
                    return response, True
                raise

        elif self.provider == "openai":
            response = self._call_openai(prompt, self.api_key)
            return response, False

        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _call_anthropic(self, prompt: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        return response.content[0].text

    def _call_openai(self, prompt: str, api_key_override: Optional[str] = None) -> str:
        from openai import OpenAI

        if self.provider == "openai":
            client = self.client
            model = self.model
        else:
            if not self._fallback_openai_client:
                key = api_key_override or os.getenv("OPENAI_API_KEY")
                if not key:
                    raise ValueError("OPENAI_API_KEY environment variable not set for fallback usage")
                self._fallback_openai_client = OpenAI(api_key=key)
            client = self._fallback_openai_client
            model = self.openai_model

        response = client.chat.completions.create(
            model=model,
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        return response.choices[0].message.content

    def analyze_silver_config(
        self,
        df: pl.DataFrame,
        table_name: str,
        bronze_metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Suggest Silver layer configuration (primary keys, deduplication, quality rules)

        Args:
            df: Polars DataFrame with sample data
            table_name: Name of the table
            bronze_metadata: Optional metadata from Bronze layer

        Returns:
            Dictionary with Silver configuration suggestions
        """
        # Detect primary key candidates
        primary_key_candidates = self._detect_primary_keys(df)

        # Analyze duplicate patterns
        duplicate_analysis = self._analyze_duplicates(df)

        # Generate data profile
        profile = self._generate_data_profile(df)

        # Build prompt
        prompt = self._build_silver_prompt(
            table_name=table_name,
            profile=profile,
            primary_key_candidates=primary_key_candidates,
            duplicate_analysis=duplicate_analysis
        )

        response_text, used_fallback = self._call_ai_api(prompt)

        # Parse response
        suggestions = self._parse_silver_response(response_text)

        # Add fallback indicator
        suggestions['_using_fallback'] = used_fallback

        return suggestions

    def analyze_gold_config(
        self,
        df: pl.DataFrame,
        table_name: str,
        business_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Suggest Gold layer configuration (aggregations, indexes, materialization)

        Args:
            df: Polars DataFrame with sample data
            table_name: Name of the table
            business_context: Optional business context/use case

        Returns:
            Dictionary with Gold configuration suggestions
        """
        # Generate data profile
        profile = self._generate_data_profile(df)

        # Detect aggregation opportunities
        numeric_columns = [col for col, dtype in zip(df.columns, df.dtypes)
                          if dtype in [pl.Int32, pl.Int64, pl.Float32, pl.Float64]]

        # Build prompt
        prompt = self._build_gold_prompt(
            table_name=table_name,
            profile=profile,
            numeric_columns=numeric_columns,
            business_context=business_context
        )

        response_text, used_fallback = self._call_ai_api(prompt)

        # Parse response
        suggestions = self._parse_gold_response(response_text)

        # Add fallback indicator
        suggestions['_using_fallback'] = used_fallback

        return suggestions

    # ========== Helper Methods ==========

    def _generate_data_profile(self, df: pl.DataFrame) -> Dict[str, Any]:
        """Generate statistical profile of the DataFrame"""
        profile = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": []
        }

        for col in df.columns:
            # Get null count using is_null().sum() for Polars Series
            null_cnt = df[col].is_null().sum()
            col_profile = {
                "name": col,
                "type": str(df[col].dtype),
                "null_count": null_cnt,
                "null_percentage": round((null_cnt / len(df)) * 100, 2),
                "unique_count": df[col].n_unique(),
                "uniqueness": round((df[col].n_unique() / len(df)) * 100, 2)
            }

            # Add min/max for numeric columns
            if df[col].dtype in [pl.Int32, pl.Int64, pl.Float32, pl.Float64]:
                col_profile["min"] = float(df[col].min())
                col_profile["max"] = float(df[col].max())
                col_profile["mean"] = float(df[col].mean())

            profile["columns"].append(col_profile)

        return profile

    def _detect_temporal_columns(self, df: pl.DataFrame) -> List[Dict[str, Any]]:
        """Detect date/timestamp columns"""
        temporal_cols = []

        for col in df.columns:
            dtype = df[col].dtype

            # Check if column is date/datetime type
            if dtype in [pl.Date, pl.Datetime]:
                temporal_cols.append({
                    "name": col,
                    "type": str(dtype),
                    "is_sequential": self._is_sequential(df[col])
                })

        return temporal_cols

    def _is_sequential(self, series: pl.Series) -> bool:
        """Check if a series has sequential/increasing pattern"""
        try:
            # Sort and check if mostly increasing
            sorted_series = series.sort()
            increasing_count = (sorted_series.diff() > 0).sum()
            total_count = len(series) - 1

            # Consider sequential if 80%+ values are increasing
            return (increasing_count / total_count) > 0.8 if total_count > 0 else False
        except:
            return False

    def _detect_primary_keys(self, df: pl.DataFrame) -> List[Dict[str, Any]]:
        """Detect potential primary key columns"""
        candidates = []

        for col in df.columns:
            uniqueness = (df[col].n_unique() / len(df)) * 100
            null_percentage = (df[col].is_null().sum() / len(df)) * 100

            # Potential primary key if 100% unique and 0% nulls
            if uniqueness == 100 and null_percentage == 0:
                candidates.append({
                    "column": col,
                    "uniqueness": 100.0,
                    "null_percentage": 0.0,
                    "confidence": 99
                })
            # Good candidate if >95% unique and <5% nulls
            elif uniqueness > 95 and null_percentage < 5:
                candidates.append({
                    "column": col,
                    "uniqueness": round(uniqueness, 2),
                    "null_percentage": round(null_percentage, 2),
                    "confidence": int(uniqueness)
                })

        # Sort by confidence
        return sorted(candidates, key=lambda x: x["confidence"], reverse=True)

    def _analyze_duplicates(self, df: pl.DataFrame) -> Dict[str, Any]:
        """Analyze duplicate patterns in data"""
        total_rows = len(df)

        # Check for exact duplicates
        duplicates = df.is_duplicated().sum()

        return {
            "total_rows": total_rows,
            "duplicate_rows": duplicates,
            "duplicate_percentage": round((duplicates / total_rows) * 100, 2) if total_rows > 0 else 0
        }

    # ========== Prompt Builders ==========

    def _build_bronze_prompt(
        self,
        table_name: str,
        profile: Dict,
        temporal_columns: List[Dict],
        source_type: str
    ) -> str:
        """Build prompt for Bronze layer configuration"""

        temporal_info = "No temporal columns detected."
        if temporal_columns:
            temporal_info = "Temporal columns found:\n"
            for col in temporal_columns:
                temporal_info += f"  - {col['name']} ({col['type']}) - Sequential: {col['is_sequential']}\n"

        prompt = f"""You are an expert Data Architect helping to configure a Bronze layer (raw data ingestion) for a data pipeline.

Table Name: {table_name}
Source Type: {source_type}
Row Count: {profile['row_count']}
Column Count: {profile['column_count']}

{temporal_info}

Column Summary:
"""
        for col in profile['columns'][:10]:  # Limit to first 10 columns
            prompt += f"  - {col['name']} ({col['type']}): {col['null_percentage']}% NULL, {col['uniqueness']}% unique\n"

        prompt += """
Based on this data, suggest optimal Bronze layer configuration:

1. **Storage Format**: What storage format should be used? (parquet recommended for analytics, csv for compatibility, json for semi-structured)
2. **Compression**: What compression should be applied? (snappy for parquet, gzip for csv/json, or none)
3. **Incremental Load**: Should incremental loading be enabled? If yes, which column should be used as watermark?
4. **Partitioning**: Should data be partitioned? If yes, what strategy (DATE, HASH, RANGE) and which column?
5. **Schema Evolution**: Should schema evolution be enabled to handle new columns?
6. **Data Type Conversions**: Analyze column data types - suggest conversions to more appropriate types (e.g., string→date, string→numeric, numeric→category)
7. **Column Naming**: Suggest standardized column names following snake_case convention (e.g., "First Name" → "first_name")
8. **Validation Hints**: What data quality validation rules would be beneficial? (e.g., null checks, range checks, uniqueness checks)

For each suggestion, provide:
- enabled: true/false (where applicable)
- relevant parameters (format, algorithm, column names, strategy)
- confidence: 0-100
- reasoning: Brief explanation (1-2 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "storage_format": {
    "format": "parquet/csv/json",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "compression": {
    "enabled": true/false,
    "algorithm": "snappy/gzip/none",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "incremental_load": {
    "enabled": true/false,
    "watermark_column": "column_name or null",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "partitioning": {
    "enabled": true/false,
    "strategy": "DATE/HASH/RANGE or null",
    "partition_column": "column_name or null",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "schema_evolution": {
    "enabled": true/false,
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "type_conversions": {
    "suggested_conversions": [
      {"column": "column_name", "from_type": "current_type", "to_type": "recommended_type", "confidence": 0-100, "reasoning": "explanation"}
    ],
    "confidence": 0-100,
    "reasoning": "overall type conversion strategy"
  },
  "column_naming": {
    "suggested_renames": [
      {"original": "old_name", "standardized": "new_name", "confidence": 0-100, "reasoning": "explanation"}
    ],
    "confidence": 0-100,
    "reasoning": "overall naming strategy"
  },
  "validation_hints": {
    "suggested_rules": [
      {"type": "not_null/unique/range/pattern/enum", "column": "column_name", "parameters": {}, "reasoning": "explanation"}
    ],
    "confidence": 0-100,
    "reasoning": "overall validation strategy explanation"
  }
}
"""
        return prompt

    def _build_silver_prompt(
        self,
        table_name: str,
        profile: Dict,
        primary_key_candidates: List[Dict],
        duplicate_analysis: Dict
    ) -> str:
        """Build prompt for Silver layer configuration"""

        pk_info = "No strong primary key candidates found."
        if primary_key_candidates:
            pk_info = "Primary key candidates:\n"
            for candidate in primary_key_candidates[:3]:  # Top 3
                pk_info += f"  - {candidate['column']}: {candidate['uniqueness']}% unique, {candidate['null_percentage']}% NULL\n"

        prompt = f"""You are an expert Data Architect helping to configure a Silver layer (cleaned, deduplicated data) for a data pipeline.

Table Name: {table_name}
Row Count: {profile['row_count']}
Column Count: {profile['column_count']}

{pk_info}

Duplicate Analysis:
- Total Rows: {duplicate_analysis['total_rows']}
- Duplicate Rows: {duplicate_analysis['duplicate_rows']} ({duplicate_analysis['duplicate_percentage']}%)

Column Summary:
"""
        for col in profile['columns'][:10]:
            prompt += f"  - {col['name']} ({col['type']}): {col['null_percentage']}% NULL, {col['uniqueness']}% unique\n"

        prompt += """
Based on this data, suggest optimal Silver layer configuration:

1. **Primary Key**: Which column(s) should be used as primary key for deduplication and merging?
2. **Deduplication Strategy**: If duplicates exist, should we keep first, last, or all records?
3. **Sort Column**: If keeping latest, which column should be used for sorting (usually timestamp)?
4. **Merge Strategy**: Should updates use merge (upsert), full_refresh, append, or SCD Type 2?
5. **Relationships**: Detect potential foreign key relationships (columns ending in _id, _key, or matching other table patterns)
6. **Quality Rules**: What data quality validation rules would ensure clean data? (not null, unique, range, pattern, enum checks)

For each suggestion, provide:
- relevant parameters
- confidence: 0-100
- reasoning: Brief explanation (1-2 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "primary_key": {
    "columns": ["column1", "column2"],
    "composite": true/false,
    "uniqueness": 0-100,
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "deduplication": {
    "enabled": true/false,
    "strategy": "first/last/none",
    "sort_column": "column_name or null",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "merge_strategy": {
    "strategy": "merge/full_refresh/append/scd_type_2",
    "update_strategy": "update_all/update_changed",
    "conflict_resolution": "source_wins/target_wins/most_recent",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "relationships": {
    "detected_foreign_keys": [
      {"column": "column_name", "references_table": "estimated_table_name", "confidence": 0-100, "reasoning": "explanation"}
    ],
    "confidence": 0-100,
    "reasoning": "overall relationship detection strategy"
  },
  "quality_rules": {
    "suggested_rules": [
      {
        "type": "not_null/unique/range/pattern/enum",
        "column": "column_name",
        "parameters": {"min": 0, "max": 100} or {"pattern": "regex"} or {"values": ["A", "B"]},
        "severity": "error/warning",
        "confidence": 0-100,
        "reasoning": "explanation"
      }
    ],
    "confidence": 0-100,
    "reasoning": "overall quality strategy explanation"
  }
}
"""
        return prompt

    def _build_gold_prompt(
        self,
        table_name: str,
        profile: Dict,
        numeric_columns: List[str],
        business_context: Optional[str]
    ) -> str:
        """Build prompt for Gold layer configuration"""

        context_info = business_context or "No business context provided."
        numeric_info = f"Numeric columns available for aggregation: {', '.join(numeric_columns)}" if numeric_columns else "No numeric columns found."

        prompt = f"""You are an expert Data Architect helping to configure a Gold layer (business-ready aggregated data) for a data pipeline.

Table Name: {table_name}
Row Count: {profile['row_count']}
Column Count: {profile['column_count']}

Business Context: {context_info}

{numeric_info}

Column Summary:
"""
        for col in profile['columns'][:10]:
            prompt += f"  - {col['name']} ({col['type']}): {col['null_percentage']}% NULL, {col['uniqueness']}% unique\n"

        prompt += """
Based on this data, suggest optimal Gold layer configuration:

1. **Aggregation Strategy**: Should data be aggregated? If yes, at what level (DAILY, MONTHLY, NONE)?
2. **Metrics**: What metrics should be calculated (COUNT, SUM, AVG, etc.)?
3. **Indexing**: Which columns should be indexed for query performance?
4. **Materialization**: Should this be materialized? What refresh strategy?
5. **Schedule Recommendation**: Based on data patterns, suggest optimal execution schedule (hourly/daily/weekly/monthly) with cron expression
6. **Sampling Strategy**: Recommend optimal sample size for data preview based on table size and complexity

For each suggestion, provide:
- relevant parameters
- confidence: 0-100
- reasoning: Brief explanation (1-2 sentences)

Respond ONLY with valid JSON in this exact format:
{
  "aggregation": {
    "enabled": true/false,
    "level": "DAILY/MONTHLY/NONE",
    "metrics": [
      {"name": "metric_name", "type": "COUNT/SUM/AVG", "column": "column_name"}
    ],
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "indexing": {
    "enabled": true/false,
    "strategy": "COVERING_INDEX/BTREE/HASH",
    "columns": ["column1", "column2"],
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "materialization": {
    "enabled": true/false,
    "refresh_strategy": "INCREMENTAL/FULL",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "schedule": {
    "frequency": "hourly/daily/weekly/monthly",
    "cron_expression": "0 0 * * *",
    "recommended_time": "description of optimal execution time",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "sampling": {
    "recommended_sample_size": 1000,
    "min_sample_size": 100,
    "max_sample_size": 10000,
    "confidence": 0-100,
    "reasoning": "explanation based on table size and complexity"
  }
}
"""
        return prompt

    # ========== Response Parsers ==========

    def _parse_bronze_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's Bronze configuration response"""
        try:
            # Extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")

            json_str = response_text[json_start:json_end]
            suggestions = json.loads(json_str)

            return suggestions
        except Exception as e:
            print(f"Error parsing Bronze response: {e}")
            # Return default suggestions if parsing fails
            return {
                "storage_format": {
                    "format": "parquet",
                    "confidence": 50,
                    "reasoning": "Parquet is recommended for analytics workloads"
                },
                "compression": {
                    "enabled": True,
                    "algorithm": "snappy",
                    "confidence": 50,
                    "reasoning": "Snappy provides good balance of compression and speed"
                },
                "incremental_load": {
                    "enabled": False,
                    "watermark_column": None,
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "partitioning": {
                    "enabled": False,
                    "strategy": None,
                    "partition_column": None,
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "schema_evolution": {
                    "enabled": True,
                    "confidence": 50,
                    "reasoning": "Enabled by default for flexibility"
                },
                "type_conversions": {
                    "suggested_conversions": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze data types"
                },
                "column_naming": {
                    "suggested_renames": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze column names"
                },
                "validation_hints": {
                    "suggested_rules": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze data quality patterns"
                }
            }

    def _parse_silver_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's Silver configuration response"""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")

            json_str = response_text[json_start:json_end]
            suggestions = json.loads(json_str)

            return suggestions
        except Exception as e:
            print(f"Error parsing Silver response: {e}")
            return {
                "primary_key": {
                    "columns": [],
                    "composite": False,
                    "uniqueness": 0,
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "deduplication": {
                    "enabled": False,
                    "strategy": None,
                    "sort_column": None,
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "merge_strategy": {
                    "strategy": "merge",
                    "update_strategy": "update_all",
                    "conflict_resolution": "source_wins",
                    "confidence": 50,
                    "reasoning": "Default merge strategy recommended"
                },
                "relationships": {
                    "detected_foreign_keys": [],
                    "confidence": 0,
                    "reasoning": "Failed to detect relationships"
                },
                "quality_rules": {
                    "suggested_rules": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze data quality patterns"
                }
            }

    def _parse_gold_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's Gold configuration response"""
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start == -1 or json_end == 0:
                raise ValueError("No JSON found in response")

            json_str = response_text[json_start:json_end]
            suggestions = json.loads(json_str)

            return suggestions
        except Exception as e:
            print(f"Error parsing Gold response: {e}")
            return {
                "aggregation": {
                    "enabled": False,
                    "level": "NONE",
                    "metrics": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "indexing": {
                    "enabled": False,
                    "strategy": None,
                    "columns": [],
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "materialization": {
                    "enabled": False,
                    "refresh_strategy": None,
                    "confidence": 0,
                    "reasoning": "Failed to analyze data"
                },
                "schedule": {
                    "frequency": "daily",
                    "cron_expression": "0 0 * * *",
                    "recommended_time": "Default daily execution at midnight",
                    "confidence": 0,
                    "reasoning": "Failed to analyze data patterns"
                },
                "sampling": {
                    "recommended_sample_size": 1000,
                    "min_sample_size": 100,
                    "max_sample_size": 10000,
                    "confidence": 50,
                    "reasoning": "Default sampling strategy"
                }
            }


# ========== Convenience Functions ==========

def get_bronze_suggestions(
    df: pl.DataFrame,
    table_name: str,
    source_type: str = "database"
) -> Dict[str, Any]:
    """
    Convenience function to get Bronze layer suggestions

    Args:
        df: Polars DataFrame with sample data
        table_name: Name of the source table
        source_type: Type of source (database, file, api)

    Returns:
        Dictionary with Bronze configuration suggestions
    """
    assistant = AIConfigAssistant()
    return assistant.analyze_bronze_config(df, table_name, source_type)


def get_silver_suggestions(
    df: pl.DataFrame,
    table_name: str,
    bronze_metadata: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Convenience function to get Silver layer suggestions

    Args:
        df: Polars DataFrame with sample data
        table_name: Name of the table
        bronze_metadata: Optional metadata from Bronze layer

    Returns:
        Dictionary with Silver configuration suggestions
    """
    assistant = AIConfigAssistant()
    return assistant.analyze_silver_config(df, table_name, bronze_metadata)


def get_gold_suggestions(
    df: pl.DataFrame,
    table_name: str,
    business_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to get Gold layer suggestions

    Args:
        df: Polars DataFrame with sample data
        table_name: Name of the table
        business_context: Optional business context/use case

    Returns:
        Dictionary with Gold configuration suggestions
    """
    assistant = AIConfigAssistant()
    return assistant.analyze_gold_config(df, table_name, business_context)


def _emit_progress(stage: str, message: str, detail: str = None, finding: Dict = None):
    """Helper function to emit progress events to stderr"""
    import sys
    event = {
        "type": "progress",
        "stage": stage,
        "message": message
    }
    if detail:
        event["detail"] = detail
    if finding:
        event["finding"] = finding
    print("PROGRESS:" + json.dumps(event), file=sys.stderr, flush=True)


def analyze_full_pipeline(
    df: pl.DataFrame,
    table_name: str,
    source_type: str = "database",
    business_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Unified function to get suggestions for all three layers (Bronze, Silver, Gold)
    with automatic fallback from Anthropic to OpenAI on failures.

    Args:
        df: Polars DataFrame with sample data
        table_name: Name of the table
        source_type: Type of source (database, file, api)
        business_context: Optional business context/use case for Gold layer

    Returns:
        Dictionary with unified configuration:
        {
            "success": True/False,
            "bronze": { ... },
            "silver": { ... },
            "gold": { ... },
            "analysisSummary": {
                "status": "completed"/"partial"/"failed",
                "progress": 100,
                "events": [...]
            },
            "providerUsed": "anthropic"/"openai"
        }
    """
    import sys

    result = {
        "success": False,
        "bronze": {},
        "silver": {},
        "gold": {},
        "analysisSummary": {
            "status": "started",
            "progress": 0,
            "events": []
        },
        "providerUsed": "unknown"
    }

    events = []
    provider_used = None

    # Helper to emit findings
    def emit_finding(stage: str, finding_type: str, text: str, icon: str = None):
        finding = {"type": finding_type, "text": text}
        if icon:
            finding["icon"] = icon
        _emit_progress(stage, f"Found: {text}", finding=finding)

    try:
        # --- SAMPLING STAGE ---
        _emit_progress("sampling", "Loading data sample...",
                      detail=f"Preparing {len(df)} rows for analysis")

        row_count = len(df)
        col_count = len(df.columns)

        _emit_progress("sampling", f"Loaded {row_count:,} rows with {col_count} columns",
                      finding={"type": "info", "text": f"Dataset: {row_count:,} rows × {col_count} columns", "icon": "table"})

        # --- PROFILING STAGE ---
        _emit_progress("profiling", "Analyzing column data types...",
                      detail="Detecting column types and patterns")

        # Detect column types
        string_cols = [c for c in df.columns if df[c].dtype == pl.Utf8]
        numeric_cols = [c for c in df.columns if df[c].dtype in [pl.Int64, pl.Int32, pl.Float64, pl.Float32]]
        date_cols = [c for c in df.columns if df[c].dtype in [pl.Date, pl.Datetime]]

        if string_cols:
            _emit_progress("profiling", f"Found {len(string_cols)} text columns",
                          finding={"type": "column", "text": f"Text columns: {', '.join(string_cols[:3])}{'...' if len(string_cols) > 3 else ''}", "icon": "type"})

        if numeric_cols:
            _emit_progress("profiling", f"Found {len(numeric_cols)} numeric columns",
                          finding={"type": "column", "text": f"Numeric columns: {', '.join(numeric_cols[:3])}{'...' if len(numeric_cols) > 3 else ''}", "icon": "hash"})

        if date_cols:
            _emit_progress("profiling", f"Found {len(date_cols)} date/time columns",
                          finding={"type": "column", "text": f"Date columns: {', '.join(date_cols[:3])}{'...' if len(date_cols) > 3 else ''}", "icon": "calendar"})

        # Look for potential ID columns
        id_candidates = [c for c in df.columns if any(kw in c.lower() for kw in ['id', 'key', 'code', 'num', 'no'])]
        if id_candidates:
            _emit_progress("profiling", "Detected potential identifier columns",
                          finding={"type": "pattern", "text": f"Potential IDs: {', '.join(id_candidates[:3])}", "icon": "key"})

        # Try Anthropic first, then fallback to OpenAI
        assistant = None
        try:
            # --- BRONZE STAGE ---
            _emit_progress("bronze", "Initializing AI analysis for Bronze layer...",
                          detail="Connecting to AI provider")

            assistant = AIConfigAssistant()
            provider_used = assistant.provider

            provider_name = "Claude" if provider_used == "anthropic" else "GPT"
            _emit_progress("bronze", f"Connected to {provider_name} AI",
                          finding={"type": "info", "text": f"Using {provider_name} for intelligent analysis", "icon": "sparkles"})

            _emit_progress("bronze", "Analyzing ingestion strategy...",
                          detail="Determining optimal load patterns")

            # Bronze Layer
            bronze_result = assistant.analyze_bronze_config(df, table_name, source_type)
            result["bronze"] = bronze_result
            events.append({"stage": "bronze", "status": "completed", "timestamp": datetime.now().isoformat()})
            result["analysisSummary"]["progress"] = 50

            # Emit Bronze findings
            if bronze_result.get("incremental_load", {}).get("enabled"):
                watermark = bronze_result["incremental_load"].get("watermark_column", "timestamp")
                _emit_progress("bronze", "Incremental load strategy recommended",
                              finding={"type": "recommendation", "text": f"Use incremental loading with '{watermark}' as watermark", "icon": "clock"})
            else:
                _emit_progress("bronze", "Full load strategy recommended",
                              finding={"type": "recommendation", "text": "Full snapshot load recommended for this dataset", "icon": "database"})

            if bronze_result.get("partitioning", {}).get("enabled"):
                part_col = bronze_result["partitioning"].get("column", "date")
                _emit_progress("bronze", "Partitioning strategy identified",
                              finding={"type": "recommendation", "text": f"Partition by '{part_col}' for optimal performance", "icon": "filter"})

            # --- SILVER STAGE ---
            _emit_progress("silver", "Analyzing data cleansing requirements...",
                          detail="Identifying quality rules and transformations")

            # Silver Layer
            silver_result = assistant.analyze_silver_config(df, table_name, bronze_metadata=bronze_result)
            result["silver"] = silver_result
            events.append({"stage": "silver", "status": "completed", "timestamp": datetime.now().isoformat()})
            result["analysisSummary"]["progress"] = 75

            # Emit Silver findings
            if silver_result.get("primary_key", {}).get("columns"):
                pk_cols = silver_result["primary_key"]["columns"]
                _emit_progress("silver", "Primary key identified",
                              finding={"type": "recommendation", "text": f"Primary key: {', '.join(pk_cols[:3])}", "icon": "key"})

            if silver_result.get("deduplication", {}).get("enabled"):
                strategy = silver_result["deduplication"].get("strategy", "latest")
                _emit_progress("silver", "Deduplication strategy configured",
                              finding={"type": "recommendation", "text": f"Dedup strategy: keep {strategy} record", "icon": "filter"})

            if silver_result.get("quality_rules"):
                rule_count = len(silver_result["quality_rules"])
                _emit_progress("silver", f"Generated {rule_count} data quality rules",
                              finding={"type": "recommendation", "text": f"{rule_count} quality rules will be applied", "icon": "toggle"})

            # --- GOLD STAGE ---
            _emit_progress("gold", "Designing analytics layer...",
                          detail="Building aggregations and metrics")

            # Gold Layer
            gold_result = assistant.analyze_gold_config(df, table_name, business_context)
            result["gold"] = gold_result
            events.append({"stage": "gold", "status": "completed", "timestamp": datetime.now().isoformat()})
            result["analysisSummary"]["progress"] = 100

            # Emit Gold findings
            if gold_result.get("aggregation", {}).get("enabled"):
                metrics = gold_result["aggregation"].get("metrics", [])
                if metrics:
                    _emit_progress("gold", f"Configured {len(metrics)} aggregation metrics",
                                  finding={"type": "recommendation", "text": f"Metrics: {', '.join([m.get('name', 'metric') for m in metrics[:3]])}", "icon": "chart"})

            if gold_result.get("dimensions"):
                dims = gold_result["dimensions"]
                if dims:
                    _emit_progress("gold", "Dimension columns identified",
                                  finding={"type": "recommendation", "text": f"Dimensions: {', '.join(dims[:3])}", "icon": "table"})

            if gold_result.get("schedule", {}).get("frequency"):
                freq = gold_result["schedule"]["frequency"]
                _emit_progress("gold", "Refresh schedule configured",
                              finding={"type": "recommendation", "text": f"Recommended refresh: {freq}", "icon": "clock"})

            result["success"] = True
            result["analysisSummary"]["status"] = "completed"

            _emit_progress("gold", "Analysis complete!",
                          finding={"type": "info", "text": "All layer configurations ready for review", "icon": "sparkles"})

        except Exception as e:
            error_msg = str(e)
            print(f"[ERROR] Primary provider failed: {error_msg}", file=sys.stderr)

            # Check if it's an Anthropic error and OpenAI is available
            if "anthropic" in error_msg.lower() or "insufficient" in error_msg.lower() or "credit" in error_msg.lower():
                openai_key = os.getenv("OPENAI_API_KEY")
                if openai_key and (assistant is None or assistant.provider == "anthropic"):
                    print("[INFO] Falling back to OpenAI...", file=sys.stderr, flush=True)

                    _emit_progress("bronze", "Switching to backup AI provider...",
                                  finding={"type": "warning", "text": "Primary AI unavailable, using OpenAI fallback", "icon": "sparkles"})

                    # Retry with OpenAI
                    assistant = AIConfigAssistant(provider="openai")
                    provider_used = "openai"

                    _emit_progress("bronze", "Analyzing with GPT...",
                                  detail="Restarting Bronze layer analysis")

                    # Retry all three layers
                    bronze_result = assistant.analyze_bronze_config(df, table_name, source_type)
                    result["bronze"] = bronze_result
                    result["analysisSummary"]["progress"] = 50

                    if bronze_result.get("incremental_load", {}).get("enabled"):
                        watermark = bronze_result["incremental_load"].get("watermark_column", "timestamp")
                        _emit_progress("bronze", "Bronze configuration complete",
                                      finding={"type": "recommendation", "text": f"Incremental load using '{watermark}'", "icon": "clock"})

                    _emit_progress("silver", "Analyzing Silver layer with GPT...",
                                  detail="Configuring data cleansing rules")

                    silver_result = assistant.analyze_silver_config(df, table_name, bronze_metadata=bronze_result)
                    result["silver"] = silver_result
                    result["analysisSummary"]["progress"] = 75

                    if silver_result.get("primary_key", {}).get("columns"):
                        _emit_progress("silver", "Silver configuration complete",
                                      finding={"type": "recommendation", "text": f"PK: {', '.join(silver_result['primary_key']['columns'][:2])}", "icon": "key"})

                    _emit_progress("gold", "Analyzing Gold layer with GPT...",
                                  detail="Building analytics configuration")

                    gold_result = assistant.analyze_gold_config(df, table_name, business_context)
                    result["gold"] = gold_result
                    result["analysisSummary"]["progress"] = 100

                    result["success"] = True
                    result["analysisSummary"]["status"] = "completed"
                    events.append({"stage": "fallback", "status": "openai_used", "timestamp": datetime.now().isoformat()})

                    _emit_progress("gold", "Analysis complete (via fallback)!",
                                  finding={"type": "info", "text": "All configurations ready using GPT", "icon": "sparkles"})
                else:
                    raise  # Re-raise if no fallback available
            else:
                raise  # Re-raise if not an Anthropic-specific error

    except Exception as e:
        print(f"[ERROR] All providers failed: {str(e)}", file=sys.stderr)
        result["success"] = False
        result["analysisSummary"]["status"] = "failed"
        result["analysisSummary"]["error"] = str(e)
        events.append({"stage": "error", "message": str(e), "timestamp": datetime.now().isoformat()})

        _emit_progress("gold", "Analysis failed",
                      finding={"type": "warning", "text": f"Error: {str(e)[:100]}", "icon": "sparkles"})

    result["analysisSummary"]["events"] = events
    result["providerUsed"] = provider_used or "unknown"

    return result
