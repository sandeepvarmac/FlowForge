Great, this is the right place to start: Source → Landing → Bronze as “the ingest job”.

I’ll walk through it in two layers:

Scenario families – the different real-world patterns you need to handle.

What the user must provide – a structured checklist of fields/questions, with branches per scenario and per dataset type (fact/dim/reference/etc.).

1. Scenario families for Source → Landing → Bronze
Think of each ingest job as: “From this source, create/maintain this bronze dataset.”
Every real-world case tends to fall into one of these families (or a combination):

1.1 Batch file–based ingest
Source is files in:

External object storage (S3/ADLS/GCS).

Internal landing bucket.

Direct uploads via UI.

On-prem/share path (mounted).

Sub-scenarios:

Simple append

New file per run (e.g., orders_2025-01-01.csv) gets appended to bronze fact table.

Partitioned append

Files are partitioned by date/region. You append into the matching bronze partition.

Snapshot / full refresh

Each file is a full dump (“replace bronze each run”).

Corrections/overwrites

File represents an overwrite for a specific partition (e.g., “rebuild 2025-01-05 only”).

Multi-tenant / multi-entity

One file contains data for multiple tenants or logical entities; you might split in bronze using a tenant/segment column.

1.2 Database table / query ingest
Source is a relational database:

OLTP system (e.g., order DB).

SaaS DB/warehouse (Snowflake, Redshift, etc.).

Materialized views.

Sub-scenarios:

Full table snapshot

Entire table (or view) copied on each run.

Incremental by timestamp high-watermark

updated_at / last_modified column.

Incremental by monotonically increasing key

id, sequence_id (numeric or lexicographic).

CDC-like table

A change table with op_type (I/U/D) and change timestamps.

1.3 API / SaaS ingest
Source is a REST/GraphQL-style API, often SaaS:

Salesforce, HubSpot, Jira, etc.

Internal microservice APIs.

Sub-scenarios:

Full snapshot API

Retrieve all records each run (pages through entire dataset).

Incremental API using time or cursor

Parameter: updated_since or since_id, or server-side cursor token.

Pagination on top.

Hierarchical/nested JSON

Need to flatten into tabular bronze schema.

1.4 Log/event-style ingest (batch flavor)
You might not do streaming yet, but you can still batch ingest logs:

App logs, clickstreams, audit logs in files.

Object storage “drop” of JSON/NDJSON events.

Sub-scenarios:

Append-only event log

Only inserts; massive volume, heavily partitioned by time.

Corrected/late events

Events arrive late but still need to be included in historical partitions.

1.5 Semantic dataset types (fact/dim/etc.)
Across all of the above source types, each ingest job is building one of these dataset roles:

Fact – transaction / event grain (e.g., order_line, payment, page_view).

Dimension – descriptive attributes keyed by an ID (e.g., customer, product).

Reference dataset – small, mostly static lists (e.g., country codes, status codes).

Master data – “golden record” entity sources (often treated similarly to dims).

Snapshot – periodic “point-in-time” dumps (e.g., daily account balance snapshot).

Event/log – append-only high-volume event streams (could be treated as fact, but worth calling out).

Those roles don’t change the mechanics of reading from the source, but they heavily influence:

Required keys.

Incremental vs full behavior.

Deduping and schema expectations.

How bronze will be used downstream.

2. What information should the user provide? (End-to-end checklist)
When they create an ingest job, your UI/API is effectively asking:

“Tell me everything I need to reliably keep this bronze dataset in sync with that source.”

Below is a structured list of what you can (reasonably) ask users to provide, grouped into sections. Scenario-specific fields are noted where they differ.

2.1 Dataset identity & semantics (applies to all scenarios)
Purpose: Describe what this dataset is and how it behaves, not just where it comes from.

Dataset name & description

Display name (e.g., orders_fact).

Human description (“One row per order line from OMS”).

Dataset role / type

fact | dimension | reference | master | snapshot | event_log | other.

Grain (natural key / uniqueness)

“What uniquely identifies a row at the source?”

Fact: order_id + line_number.

Dimension: customer_id.

Event: event_id or (user_id, event_ts, event_type).

Business keys vs technical keys

Optional: difference between natural key and surrogate key if you care later in silver/gold.

Expected change pattern

append_only (facts/events),

upserts (dims/master),

full_snapshot (complete replace each run),

append_with_corrections (facts with late updates/deletes).

Intended freshness / cadence

How often it should run: hourly | daily | on_demand | other.

This will matter for scheduling later but is good to capture with ingest.

2.2 Source connectivity & access
This is what you already mostly have, but I’ll lay it out scenario-wise.

2.2.1 File-based sources
User provides:

Source location type

upload | s3 | local | other object store.

Path / pattern

