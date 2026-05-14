# Iceberg Advanced Demo — Manager Presentation Talking Points

## Opening Statement

"We built this lakehouse on Apache Iceberg — not raw Parquet — because Oracle Fusion financial data requires enterprise-grade data management. Let me show you why in 8 live demonstrations."

---

## Demo 1: Baseline

**Say:** "Here's our $2.1 billion budget across 9 departments. This is the Gold layer — the single source of truth that Power BI connects to. Every number here came from Oracle Fusion through our automated Bronze → Silver → Gold pipeline."

**Show:** Executive KPI query, department ranking.

---

## Demo 2: Bad Data Load (The Problem)

**Say:** "Now watch what happens when a bad BICC extract accidentally doubles the Police department budget. In a traditional Parquet data lake, this would be a disaster — the old data is gone, overwritten. You'd need to restore from backup, which takes hours."

**Show:** UPDATE that doubles budget. Show inflated total.

---

## Demo 3: Time Travel (The Solution)

**Say:** "With Iceberg, I can query the table as it was BEFORE the bad update. No restore, no backup, no downtime. One query, instant answer."

**Show:** `$iceberg_history` showing snapshots. `FOR TIMESTAMP AS OF` query returning correct values.

**Key line:** "This took 2 seconds. A Parquet restore would take 2 hours."

---

## Demo 4: Schema Evolution

**Say:** "Oracle Fusion 26A is adding new segments to the Chart of Accounts next quarter. With Parquet, we'd need to recreate every table, reload all historical data, and update every pipeline. With Iceberg — watch this."

**Show:** `ALTER TABLE ADD COLUMNS`. Query showing old data still works (NULLs for new columns). New data populates the columns.

**Key line:** "Zero downtime. Zero data movement. Zero pipeline changes. The old data coexists with the new schema."

---

## Demo 5: Incremental MERGE

**Say:** "Every morning, Oracle sends us only the records that changed — maybe 5 out of 10,000. With Parquet, we'd rewrite all 10,000 records. With Iceberg MERGE INTO, we update only the 5 that changed."

**Show:** MERGE INTO updating one record. Verify only that record changed.

**Key line:** "98% reduction in compute cost. Same result."

---

## Demo 6: Audit Trail

**Say:** "Every change is tracked as an immutable snapshot. Auditors can see exactly what the data looked like at any point in time. This isn't an application feature we built — it's built into the storage layer itself."

**Show:** `$iceberg_history`, `$snapshots`, `$files` metadata tables.

---

## Demo 7: Enterprise Scenarios

**Say:** "Let me show you real scenarios our finance team faces:"

- **Compliance audit:** "What was the budget on March 1st?" → One query, instant answer.
- **Bad load recovery:** Query previous snapshot, verify correct values, fix in seconds.
- **Concurrent ETL:** Two jobs writing simultaneously won't corrupt data (optimistic concurrency).
- **Schema drift:** Oracle adds unexpected columns — pipeline doesn't break.

---

## Demo 8: Why Iceberg > Parquet (Closing)

**Say:** "Here's the bottom line comparison:"

| Capability | Raw Parquet | Apache Iceberg |
|---|---|---|
| Time travel | ❌ Data overwritten | ✅ Query any historical state |
| Update 1 record | ❌ Rewrite entire table | ✅ MERGE INTO (single record) |
| Add column | ❌ Recreate table + reload | ✅ ALTER TABLE (instant) |
| Audit trail | ❌ None | ✅ Immutable snapshots |
| Bad data recovery | ❌ Restore from backup (hours) | ✅ Time travel (seconds) |
| ACID transactions | ❌ Partial writes possible | ✅ Atomic commits |
| Partition change | ❌ Rewrite all data | ✅ Partition evolution |

**Closing line:** "Iceberg gives us the reliability of a database with the scalability of a data lake. For Oracle Fusion financial data — where accuracy, auditability, and recoverability are non-negotiable — this is the only architecture that makes sense."

---

## Q&A Preparation

**Q: "What's the cost difference?"**
A: "Iceberg metadata adds ~1% storage overhead. But we save 98% on compute by using MERGE instead of full reloads. Net savings: significant."

**Q: "What if Iceberg has a bug?"**
A: "Iceberg is an Apache Foundation open standard used by Netflix, Apple, and AWS natively. It's the most battle-tested lakehouse format."

**Q: "Can Power BI still connect?"**
A: "Yes — Power BI connects via Athena ODBC. It doesn't know or care that the tables are Iceberg. It just sees fast SQL results."

**Q: "What about Oracle 26A changes?"**
A: "Schema evolution handles it. We demonstrated adding columns without any pipeline changes. When 26A ships, we add the new PVO columns and keep running."
