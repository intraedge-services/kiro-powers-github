# Enterprise Monitoring — COS Iceberg Lakehouse

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                                   │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  CloudWatch  │    │  CloudWatch  │    │    SNS       │          │
│  │  Metrics     │    │  Logs        │    │  Alerts      │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                    │                   │
│         ▼                   ▼                    ▼                   │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              CloudWatch Dashboard                         │       │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │       │
│  │  │Snapshot│ │ File   │ │ Query  │ │Storage │           │       │
│  │  │ Count  │ │ Count  │ │Latency │ │ Growth │           │       │
│  │  └────────┘ └────────┘ └────────┘ └────────┘           │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│  Data Sources:                                                       │
│  ├── Glue Job metrics (ETL duration, records processed)             │
│  ├── Athena query metrics (scan size, duration)                     │
│  ├── S3 metrics (bucket size, request count)                        │
│  └── Custom metrics (Iceberg table health via Lambda)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Snapshot Growth Monitoring

### Lambda Function: Iceberg Health Check

```python
# lambda_iceberg_health.py
import boto3
import json
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')
athena = boto3.client('athena')

TABLES = [
    ('cos_gold', 'fact_budgetary_control'),
    ('cos_gold', 'fact_gl_actuals'),
    ('cos_gold', 'fact_ap_invoices'),
    ('cos_gold', 'fact_purchase_orders'),
]

def lambda_handler(event, context):
    for database, table in TABLES:
        # Query snapshot count
        query = f"""
            SELECT
                COUNT(*) AS snapshot_count,
                MAX(committed_at) AS latest_snapshot
            FROM {database}.{table}.snapshots
        """
        result = run_athena_query(query, database)

        # Query file statistics
        file_query = f"""
            SELECT
                COUNT(*) AS file_count,
                SUM(file_size_in_bytes) AS total_bytes,
                AVG(file_size_in_bytes) AS avg_file_bytes,
                MIN(file_size_in_bytes) AS min_file_bytes
            FROM {database}.{table}.files
        """
        file_result = run_athena_query(file_query, database)

        # Publish to CloudWatch
        publish_metrics(database, table, result, file_result)

    return {'statusCode': 200}


def publish_metrics(database, table, snapshot_data, file_data):
    namespace = 'COS/IcebergHealth'
    dimensions = [
        {'Name': 'Database', 'Value': database},
        {'Name': 'Table', 'Value': table}
    ]

    metrics = [
        {
            'MetricName': 'SnapshotCount',
            'Value': snapshot_data['snapshot_count'],
            'Unit': 'Count',
            'Dimensions': dimensions
        },
        {
            'MetricName': 'FileCount',
            'Value': file_data['file_count'],
            'Unit': 'Count',
            'Dimensions': dimensions
        },
        {
            'MetricName': 'TotalStorageMB',
            'Value': file_data['total_bytes'] / 1024 / 1024,
            'Unit': 'Megabytes',
            'Dimensions': dimensions
        },
        {
            'MetricName': 'AvgFileSizeMB',
            'Value': file_data['avg_file_bytes'] / 1024 / 1024,
            'Unit': 'Megabytes',
            'Dimensions': dimensions
        },
        {
            'MetricName': 'MinFileSizeMB',
            'Value': file_data['min_file_bytes'] / 1024 / 1024,
            'Unit': 'Megabytes',
            'Dimensions': dimensions
        }
    ]

    cloudwatch.put_metric_data(
        Namespace=namespace,
        MetricData=metrics
    )
```

---

## 2. CloudWatch Alarms

```yaml
# cloudformation_monitoring.yaml
Resources:
  SnapshotCountAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: COS-Iceberg-SnapshotCount-High
      Namespace: COS/IcebergHealth
      MetricName: SnapshotCount
      Dimensions:
        - Name: Table
          Value: fact_budgetary_control
      Statistic: Maximum
      Period: 3600
      EvaluationPeriods: 1
      Threshold: 50
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic
      AlarmDescription: "Snapshot count exceeds 50 — run expire_snapshots"

  SmallFileAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: COS-Iceberg-SmallFiles-Warning
      Namespace: COS/IcebergHealth
      MetricName: AvgFileSizeMB
      Dimensions:
        - Name: Table
          Value: fact_budgetary_control
      Statistic: Minimum
      Period: 3600
      EvaluationPeriods: 1
      Threshold: 64
      ComparisonOperator: LessThanThreshold
      AlarmActions:
        - !Ref AlertTopic
      AlarmDescription: "Average file size below 64MB — run compaction"

  FileCountAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: COS-Iceberg-FileCount-Critical
      Namespace: COS/IcebergHealth
      MetricName: FileCount
      Dimensions:
        - Name: Table
          Value: fact_budgetary_control
      Statistic: Maximum
      Period: 3600
      EvaluationPeriods: 1
      Threshold: 500
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: cos-iceberg-alerts
      Subscription:
        - Protocol: email
          Endpoint: data-team@cityofscottsdale.gov
```

---

## 3. Glue Job Monitoring

