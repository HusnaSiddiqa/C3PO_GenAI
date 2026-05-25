import boto3
import os
from pathlib import Path
from boto3.dynamodb.conditions import Attr

# Load .env file if it exists
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    for line in env_file.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
ENV = os.getenv("ENV", "local")


def get_dynamodb_resource():
    if ENV == "local":
        return boto3.resource(
            "dynamodb",
            region_name=AWS_REGION,
            endpoint_url="http://localhost:8000",
            aws_access_key_id="dummy",
            aws_secret_access_key="dummy"
        )
    else:
        return boto3.resource(
            "dynamodb",
            region_name=AWS_REGION
        )


dynamodb = get_dynamodb_resource()


def get_table(table_name: str):
    return dynamodb.Table(table_name)



def _scan_first_match(table, filter_expr, projection: str | None = None, names: dict | None = None):
    params = {"FilterExpression": filter_expr}
    if projection:
        params["ProjectionExpression"] = projection
    if names:
        params["ExpressionAttributeNames"] = names

    resp = table.scan(**params)
    items = resp.get("Items", [])
    if items:
        return items[0]

    while "LastEvaluatedKey" in resp:
        params["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        resp = table.scan(**params)
        items = resp.get("Items", [])
        if items:
            return items[0]
    return None

def value_exists_already(table, value_to_check: str) -> bool:
    return _scan_first_match(
        table,
        Attr("value").eq(value_to_check),
        projection="KeyId"
    )
