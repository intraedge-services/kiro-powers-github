# Iceberg Limitations, Challenges & Comparison

## Iceberg Limitations on AWS

| Limitation | Impact | Workaround |
|---|---|---|
| No real-time streaming | Minimum ~1 min commit latency | Use Kinesis → staging → batch micro-loads |
| Athena MERGE limited to Iceberg v2 | Must use format-version 2 | Already using v2 in our design |
| No automatic compaction | Small files accumulate | Scheduled Glue maintenance jobs |
| Glue Catalog eventual consistency | Brief delay after commits | Retry logic in queries |
| No row-level locking | Concurrent writes can conflict | Commit retry + serialized writes per table |
| Athena 100 partition limit per query | Complex queries may fail | Design partitions to stay under limit |
| No materialized views | Can't pre-compute aggregates | Use Gold layer as pre-aggregated |
| Schema evolution: no column rename in Athena | Athena limitation, not Iceberg | Use Spark/EMR for renames |

---

## Concurrency Considerations

### Optimistic Concurrency Control

```
Writer A: Read snapshot 5 → compute → attempt commit
Writer B: Read snapshot 5 → compute → attempt commit

If A commits first → snapshot 6 created
B's commit fails → retry with snapshot 6 as base

Iceberg handles this via:
  commit.retry.num-retries = 4
  commit.retry.min-wait-ms = 100
```

### COS Pipeline Concurrency Model

```
┌─────────────────────────────────────────────────────────┐
│  SAFE: Sequential pipeline (our design)                  │
│                                                          │
│  06:00 BICC Extract → Bronze (append only, no conflict) │
│  06:30 Silver MERGE (single writer per table)            │
│  07:00 Gold refresh (single writer per table)            │
│  07:30 Power BI refresh                                  │
│                                                          │
│  RISK: Parallel writes to same table                     │
│  → Mitigated by: sequential scheduling + retry config    │
└─────────────────────────────────────────────────────────┘
```

---

## Metadata Scaling

| Table Size | Snapshots | Manifests | Metadata Size | Planning Time |
|---|---|---|---|---|
| < 1GB | < 50 | < 10 | < 1MB | < 100ms |
| 1-100GB | 50-200 | 10-50 | 1-10MB | 100-500ms |
| 100GB-1TB | 200-1000 | 50-200 | 10-100MB | 500ms-2s |
| > 1TB | > 1000 | > 200 | > 100MB | > 2s ⚠️ |

**COS projection:** Gold layer ~500MB total → well within safe limits.

**Mitigation for growth:**
- Expire snapshots (keep 7 days)
- Rewrite manifests weekly
- Monitor metadata size via CloudWatch

---

## Athena-Specific Limitations

| Feature | Athena Support | Alternative |
|---|---|---|
| MERGE INTO | ✅ Iceberg v2 only | — |
| Time travel (TIMESTAMP) | ✅ | — |
| Time travel (VERSION) | ✅ | — |
| Schema evolution (ADD COLUMN) | ✅ | — |
| Schema evolution (RENAME) | ❌ | Use Spark |
| Schema evolution (DROP) | ✅ | — |
| Partition evolution | ✅ | — |
| expire_snapshots | ❌ (use Spark) | Glue job |
| rewrite_data_files | ❌ (use Spark) | Glue job |
| remove_orphan_files | ❌ (use Spark) | Glue job |
| Row-level deletes | ✅ (merge-on-read) | — |
| CTAS (Create Table As) | ✅ | — |

**Key insight:** Athena is great for querying and simple DML. Maintenance operations require Spark (via Glue or EMR).

---

## Cost Considerations

### S3 Storage Costs

| Component | Size Estimate | Monthly Cost |
|---|---|---|
| Bronze (append-only, 1 year) | ~5 GB | $0.12 |
| Silver (deduplicated) | ~2 GB | $0.05 |
| Gold (star schema) | ~500 MB | $0.01 |
| Metadata (JSON + Avro) | ~50 MB | $0.001 |
| Snapshots (7-day retention) | ~3 GB | $0.07 |
| **Total** | **~10.5 GB** | **~$0.25/month** |

### Compute Costs

| Operation | Frequency | Duration | Monthly Cost |
|---|---|---|---|
| Athena queries (Power BI) | 100/day | 1-3s each | ~$5 (per TB scanned) |
| Glue ETL (Bronze→Silver→Gold) | Daily | 5 min | ~$3 |
| Glue Maintenance (compaction) | Daily | 3 min | ~$2 |
| **Total compute** | | | **~$10/month** |

**Total estimated cost: ~$10.25/month** for the COS financial lakehouse.

---

## Optimization Tradeoffs

| Decision | Benefit | Cost |
|---|---|---|
| Iceberg v2 (merge-on-read) | Faster writes, lower latency | Slightly slower reads until compaction |
| 7-day snapshot retention | Low storage cost | Can't time-travel beyond 7 days |
| Daily compaction | Fast queries | Extra Glue compute cost |
| Hidden partitioning | User-friendly queries | Slightly more metadata |
| Sort-order compaction | Excellent pruning | Longer compaction time |
| Zstd compression | 30% smaller files | Slightly more CPU on read |

---

## Comparison: Iceberg vs Delta Lake vs Hudi

| Feature | Apache Iceberg | Delta Lake | Apache Hudi |
|---|---|---|---|
| **Open standard** | ✅ Apache Foundation | ❌ Databricks-controlled | ✅ Apache Foundation |
| **AWS native support** | ✅ Athena, Glue, EMR | ⚠️ Limited (EMR only) | ⚠️ Limited |
| **Hidden partitioning** | ✅ | ❌ | ❌ |
| **Partition evolution** | ✅ No rewrite needed | ❌ Requires rewrite | ❌ |
| **Schema evolution** | ✅ Full (add/drop/rename/reorder) | ⚠️ Add/rename only | ⚠️ Limited |
| **Time travel** | ✅ Snapshot + timestamp | ✅ Version + timestamp | ⚠️ Limited |
| **MERGE performance** | ✅ Copy-on-write or merge-on-read | ✅ Copy-on-write | ✅ Merge-on-read |
| **Concurrent writes** | ✅ Optimistic concurrency | ✅ Optimistic concurrency | ⚠️ Lock-based |
| **Metadata scalability** | ✅ Manifest-based (scales to PB) | ⚠️ Transaction log (linear scan) | ⚠️ Timeline-based |
| **Compaction** | ✅ Binpack + sort | ✅ Optimize | ✅ Clustering |
| **Athena support** | ✅ Full DML + DDL | ❌ Read-only | ❌ Read-only |
| **Glue Catalog** | ✅ Native | ⚠️ Requires Unity Catalog | ⚠️ Requires Hudi sync |
| **Power BI DirectQuery** | ✅ Via Athena ODBC | ⚠️ Via Databricks only | ❌ |
| **Community momentum** | 🔥 Fastest growing | 🔥 Large (Databricks) | ⚠️ Declining |

### Why Iceberg for COS?

1. **AWS-native:** First-class support in Athena, Glue, EMR, Redshift Spectrum
2. **Partition evolution:** COS fiscal year changes won't require data rewrites
3. **Hidden partitioning:** Finance users query by date naturally — no partition awareness needed
4. **Open standard:** No vendor lock-in; works with any engine
5. **Metadata scalability:** Manifest-based approach handles growth without degradation
6. **Power BI integration:** DirectQuery via Athena ODBC — no intermediate layer needed