```python
# Monitor ETL job health
import boto3

glue = boto3.client('glue')
cloudwatch = boto3.client('cloudwatch')

def check_glue_jobs():
    jobs = [
        'cos-bronze-ingestion',
        'cos-silver-merge',
        'cos-gold-refresh',
        'cos-iceberg-maintenance'
    ]

    for job_name in jobs:
        response = glue.get_job_runs(JobName=job_name, MaxResults=1)
        if response['JobRuns']:
            run = response['JobRuns'][0]
            status = run['JobRunState']
            duration = (run.get('CompletedOn', datetime.now()) -
                       run['StartedOn']).total_seconds()

            cloudwatch.put_metric_data(
                Namespace='COS/GlueJobs',
                MetricData=[
                    {
                        'MetricName': 'JobDuration',
                        'Value': duration,
                        'Unit': 'Seconds',
                        'Dimensions': [{'Name': 'JobName', 'Value': job_name}]
                    },
                    {
                        'MetricName': 'JobStatus',
                        'Value': 1 if status == 'SUCCEEDED' else 0,
                        'Unit': 'Count',
                        'Dimensions': [{'Name': 'JobName', 'Value': job_name}]
                    }
                ]
            )
```

---

## 4. Query Performance Monitoring

```sql
-- Athena query to track query performance over time
-- Run daily and publish to CloudWatch

SELECT
    DATE(query_execution_context.database) AS query_date,
    COUNT(*) AS query_count,
    AVG(statistics.data_scanned_in_bytes) / 1024 / 1024 AS avg_scan_mb,
    AVG(statistics.engine_execution_time_in_millis) AS avg_duration_ms,
    MAX(statistics.engine_execution_time_in_millis) AS max_duration_ms
FROM information_schema.query_execution
WHERE query_execution_context.database = 'cos_gold'
  AND status.state = 'SUCCEEDED'
  AND DATE(submission_date_time) >= CURRENT_DATE - INTERVAL '7' DAY
GROUP BY 1
ORDER BY 1 DESC;
```

---

## 5. Storage Growth Tracking

```python
# S3 bucket metrics via CloudWatch
# Already available natively — just create dashboard

# Custom metric: track growth rate
def track_storage_growth():
    s3 = boto3.client('s3')

    prefixes = {
        'bronze': 'bronze/',
        'silver': 'silver/',
        'gold': 'gold/',
        'metadata': 'gold/fact_budgetary_control/metadata/'
    }

    for layer, prefix in prefixes.items():
        response = s3.list_objects_v2(
            Bucket='cos-financial-lakehouse',
            Prefix=prefix
        )

        total_size = sum(obj['Size'] for obj in response.get('Contents', []))
        object_count = response.get('KeyCount', 0)

        cloudwatch.put_metric_data(
            Namespace='COS/Storage',
            MetricData=[
                {
                    'MetricName': 'LayerSizeMB',
                    'Value': total_size / 1024 / 1024,
                    'Unit': 'Megabytes',
                    'Dimensions': [{'Name': 'Layer', 'Value': layer}]
                },
                {
                    'MetricName': 'ObjectCount',
                    'Value': object_count,
                    'Unit': 'Count',
                    'Dimensions': [{'Name': 'Layer', 'Value': layer}]
                }
            ]
        )
```

---

## 6. Partition Skew Analysis

```sql
-- Detect uneven partition distribution
SELECT
    partition AS partition_value,
    COUNT(*) AS file_count,
    SUM(file_size_in_bytes) / 1024 / 1024 AS partition_size_mb,
    SUM(record_count) AS total_records
FROM cos_gold.fact_budgetary_control.files
GROUP BY partition
ORDER BY partition_size_mb DESC;

-- Alert if any partition is 5x larger than average
-- This indicates skew that hurts query parallelism
```

---

## 7. Dashboard Layout (CloudWatch)

```
┌─────────────────────────────────────────────────────────────────────┐
│  COS ICEBERG LAKEHOUSE — OPERATIONAL DASHBOARD                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ ETL Status  │ │ Snapshot    │ │ Avg Query   │ │ Storage     │  │
│  │ ✅ All Pass │ │ Count: 12   │ │ Time: 1.2s  │ │ 10.5 GB     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                      │
│  ┌────────────────────────────────┐ ┌────────────────────────────┐  │
│  │ Storage Growth (7 days)        │ │ Query Latency (7 days)     │  │
│  │ ████████████████░░░░ 10.5 GB   │ │ ▁▂▁▃▁▂▁ avg 1.2s          │  │
│  └────────────────────────────────┘ └────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────┐ ┌────────────────────────────┐  │
│  │ File Count by Table            │ │ Glue Job Duration          │  │
│  │ fact_bc:     4 files ✅        │ │ bronze:  45s ✅            │  │
│  │ fact_gl:    12 files ✅        │ │ silver: 120s ✅            │  │
│  │ fact_ap:     8 files ✅        │ │ gold:    90s ✅            │  │
│  │ fact_po:     6 files ✅        │ │ maint:  180s ✅            │  │
│  └────────────────────────────────┘ └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```
