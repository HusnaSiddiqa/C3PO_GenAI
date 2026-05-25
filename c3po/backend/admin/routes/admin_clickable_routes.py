import csv
import io
from datetime import datetime

from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError
from fastapi import HTTPException, APIRouter, Body, UploadFile, File
from fastapi.responses import StreamingResponse
from utils.constants import CLICKABLE_QUESTIONS_TABLE
from utils.dynamodb import (get_table, _scan_first_match)

# --- Admin API for dynamic table access ---
router = APIRouter()

clickable_questions_table = get_table(CLICKABLE_QUESTIONS_TABLE)


def is_admin(user):
    return 'APP_us_sbx_iidd_genai_admin_user' in user.get('Groups', [])

# --- Admin Clickable Questions Routes ---

# GET /clickable-questions/download
# Allows admin to download all clickable questions from the DynamoDB table as a CSV file
# Auth: Admin only
# Use case: Admins can export all clickable questions for review, backup, or migration
@router.get("/clickable-questions/download")
def download_clickable_questions_csv(
        # user=Depends(verify_okta_jwt)
):
    """
    Download all clickable questions from the DynamoDB table as a CSV file.
    Sorted by numeric part of PK ascending. Excludes PK, SK, updated_at, and updated_by fields.
    Admin only.
    """
    # if not is_admin(user):
    #     raise HTTPException(status_code=403, detail="Admins only")
    try:
        table = clickable_questions_table
        items = []
        last_evaluated_key = None

        # Full table scan to get all items (no pagination in response)
        while True:
            scan_kwargs = {}
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key

            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))

            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break

        # Remove PK, SK, updated_at, and updated_by from each item
        for item in items:
            item.pop('PK', None)
            item.pop('SK', None)
            item.pop('updated_at', None)
            item.pop('updated_by', None)

        # Sort items by numeric part of PK ascending
        def extract_pk_number(item):
            pk = item.get('PK', '')
            if pk.startswith('QUESTION#Q'):
                try:
                    return int(pk.split('QUESTION#Q')[1])
                except Exception:
                    return 0
            return 0

        items.sort(key=extract_pk_number)

        # Prepare CSV
        if not items:
            raise HTTPException(status_code=404, detail="No clickable questions found")

        # Get all fieldnames from the first item
        fieldnames = [key for key in items[0].keys()]

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(items)
        output.seek(0)

        # Return as StreamingResponse for CSV download
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ground_truth.csv"}
        )

    except Exception as e:
        print(f"Error downloading clickable questions: {e}")
        raise HTTPException(status_code=500, detail=f"Error downloading clickable questions: {str(e)}")

# POST /clickable-questions/upload
# Allows admin to upload and replace all clickable questions in the DynamoDB table from a CSV file
# Auth: Admin only
# Use case: Admins can bulk update clickable questions for review, correction, or migration
@router.post("/clickable-questions/upload")
async def upload_clickable_questions_csv(
        user_id: str = Body(..., embed=True),
        file: UploadFile = File(...),
        # user=Depends(verify_okta_jwt)
):
    """
    Upload clickable questions from a CSV file to DynamoDB.
    Validates file type, file name, and mandatory fields.
    Deletes all existing data before inserting new data.
    Assigns question_id as Q1, Q2, ... in order of CSV rows.
    The 'enabled' field, if present, must be 'true' or 'false' (case-insensitive). If not provided, defaults to False.
    The 'order' field is stored as-is from the CSV.
    Admin only.
    """
    # if not is_admin(user):
    #     raise HTTPException(status_code=403, detail="Admins only")

    # Validate file type and name
    if file.content_type != "text/csv":
        raise HTTPException(status_code=400, detail="File must be a CSV")
    if file.filename != "ground_truth.csv":
        raise HTTPException(status_code=400, detail="File name must be ground_truth.csv")

    try:
        # Read CSV content
        content = await file.read()
        csvfile = io.StringIO(content.decode("utf-8"))
        reader = csv.DictReader(csvfile)

        # Validate mandatory fields (enabled is NOT mandatory)
        mandatory_fields = {
            "category", "question"
        }
        for field in mandatory_fields:
            if field not in reader.fieldnames:
                raise HTTPException(status_code=400, detail=f"Missing mandatory field: {field}")

        # Delete all existing items from the table
        table = clickable_questions_table
        existing_items = []
        last_evaluated_key = None
        while True:
            scan_kwargs = {}
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
            response = table.scan(**scan_kwargs)
            existing_items.extend(response.get('Items', []))
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        with table.batch_writer() as batch:
            for item in existing_items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})

        # Prepare new items with sequential question_id (Q1, Q2, ...)
        new_items = []
        updated_at = datetime.utcnow().isoformat() + "Z"
        for idx, row in enumerate(reader, start=1):
            # Validate row mandatory fields
            for field in mandatory_fields:
                if not row.get(field):
                    raise HTTPException(status_code=400, detail=f"Missing value for mandatory field: {field}")

            question_id = f"Q{idx:02}"
            pk = f"QUESTION#{question_id}"
            sk = f"CATEGORY#{row['category']}"

            # Handle enabled field
            enabled_val = (row.get("enabled") or "").strip().lower()
            if enabled_val == "":
                enabled = False
            elif enabled_val in ("true", "false"):
                enabled = enabled_val == "true"
            else:
                raise HTTPException(status_code=400, detail="Enabled field must be 'true' or 'false' (case-insensitive) if provided")

            item = {
                "PK": pk,
                "SK": sk,
                "category": row["category"],
                "question_id": question_id,
                "question": row["question"],
                "expected_answer": row.get("expected_answer"),
                "enabled": enabled,
                "order": int(row["order"]) if row.get("order") else 0,
                "sesitivity": row.get("sesitivity"),
                "sql_query": row.get("sql_query"),
                "updated_at": updated_at,
                "updated_by": user_id
            }

            new_items.append(item)

        # Insert new items
        with table.batch_writer() as batch:
            for item in new_items:
                batch.put_item(Item=item)

        return {"status": "success", "inserted": len(new_items)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error uploading clickable questions: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading clickable questions: {str(e)}")


# GET /clickable-questions
# Returns: List of clickable questions with PK, SK, question_id, question, expected_answer, expected_sql, enabled, and category, sorted by PK numeric value ascending
# Use case: Any user can view all clickable questions with their IDs and details
@router.get("/clickable-questions")
def get_clickable_questions():
    """
    Fetch all clickable questions with PK, SK, question_id, question, expected_answer, expected_sql (optional), enabled, and category.
    Sorted by numeric part of PK ascending.
    """
    try:
        table = clickable_questions_table
        items = []
        last_evaluated_key = None

        # Full table scan to get all items
        while True:
            scan_kwargs = {}
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key

            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))

            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break

        # Sort items by numeric part of PK ascending
        def extract_pk_number(item):
            pk = item.get('PK', '')
            if pk.startswith('QUESTION#Q'):
                try:
                    return int(pk.split('QUESTION#Q')[1])
                except Exception:
                    return 0
            return 0

        items.sort(key=extract_pk_number)

        # Prepare response with selected fields
        result = []
        for item in items:
            result.append({
                "PK": item.get("PK"),
                "SK": item.get("SK"),
                "question_id": item.get("question_id"),
                "question": item.get("question"),
                "expected_answer": item.get("expected_answer"),
                "expected_sql": item.get("sql_query"),  # Optional field
                "enabled": item.get("enabled"),
                "category": item.get("category"),
                "agent_type": item.get("agent_type"),
                "scorer": item.get("scorer"),
            })

        return result

    except Exception as e:
        print(f"Error fetching clickable questions: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching clickable questions: {str(e)}")


