# FlowForge - Intelligent Document Processing (IDP) Implementation Plan

**Document Version:** 1.0
**Created:** October 21, 2025
**Status:** Planning Phase
**Priority:** Phase 3 Feature (Post-MVP)
**Effort Estimate:** 12-16 weeks (phased rollout)

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Case](#business-case)
3. [Technical Architecture](#technical-architecture)
4. [Implementation Phases](#implementation-phases)
5. [API Design](#api-design)
6. [Database Schema](#database-schema)
7. [UI/UX Design](#uiux-design)
8. [Integration Points](#integration-points)
9. [Security & Compliance](#security--compliance)
10. [Cost Analysis](#cost-analysis)
11. [Success Metrics](#success-metrics)
12. [Risks & Mitigations](#risks--mitigations)

---

## 🎯 Executive Summary

### What is IDP?

Intelligent Document Processing (IDP) is an **optional add-on module** for FlowForge that enables automated extraction of structured data from unstructured documents (PDFs, images, scanned files). It uses AI vision models to extract text, tables, and key-value pairs, then feeds this data into FlowForge's standard Bronze → Silver → Gold pipeline.

### Strategic Positioning

- **NOT a replacement** for specialized IDP tools (UiPath, Automation Anywhere)
- **IS a complementary capability** for document-heavy data workflows
- **Target customers:** Organizations processing invoices, purchase orders, contracts, forms, claims, or receipts as part of their data pipelines
- **Differentiator:** Vendor-neutral, integrated with orchestration, works with any cloud/on-prem

### Key Benefits

| Benefit | Description | Impact |
|---------|-------------|--------|
| **10x Faster Setup** | Pre-built templates vs custom code | 3 days → 3 hours |
| **92% Cost Reduction** | Automated extraction vs manual entry | $174K/year → $12K/year (invoice example) |
| **Vendor Neutral** | Customer chooses AI provider (OpenAI, Claude, Azure, Google) | No lock-in |
| **Seamless Integration** | Documents → Bronze → Silver → Gold (one platform) | No tool sprawl |
| **AI-Powered** | Smart field detection, confidence scoring | 95%+ accuracy |

### ROI Example: Invoice Processing

**Before (Manual):**
- 5,000 invoices/month × 5 min/invoice = 416 hours
- Annual cost: **$174,720**

**After (FlowForge IDP):**
- Automated extraction + review = 125 hours
- Annual cost: **$17,374** (includes $999/mo IDP module)
- **Savings: $157,346/year (90% reduction)**

---

## 💼 Business Case

### Market Opportunity

- **IDP Market Size:** $5.3B (2024) → $32.8B (2032) - CAGR 26%
- **Target Segments:**
  - Finance/Accounting (AP automation, invoice processing)
  - Healthcare (claims processing, medical records)
  - Supply Chain (POs, shipping docs, customs forms)
  - Legal (contract extraction, compliance docs)
  - HR (resume parsing, onboarding forms)

### Competitive Landscape

| Solution | Lock-in | Pricing | Integration | Our Advantage |
|----------|---------|---------|-------------|---------------|
| **Snowflake Document AI** | Snowflake only | $$$$ | Snowflake tables | Vendor-neutral, any database |
| **AWS Textract** | AWS | $$$ per page | Manual integration | Built-in orchestration |
| **Azure Form Recognizer** | Azure | $$$ per page | Manual integration | Cross-cloud support |
| **UiPath Document Understanding** | UiPath RPA | $$$$ per bot | RPA-first | Data pipeline native |
| **FlowForge IDP** | **None** | Transparent usage-based | Built-in workflow engine | Complete platform |

### Why FlowForge is Well-Positioned

1. ✅ **Existing AI capabilities:** Already using OpenAI for schema detection
2. ✅ **Pipeline architecture:** Bronze/Silver/Gold handles extracted data naturally
3. ✅ **Vendor-neutral DNA:** Core value proposition extends to IDP
4. ✅ **Enterprise customers:** Target market already processes documents
5. ✅ **Workflow integration:** Document triggers → downstream workflows (unique)

---

## 🏗️ Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FlowForge Platform                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    IDP Module (New)                          │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  1. Document Ingestion Service                              │  │
│  │     - PDF, PNG, JPG, TIFF upload                            │  │
│  │     - S3/MinIO storage (landing/documents/)                 │  │
│  │     - Multi-page document handling                          │  │
│  │     - Pre-processing (deskew, enhance, split)               │  │
│  │                                                              │  │
│  │  2. AI Vision Service (Vendor-Neutral)                      │  │
│  │     ├─ OpenAI GPT-4 Vision API                              │  │
│  │     ├─ Anthropic Claude 3 Vision API                        │  │
│  │     ├─ Azure Document Intelligence API                      │  │
│  │     └─ Google Document AI API                               │  │
│  │                                                              │  │
│  │  3. Extraction Engine                                       │  │
│  │     - Text extraction (OCR)                                 │  │
│  │     - Table detection and parsing                           │  │
│  │     - Key-value pair extraction                             │  │
│  │     - Template matching                                     │  │
│  │     - Confidence scoring                                    │  │
│  │                                                              │  │
│  │  4. Validation & Post-Processing                            │  │
│  │     - Field validation rules                                │  │
│  │     - Data type conversion                                  │  │
│  │     - Business rules application                            │  │
│  │     - Human-in-the-loop review queue                        │  │
│  │                                                              │  │
│  │  5. Template Management                                     │  │
│  │     - Pre-built templates (invoice, PO, receipt)            │  │
│  │     - Custom template builder (UI)                          │  │
│  │     - Template versioning                                   │  │
│  │     - Learning/improvement system                           │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Existing FlowForge Pipeline                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Bronze Layer  →  Silver Layer  →  Gold Layer                │  │
│  │  (Raw extract)    (Validated)      (Analytics-ready)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. Document Ingestion Service

**Responsibilities:**
- Accept PDF/Image uploads via web UI or API
- Store in MinIO: `s3://flowforge-data/landing/documents/{workflow_id}/{job_id}/{doc_id}.pdf`
- Multi-page document handling (split or process as single)
- Pre-processing:
  - Deskew images
  - Enhance contrast
  - Remove noise
  - Split multi-page PDFs

**Technology Stack:**
- **PDF Processing:** PyPDF2, pdfplumber, pdf2image
- **Image Processing:** Pillow, OpenCV
- **Storage:** MinIO S3-compatible API

**API Endpoint:**
```typescript
POST /api/workflows/:workflowId/jobs/:jobId/documents/upload
Content-Type: multipart/form-data

Response:
{
  documentId: "doc_abc123",
  fileName: "invoice_2024_001.pdf",
  pageCount: 3,
  fileSizeBytes: 245890,
  s3Key: "landing/documents/workflow_xyz/job_abc/doc_abc123.pdf",
  status: "uploaded",
  createdAt: "2025-10-21T10:30:00Z"
}
```

#### 2. AI Vision Service (Vendor-Neutral)

**Responsibilities:**
- Provide unified interface to multiple AI providers
- Route requests based on customer configuration
- Handle API authentication, rate limiting, retries
- Cache results to minimize API costs

**Supported Providers:**

| Provider | Model | Best For | Cost per Document |
|----------|-------|----------|-------------------|
| **OpenAI** | GPT-4 Vision | General documents, invoices | $0.10-0.30 |
| **Anthropic** | Claude 3 Opus Vision | Complex tables, contracts | $0.15-0.40 |
| **Azure** | Document Intelligence | Enterprise compliance | $0.05-0.20 |
| **Google** | Document AI | Forms, receipts | $0.10-0.25 |

**Service Interface:**
```typescript
interface AIVisionService {
  extractDocument(
    documentId: string,
    provider: 'openai' | 'claude' | 'azure' | 'google',
    template: DocumentTemplate,
    options?: ExtractionOptions
  ): Promise<ExtractionResult>
}

interface ExtractionResult {
  documentId: string
  rawText: string
  tables: Table[]
  fields: ExtractedField[]
  confidence: number  // 0-1
  processingTimeMs: number
  tokensUsed: number
  cost: number
}

interface ExtractedField {
  name: string
  value: string
  type: 'string' | 'number' | 'date' | 'currency' | 'email' | 'phone'
  confidence: number
  boundingBox?: BoundingBox
}
```

**Implementation:**
```typescript
// apps/web/src/lib/services/ai-vision-service.ts

export class AIVisionService {
  async extractDocument(
    documentId: string,
    provider: AIProvider,
    template: DocumentTemplate
  ): Promise<ExtractionResult> {
    const document = await this.getDocument(documentId)

    // Route to appropriate provider
    switch (provider) {
      case 'openai':
        return this.extractWithOpenAI(document, template)
      case 'claude':
        return this.extractWithClaude(document, template)
      case 'azure':
        return this.extractWithAzure(document, template)
      case 'google':
        return this.extractWithGoogle(document, template)
    }
  }

  private async extractWithOpenAI(
    document: Document,
    template: DocumentTemplate
  ): Promise<ExtractionResult> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = this.buildExtractionPrompt(template)

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: await this.getDocumentDataUrl(document)
              }
            }
          ]
        }
      ],
      max_tokens: 4096
    })

    return this.parseOpenAIResponse(response, template)
  }

  private buildExtractionPrompt(template: DocumentTemplate): string {
    return `
You are extracting structured data from a document.

Document Type: ${template.name}
Expected Fields:
${template.fields.map(f => `- ${f.name} (${f.type}): ${f.description}`).join('\n')}

Instructions:
1. Extract all requested fields from the document
2. Return data as JSON with exact field names
3. Include confidence score for each field (0-1)
4. If a field is not found, return null for value and 0 for confidence

Output format:
{
  "fields": [
    {"name": "invoice_number", "value": "INV-2024-001", "confidence": 0.95},
    {"name": "invoice_date", "value": "2024-10-21", "confidence": 0.90},
    ...
  ],
  "tables": [...],
  "overall_confidence": 0.92
}
    `
  }
}
```

#### 3. Extraction Engine

**Responsibilities:**
- Coordinate AI vision API calls
- Apply template matching
- Parse AI responses into structured data
- Calculate confidence scores
- Detect tables and structure

**Core Functions:**

```typescript
// Text Extraction
async extractText(documentId: string): Promise<string>

// Table Detection
async detectTables(documentId: string): Promise<Table[]>

// Key-Value Pair Extraction
async extractKeyValuePairs(
  documentId: string,
  template: DocumentTemplate
): Promise<Map<string, any>>

// Template Matching
async matchTemplate(
  documentId: string,
  templates: DocumentTemplate[]
): Promise<{ template: DocumentTemplate, confidence: number }>

// Confidence Scoring
calculateFieldConfidence(
  field: ExtractedField,
  validationRules: ValidationRule[]
): number
```

#### 4. Validation & Post-Processing

**Responsibilities:**
- Apply field validation rules
- Convert data types (string → date, number, currency)
- Apply business rules
- Route to human review if confidence < threshold

**Validation Rules:**
```typescript
interface ValidationRule {
  field: string
  type: 'required' | 'format' | 'range' | 'custom'
  rule: string | RegExp | ((value: any) => boolean)
  errorMessage: string
}

// Example validation rules for invoice template
const invoiceValidationRules: ValidationRule[] = [
  {
    field: 'invoice_number',
    type: 'required',
    rule: /.+/,
    errorMessage: 'Invoice number is required'
  },
  {
    field: 'invoice_date',
    type: 'format',
    rule: /^\d{4}-\d{2}-\d{2}$/,
    errorMessage: 'Date must be in YYYY-MM-DD format'
  },
  {
    field: 'total_amount',
    type: 'range',
    rule: (value) => value > 0,
    errorMessage: 'Total amount must be positive'
  },
  {
    field: 'vendor_email',
    type: 'format',
    rule: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    errorMessage: 'Invalid email format'
  }
]
```

**Human-in-the-Loop Review Queue:**
```typescript
interface ReviewQueueItem {
  documentId: string
  extractionId: string
  reason: 'low_confidence' | 'validation_failed' | 'manual_review_requested'
  confidence: number
  extractedData: any
  validationErrors: string[]
  assignedTo?: string
  status: 'pending' | 'in_review' | 'approved' | 'rejected'
  reviewedAt?: Date
  reviewedBy?: string
  corrections?: any
}

// Automatically queue for review if confidence < 0.80
if (extractionResult.confidence < 0.80) {
  await reviewQueue.add({
    documentId,
    extractionId: result.id,
    reason: 'low_confidence',
    confidence: extractionResult.confidence,
    extractedData: extractionResult.fields
  })
}
```

#### 5. Template Management

**Pre-built Templates:**

1. **Invoice Template**
   - Fields: invoice_number, invoice_date, due_date, vendor_name, vendor_address, vendor_email, vendor_phone, line_items[], subtotal, tax, total, currency
   - Table extraction: Line items with description, quantity, unit_price, total
   - Common variations: Net 30, Net 60 payment terms

2. **Purchase Order Template**
   - Fields: po_number, po_date, vendor_name, shipping_address, billing_address, line_items[], subtotal, tax, total, currency, requested_delivery_date
   - Table extraction: Items with SKU, description, quantity, unit_price

3. **Receipt Template**
   - Fields: receipt_number, date, merchant_name, merchant_address, line_items[], subtotal, tax, tip, total, payment_method, card_last_four
   - Table extraction: Items with description, quantity, price

4. **Contract Template**
   - Fields: contract_number, effective_date, expiration_date, party_a, party_b, contract_value, payment_terms, key_clauses[]
   - Text extraction: Important sections (scope, terms, termination)

5. **Medical Claim Template**
   - Fields: claim_number, patient_name, patient_dob, provider_name, service_date, diagnosis_codes[], procedure_codes[], total_charge, insurance_paid, patient_responsibility
   - Compliance: HIPAA-compliant extraction

**Custom Template Builder (UI):**
```typescript
interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: 'invoice' | 'purchase_order' | 'receipt' | 'contract' | 'claim' | 'custom'
  version: number
  fields: TemplateField[]
  tables?: TableDefinition[]
  validationRules: ValidationRule[]
  aiProvider: 'openai' | 'claude' | 'azure' | 'google' | 'auto'
  confidenceThreshold: number  // 0-1, default 0.80
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

interface TemplateField {
  name: string
  label: string
  type: 'string' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'boolean'
  description: string
  required: boolean
  defaultValue?: any
  extractionHint?: string  // Hint for AI ("usually in top-right corner")
}

interface TableDefinition {
  name: string
  columns: TemplateField[]
  extractionHint?: string
}
```

---

## 📅 Implementation Phases

### Phase 1: Basic Document Extraction (Weeks 1-4)

**Goal:** MVP - Extract text and basic fields from documents

**Deliverables:**
- ✅ Document upload API
- ✅ OpenAI GPT-4 Vision integration
- ✅ Basic text extraction
- ✅ 3 pre-built templates (invoice, PO, receipt)
- ✅ Bronze layer integration (extracted data → Parquet)
- ✅ Simple UI: Upload document → View extracted data

**Database Schema:**
```sql
-- New tables
CREATE TABLE document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  fields TEXT NOT NULL, -- JSON
  validation_rules TEXT, -- JSON
  ai_provider TEXT DEFAULT 'openai',
  confidence_threshold REAL DEFAULT 0.80,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE document_extractions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  job_id TEXT NOT NULL REFERENCES jobs(id),
  document_id TEXT NOT NULL,
  template_id TEXT REFERENCES document_templates(id),
  s3_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  status TEXT NOT NULL, -- 'uploaded', 'processing', 'extracted', 'validated', 'failed'
  ai_provider TEXT,
  raw_text TEXT,
  extracted_data TEXT, -- JSON
  confidence REAL,
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  cost REAL,
  validation_errors TEXT, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_document_extractions_workflow ON document_extractions(workflow_id);
CREATE INDEX idx_document_extractions_job ON document_extractions(job_id);
CREATE INDEX idx_document_extractions_status ON document_extractions(status);
```

**API Endpoints:**
```typescript
// Upload document
POST /api/workflows/:workflowId/jobs/:jobId/documents/upload

// Extract document
POST /api/documents/:documentId/extract
Body: { templateId?: string, aiProvider?: string }

// Get extraction result
GET /api/documents/:documentId/extractions/:extractionId

// List extractions for job
GET /api/workflows/:workflowId/jobs/:jobId/extractions
```

**UI Components:**
- Document upload component (drag-and-drop)
- Extraction results viewer (JSON → table)
- Template selector dropdown

**Effort:** 3-4 weeks, 1 developer

---

### Phase 2: Templates & Validation (Weeks 5-8)

**Goal:** Custom templates, validation, human review

**Deliverables:**
- ✅ Custom template builder (UI)
- ✅ Template versioning
- ✅ Field validation rules engine
- ✅ Confidence scoring
- ✅ Human-in-the-loop review queue
- ✅ Silver layer integration (validated data)
- ✅ 10+ pre-built templates

**New Features:**

**Template Builder UI:**
- Visual field editor (drag-and-drop)
- Field type selector
- Validation rule builder
- Test template with sample document
- Template marketplace (share templates)

**Review Queue UI:**
```typescript
interface ReviewQueuePage {
  // Table view of pending reviews
  pendingReviews: ReviewQueueItem[]

  // Filters
  filters: {
    confidence: 'low' | 'medium' | 'high'
    template: string
    dateRange: [Date, Date]
  }

  // Actions
  onApprove: (item: ReviewQueueItem) => void
  onReject: (item: ReviewQueueItem, reason: string) => void
  onEdit: (item: ReviewQueueItem, corrections: any) => void
}

// Review detail modal
interface ReviewDetailModal {
  // Side-by-side view
  originalDocument: PDF | Image
  extractedData: ExtractedField[]

  // Edit extracted data inline
  onFieldEdit: (fieldName: string, newValue: any) => void

  // Confidence indicators
  fieldConfidence: Map<string, number>

  // Approve/Reject
  onApprove: () => void
  onReject: (reason: string) => void
}
```

**Database Schema Updates:**
```sql
CREATE TABLE document_reviews (
  id TEXT PRIMARY KEY,
  extraction_id TEXT NOT NULL REFERENCES document_extractions(id),
  assigned_to TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  original_data TEXT NOT NULL, -- JSON
  corrected_data TEXT, -- JSON (if edited)
  reviewer_comments TEXT,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_document_reviews_status ON document_reviews(status);
CREATE INDEX idx_document_reviews_assigned ON document_reviews(assigned_to);
```

**API Endpoints:**
```typescript
// Template management
GET    /api/templates
POST   /api/templates
GET    /api/templates/:templateId
PUT    /api/templates/:templateId
DELETE /api/templates/:templateId

// Review queue
GET    /api/reviews
GET    /api/reviews/:reviewId
PUT    /api/reviews/:reviewId/approve
PUT    /api/reviews/:reviewId/reject
PUT    /api/reviews/:reviewId/edit
```

**Effort:** 4-5 weeks, 2 developers

---

### Phase 3: Advanced Features (Weeks 9-16)

**Goal:** Enterprise-grade capabilities

**Deliverables:**
- ✅ Multi-page document assembly
- ✅ Complex table extraction (nested, merged cells)
- ✅ Handwriting recognition
- ✅ Learning/improvement system (template auto-tuning)
- ✅ Claude Vision integration (better for complex docs)
- ✅ Azure/Google provider options
- ✅ Batch processing (1000+ docs)
- ✅ Workflow triggers (new document → auto-process)
- ✅ Gold layer integration (analytics-ready)

**New Capabilities:**

**Multi-Page Assembly:**
- Split multi-page PDFs into logical documents
- Assemble related pages (e.g., invoice + line items across pages)
- Handle attachments (invoice + supporting docs)

**Advanced Table Extraction:**
- Nested tables (table within table cell)
- Merged cells (colspan, rowspan)
- Rotated tables
- Multiple tables per page

**Learning System:**
- Track human corrections in review queue
- Automatically improve template field extraction
- Suggest new fields based on common corrections
- Version templates with improvement metrics

**Batch Processing:**
```typescript
// Batch upload and process
POST /api/workflows/:workflowId/jobs/:jobId/documents/batch
Body: {
  documents: File[], // Up to 1000
  templateId: string,
  autoApprove: boolean, // Auto-approve if confidence > threshold
  notifyOnComplete: boolean
}

Response: {
  batchId: string,
  totalDocuments: number,
  status: 'processing',
  estimatedCompletionTime: Date
}

// Check batch status
GET /api/batches/:batchId
Response: {
  batchId: string,
  totalDocuments: number,
  processed: number,
  succeeded: number,
  failed: number,
  inReview: number,
  status: 'processing' | 'completed',
  results: ExtractionResult[]
}
```

**Workflow Triggers (Document-driven):**
```typescript
// New trigger type: document-arrival
interface DocumentArrivalTrigger {
  type: 'document'
  templateId: string
  folder: string // S3 path to monitor
  autoProcess: boolean
  confidenceThreshold: number

  // When new document arrives:
  // 1. Extract using template
  // 2. If confidence > threshold, auto-approve
  // 3. If confidence < threshold, queue for review
  // 4. Trigger downstream workflow (e.g., Bronze → Silver → Gold)
}

// Example: Invoice arrives → Auto-extract → Trigger AP workflow
const invoiceTrigger: DocumentArrivalTrigger = {
  type: 'document',
  templateId: 'invoice_template_v2',
  folder: 'landing/documents/invoices/',
  autoProcess: true,
  confidenceThreshold: 0.85
}
```

**Effort:** 6-8 weeks, 2-3 developers

---

## 🔌 API Design

### Core API Endpoints

#### Document Management

```typescript
/**
 * Upload a document for extraction
 */
POST /api/workflows/:workflowId/jobs/:jobId/documents/upload
Content-Type: multipart/form-data

Request:
- file: File (PDF, PNG, JPG, TIFF)
- templateId?: string (optional, auto-detect if not provided)
- aiProvider?: 'openai' | 'claude' | 'azure' | 'google'

Response: 201 Created
{
  documentId: "doc_abc123",
  fileName: "invoice_2024_001.pdf",
  pageCount: 3,
  fileSizeBytes: 245890,
  s3Key: "landing/documents/workflow_xyz/job_abc/doc_abc123.pdf",
  status: "uploaded",
  createdAt: "2025-10-21T10:30:00Z"
}

/**
 * Extract data from uploaded document
 */
POST /api/documents/:documentId/extract
Content-Type: application/json

Request:
{
  templateId?: "invoice_template_v2", // Optional, auto-detect if not provided
  aiProvider?: "openai", // Optional, use template default if not provided
  options?: {
    confidenceThreshold?: 0.80,
    autoQueue?: true, // Auto-queue for review if below threshold
    language?: "en"
  }
}

Response: 202 Accepted
{
  extractionId: "ext_xyz789",
  status: "processing",
  estimatedTimeMs: 5000
}

/**
 * Get extraction result
 */
GET /api/documents/:documentId/extractions/:extractionId

Response: 200 OK
{
  extractionId: "ext_xyz789",
  documentId: "doc_abc123",
  status: "completed", // 'processing' | 'completed' | 'failed'
  template: {
    id: "invoice_template_v2",
    name: "Invoice (v2)",
    category: "invoice"
  },
  extractedData: {
    fields: [
      {
        name: "invoice_number",
        value: "INV-2024-001",
        type: "string",
        confidence: 0.95
      },
      {
        name: "invoice_date",
        value: "2024-10-21",
        type: "date",
        confidence: 0.90
      },
      {
        name: "vendor_name",
        value: "Acme Corp",
        type: "string",
        confidence: 0.98
      },
      {
        name: "total_amount",
        value: 1250.50,
        type: "currency",
        confidence: 0.92
      }
    ],
    tables: [
      {
        name: "line_items",
        rows: [
          {
            description: "Widget A",
            quantity: 10,
            unit_price: 50.00,
            total: 500.00
          },
          {
            description: "Widget B",
            quantity: 5,
            unit_price: 150.10,
            total: 750.50
          }
        ]
      }
    ]
  },
  confidence: 0.93, // Overall confidence
  validationErrors: [],
  processingTimeMs: 4532,
  tokensUsed: 2840,
  cost: 0.15,
  needsReview: false,
  createdAt: "2025-10-21T10:30:05Z",
  completedAt: "2025-10-21T10:30:09Z"
}

/**
 * List extractions for a job
 */
GET /api/workflows/:workflowId/jobs/:jobId/extractions
Query Params:
- status?: 'processing' | 'completed' | 'failed' | 'in_review'
- limit?: number (default 50)
- offset?: number

Response: 200 OK
{
  extractions: [...],
  total: 150,
  limit: 50,
  offset: 0
}

/**
 * Delete document
 */
DELETE /api/documents/:documentId

Response: 204 No Content
```

#### Template Management

```typescript
/**
 * List all templates
 */
GET /api/templates
Query Params:
- category?: 'invoice' | 'purchase_order' | 'receipt' | 'contract' | 'claim' | 'custom'
- search?: string

Response: 200 OK
{
  templates: [
    {
      id: "invoice_template_v2",
      name: "Invoice (v2)",
      description: "Standard invoice with line items",
      category: "invoice",
      version: 2,
      fieldCount: 12,
      isPrebuilt: true,
      createdAt: "2025-01-15T00:00:00Z"
    },
    ...
  ]
}

/**
 * Get template details
 */
GET /api/templates/:templateId

Response: 200 OK
{
  id: "invoice_template_v2",
  name: "Invoice (v2)",
  description: "Standard invoice with line items",
  category: "invoice",
  version: 2,
  fields: [
    {
      name: "invoice_number",
      label: "Invoice Number",
      type: "string",
      required: true,
      description: "Unique invoice identifier"
    },
    ...
  ],
  tables: [
    {
      name: "line_items",
      columns: [
        { name: "description", type: "string", required: true },
        { name: "quantity", type: "number", required: true },
        { name: "unit_price", type: "currency", required: true },
        { name: "total", type: "currency", required: true }
      ]
    }
  ],
  validationRules: [...],
  aiProvider: "openai",
  confidenceThreshold: 0.80,
  createdAt: "2025-01-15T00:00:00Z",
  updatedAt: "2025-03-10T15:30:00Z"
}

/**
 * Create custom template
 */
POST /api/templates
Content-Type: application/json

Request:
{
  name: "Purchase Order - Custom",
  description: "Custom PO template for our org",
  category: "purchase_order",
  fields: [...],
  tables: [...],
  validationRules: [...],
  aiProvider: "claude",
  confidenceThreshold: 0.85
}

Response: 201 Created
{
  id: "custom_po_abc123",
  ...
}

/**
 * Update template
 */
PUT /api/templates/:templateId

/**
 * Delete template
 */
DELETE /api/templates/:templateId
```

#### Review Queue

```typescript
/**
 * List reviews
 */
GET /api/reviews
Query Params:
- status?: 'pending' | 'in_review' | 'approved' | 'rejected'
- assignedTo?: string
- confidence?: 'low' | 'medium' | 'high'
- limit?: number
- offset?: number

Response: 200 OK
{
  reviews: [
    {
      id: "rev_xyz123",
      extractionId: "ext_abc789",
      documentId: "doc_abc123",
      fileName: "invoice_suspicious.pdf",
      template: "Invoice (v2)",
      reason: "low_confidence",
      confidence: 0.72,
      status: "pending",
      assignedTo: null,
      createdAt: "2025-10-21T10:45:00Z"
    },
    ...
  ],
  total: 25,
  limit: 50,
  offset: 0
}

/**
 * Get review details
 */
GET /api/reviews/:reviewId

Response: 200 OK
{
  id: "rev_xyz123",
  extraction: {
    extractionId: "ext_abc789",
    documentId: "doc_abc123",
    s3Key: "landing/documents/.../doc_abc123.pdf",
    extractedData: {...},
    confidence: 0.72,
    validationErrors: [
      "Field 'invoice_date' failed validation: Invalid date format"
    ]
  },
  reason: "low_confidence",
  status: "pending",
  originalData: {...},
  correctedData: null,
  reviewerComments: null,
  createdAt: "2025-10-21T10:45:00Z"
}

/**
 * Approve extraction
 */
PUT /api/reviews/:reviewId/approve
Content-Type: application/json

Request:
{
  comments?: "Looks good, approved"
}

Response: 200 OK
{
  id: "rev_xyz123",
  status: "approved",
  reviewedAt: "2025-10-21T11:00:00Z",
  reviewedBy: "user@example.com"
}

/**
 * Reject extraction
 */
PUT /api/reviews/:reviewId/reject
Content-Type: application/json

Request:
{
  reason: "Document is not an invoice, looks like a receipt",
  comments?: "Wrong document type uploaded"
}

Response: 200 OK
{
  id: "rev_xyz123",
  status: "rejected",
  rejectionReason: "...",
  reviewedAt: "2025-10-21T11:00:00Z",
  reviewedBy: "user@example.com"
}

/**
 * Edit and approve extraction
 */
PUT /api/reviews/:reviewId/edit
Content-Type: application/json

Request:
{
  correctedData: {
    fields: [
      {
        name: "invoice_date",
        value: "2024-10-21", // Corrected value
        type: "date",
        confidence: 1.0 // Manual correction = 100% confidence
      },
      ...
    ]
  },
  comments: "Corrected invoice date format"
}

Response: 200 OK
{
  id: "rev_xyz123",
  status: "approved",
  correctedData: {...},
  reviewerComments: "...",
  reviewedAt: "2025-10-21T11:00:00Z",
  reviewedBy: "user@example.com"
}
```

#### Batch Processing

```typescript
/**
 * Upload and process multiple documents
 */
POST /api/workflows/:workflowId/jobs/:jobId/documents/batch
Content-Type: multipart/form-data

Request:
- files: File[] (up to 1000)
- templateId: string
- aiProvider?: string
- autoApprove?: boolean (default false)
- confidenceThreshold?: number (default 0.80)

Response: 202 Accepted
{
  batchId: "batch_xyz123",
  totalDocuments: 250,
  status: "processing",
  estimatedCompletionTime: "2025-10-21T12:00:00Z"
}

/**
 * Get batch status
 */
GET /api/batches/:batchId

Response: 200 OK
{
  batchId: "batch_xyz123",
  workflowId: "workflow_abc",
  jobId: "job_xyz",
  totalDocuments: 250,
  processed: 180,
  succeeded: 165,
  failed: 5,
  inReview: 10,
  status: "processing", // 'processing' | 'completed'
  startedAt: "2025-10-21T10:00:00Z",
  estimatedCompletionTime: "2025-10-21T12:00:00Z",
  results: [
    {
      documentId: "doc_001",
      fileName: "invoice_001.pdf",
      status: "completed",
      confidence: 0.95
    },
    ...
  ]
}

/**
 * List batches
 */
GET /api/batches
Query Params:
- workflowId?: string
- status?: 'processing' | 'completed'
- limit?: number
- offset?: number
```

---

## 💾 Database Schema

### Complete Schema for IDP Module

```sql
-- ========================================
-- Document Templates
-- ========================================

CREATE TABLE document_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('invoice', 'purchase_order', 'receipt', 'contract', 'claim', 'form', 'custom')),
  version INTEGER DEFAULT 1,
  is_prebuilt BOOLEAN DEFAULT FALSE,

  -- Template definition (JSON)
  fields TEXT NOT NULL, -- JSON array of TemplateField
  tables TEXT, -- JSON array of TableDefinition (optional)
  validation_rules TEXT, -- JSON array of ValidationRule (optional)

  -- AI configuration
  ai_provider TEXT DEFAULT 'openai' CHECK(ai_provider IN ('openai', 'claude', 'azure', 'google', 'auto')),
  confidence_threshold REAL DEFAULT 0.80 CHECK(confidence_threshold >= 0 AND confidence_threshold <= 1),

  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX idx_document_templates_category ON document_templates(category);
CREATE INDEX idx_document_templates_prebuilt ON document_templates(is_prebuilt);

-- ========================================
-- Document Extractions
-- ========================================

CREATE TABLE document_extractions (
  id TEXT PRIMARY KEY,

  -- Relationships
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES document_templates(id) ON DELETE SET NULL,
  batch_id TEXT, -- Optional, if part of batch

  -- Document info
  document_id TEXT NOT NULL UNIQUE,
  s3_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,

  -- Extraction status
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK(status IN ('uploaded', 'processing', 'extracted', 'validated', 'failed', 'in_review', 'approved')),

  -- AI processing
  ai_provider TEXT,
  raw_text TEXT, -- Full extracted text (for debugging)
  extracted_data TEXT, -- JSON: { fields: [], tables: [] }
  confidence REAL CHECK(confidence >= 0 AND confidence <= 1),

  -- Processing metrics
  processing_time_ms INTEGER,
  tokens_used INTEGER,
  cost REAL, -- USD

  -- Validation
  validation_errors TEXT, -- JSON array of error messages
  needs_review BOOLEAN DEFAULT FALSE,

  -- Error handling
  error_message TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX idx_document_extractions_workflow ON document_extractions(workflow_id);
CREATE INDEX idx_document_extractions_job ON document_extractions(job_id);
CREATE INDEX idx_document_extractions_status ON document_extractions(status);
CREATE INDEX idx_document_extractions_batch ON document_extractions(batch_id);
CREATE INDEX idx_document_extractions_needs_review ON document_extractions(needs_review);

-- ========================================
-- Document Reviews (Human-in-the-Loop)
-- ========================================

CREATE TABLE document_reviews (
  id TEXT PRIMARY KEY,

  -- Relationships
  extraction_id TEXT NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
  assigned_to TEXT, -- User email/ID

  -- Review info
  reason TEXT NOT NULL CHECK(reason IN ('low_confidence', 'validation_failed', 'manual_review_requested', 'audit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_review', 'approved', 'rejected')),

  -- Data
  original_data TEXT NOT NULL, -- JSON snapshot of extracted data
  corrected_data TEXT, -- JSON with human corrections (if edited)

  -- Review outcome
  reviewer_comments TEXT,
  rejection_reason TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);

CREATE INDEX idx_document_reviews_extraction ON document_reviews(extraction_id);
CREATE INDEX idx_document_reviews_status ON document_reviews(status);
CREATE INDEX idx_document_reviews_assigned ON document_reviews(assigned_to);

-- ========================================
-- Batch Processing
-- ========================================

CREATE TABLE document_batches (
  id TEXT PRIMARY KEY,

  -- Relationships
  workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES document_templates(id),

  -- Batch info
  total_documents INTEGER NOT NULL,
  processed INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  in_review INTEGER DEFAULT 0,

  -- Configuration
  auto_approve BOOLEAN DEFAULT FALSE,
  confidence_threshold REAL DEFAULT 0.80,

  -- Status
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('queued', 'processing', 'completed', 'failed')),

  -- Timestamps
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  estimated_completion_time INTEGER
);

CREATE INDEX idx_document_batches_workflow ON document_batches(workflow_id);
CREATE INDEX idx_document_batches_status ON document_batches(status);

-- ========================================
-- Template Learning/Improvement
-- ========================================

CREATE TABLE template_corrections (
  id TEXT PRIMARY KEY,

  -- Relationships
  template_id TEXT NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  extraction_id TEXT NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES document_reviews(id) ON DELETE CASCADE,

  -- Correction details
  field_name TEXT NOT NULL,
  original_value TEXT,
  corrected_value TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK(correction_type IN ('value', 'type', 'format', 'missing')),

  -- Learning
  applied_to_template BOOLEAN DEFAULT FALSE,
  improvement_score REAL, -- How much this improved extraction accuracy

  -- Timestamps
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_template_corrections_template ON template_corrections(template_id);
CREATE INDEX idx_template_corrections_field ON template_corrections(field_name);
CREATE INDEX idx_template_corrections_applied ON template_corrections(applied_to_template);
```

---

## 🎨 UI/UX Design

### 1. Document Upload Component

**Location:** Workflow Detail Page → Job Detail Modal → New "Documents" Tab

```typescript
// Component: DocumentUploadSection.tsx

interface DocumentUploadSectionProps {
  workflowId: string
  jobId: string
  onUploadComplete: (documentId: string) => void
}

export function DocumentUploadSection({ workflowId, jobId }: DocumentUploadSectionProps) {
  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-8">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Upload Documents</h3>
            <p className="text-sm text-gray-600 mb-4">
              Drag and drop PDFs or images, or click to browse
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Supported: PDF, PNG, JPG, TIFF (max 10MB per file)
            </p>

            {/* Template Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Document Template (optional)
              </label>
              <select className="w-64 border rounded-md px-3 py-2">
                <option value="">Auto-detect</option>
                <option value="invoice_v2">Invoice</option>
                <option value="purchase_order_v1">Purchase Order</option>
                <option value="receipt_v1">Receipt</option>
                <option value="contract_v1">Contract</option>
              </select>
            </div>

            <Button variant="primary" size="lg">
              <Upload className="w-5 h-5 mr-2" />
              Select Files
            </Button>

            <div className="mt-4">
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Batch Upload (up to 1000 files)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Documents List */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Uploaded Documents</h3>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableCell>File Name</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map(doc => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <FileText className="w-4 h-4 inline mr-2" />
                    {doc.fileName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.template}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell>
                    <ConfidenceIndicator confidence={doc.confidence} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                    <Button variant="ghost" size="sm">Extract</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 2. Extraction Results Viewer

```typescript
// Component: ExtractionResultsModal.tsx

interface ExtractionResultsModalProps {
  documentId: string
  extractionId: string
  onClose: () => void
}

export function ExtractionResultsModal({ documentId, extractionId }: ExtractionResultsModalProps) {
  const extraction = useExtraction(extractionId)

  return (
    <Modal open={true} onClose={onClose} size="xl">
      <ModalHeader>
        <h2 className="text-xl font-bold">Extraction Results</h2>
        <ConfidenceBadge confidence={extraction.confidence} />
      </ModalHeader>

      <ModalBody>
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Original Document */}
          <div>
            <h3 className="font-semibold mb-3">Original Document</h3>
            <PDFViewer src={extraction.s3Url} />
          </div>

          {/* Right: Extracted Data */}
          <div>
            <h3 className="font-semibold mb-3">Extracted Data</h3>

            {/* Fields */}
            <div className="space-y-3">
              {extraction.fields.map(field => (
                <div key={field.name} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium">{field.label}</label>
                    <ConfidenceIndicator confidence={field.confidence} size="sm" />
                  </div>
                  <div className="text-base">{field.value}</div>
                  <div className="text-xs text-gray-500 mt-1">Type: {field.type}</div>
                </div>
              ))}
            </div>

            {/* Tables */}
            {extraction.tables.map(table => (
              <div key={table.name} className="mt-6">
                <h4 className="font-semibold mb-2">{table.name}</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {table.columns.map(col => (
                        <TableCell key={col.name}>{col.label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.rows.map((row, idx) => (
                      <TableRow key={idx}>
                        {table.columns.map(col => (
                          <TableCell key={col.name}>{row[col.name]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

            {/* Validation Errors */}
            {extraction.validationErrors.length > 0 && (
              <Alert variant="warning" className="mt-4">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle>Validation Issues</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {extraction.validationErrors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={handleApprove}>
          <Check className="w-4 h-4 mr-2" />
          Approve & Continue
        </Button>
        <Button variant="secondary" onClick={handleEdit}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Data
        </Button>
      </ModalFooter>
    </Modal>
  )
}
```

### 3. Template Builder UI

```typescript
// Page: /settings/idp/templates/new

export function TemplateBuilderPage() {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageHeader>
        <h1 className="text-2xl font-bold">Create Custom Template</h1>
        <p className="text-gray-600">Define fields to extract from your documents</p>
      </PageHeader>

      <div className="grid grid-cols-3 gap-6 mt-6">
        {/* Left: Template Configuration */}
        <div className="col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Template Info</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" placeholder="e.g., Custom Invoice" className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select className="w-full">
                  <option>Invoice</option>
                  <option>Purchase Order</option>
                  <option>Receipt</option>
                  <option>Contract</option>
                  <option>Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI Provider</label>
                <select className="w-full">
                  <option>OpenAI GPT-4 Vision</option>
                  <option>Claude 3 Opus Vision</option>
                  <option>Azure Document Intelligence</option>
                  <option>Google Document AI</option>
                  <option>Auto (best for document type)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Confidence Threshold
                </label>
                <input type="range" min="0" max="100" value="80" className="w-full" />
                <div className="text-xs text-gray-600 text-center">80%</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold">Sample Document</h3>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Upload sample document to test template</p>
                <Button variant="outline" size="sm" className="mt-3">
                  Upload Sample
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle: Field Builder */}
        <div className="col-span-2">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h3 className="font-semibold">Fields</h3>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium">Field Name</label>
                        <input type="text" value={field.name} className="w-full text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Label</label>
                        <input type="text" value={field.label} className="w-full text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Type</label>
                        <select className="w-full text-sm">
                          <option>String</option>
                          <option>Number</option>
                          <option>Date</option>
                          <option>Currency</option>
                          <option>Email</option>
                          <option>Phone</option>
                          <option>Boolean</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center text-xs">
                          <input type="checkbox" checked={field.required} className="mr-1" />
                          Required
                        </label>
                        <Button variant="ghost" size="sm" className="ml-auto">
                          <Trash className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-medium">Extraction Hint (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g., 'usually in top-right corner'"
                        className="w-full text-sm"
                      />
                    </div>

                    {/* Validation Rules */}
                    <div className="mt-3">
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium">
                          Validation Rules
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <label>Format/Pattern (regex)</label>
                            <input type="text" placeholder="e.g., ^\d{4}-\d{2}-\d{2}$" />
                          </div>
                          <div>
                            <label>Min/Max (for numbers)</label>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="number" placeholder="Min" />
                              <input type="number" placeholder="Max" />
                            </div>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table Definition */}
              <div className="mt-6 border-t pt-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">Tables (optional)</h4>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Table
                  </Button>
                </div>

                {/* Table builder similar to fields */}
              </div>
            </CardContent>
          </Card>

          {/* Test Template Button */}
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline">Cancel</Button>
            <Button variant="secondary">
              <Zap className="w-4 h-4 mr-2" />
              Test Template
            </Button>
            <Button variant="primary">
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 4. Review Queue Page

```typescript
// Page: /idp/review-queue

export function ReviewQueuePage() {
  return (
    <div className="p-6">
      <PageHeader>
        <h1 className="text-2xl font-bold">Document Review Queue</h1>
        <p className="text-gray-600">
          Review documents with low confidence or validation errors
        </p>
      </PageHeader>

      {/* Filters */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Status</label>
              <select className="w-full">
                <option>All</option>
                <option>Pending</option>
                <option>In Review</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Confidence</label>
              <select className="w-full">
                <option>All</option>
                <option>Low (&lt; 70%)</option>
                <option>Medium (70-85%)</option>
                <option>High (&gt; 85%)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Template</label>
              <select className="w-full">
                <option>All</option>
                <option>Invoice</option>
                <option>Purchase Order</option>
                <option>Receipt</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Date Range</label>
              <input type="date" className="w-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Queue Table */}
      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>Document</TableCell>
              <TableCell>Template</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviewItems.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <div>
                      <div className="font-medium">{item.fileName}</div>
                      <div className="text-xs text-gray-500">{item.documentId}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.template}</Badge>
                </TableCell>
                <TableCell>
                  <ReasonBadge reason={item.reason} />
                </TableCell>
                <TableCell>
                  <ConfidenceIndicator confidence={item.confidence} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  <RelativeTime date={item.createdAt} />
                </TableCell>
                <TableCell>
                  <Button variant="primary" size="sm" onClick={() => openReviewModal(item)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
```

---

## 🔗 Integration Points

### 1. Integration with Existing Job System

**New Job Type: "Document Extraction Job"**

```typescript
// Extend existing job types
type JobType = 'file' | 'database' | 'api' | 'document'  // Add 'document'

// New job configuration for document extraction
interface DocumentJobConfig {
  type: 'document'

  source: {
    type: 'document'
    landingPath: string  // S3 path where documents are uploaded
    templateId: string   // Which template to use for extraction
    aiProvider?: 'openai' | 'claude' | 'azure' | 'google'
    autoApprove: boolean  // Auto-approve if confidence > threshold
    confidenceThreshold: number  // Default 0.80
  }

  transformation: {
    // After extraction, apply standard transformations
    columnMappings?: ColumnMapping[]
    validationRules?: ValidationRule[]
  }

  destination: {
    // Bronze layer receives extracted data as structured table
    bronzeTable: string
    silverTable: string
    goldTable: string
  }
}

// Example: Invoice extraction job
const invoiceExtractionJob: Job = {
  id: 'job_invoice_001',
  workflowId: 'workflow_ap_automation',
  name: 'Extract Invoice Data',
  type: 'document',
  source: {
    type: 'document',
    landingPath: 's3://flowforge-data/landing/documents/invoices/',
    templateId: 'invoice_template_v2',
    aiProvider: 'openai',
    autoApprove: true,
    confidenceThreshold: 0.85
  },
  transformation: {
    columnMappings: [
      { source: 'invoice_number', target: 'invoice_id', type: 'string' },
      { source: 'total_amount', target: 'amount', type: 'currency' }
    ]
  },
  destination: {
    bronzeTable: 'invoices_bronze',
    silverTable: 'invoices_silver',
    goldTable: 'invoices_gold'
  }
}
```

### 2. Integration with Bronze/Silver/Gold Pipeline

**Flow:**
```
Document Upload
       ↓
AI Extraction (IDP Module)
       ↓
Structured Data (JSON)
       ↓
Bronze Layer (Raw extraction as Parquet)
  - Column: document_id, extraction_id, field_name, field_value, confidence
  - Column: _extracted_at, _ai_provider, _template_id
       ↓
Silver Layer (Validated, typed, deduplicated)
  - Apply validation rules
  - Convert data types (string → date, currency, etc.)
  - Deduplicate by primary key
  - Merge strategy: source wins
       ↓
Gold Layer (Analytics-ready)
  - Pivot extracted fields to columns
  - Join with other data sources
  - Aggregate (e.g., sum invoices by vendor)
```

**Example Bronze Schema:**
```sql
-- Bronze: Raw extraction results (one row per extracted field)
CREATE TABLE invoices_bronze (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  extraction_id TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date DATE,
  vendor_name TEXT,
  total_amount DECIMAL(10,2),
  currency TEXT,
  -- Audit columns
  _extracted_at TIMESTAMP,
  _ai_provider TEXT,
  _template_id TEXT,
  _confidence REAL,
  _source_file TEXT
)

-- Silver: Validated, typed, deduplicated
CREATE TABLE invoices_silver (
  invoice_id TEXT PRIMARY KEY, -- Deduplication key
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  vendor_name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  -- Audit
  _ingested_at TIMESTAMP,
  _updated_at TIMESTAMP,
  _extraction_id TEXT
)

-- Gold: Analytics-ready
CREATE TABLE vendor_invoices_summary_gold (
  vendor_name TEXT PRIMARY KEY,
  total_invoices INTEGER,
  total_amount DECIMAL(12,2),
  avg_invoice_amount DECIMAL(10,2),
  earliest_invoice_date DATE,
  latest_invoice_date DATE
)
```

### 3. Integration with Workflow Triggers

**New Trigger Type: Document Arrival**

```typescript
// Extend trigger types
type TriggerType = 'manual' | 'scheduled' | 'dependency' | 'event' | 'document'

interface DocumentArrivalTrigger {
  type: 'document'
  templateId: string
  folder: string  // S3 path to monitor (e.g., 's3://bucket/landing/documents/invoices/')
  filePattern?: string  // Optional glob pattern (e.g., 'invoice_*.pdf')
  autoProcess: boolean  // Automatically extract and run workflow
  confidenceThreshold: number

  // When document arrives:
  // 1. Extract using template
  // 2. If confidence > threshold and autoProcess = true, trigger workflow
  // 3. If confidence < threshold, queue for review
}

// Example: Invoice processing workflow triggered by document upload
const documentTrigger: DocumentArrivalTrigger = {
  type: 'document',
  templateId: 'invoice_template_v2',
  folder: 's3://flowforge-data/landing/documents/invoices/',
  filePattern: 'invoice_*.pdf',
  autoProcess: true,
  confidenceThreshold: 0.85
}

// Workflow execution flow:
// 1. User uploads invoice_2024_001.pdf to monitored folder
// 2. IDP module detects new document
// 3. Extracts data using invoice template
// 4. Confidence = 0.92 (> 0.85 threshold)
// 5. Auto-approves extraction
// 6. Triggers workflow execution
// 7. Extracted data flows through Bronze → Silver → Gold
// 8. Workflow completes, downstream workflows trigger (e.g., AP approval)
```

### 4. Integration with Prefect

**New Prefect Flow: Document Extraction**

```python
# prefect-flows/flows/document_extraction.py

from prefect import flow, task
from services.ai_vision_service import AIVisionService
from services.trigger_handler import notify_completion
import asyncio

@task
async def extract_document(
    document_id: str,
    template_id: str,
    ai_provider: str = 'openai'
) -> dict:
    """
    Extract structured data from document using AI
    """
    vision_service = AIVisionService()

    # Get document from S3
    document = await vision_service.get_document(document_id)

    # Get template
    template = await vision_service.get_template(template_id)

    # Extract data
    result = await vision_service.extract_document(
        document=document,
        template=template,
        provider=ai_provider
    )

    return result

@task
async def validate_extraction(extraction_result: dict, template: dict) -> dict:
    """
    Validate extracted data against template rules
    """
    validation_errors = []

    for field in extraction_result['fields']:
        # Check required fields
        if field['required'] and not field['value']:
            validation_errors.append(f"Field '{field['name']}' is required")

        # Check format (regex validation)
        # Check data type
        # Check range (for numbers)

    return {
        'is_valid': len(validation_errors) == 0,
        'errors': validation_errors
    }

@task
async def queue_for_review(extraction_id: str, reason: str) -> None:
    """
    Add extraction to human review queue
    """
    # Call API to create review queue item
    pass

@task
async def save_to_bronze(extraction_result: dict, job_config: dict) -> None:
    """
    Save extracted data to Bronze layer
    """
    # Convert extraction result to Parquet
    # Upload to S3: s3://bucket/bronze/{workflow_id}/{job_id}/extracted_data.parquet
    pass

@flow(name="Document Extraction Flow")
async def document_extraction_flow(
    workflow_id: str,
    job_id: str,
    document_id: str,
    template_id: str,
    execution_id: str
):
    """
    Main flow for document extraction
    """
    try:
        # Get job config
        job_config = await get_job_config(workflow_id, job_id)

        # Extract document
        extraction_result = await extract_document(
            document_id=document_id,
            template_id=template_id,
            ai_provider=job_config['source']['aiProvider']
        )

        # Validate extraction
        validation_result = await validate_extraction(
            extraction_result=extraction_result,
            template=job_config['source']['template']
        )

        # Check confidence threshold
        confidence_threshold = job_config['source']['confidenceThreshold']

        if extraction_result['confidence'] < confidence_threshold:
            # Queue for human review
            await queue_for_review(
                extraction_id=extraction_result['id'],
                reason='low_confidence'
            )
            return {
                'status': 'queued_for_review',
                'confidence': extraction_result['confidence']
            }

        if not validation_result['is_valid']:
            # Queue for human review
            await queue_for_review(
                extraction_id=extraction_result['id'],
                reason='validation_failed'
            )
            return {
                'status': 'queued_for_review',
                'validation_errors': validation_result['errors']
            }

        # Auto-approve: Save to Bronze layer
        await save_to_bronze(extraction_result, job_config)

        # Continue with standard Bronze → Silver → Gold pipeline
        # (Call existing medallion flow)

        # Notify completion for trigger system
        await notify_completion(execution_id, status='completed')

        return {
            'status': 'completed',
            'extraction_id': extraction_result['id'],
            'confidence': extraction_result['confidence']
        }

    except Exception as e:
        await notify_completion(execution_id, status='failed')
        raise
```

---

## 🔒 Security & Compliance

### 1. Data Security

**Document Storage:**
- Documents stored in S3/MinIO with encryption at rest
- Access control via IAM policies/MinIO bucket policies
- Automatic deletion after configurable retention period (default 90 days)

**API Security:**
- All API endpoints require authentication (JWT)
- Role-based access control (RBAC):
  - `idp:upload` - Upload documents
  - `idp:extract` - Trigger extraction
  - `idp:review` - Access review queue
  - `idp:approve` - Approve extractions
  - `idp:admin` - Manage templates

**AI Provider Security:**
- API keys stored in environment variables (never in database)
- Support for customer-managed keys (BYOK)
- Option to use customer's own AI provider accounts

### 2. Compliance

**GDPR Compliance:**
- Right to erasure: Delete document and all extraction data
- Data minimization: Only extract fields defined in template
- Consent: User must opt-in to IDP module
- Audit trail: Log all extraction and review actions

**HIPAA Compliance (Healthcare):**
- PHI handling: Support HIPAA-compliant AI providers (Azure)
- Encryption: End-to-end encryption for medical documents
- Access logging: Audit trail of who accessed which documents
- BAA: Business Associate Agreement with AI providers

**SOX Compliance (Finance):**
- Audit trail: Immutable log of all extractions and approvals
- Segregation of duties: Separate roles for upload/extract/approve
- Retention: Configurable document retention (7 years for financial docs)

### 3. Privacy

**PII Detection:**
- Automatically detect PII in extracted data
- Redact sensitive fields (SSN, credit card numbers)
- Optional: Mask PII in review queue for reviewers

**Data Residency:**
- Support region-specific AI providers (EU-only, US-only)
- Store documents in customer-specified S3 region

---

## 💰 Cost Analysis

### 1. Development Costs

| Phase | Duration | Team | Cost (Estimate) |
|-------|----------|------|-----------------|
| **Phase 1: Basic Extraction** | 4 weeks | 1 developer | $20,000 |
| **Phase 2: Templates & Validation** | 5 weeks | 2 developers | $50,000 |
| **Phase 3: Advanced Features** | 8 weeks | 2-3 developers | $80,000 |
| **QA & Testing** | 2 weeks | 1 QA engineer | $8,000 |
| **Documentation & Training** | 1 week | 1 technical writer | $4,000 |
| **Total** | **20 weeks** | | **$162,000** |

### 2. Operational Costs (Per Customer)

**AI Provider Costs:**

| Provider | Cost per Document | Cost per 1,000 Docs | Notes |
|----------|-------------------|---------------------|-------|
| **OpenAI GPT-4 Vision** | $0.10 - $0.30 | $100 - $300 | Best for general documents |
| **Claude 3 Opus Vision** | $0.15 - $0.40 | $150 - $400 | Best for complex tables |
| **Azure Document Intelligence** | $0.05 - $0.20 | $50 - $200 | Pre-built models, cheaper |
| **Google Document AI** | $0.10 - $0.25 | $100 - $250 | Good balance |

**Storage Costs:**
- S3/MinIO: ~$0.023/GB/month
- Average document: 500KB
- 10,000 documents = 5GB = **$0.12/month**

**Compute Costs:**
- Prefect worker (document processing): Minimal (uses existing workers)

**Total Monthly Operational Cost (10,000 docs):**
- AI: $150 - $400
- Storage: $0.12
- **Total: ~$150 - $400/month**

### 3. Pricing Strategy

**IDP Module Add-On Pricing:**

| Tier | Documents/Month | Price/Month | Margin |
|------|----------------|-------------|--------|
| **Starter** | 1,000 | $299 | ~50% margin |
| **Professional** | 10,000 | $999 | ~60% margin |
| **Enterprise** | Unlimited | $2,999 | ~80% margin |

**Additional Revenue:**
- Custom templates: $500 - $2,000 per template (one-time)
- Professional services: Template building, integration - $150/hour
- Training: $2,000 per day

### 4. Revenue Projections (Year 1)

**Assumptions:**
- 20 customers adopt IDP module (10% of customer base)
- Average tier: Professional ($999/mo)

**Annual Revenue:**
- Subscription: 20 × $999 × 12 = **$239,760**
- Custom templates: 10 × $1,000 = **$10,000**
- Professional services: 5 customers × 40 hours × $150 = **$30,000**
- **Total: $279,760**

**Annual Costs:**
- Development (amortized): $162,000 ÷ 3 years = **$54,000**
- AI provider costs: 20 × $400 × 12 = **$96,000**
- Support: 0.5 FTE × $100,000 = **$50,000**
- **Total: $200,000**

**Net Profit Year 1: $79,760**
**ROI: 49%**

---

## 📈 Success Metrics

### 1. Technical Metrics

**Extraction Accuracy:**
- Target: 95%+ field extraction accuracy
- Measurement: % of fields correctly extracted (compared to human review)

**Processing Speed:**
- Target: < 10 seconds per document
- Measurement: Average time from upload to extraction complete

**Confidence Score:**
- Target: 85%+ average confidence
- Measurement: Average confidence across all extractions

**Review Rate:**
- Target: < 20% of documents queued for review
- Measurement: % of extractions below confidence threshold

### 2. Business Metrics

**Time Savings:**
- Target: 80% reduction in manual data entry time
- Measurement: Before (manual entry time) vs After (review time)

**Cost Savings:**
- Target: 75% reduction in processing costs
- Measurement: Before (labor cost) vs After (AI cost + review labor)

**Adoption Rate:**
- Target: 25% of customers adopt IDP module within 6 months
- Measurement: % of customers with active IDP subscriptions

**Customer Satisfaction:**
- Target: NPS > 40 for IDP feature
- Measurement: Quarterly NPS survey

### 3. Usage Metrics

**Documents Processed:**
- Target: 50,000 documents/month (across all customers)
- Measurement: Total extraction count

**Template Usage:**
- Target: Average 3 templates per customer
- Measurement: # of active templates per customer

**Batch Processing:**
- Target: 30% of documents processed via batch upload
- Measurement: % of documents uploaded in batches

---

## ⚠️ Risks & Mitigations

### 1. Technical Risks

**Risk: AI Extraction Accuracy < 95%**
- **Probability:** Medium
- **Impact:** High (customer trust, manual review overhead)
- **Mitigation:**
  - Start with high-quality pre-built templates
  - Implement learning system to improve over time
  - Set conservative confidence thresholds (80%+)
  - Provide human review queue for low-confidence extractions

**Risk: AI Provider API Downtime**
- **Probability:** Low
- **Impact:** High (processing blocked)
- **Mitigation:**
  - Support multiple AI providers (fallback to Azure/Google if OpenAI down)
  - Implement retry logic with exponential backoff
  - Queue failed extractions for automatic retry

**Risk: High AI Provider Costs**
- **Probability:** Medium
- **Impact:** Medium (margin compression)
- **Mitigation:**
  - Implement caching (don't re-extract same document)
  - Optimize prompts to reduce token usage
  - Use cheaper providers (Azure) for simple documents
  - Pass costs to customers transparently

### 2. Business Risks

**Risk: Low Customer Adoption**
- **Probability:** Medium
- **Impact:** High (ROI not achieved)
- **Mitigation:**
  - Start with high-value use cases (invoice processing)
  - Provide free trial (100 documents/month)
  - Create pre-built templates for common documents
  - Offer professional services for custom templates

**Risk: Competing with Specialized IDP Tools**
- **Probability:** High
- **Impact:** Medium
- **Mitigation:**
  - Position as **complementary**, not replacement
  - Focus on **integrated workflow** advantage
  - Target customers who want **vendor-neutral** solution
  - Emphasize **cost savings** vs specialized tools

### 3. Compliance Risks

**Risk: GDPR/HIPAA Violations**
- **Probability:** Low
- **Impact:** Very High (legal liability)
- **Mitigation:**
  - Conduct privacy impact assessment (PIA)
  - Implement data retention policies (auto-delete after 90 days)
  - Support customer-managed AI provider accounts (BYOK)
  - Provide audit trail for all data access

---

## 📅 Roadmap

### Q2 2025: Phase 1 (Basic Extraction)
- ✅ Document upload API
- ✅ OpenAI GPT-4 Vision integration
- ✅ 3 pre-built templates (invoice, PO, receipt)
- ✅ Bronze layer integration
- ✅ Basic UI (upload + results viewer)

### Q3 2025: Phase 2 (Templates & Validation)
- ✅ Custom template builder
- ✅ Validation rules engine
- ✅ Human review queue
- ✅ 10+ pre-built templates
- ✅ Silver layer integration

### Q4 2025: Phase 3 (Advanced Features)
- ✅ Claude Vision integration
- ✅ Azure/Google provider options
- ✅ Batch processing
- ✅ Workflow triggers (document arrival)
- ✅ Learning system (template improvement)

### Q1 2026: Enterprise Features
- Multi-language support (Spanish, French, German)
- Handwriting recognition
- Complex table extraction (nested, merged cells)
- Template marketplace (share templates)

---

## 📚 References

### Industry Research
- Gartner: IDP Market Report 2024
- Forrester: Data Management Trends 2024
- McKinsey: Data Engineering Productivity Study 2024

### Competitor Analysis
- Snowflake Document AI Documentation
- UiPath Document Understanding Overview
- AWS Textract vs Azure Form Recognizer Comparison

### Technical Documentation
- OpenAI GPT-4 Vision API Documentation
- Anthropic Claude 3 Vision Capabilities
- Prefect Flow Documentation

---

**Status:** Ready for Executive Review
**Next Steps:**
1. Review and approve Phase 1 scope
2. Allocate development resources (1-2 developers for Q2 2025)
3. Create detailed technical specifications for Phase 1
4. Begin UI/UX mockups for document upload and results viewer

**Questions for Review:**
1. Should we prioritize Phase 1 in Q2 2025, or wait until Q3/Q4?
2. Is the pricing strategy ($299/$999/$2,999) aligned with market expectations?
3. Should we offer a free tier (100 documents/month) to drive adoption?
4. Which AI provider should be default: OpenAI or Claude?
