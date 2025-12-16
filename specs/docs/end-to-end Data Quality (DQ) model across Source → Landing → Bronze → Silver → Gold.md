I’ll treat this as designing an end-to-end Data Quality (DQ) model across Source → Landing → Bronze → Silver → Gold, including:

All the types of DQ checks (rule-based and AI-powered).

Where they apply in the pipeline.

What actions to take on failures (quarantine, fix, fail, warn, etc.).

How users configure this as part of ingest & dataset jobs.

1. Mental model: DQ as “gates + fixes” at each layer
Think in terms of gates at each hop:

Source → Landing

Goal: capture raw data faithfully.

DQ here is mostly: “Did we receive what we expected?”

Detect, rarely mutate.

Landing → Bronze (Ingest job)

Goal: get technically clean, schema-conformant data.

DQ: schema/format/structural checks.

Safe fixes + quarantine.

Bronze → Silver (First dataset jobs)

Goal: business clean, conformed data.

DQ: business rules, referential integrity, dedupe, SCD logic, etc.

Heavy remediation happens here.

Silver → Gold (Second dataset jobs)

Goal: fit-for-purpose products (metrics, ML sets, RAG corpora).

DQ: metric sanity, aggregates, SLA, anomalies.

Typically: no hidden fixes, mostly enforce and fail/flag.

Each gate can:

Detect: measure/flag problems.

Decide: based on severity, choose action.

Act: fail/quarantine/fix/ignore/alert.

2. Types of Data Quality checks
Across all layers, you need support for:

2.1 Structural / technical checks
Schema conformance (columns present, types correct).

Nullability (columns that must not be null).

Format patterns (email, phone, iso_date, JSON validity).

Value ranges (0 <= amount <= 1e9).

Uniqueness of keys.

Referential integrity (FKs: order.customer_id exists in customer_dim).

Where:

Strongest at Landing→Bronze, Bronze→Silver.

Re-asserted at Gold for critical tables.

2.2 Business rule checks
Allowed values (e.g., status in ('NEW','PAID','CANCELLED')).

Cross-field logic (e.g., shipped_at >= order_date).

Domain rules (e.g., amount > 0 for non-refund orders).

Logical consistency (e.g., country_code consistent with currency).

Where:

Mostly Bronze→Silver (core business cleaning).

Additional, stricter rules at Silver→Gold.

2.3 Statistical / distributional checks
Row count vs historical (sudden drop/spike).

Distribution drift (e.g., country_code mix, status proportions).

Metric drift (avg order value, click-through rates, etc.).

Outlier detection on numeric fields.

Where:

Bronze→Silver & Silver→Gold (where aggregates make sense).

Gold for metrics tables & ML datasets.

2.4 Cross-system & cross-layer reconciliation
Source vs Landing row counts / totals.

Bronze vs Silver (are we dropping more than expected?).

Warehouse vs external system-of-record for key metrics.

Where:

Immediately after ingest, and as periodic Gold-level checks.

2.5 AI-powered / ML-driven checks
Some examples:

Anomaly detection on metrics and distributions

Learn time-series behavior (e.g., revenue per day, row counts per day) and flag anomalies.

Embedding-based outlier detection

For text or high-dimensional features, embeddings + clustering to find weird records.

LLM-powered semantic validation

Validate free-text fields:

Detect obviously garbage text.

Spot misclassified categories from description text.

Identify sensitive info (unexpected PII/PHI) in wrong places.

Automatic rule suggestion

AI looks at data & metadata and proposes rules:

“Column country_code is almost always 2 uppercase letters; define a pattern rule?”

“order_status is usually from this set; define allowed values?”

Automatic remediation recommendations

AI suggests fix strategies:

Map common misspellings/synonyms (usa, US, United States).

Propose default values when safe (e.g., missing middle name).

Propose imputation strategies for numeric fields.

These are usually assistive (suggest + explain) but can also be configured to run automatically with guardrails.

3. DQ configuration: what users can define per job
For each ingest job and dataset job, you can model DQ as a set of rules with:

scope: ingest / bronze / silver / gold / dataset.

target: column(s), table, metric, or partition.

check_type: structural | business | statistical | AI.

condition: expression/model (SQL, DSL, or AI configuration).

severity: info | warning | error | critical.

action_on_violation: what to do if it fails (see next section).

auto_fix: optional transformation to apply when allowed.

notification: who/where to alert.

Example (conceptually):

- name: country_code_valid
  scope: bronze_to_silver
  target: column: country_code
  check_type: business
  condition: "country_code ~ '^[A-Z]{2}$'"
  severity: error
  action_on_violation: quarantine_row
  quarantine_dataset: bronze.country_code_invalid
4. Actions when DQ issues occur (per layer)
Here’s the key part you asked: quarantine vs fix vs fail vs let it pass.

4.1 Canonical actions
Across all layers, you should support:

Fail job (hard stop)

Job fails, pipeline may fail.

Used for critical issues: schema mismatch, core key constraints, major metric anomalies.

Quarantine

Problematic rows (or files) are moved to a quarantine dataset/path.

“Good” rows continue forward.

Quarantine includes reason & rule that was violated.

Auto-fix & continue

Apply a deterministic fix:

Trim whitespace, cast types, standardize case.

Map common invalid values to canonical ones (N/A, UNKNOWN).

Impute with configured defaults.

Still log the fix for audit.

Warn & continue

Log violation, raise an alert, but do not block or change data.

