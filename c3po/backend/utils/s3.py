import re
from typing import Iterator, List, Optional

import boto3
from botocore.exceptions import ClientError

s3 = boto3.client("s3")

def upload_to_s3(file_bytes: bytes, bucket: str, key: str):
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes
    )

def get_next_nlq_csv_key(bucket: str, prefix: str) -> str:
    paginator = s3.get_paginator("list_objects_v2")
    pages = paginator.paginate(Bucket=bucket, Prefix=prefix)

    numbers = []

    for page in pages:
        for obj in page.get("Contents", []):
            key = obj["Key"]

            filename = key.replace(prefix, "")
            match = re.fullmatch(r"(\d+)\.csv", filename)
            if match:
                numbers.append(int(match.group(1)))

    next_num = max(numbers) + 1 if numbers else 1
    return f"{prefix}{next_num}.csv"

def upload_to_s3_path(file_bytes: bytes, bucket_path: str):
    bucket_path = bucket_path.replace("s3://", "")
    bucket, key = bucket_path.split('/', 1)

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=file_bytes
    )

def stream_from_s3(bucket: str, key: str):
    response = s3.get_object(Bucket=bucket, Key=key)
    return response['Body']

def get_s3_client():
    return boto3.client("s3")

def read_s3_file(bucket: str, key: str, s3=None, file_format='json'):
    if s3 is None:
        s3 = get_s3_client()
    
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        
        if file_format == 'json':
            import json
            return json.loads(content)
        elif file_format == 'text':
            return content
        else:
            raise ValueError("Unsupported file format")
    except Exception as e:
        print(f"Error reading S3 file: {e}")
        return None


def list_s3_objects(bucket: str, prefix: str) -> List[str]:
    """List all object keys under a prefix."""
    keys: List[str] = []
    paginator = s3.get_paginator("list_objects_v2")

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])

    return keys


def stream_s3_csv_parts_as_one(
    bucket: str,
    ordered_keys: List[str],
    *,
    chunk_size: int = 1024 * 1024,
) -> Iterator[bytes]:
    header_line: Optional[bytes] = None
    first_file = True

    for key in ordered_keys:
        try:
            obj = s3.get_object(Bucket=bucket, Key=key)
            body = obj["Body"]  # botocore.response.StreamingBody
        except ClientError as e:
            raise ValueError(f"Missing part in S3: {key}. {str(e)}")

        for line in body.iter_lines(chunk_size=chunk_size):
            if first_file:
                # Capture header for subsequent comparison
                if header_line is None:
                    header_line = line
                yield line + b"\n"
            else:
                # Skip repeated header line if Databricks wrote it in every part file
                if header_line is not None and line == header_line:
                    continue
                yield line + b"\n"
        first_file = False