For object storage: bucket + prefix or URI pattern (s3://bucket/path/prefix*).

For upload: how you store file handles internally.

For local: mounted path or directory.

File format

csv | json | parquet | (optionally) ndjson.

CSV options (if relevant)

Delimiter, header row, quote char, encoding.

Compression

none | gzip | snappy.

File naming semantics (optional but very useful)

Do filenames encode date/partition?

e.g., orders_YYYYMMDD.csv.

Regex or pattern for parsing metadata from filename.

2.2.2 Database sources
User provides:

Connection

connection_id referencing a secure connection config.

Extraction mode

table vs custom_query.

Table name / view (if table mode).

SQL query (if query mode).

Optional filters

If they want to limit to a subset (e.g., region, tenant).

2.2.3 API sources
User provides:

Endpoint info

URL, HTTP method.

Auth

Type: none | basic | bearer | api_key.

Reference to credentials (ID), not raw secret.

Request details

Headers, body template, query parameters.

Pagination config

page_param, page_size, next_token_path (cursor), or other vendor-specific pattern.

Response format

JSON path to the array of records (data.items, etc.).

2.3 Ingest mode & incremental semantics
This is cross-cutting across files, DB, and APIs.

Ingestion mode

full_load (replace, or append-full),

incremental,

cdc (if you support change logs explicitly).

Incremental strategy (if incremental)

The user chooses one of:

Timestamp watermark

watermark_column (at source): e.g., updated_at.

Numeric / lexicographic key watermark

watermark_column: e.g., id, sequence_id.

API-specific cursor

Cursor param or token; for APIs this is mostly in the API config, but conceptually the same.

You already model this with incremental_mode, watermark_column, last_watermark_value.

Initial load behavior

From when do we start?

“All history” (default).

“From date X” (e.g., 2023-01-01).

“From the current max at first run” (bootstrap without history).

Delete / correction handling

Does the source signal deletes?

If yes: which column(s) indicate delete? (is_deleted, op_type).

Should delete events be:

Propagated as tombstones in bronze,

Ignored,

Quarantined?

Re-run & idempotency behavior (this influences bronze write semantics)

For a given run (e.g., date), re-running:

Overwrites that partition entirely,

Or merges/upserts at the bronze level based on dedupe_keys.

2.4 Landing configuration
Landing = raw copy of what came in, usually for replay/compliance.

User provides (or you default intelligently):

Landing location / prefix

Where raw files land (bucket + path).

Landing format

Typically preserve as-is (no change), but if you always re-save as something else (e.g., compressed), capture that.

Landing file naming pattern

You already have filename_pattern like {timestamp}_{filename} – good.

Might also take optional placeholders: {run_id}, {partition}, {source_file_name}.

Retention policy

landing_retention_days – you already have this.

Optionally: “never delete” flag for highly regulated sources.

Versioning behavior

If the same source file name appears again:

Keep multiple versions.

Overwrite.

Quarantine as suspicious.

2.5 Bronze configuration (canonicalized raw)
This is where you normalize raw to a queryable, consistent table.

Bronze storage format

You’re standardizing to parquet (great); user can optionally override.

Partitioning

Partition mode:

date, column, none.

If date:

Which column represents the date? (event_date, updated_at, or ingestion time if none).

Pattern (e.g., yyyy/MM/dd).

If column:

Column name(s).

Optional pattern (e.g., hierarchical country/city).

Compression

snappy | gzip | none (you already have this).

Schema handling

Schema mode:

infer vs user.

If user:

The list of columns (name, type, nullable).

Schema evolution policy (this is the one gap I’d add):

What to do with:

New columns.

Missing columns.

Type changes.

e.g., strict | additive_only | permissive.

Column rename / standardization

rename_map: original -> standardized (you have this).

Deduplication

dedupe_keys: which columns define duplicates.

If there are duplicates:

Keep latest by watermark column,

Keep earliest,

Quarantine.

Error handling

error_handling = fail | quarantine (you have this).

Quarantine location/path (if applicable).

Optional: thresholds:

“Fail if > X% records are bad.”

Output location

Bronze dataset path.

Optional separate path for different tenants/regions if needed.

2.6 Governance & classification (lightweight but important at ingest)
Even for just Source → Landing → Bronze, there are a few fields you should eventually ask for:

Owner / steward

Team/Person responsible for this dataset.

Data domain

e.g., Sales, Marketing, Finance, Core Platform.

Data classification

public | internal | confidential | PII | PHI | other.

Usage flags / restrictions

“Can this be used for ML model training?” yes/no.

“Contains PII that must be masked in downstream layers?” yes/no.

These don’t change ingestion mechanics, but they’re essential for an enterprise platform and influence what AI workloads you’re allowed to run later.

3. Bringing it together
If I compress everything into a single mental model:

Every ingest job should capture:

What the dataset is (semantics: fact/dim/ref, grain, change pattern).

Where it comes from (source connection & location).

How it changes over time (incremental vs full, watermarking, deletes).

How we want to store it (landing & bronze layout: format, partitioning, compression).

How we want to treat schema & errors (schema mode, evolution policy, dedupe, quarantine).

Who owns it and how sensitive it is (governance).

Your existing spec already covers a big slice of this (especially the “where” and “bronze layout”). The main additions I’d suggest at the ingest job level, to be truly end-to-end, are:

Semantic dataset type (fact | dimension | reference | snapshot | event_log | master).

Grain/keys and change pattern (append vs upsert vs snapshot).

Slightly richer schema evolution options (beyond just schema_mode).

Lightweight governance fields (owner, classification, ML-usage flag).