Typically for low-severity anomalies.

Rollback / revert

For Gold datasets, prefer to:

Keep previous “good” version,

Mark the new run as failed,

So consumers don’t see degraded data.

Defer fix to next layer

Sometimes chosen intentionally:

At ingest, just capture and standardize;

Real business corrections in Silver.

4.2 Recommended policy by layer
4.2.1 Source → Landing
Goal: Do not lose fidelity. Landing is your raw truth.

Checks:

File presence, basic size, basic row counts if available.

Optional: simple header/schema checks.

Actions:

Never mutate data (no auto-fixes).

If a whole file is corrupt/unreadable:

Move file to a “source_quarantine” bucket and fail the ingest job.

Track counts for reconciliation:

“N files expected, M received; X invalid.”

Summary: Mostly detect + quarantine at file level, not row-level; no corrections.

4.2.2 Landing → Bronze (Ingest job)
Goal: Technically clean, queryable, standardized structure.

Checks:

Schema/type conformance.

Required columns present.

Parsing & casting (dates, numbers).

Basic range checks and format checks.

Deduplication keys (to avoid exact duplicates).

Actions:

Quarantine bad rows:

Rows that fail parsing/type/format go to bronze_quarantine with error metadata.

Auto-fix low-risk issues:

Trim strings, normalize case, convert common date formats.

Use default values where safe and documented.

Fail on structural disasters:

e.g., schema completely wrong, 90%+ rows invalid.

Summary: Fix where safe + quarantine bad rows. Only fail for severe structural issues.

4.2.3 Bronze → Silver (First dataset jobs)
Goal: Business-clean, conformed, “trusted raw”.

Checks:

Business rules (valid status combinations, date logic).

Referential integrity vs dimensions / reference datasets.

Deduplication rules at business-grain (e.g., one active customer per email).

Distribution checks and anomaly detection.

AI checks on text (e.g., detect obviously garbage descriptions).

Actions:

Auto-fix where rules are “canonicalization”:

Map synonyms/aliases.

Normalize currencies, units.

Interpret known invalid representations (NULL, ?, blanks).

Quarantine or mark rows that violate business constraints:

E.g., order_total < 0 → quarantine / mark as invalid.

Fail job for contract violations:

If dataset-level constraints are broken:

e.g., duplicate keys above threshold, too many missing FKs, etc.

Summary: This is the main place to fix data. You still quarantine & alert for ambiguous cases. Severe contract violations => fail.

4.2.4 Silver → Gold (Second dataset jobs)
Goal: Highly trusted, consumer-ready artifacts.

Checks:

Metric-level sanity (no negative revenue, ratio changes within expected ranges).

Time-series anomaly detection (AI-based).

DQ for training sets (no label leakage, correct balance).

DQ for vector sets (no empty chunks, minimal junk text, correct metadata).

Aggregation vs Silver for reconciliation.

Actions:

Do NOT silently fix critical issues:

If a metric is wildly off, better to fail or use last good version.

Fail the job or mark as “unpublished” if:

Core metric integrity is compromised.

Roll back to last good version:

Keep yesterday’s Gold table serving if today’s run fails.

Quarantine suspect partitions (e.g., today’s partition) while leaving older partitions intact.

Summary: Gold is where you enforce and protect trust. Minimal hidden fixes; prefer fail + roll back + alert.

5. AI-powered DQ in practice (how it fits in)
You can layer AI into each stage as:

5.1 Suggestion / design-time AI
When user is defining ingest or dataset jobs:

AI inspects sample data and:

Proposes schema.

Suggests uniqueness constraints, not-null fields.

Suggests business rules (“status mostly from {A,B,C}”).

Suggests DQ thresholds (“row count usually 100k–200k per day”).

Helps generate:

Great-Expectations-like tests.

Recommended quarantine policies.

5.2 Runtime AI checks
At run time:

Time-series anomaly detection on:

Row counts, metric values, distributions.

Semantic anomaly detection in text:

Unexpected language, profanity, PII leaks.

Non-informative “garbage” text in RAG corpora.

Workflow:

Collect metrics and samples during job run.

Feed to AI model.

If flagged:

Apply configured action: warn/quarantine/fail.

Attach an AI-generated explanation to the incident.

5.3 AI-assisted remediation
When issues occur:

AI suggests or even applies:

Mapping rules (free-text mapping into known categories).

Standardization patterns.

Suggested filters for Gold (e.g., “exclude obvious bot traffic”).

You can keep these as “auto_fix actions attached to rules” with strong audit trails.

6. End-to-end view: putting it into the platform
To make this concrete for your platform:

Every ingest / dataset job gets an optional data_quality section with:

Rules (structured or SQL / DSL).

Severity & actions.

Optional AI-check configs.

Each layer has default policies:

Landing: detect + file quarantine.

Bronze: schema & type enforcement; safe fixes; row-level quarantine.

Silver: business rules & canonicalization; heavy remediation; fail on contract violation.

Gold: metric & SLA enforcement; minimal auto-fix; fail or rollback on serious issues.

DQ incidents:

Stored centrally with:

Which job + dataset + run.

Which rule was violated.

What was done (quarantine/fix/fail).

Counts, samples, AI explanations.

Show up in UI and observability dashboards.

User knobs:

They can tune:

Thresholds (e.g., 1% vs 10% bad rows).

When to quarantine vs fail.

What AI checks to enable.

Where automatic fixes are allowed.