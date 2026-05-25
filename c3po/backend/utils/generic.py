from typing import Any, Dict
import boto3
from boto3.dynamodb.conditions import Key
from sqlalchemy import create_engine
from utils.dynamodb import get_table
from utils.constants import Region_NAME
import json
from botocore.exceptions import ClientError


# Fetch secrets from AWS Secrets Manager
def get_secret(secret_name, region_name=Region_NAME, default_value=None):
    """
    Fetch a secret from AWS Secrets Manager by name.
    If retrieval fails and default_value is provided, return default_value.
    Otherwise, raise the original exception.
    """
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        if default_value is not None:
            print(f"Warning: Could not fetch secret '{secret_name}': {e}. Using default value.")
            return default_value
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    secret = get_secret_value_response['SecretString']
    if secret is None:
        if default_value is not None:
            print(f"Warning: Secret '{secret_name}' is empty. Using default value.")
            return default_value
        raise ValueError(f"Secret {secret_name} not found or is empty.")    
    
    print(f"Secret {secret_name} retrieved successfully.")
    
    # Try to parse as JSON, return as dict if successful, otherwise return as string
    try:
        return json.loads(secret)
    except json.JSONDecodeError:
        return secret

class DataWarehouse:
    def __init__(self, host_name, http_path, access_token):
        from databricks import sql
        self.connection = sql.connect(
            server_hostname=host_name,
            http_path=http_path,
            access_token=access_token,  # Uncomment to use token-based auth
            #auth_type="databricks-oauth",
            auth_type="pat",
            _tls_no_verify=True
        )
        self.cursor = self.connection.cursor()

    def get_data_from_wareshouse(self, sql_query):
        import pandas as pd
        try:
            print("In warehouse executing")
            result = pd.DataFrame(self.cursor.execute(sql_query).fetchall())
            result.columns = [elem[0] for elem in self.cursor.description]
            print(result.head())
            return result
        except Exception as e:
            print(f"Error {e}")
            raise RuntimeError(f"Error executing query: {e}")
        

def expand_dict(flat_dict, sep: str = '.'):
    unflattened = {}
    for key, value in flat_dict.items():
        parts = key.split(sep)
        
        current_level = unflattened
        
        for part in parts[:-1]:
            current_level = current_level.setdefault(part, {})
        
        current_level[parts[-1]] = value
        
    return unflattened


def flatten_dict(dictionary: Dict[str, Any],
                 parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
    items = []

    for key, value in dictionary.items():
        new_key = parent_key + sep + key if parent_key else key

        if isinstance(value, dict):
            items.extend(flatten_dict(value, new_key, sep=sep).items())
        else:
            items.append((new_key, value))

    return dict(items)