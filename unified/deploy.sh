#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# COS UNIFIED FINANCIAL LAKEHOUSE — PRODUCTION DEPLOYMENT
# One command: ./deploy.sh
# Executes: Bronze → Silver → Gold → Validation via Athena
#
# Works in: AWS CloudShell (no boto3, no Spark, no Python)
# Requires: AWS CLI, Athena workgroup, Glue databases, S3 bucket
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

WORKGROUP="cos-financial-lakehouse"
REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"
POLL_INTERVAL=3
MAX_WAIT=300

TOTAL_QUERIES=0
SUCCEEDED_QUERIES=0
FAILED_QUERIES=0

# ─────────────────────────────────────────────────────────────────────
# FUNCTION: Execute one Athena SQL statement with polling
# ─────────────────────────────────────────────────────────────────────
execute_athena_query() {
    local sql="$1"
    local database="$2"
    local label="$3"

    TOTAL_QUERIES=$((TOTAL_QUERIES + 1))

    # Start query execution
    local query_id
    query_id=$(aws athena start-query-execution \
        --query-string "$sql" \
        --query-execution-context "Database=$database" \
        --work-group "$WORKGROUP" \
        --region "$REGION" \
        --output text \
        --query 'QueryExecutionId' 2>&1)

    local rc=$?
    if [ $rc -ne 0 ]; then
        echo "      ❌ FAILED to start query: $query_id"
        FAILED_QUERIES=$((FAILED_QUERIES + 1))
        return 1
    fi

    echo "      QueryExecutionId: $query_id"

    # Poll for completion
    local elapsed=0
    local state=""

    while [ $elapsed -lt $MAX_WAIT ]; do
        state=$(aws athena get-query-execution \
            --query-execution-id "$query_id" \
            --region "$REGION" \
            --output text \
            --query 'QueryExecution.Status.State' 2>/dev/null)

        case "$state" in
            SUCCEEDED)
                echo "      ✅ SUCCEEDED"
                SUCCEEDED_QUERIES=$((SUCCEEDED_QUERIES + 1))
                return 0
                ;;
            FAILED)
                local reason
                reason=$(aws athena get-query-execution \
                    --query-execution-id "$query_id" \
                    --region "$REGION" \
                    --output text \
                    --query 'QueryExecution.Status.StateChangeReason' 2>/dev/null)
                echo "      ❌ FAILED: $reason"
                FAILED_QUERIES=$((FAILED_QUERIES + 1))
                return 1
                ;;
            CANCELLED)
                echo "      ❌ CANCELLED"
                FAILED_QUERIES=$((FAILED_QUERIES + 1))
                return 1
                ;;
            QUEUED|RUNNING)
                sleep $POLL_INTERVAL
                elapsed=$((elapsed + POLL_INTERVAL))
                ;;
            *)
                sleep $POLL_INTERVAL
                elapsed=$((elapsed + POLL_INTERVAL))
                ;;
        esac
    done

    echo "      ❌ TIMEOUT after ${MAX_WAIT}s (state: $state)"
    FAILED_QUERIES=$((FAILED_QUERIES + 1))
    return 1
}

# ─────────────────────────────────────────────────────────────────────
# FUNCTION: Process a SQL file — split by semicolons, execute each
# ─────────────────────────────────────────────────────────────────────
process_sql_file() {
    local filepath="$1"
    local database="$2"
    local step_name="$3"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $step_name"
    echo "  File: $(basename "$filepath")"
    echo "  Database: $database"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ ! -f "$filepath" ]; then
        echo "  ❌ File not found: $filepath"
        return 1
    fi

    # Read file, strip comments, split by semicolons
    local stmt=""
    local stmt_num=0

    while IFS= read -r line || [ -n "$line" ]; do
        # Strip leading/trailing whitespace
        local trimmed
        trimmed=$(echo "$line" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

        # Skip empty lines and comment-only lines
        if [ -z "$trimmed" ]; then
            continue
        fi
        if [[ "$trimmed" == --* ]]; then
            continue
        fi

        # Accumulate the statement
        if [ -z "$stmt" ]; then
            stmt="$trimmed"
        else
            stmt="$stmt $trimmed"
        fi

        # Check if statement ends with semicolon
        if [[ "$trimmed" == *";" ]]; then
            # Remove trailing semicolon
            stmt="${stmt%%;}"
            stmt=$(echo "$stmt" | sed 's/;$//')

            # Skip if empty after cleanup
            if [ -z "$(echo "$stmt" | tr -d '[:space:]')" ]; then
                stmt=""
                continue
            fi

            stmt_num=$((stmt_num + 1))
            local preview
            preview=$(echo "$stmt" | cut -c1-70)
            echo ""
            echo "    [$stmt_num] $preview..."

            execute_athena_query "$stmt" "$database" "stmt_$stmt_num"

            if [ $? -ne 0 ]; then
                echo ""
                echo "  ⚠️  Statement $stmt_num failed. Continuing..."
            fi

            stmt=""
        fi
    done < "$filepath"

    # Handle final statement without trailing semicolon
    if [ -n "$(echo "$stmt" | tr -d '[:space:]')" ]; then
        stmt_num=$((stmt_num + 1))
        local preview
        preview=$(echo "$stmt" | cut -c1-70)
        echo ""
        echo "    [$stmt_num] $preview..."
        execute_athena_query "$stmt" "$database" "stmt_$stmt_num"
    fi

    echo ""
    echo "  ✓ Completed: $stmt_num statements processed"
}

