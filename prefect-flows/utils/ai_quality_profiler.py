"""
AI Quality Profiler - Analyzes Bronze layer data and suggests quality rules
Uses Anthropic Claude to intelligently detect data quality issues and recommend validation rules
"""

import os
import json
from typing import Dict, List, Any, Optional
import polars as pl
import anthropic
from prefect import get_run_logger


class AIQualityProfiler:
    """AI-powered data quality profiler that suggests validation rules"""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize AI profiler with Anthropic API key"""
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
        self.client = anthropic.Anthropic(api_key=self.api_key)

    def profile_dataframe(
        self,
        df: pl.DataFrame,
        table_name: str,
        sample_size: int = 100
    ) -> Dict[str, Any]:
        """
        Analyze a Polars DataFrame and generate quality rule suggestions

        Args:
            df: Polars DataFrame to analyze
            table_name: Name of the table/dataset
            sample_size: Number of rows to sample for AI analysis

        Returns:
            Dictionary with quality profile and AI suggestions
        """
        logger = get_run_logger()
        logger.info(f"Profiling DataFrame: {table_name} ({len(df)} rows, {len(df.columns)} columns)")

        # Step 1: Generate statistical profile
        profile = self._generate_statistical_profile(df)

        # Step 2: Sample data for AI analysis
        sample_data = self._sample_dataframe(df, sample_size)

        # Step 3: Get AI suggestions
        ai_suggestions = self._get_ai_suggestions(
            table_name=table_name,
            profile=profile,
            sample_data=sample_data
        )

        return {
            "table_name": table_name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "profile": profile,
            "ai_suggestions": ai_suggestions
        }

    def _generate_statistical_profile(self, df: pl.DataFrame) -> Dict[str, Any]:
        """Generate statistical profile for each column"""
        profile = {}

        for col in df.columns:
            col_data = df[col]
            col_type = str(col_data.dtype)

            null_cnt = col_data.is_null().sum()
            stats = {
                "data_type": col_type,
                "null_count": null_cnt,
                "null_percentage": round((null_cnt / len(df)) * 100, 2),
                "unique_count": col_data.n_unique(),
                "unique_percentage": round((col_data.n_unique() / len(df)) * 100, 2)
            }

            # Type-specific statistics
            if col_type in ["Int64", "Int32", "Int16", "Int8", "Float64", "Float32"]:
                # Numeric statistics
                stats.update({
                    "min": float(col_data.min()) if col_data.min() is not None else None,
                    "max": float(col_data.max()) if col_data.max() is not None else None,
                    "mean": float(col_data.mean()) if col_data.mean() is not None else None,
                    "median": float(col_data.median()) if col_data.median() is not None else None,
                    "std_dev": float(col_data.std()) if col_data.std() is not None else None
                })

                # Detect outliers (values beyond 3 standard deviations)
                if stats["mean"] and stats["std_dev"]:
                    lower_bound = stats["mean"] - (3 * stats["std_dev"])
                    upper_bound = stats["mean"] + (3 * stats["std_dev"])
                    outlier_count = col_data.filter(
                        (col_data < lower_bound) | (col_data > upper_bound)
                    ).len()
                    stats["outlier_count"] = outlier_count
                    stats["outlier_percentage"] = round((outlier_count / len(df)) * 100, 2)

            elif col_type == "Utf8":
                # String statistics
                stats.update({
                    "min_length": int(col_data.str.lengths().min()) if col_data.str.lengths().min() is not None else None,
                    "max_length": int(col_data.str.lengths().max()) if col_data.str.lengths().max() is not None else None,
                    "avg_length": round(float(col_data.str.lengths().mean()), 2) if col_data.str.lengths().mean() is not None else None
                })

                # Sample unique values (for enum detection)
                unique_values = col_data.unique().to_list()[:20]  # First 20 unique values
                stats["sample_values"] = [str(v) for v in unique_values if v is not None]

            profile[col] = stats

        return profile

    def _sample_dataframe(self, df: pl.DataFrame, sample_size: int) -> List[Dict[str, Any]]:
        """Sample rows from DataFrame for AI analysis"""
        # Take stratified sample (first N rows + random sample)
        head_sample = df.head(min(50, sample_size // 2))
        random_sample = df.sample(min(sample_size // 2, len(df)))

        combined = pl.concat([head_sample, random_sample]).unique()
        combined = combined.head(sample_size)

        # Convert to list of dicts
        return combined.to_dicts()

    def _get_ai_suggestions(
        self,
        table_name: str,
        profile: Dict[str, Any],
        sample_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Use Anthropic Claude to analyze profile and suggest quality rules"""
        logger = get_run_logger()

        # Prepare prompt for the model
        prompt = self._build_ai_prompt(table_name, profile, sample_data)

        try:
            logger.info("Calling Anthropic Claude for quality rule suggestions...")

            message = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Parse AI response
            response_text = message.content[0].text if message.content else ""
            logger.info(f"AI response received ({len(response_text)} chars)")

            # Extract JSON from response
            suggestions = self._parse_ai_response(response_text)

            return suggestions

        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            return {
                "quality_rules": [],
                "primary_key_recommendation": None,
                "join_key_recommendations": [],
                "error": str(e)
            }

    def _build_ai_prompt(
        self,
        table_name: str,
        profile: Dict[str, Any],
        sample_data: List[Dict[str, Any]]
    ) -> str:
        """Build prompt for the model"""
        prompt = f"""You are a data quality expert analyzing a dataset called "{table_name}".
Based on the statistical profile and sample data provided, suggest data quality validation rules.

**Statistical Profile:**
```json
{json.dumps(profile, indent=2)}
```

**Sample Data (first {len(sample_data)} rows):**
```json
{json.dumps(sample_data[:10], indent=2, default=str)}
```

**Your Task:**
Analyze this data and provide quality rule suggestions in the following JSON format:

```json
{{
  "quality_rules": [
    {{
      "rule_id": "unique_rule_id",
      "rule_name": "descriptive_name",
      "column": "column_name",
      "rule_type": "not_null|unique|range|pattern|enum|custom",
      "parameters": {{
        "min": null,
        "max": null,
        "pattern": null,
        "allowed_values": null,
        "custom_sql": null
      }},
      "confidence": 95,
      "current_compliance": "95% of records pass",
      "reasoning": "Why this rule is needed",
      "severity": "error|warning|info"
    }}
  ],
  "primary_key_recommendation": {{
    "column": "column_name or null",
    "confidence": 98,
    "reasoning": "Why this should be primary key"
  }},
  "join_key_recommendations": [
    {{
      "column": "column_name",
      "confidence": 90,
      "reasoning": "Likely foreign key to another table"
    }}
  ],
  "overall_quality_score": 87,
  "summary": "Brief summary of data quality"
}}
```

**Important Guidelines:**
1. **Detect common issues:** null values, duplicates, outliers, format inconsistencies, enum violations
2. **Be specific:** Provide exact patterns, ranges, and allowed values
3. **Calculate confidence:** Based on current data compliance (0-100%)
4. **Prioritize:** Use severity (error, warning, info)
5. **Explain:** Provide clear reasoning for each suggestion
6. **Identify keys:** Suggest primary keys (unique, non-null) and foreign keys

**Rule Types:**
- **not_null**: Column should not have NULL values
- **unique**: Column values should be unique
- **range**: Numeric values within min/max
- **pattern**: String matches regex pattern (e.g., email, phone)
- **enum**: Value must be in allowed list
- **custom**: Custom SQL validation expression

Return ONLY the JSON response, no additional text.
"""
        return prompt

    def _parse_ai_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response and extract JSON"""
        # Try to find JSON in response
        try:
            # Find JSON block
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1

            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON found in response")

            json_text = response_text[start_idx:end_idx]
            suggestions = json.loads(json_text)

            return suggestions

        except json.JSONDecodeError as e:
            # Fallback: return empty structure
            return {
                "quality_rules": [],
                "primary_key_recommendation": None,
                "join_key_recommendations": [],
                "overall_quality_score": 0,
                "summary": f"Failed to parse AI response: {str(e)}"
            }


def profile_bronze_dataset(
    df: pl.DataFrame,
    table_name: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to profile a Bronze layer dataset

    Args:
        df: Polars DataFrame
        table_name: Name of the dataset
    api_key: Optional OpenAI API key

    Returns:
        Quality profile with AI suggestions
    """
    profiler = AIQualityProfiler(api_key=api_key, model=model)
    return profiler.profile_dataframe(df, table_name)
