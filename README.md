# COS_FINAL — Consolidated Oracle Source → PVO → Dimension/Fact Mapping

> **Purpose:** Single source of truth mapping every dataset from the Executive Financial Dashboard requirements to Oracle Fusion BICC PVOs, required fields, and target Snowflake dimensions/facts.
> **Oracle Release:** 25D
> **Source:** Executive Financial Dashboard Datasets requirement sheet

## Document Index

| # | Document | Contents |
|---|---|---|
| 1 | [01-master-dataset-mapping.md](01-master-dataset-mapping.md) | All 44 datasets → PVO → Snowflake raw → target dim/fact |
| 2 | [02-pvo-field-inventory.md](02-pvo-field-inventory.md) | Every PVO with its required fields and target columns |
| 3 | [03-dimension-field-lineage.md](03-dimension-field-lineage.md) | Each dimension with full field-level PVO lineage |
| 4 | [04-fact-field-lineage.md](04-fact-field-lineage.md) | Each fact with full field-level PVO lineage |
| 5 | [05-bus-matrix-with-pvo.md](05-bus-matrix-with-pvo.md) | Bus matrix annotated with source PVOs per cell |
| 6 | [06-executive-decision-traceability.md](06-executive-decision-traceability.md) | Each executive decision → datasets → PVOs → facts/dims needed |
