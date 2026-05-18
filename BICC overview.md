# 01 — Oracle BICC Overview

## What is BICC?

**BI Cloud Connector (BICC)** is Oracle Fusion Cloud's native bulk data extraction capability. It extracts business data from Fusion SaaS applications into CSV files that can be stored in Oracle UCM (Universal Content Management) or OCI Object Storage — and from there loaded into any downstream system.

```
Oracle Fusion Cloud SaaS
    ├── ERP (Financials, Procurement, Projects)
    ├── HCM (HR, Payroll, Talent)
    ├── SCM (Supply Chain, Inventory)
    └── CX (Sales, Service)
         ↓
    BICC Console
    (schedule extracts, select PVOs)
         ↓
    CSV files
         ↓
    UCM Server  OR  OCI Object Storage  OR  External Storage
         ↓
    Your data warehouse / analytics platform
```

## Why BICC Instead of Direct DB Access?

Oracle Fusion Cloud is a **multi-tenant SaaS** — you cannot directly query the underlying Oracle database. BICC is the supported, governed way to extract large volumes of data.

| Method | Use Case | Volume | Latency |
|---|---|---|---|
| **BICC** | Bulk historical + incremental extracts | Millions of rows | Minutes–hours |
| REST API | Real-time single-record queries | Thousands of rows | Seconds |
| OTBI (Reports) | Ad-hoc reporting | Thousands of rows | Seconds |
| BIP (BI Publisher) | Scheduled reports | Thousands of rows | Minutes |
| HDL (HCM Data Loader) | HCM data loads | Bulk | Batch |

**Use BICC when:** You need to extract large volumes of Fusion data into a data warehouse, data lake, or analytics platform.

## Terms

| Term | Definition |
|---|---|
| **BICC** | BI Cloud Connector — the extraction framework |
| **PVO** | Public View Object — a structured view over Fusion base tables |
| **Extract PVO** | PVO optimized for bulk extraction (preferred) |
| **Non-extract PVO** | PVO that runs complex queries — use sparingly |
| **Offering** | A group of PVOs for a functional area (Finance, HCM, SCM) |
| **Data Store** | The output CSV file from a BICC extract |
| **UCM** | Universal Content Management — built-in file server |
| **Cloud Extract** | A scheduled BICC job that produces CSV files |
| **Full Extract** | All records from a PVO |
| **Incremental Extract** | Only records changed since last extract |

## BICC Limitations

| Limitation | Detail |
|---|---|
| Output format | CSV only (no JSON, Parquet, Avro) |
| No direct SQL | You select PVOs, not write SQL |
| Latency | Not real-time — minimum ~15 min for incremental |
| UCM storage | Temporary — files deleted after ~7 days |
| Non-extract PVOs | Can be slow and resource-intensive |
| Custom objects | Flexfields require additional configuration |
| Deleted records | Hard deletes not captured — need workarounds |