# ─────────────────────────────────────────────────────────────────────
# FUNCTION: Run validation count query and display result
# ─────────────────────────────────────────────────────────────────────
validate_count() {
    local table="$1"
    local database="$2"

    local sql="SELECT COUNT(*) AS cnt FROM $table"

    local query_id
    query_id=$(aws athena start-query-execution \
        --query-string "$sql" \
        --query-execution-context "Database=$database" \
        --work-group "$WORKGROUP" \
        --region "$REGION" \
        --output text \
        --query 'QueryExecutionId' 2>/dev/null)

    # Wait for result
    local elapsed=0
    while [ $elapsed -lt 60 ]; do
        local state
        state=$(aws athena get-query-execution \
            --query-execution-id "$query_id" \
            --region "$REGION" \
            --output text \
            --query 'QueryExecution.Status.State' 2>/dev/null)

        if [ "$state" = "SUCCEEDED" ]; then
            local count
            count=$(aws athena get-query-results \
                --query-execution-id "$query_id" \
                --region "$REGION" \
                --output text \
                --query 'ResultSet.Rows[1].Data[0].VarCharValue' 2>/dev/null)
            echo "    $table: $count rows"
            return 0
        elif [ "$state" = "FAILED" ] || [ "$state" = "CANCELLED" ]; then
            echo "    $table: ❌ query failed"
            return 1
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    echo "    $table: ❌ timeout"
    return 1
}

# ═══════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  COS UNIFIED FINANCIAL LAKEHOUSE — DEPLOYMENT"
echo "  Oracle Fusion → Bronze → Silver → Gold → Analytics"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Region:    $REGION"
echo "  Workgroup: $WORKGROUP"
echo "  SQL Dir:   $SQL_DIR"
echo "  Time:      $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════════"

# Verify AWS access
echo ""
echo "  Verifying AWS access..."
aws sts get-caller-identity --region "$REGION" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ AWS credentials not configured. Run: aws configure"
    exit 1
fi
echo "  ✅ AWS credentials valid"

# Verify workgroup exists
aws athena get-work-group --work-group "$WORKGROUP" --region "$REGION" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Athena workgroup '$WORKGROUP' not found."
    echo "     Run: cd infrastructure && terraform apply"
    exit 1
fi
echo "  ✅ Athena workgroup found"

# ─────────────────────────────────────────────────────────────────────
# STEP 1: Create Iceberg tables
# ─────────────────────────────────────────────────────────────────────
process_sql_file "$SQL_DIR/01_create_tables.sql" "cos_gold" "📋 STEP 1: Create Iceberg Tables"

# ─────────────────────────────────────────────────────────────────────
# STEP 2: Load Bronze layer (112 rows)
# ─────────────────────────────────────────────────────────────────────
process_sql_file "$SQL_DIR/02_load_bronze.sql" "cos_bronze" "📥 STEP 2: Load Bronze Layer (Oracle Fusion BICC Data)"

# ─────────────────────────────────────────────────────────────────────
# STEP 3: Transform Bronze → Silver
# ─────────────────────────────────────────────────────────────────────
process_sql_file "$SQL_DIR/03_bronze_to_silver.sql" "cos_silver" "🔄 STEP 3: Bronze → Silver (Dedup + Enrich)"

# ─────────────────────────────────────────────────────────────────────
# STEP 4: Load Gold star schema
# ─────────────────────────────────────────────────────────────────────
process_sql_file "$SQL_DIR/04_silver_to_gold.sql" "cos_gold" "⭐ STEP 4: Silver → Gold (Star Schema)"

# ─────────────────────────────────────────────────────────────────────
# STEP 5: Validation
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ STEP 5: Validation — Row Counts"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

validate_count "cos_bronze.budget_control" "cos_bronze"
validate_count "cos_silver.budget_control_clean" "cos_silver"
validate_count "cos_gold.dim_coa" "cos_gold"
validate_count "cos_gold.dim_period" "cos_gold"
validate_count "cos_gold.dim_supplier" "cos_gold"
validate_count "cos_gold.fact_budgetary_control" "cos_gold"

# ─────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  🎉 DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Queries executed: $TOTAL_QUERIES"
echo "  Succeeded:        $SUCCEEDED_QUERIES"
echo "  Failed:           $FAILED_QUERIES"
echo ""
echo "  Try in Athena:"
echo ""
echo "    SELECT dc.department_description,"
echo "           ROUND(SUM(f.budget_amount)/1e6, 1) AS budget_M,"
echo "           ROUND(SUM(f.actual_amount)/1e6, 1) AS actual_M"
echo "    FROM cos_gold.fact_budgetary_control f"
echo "    JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key"
echo "    GROUP BY dc.department_description"
echo "    ORDER BY budget_M DESC;"
echo ""
echo "  Full analytics: Run unified/sql/05_validate.sql in Athena"
echo ""

if [ $FAILED_QUERIES -gt 0 ]; then
    echo "  ⚠️  $FAILED_QUERIES queries failed. Check output above."
    exit 1
fi