@router.post("/clickable-questions/search")
def search_clickable_questions(question: str = Body(..., embed=True)):
    table = clickable_questions_table
    QUESTION_GSI_NAME = "QuestionLastUpdated"
    matched_item = None

    # --- 1. Try querying via GSI (fast path) ---
    try:
        response = table.query(
            IndexName=QUESTION_GSI_NAME,
            KeyConditionExpression=Key("question").eq(question.strip()),
            FilterExpression=Attr("enabled").eq(True),
            Limit=1,  # we only need one since it's unique
        )
        items = response.get("Items", [])
        if items:
            matched_item = items[0]

    except ClientError as e:
        error_msg = str(e)
        error_code = e.response.get("Error", {}).get("Code", "")

        # If index doesn't exist / invalid → we'll fallback to scan
        if error_code == "ValidationException":
            print(f"[INFO] GSI '{QUESTION_GSI_NAME}' not found. Falling back to scan.")
        else:
            # Real AWS / network / auth issues → bubble up as 500
            print(f"[ERROR] Query on GSI failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Error querying clickable questions"
            )
    if matched_item is None:
        matched_item = _scan_first_match(table, Attr("question").eq(question) & Attr("enabled").eq(True))
    if matched_item is None:
        return {}

    # --- 4. Normalize response shape ---
    return {
        "PK": matched_item.get("PK"),
        "SK": matched_item.get("SK"),
        "question_id": matched_item.get("question_id"),
        "question": matched_item.get("question"),
        "expected_answer": matched_item.get("expected_answer"),
        "sql_query": matched_item.get("sql_query"),
        "enabled": matched_item.get("enabled"),
        "category": matched_item.get("category"),
        "agent_type": matched_item.get("agent_type"),
        "scorer": matched_item.get("scorer"),
    }

# PUT /clickable-questions/update
# Allows admin to update category and enabled fields for a clickable question
# Auth: Admin only
# Use case: Admins can correct or toggle category/enabled for a specific clickable question
# list of objects in request
@router.put("/clickable-questions/update")
def update_clickable_question(
        questions: list[dict] = Body(..., embed=True),
):
    """
    Update category and enabled fields for multiple clickable questions.
    Admin only.
    """
    # if not is_admin(user):
    #     raise HTTPException(status_code=403, detail="Admins only")

    table = clickable_questions_table
    updated_items = []

    try:
        for question in questions:
            PK = question.get("PK")
            SK = question.get("SK")
            category = question.get("category")
            enabled = question.get("enabled")
            scorer = question.get("scorer")

            if not PK or not SK or not category or enabled is None:
                raise HTTPException(status_code=400, detail="PK, SK, category, and enabled are required fields")

            # Fetch the existing item
            response = table.get_item(Key={"PK": PK, "SK": SK})
            item = response.get("Item")
            if not item:
                raise HTTPException(status_code=404, detail=f"Clickable question with PK={PK} and SK={SK} not found")

            # Update fields using update_item
            updated_at = datetime.utcnow().isoformat() + "Z"
            update_expression = "SET category = :category, enabled = :enabled, updated_at = :updated_at"
            expression_attribute_values = {
                ":category": category,
                ":enabled": enabled,
                ":updated_at": updated_at
            }

            if scorer is not None and scorer != "N/A":
                update_expression += ", scorer = :scorer"
                expression_attribute_values[":scorer"] = scorer

            table.update_item(
                Key={"PK": PK, "SK": SK},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values
            )

            updated_items.append({
                "PK": PK,
                "SK": SK,
                "category": category,
                "enabled": enabled,
                "scorer": scorer,
                "updated_at": updated_at
            })

        return {"status": "success", "updated_items": updated_items}

    except Exception as e:
        print(f"Error updating clickable questions: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating clickable questions: {str(e)}")