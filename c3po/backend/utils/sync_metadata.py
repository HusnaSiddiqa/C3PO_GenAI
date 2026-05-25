from utils.constants import SCHEMA_CONFIG_TABLE, SYNC_TABLE_CONTROL_TABLE
import time  # Add this import
from datetime import datetime, timedelta

import boto3
import pandas as pd
from boto3.dynamodb.conditions import Attr, Key
from utils.constants import SCHEMA_CONFIG_TABLE, SYNC_TABLE_CONTROL_TABLE, Region_NAME,DATABRICKS_SECRET
from utils.generic import get_secret, DataWarehouse  # Import DataWarehouse from generic

# Lazy loading of Databricks connection details from AWS Secrets Manager
# The secret should be a JSON object with keys: DATABRICKS_HOST, DATABRICKS_HTTP_PATH, DATABRICKS_TOKEN
_DATABRICKS_SECRET = None


def get_databricks_config():
    """Lazy load Databricks configuration from AWS Secrets Manager"""
    global _DATABRICKS_SECRET
    if _DATABRICKS_SECRET is None:
        try:
            _DATABRICKS_SECRET = get_secret(DATABRICKS_SECRET, region_name=Region_NAME)
        except Exception as e:
            print(f"Warning: Could not fetch Databricks secret: {e}")
            raise
    return _DATABRICKS_SECRET


def refresh_databricks_token():
    """Force refresh of Databricks token from AWS Secrets Manager"""
    global _DATABRICKS_SECRET
    _DATABRICKS_SECRET = None  # Clear cache
    print("Refreshing Databricks token...")
    return get_databricks_config()


def get_databricks_host():
    return get_databricks_config()["DATABRICKS_HOST"]


def get_databricks_http_path():
    return get_databricks_config()["DATABRICKS_HTTP_PATH"]


def get_access_token():
    token = get_databricks_config().get("DATABRICKS_TOKEN")
    if not token or token == "fallback_token":
        print("Warning: Using fallback Databricks token")
    return token


def validate_glue_connection():
    """Test AWS Glue connection before processing tables"""
    try:
        # Simple test - list databases (should return quickly)
        response = glue.get_databases(MaxResults=1)
        return True
    except Exception as e:
        print(f"AWS Glue connection test failed: {e}")
        return False


def validate_databricks_connection():
    """Test Databricks connection before processing tables"""
    try:
        test_query = "SELECT 1 as test_connection"
        dw = DataWarehouse(get_databricks_host(), get_databricks_http_path(), get_access_token())
        result = dw.get_data_from_wareshouse(test_query)
        return not result.empty
    except Exception as e:
        print(f"Databricks connection test failed: {e}")
        return False


dynamodb = boto3.resource('dynamodb', region_name=Region_NAME)
schema_config = dynamodb.Table(SCHEMA_CONFIG_TABLE)
sync_table_control = dynamodb.Table(SYNC_TABLE_CONTROL_TABLE)
glue = boto3.client('glue', region_name=Region_NAME)


def fetch_databricks_schema(allowed_tables):
    """
    Fetch columns from Databricks tables and views using the DataWarehouse class.
    allowed_tables: set of (catalog, schema, table, object_type) tuples
      object_type is 'table' or 'view'
    Returns a DataFrame with catalog, db_name, table_name, column_name, column_type, object_type.
    """
    db_tables = []

    if not allowed_tables:
        print("No allowed tables/views specified, returning empty DataFrame")
        return pd.DataFrame(db_tables)

    # Test connection first
    if not validate_databricks_connection():
        print("Databricks connection failed, attempting token refresh...")
        refresh_databricks_token()
        if not validate_databricks_connection():
            print("Databricks connection still failed after token refresh, skipping all tables")
            return pd.DataFrame(db_tables)
        else:
            print("Databricks connection restored after token refresh")

    # Extract unique catalogs and schemas from allowed_tables to minimize queries
    # {catalog: {schema: [(table, object_type), ...]}}
    catalogs_to_query = {}

    for catalog, schema, table, object_type in allowed_tables:
        if catalog not in catalogs_to_query:
            catalogs_to_query[catalog] = {}
        if schema not in catalogs_to_query[catalog]:
            catalogs_to_query[catalog][schema] = []
        catalogs_to_query[catalog][schema].append((table, object_type))

    print(f"Optimized query: Will only fetch from {len(catalogs_to_query)} catalogs: {list(catalogs_to_query.keys())}")

    # Only query the specific catalogs and schemas we need
    for catalog, schemas_dict in catalogs_to_query.items():
        print(f"Processing catalog: {catalog}")

        try:
            catalog_check = DataWarehouse(get_databricks_host(), get_databricks_http_path(),
                                          get_access_token()).get_data_from_wareshouse(
                f"SHOW CATALOGS LIKE '{catalog}'")
            if catalog_check.empty:
                print(f"Warning: Catalog '{catalog}' not found, skipping...")
                continue
        except Exception as e:
            print(f"Error checking catalog '{catalog}': {e}, skipping...")
            continue

        for schema, tables_list in schemas_dict.items():
            print(f"Processing schema: {catalog}.{schema} with {len(tables_list)} entries")

            try:
                schema_check = DataWarehouse(get_databricks_host(), get_databricks_http_path(),
                                             get_access_token()).get_data_from_wareshouse(
                    f"SHOW SCHEMAS IN `{catalog}` LIKE '{schema}'")
                if schema_check.empty:
                    print(f"Warning: Schema '{catalog}.{schema}' not found, skipping...")
                    continue
            except Exception as e:
                print(f"Error checking schema '{catalog}.{schema}': {e}, skipping...")
                continue

            for table, object_type in tables_list:
                print(f"Processing {object_type}: {catalog}.{schema}.{table}")

                max_retries = 2
                for attempt in range(max_retries):
                    try:
                        # DESCRIBE TABLE works for both tables and permanent views in Databricks
                        columns_df = DataWarehouse(get_databricks_host(), get_databricks_http_path(),
                                                   get_access_token()).get_data_from_wareshouse(
                            f"DESCRIBE TABLE `{catalog}`.`{schema}`.`{table}`")

                        if columns_df.empty and object_type == 'view':
                            # Fallback for views: SHOW COLUMNS IN
                            print(f"DESCRIBE TABLE returned empty for view {catalog}.{schema}.{table}, trying SHOW COLUMNS IN...")
                            columns_df = DataWarehouse(get_databricks_host(), get_databricks_http_path(),
                                                       get_access_token()).get_data_from_wareshouse(
                                f"SHOW COLUMNS IN `{catalog}`.`{schema}`.`{table}`")

                        if columns_df.empty:
                            print(f"Warning: No columns found for {object_type} {catalog}.{schema}.{table}")
                            break

                        for _, col in columns_df.iterrows():
                            col_name = col.iloc[0]
                            col_type = col.iloc[1] if len(col) > 1 else ""
                            # Skip DESCRIBE TABLE partition/comment separator rows
                            if str(col_name).startswith("#") or col_name == "":
                                continue
                            db_tables.append({
                                "catalog": catalog,
                                "db_name": schema,
                                "table_name": table,
                                "column_name": col_name,
                                "column_type": col_type,
                                "source": "databricks",
                                "object_type": object_type,
                            })

                        print(f"Successfully processed {len(columns_df)} columns from {object_type} {catalog}.{schema}.{table}")
                        break

                    except Exception as e:
                        error_msg = str(e).lower()

                        if any(keyword in error_msg for keyword in
                               ["oauth", "csrf", "mismatching_state", "authentication", "token"]):
                            if attempt < max_retries - 1:
                                print(f"OAuth/auth error for {catalog}.{schema}.{table}, retrying ({attempt + 1}/{max_retries})...")
                                time.sleep(2)
                                if attempt == 0:
                                    refresh_databricks_token()
                                continue
                            else:
                                print(f"OAuth/auth error persists for {catalog}.{schema}.{table} after {max_retries} attempts: {e}")
                                break
                        else:
                            print(f"Error processing {object_type} {catalog}.{schema}.{table}: {e}")
                            break

    print(f"Total columns fetched: {len(db_tables)}")
    return pd.DataFrame(db_tables)


def fetch_glue_schema(allowed_tables):
    """
    Fetch columns from AWS Glue Data Catalog tables and views.
    allowed_tables: set of (db_name, table_name, object_type) tuples
      object_type is 'table' or 'view'
    Returns a DataFrame with db_name, table_name, column_name, column_type, object_type.
    """
    glue_tables = []

    if not allowed_tables:
        print("No allowed Glue tables/views specified, returning empty DataFrame")
        return pd.DataFrame(glue_tables)

    # Test Glue connection first
    if not validate_glue_connection():
        print("AWS Glue connection failed, skipping all Glue tables")
        return pd.DataFrame(glue_tables)
    else:
        print("AWS Glue connection validated")

    # Group allowed tables by database: {db_name: [(table_name, object_type), ...]}
    databases_to_query = {}
    for db_name, table_name, object_type in allowed_tables:
        if db_name not in databases_to_query:
            databases_to_query[db_name] = []
        databases_to_query[db_name].append((table_name, object_type))

    print(f"Optimized Glue query: Will only fetch from {len(databases_to_query)} databases: {list(databases_to_query.keys())}")

    for db_name, table_names in databases_to_query.items():
        print(f"Processing Glue database: {db_name} with {len(table_names)} entries")

        try:
            try:
                glue.get_database(Name=db_name)
                print(f"Glue database '{db_name}' found")
            except glue.exceptions.EntityNotFoundException:
                print(f"Warning: Glue database '{db_name}' not found, skipping...")
                continue
            except Exception as e:
                print(f"Error checking Glue database '{db_name}': {e}, skipping...")
                continue

            for table_name, object_type in table_names:
                print(f"Processing Glue {object_type}: {db_name}.{table_name}")

                max_retries = 2
                for attempt in range(max_retries):
                    try:
                        table_response = glue.get_table(
                            DatabaseName=db_name,
                            Name=table_name
                        )

                        table = table_response['Table']
                        table_type = table.get('TableType', '')
                        columns_processed = 0

                        # Extract columns from StorageDescriptor (works for tables and most views)
                        if 'StorageDescriptor' in table and 'Columns' in table['StorageDescriptor']:
                            columns = table['StorageDescriptor']['Columns']
                            for col in columns:
                                glue_tables.append({
                                    "catalog": None,
                                    "db_name": db_name,
                                    "table_name": table_name,
                                    "column_name": col['Name'],
                                    "column_type": col['Type'],
                                    "source": "glue",
                                    "object_type": object_type,
                                })
                                columns_processed += 1
                            print(f"Processed {len(columns)} columns from {db_name}.{table_name}")

                        # Partition columns (tables only — views don't have partitions)
                        if object_type == 'table' and 'PartitionKeys' in table and table['PartitionKeys']:
                            for col in table['PartitionKeys']:
                                glue_tables.append({
                                    "catalog": None,
                                    "db_name": db_name,
                                    "table_name": table_name,
                                    "column_name": col['Name'] + " (partition)",
                                    "column_type": col['Type'],
                                    "source": "glue",
                                    "object_type": object_type,
                                })
                                columns_processed += 1
                            print(f"Also processed {len(table['PartitionKeys'])} partition columns from {db_name}.{table_name}")

                        # For Glue views (TableType == 'VIRTUAL_VIEW') with no StorageDescriptor columns,
                        # attempt to extract column info from the view's Parameters metadata
                        if object_type == 'view' and columns_processed == 0:
                            params = table.get('Parameters', {})
                            # Glue stores Presto/Athena view columns in 'presto_view' or 'comment' params
                            view_columns_raw = params.get('view_columns', params.get('presto_view_columns', ''))
                            if view_columns_raw:
                                try:
                                    import json as _json
                                    view_cols = _json.loads(view_columns_raw)
                                    for vc in view_cols:
                                        glue_tables.append({
                                            "catalog": None,
                                            "db_name": db_name,
                                            "table_name": table_name,
                                            "column_name": vc.get('name', vc.get('Name', '')),
                                            "column_type": vc.get('type', vc.get('Type', '')),
                                            "source": "glue",
                                            "object_type": object_type,
                                        })
                                        columns_processed += 1
                                    print(f"Extracted {columns_processed} columns from view params for {db_name}.{table_name}")
                                except Exception:
                                    pass

                            if columns_processed == 0:
                                print(f"Warning: Glue {object_type} '{db_name}.{table_name}' (TableType={table_type}) "
                                      f"has no columns in StorageDescriptor or Parameters. "
                                      f"Add columns manually via PUT /schema-metadata.")
                        elif columns_processed == 0:
                            print(f"Warning: No columns found for {object_type} {db_name}.{table_name}")
                        else:
                            print(f"Total: {columns_processed} columns processed from {object_type} {db_name}.{table_name}")

                        break

                    except glue.exceptions.EntityNotFoundException:
                        print(f"Warning: '{db_name}.{table_name}' not found in Glue")
                        break

                    except Exception as e:
                        error_msg = str(e).lower()

                        if any(keyword in error_msg for keyword in
                               ["unrecognizedclientexception", "security token", "access denied", "forbidden", "unauthorized"]):
                            if attempt < max_retries - 1:
                                print(f"AWS auth error for {db_name}.{table_name}, retrying ({attempt + 1}/{max_retries})...")
                                time.sleep(2)
                                continue
                            else:
                                print(f"AWS auth error persists for {db_name}.{table_name} after {max_retries} attempts: {e}")
                                break

                        elif any(keyword in error_msg for keyword in ["throttling", "rate exceeded", "too many requests"]):
                            if attempt < max_retries - 1:
                                print(f"Throttling error for {db_name}.{table_name}, retrying ({attempt + 1}/{max_retries})...")
                                time.sleep(5)
                                continue
                            else:
                                print(f"Throttling error persists for {db_name}.{table_name} after {max_retries} attempts: {e}")
                                break

                        elif any(keyword in error_msg for keyword in ["timeout", "connection", "network", "endpoint"]):
                            if attempt < max_retries - 1:
                                print(f"Network error for {db_name}.{table_name}, retrying ({attempt + 1}/{max_retries})...")
                                time.sleep(3)
                                continue
                            else:
                                print(f"Network error persists for {db_name}.{table_name} after {max_retries} attempts: {e}")
                                break
                        else:
                            print(f"Error processing Glue {object_type} {db_name}.{table_name}: {e}")
                            break

        except Exception as e:
            error_msg = str(e).lower()
            if "unrecognizedclientexception" in error_msg or "security token" in error_msg:
                print(f"AWS credentials issue for database {db_name}: {e}")
                print("Check your AWS credentials and permissions")
                continue
            else:
                print(f"Error processing Glue database {db_name}: {e}")
                continue

    print(f"Total Glue columns fetched: {len(glue_tables)}")
    return pd.DataFrame(glue_tables)


def fetch_allowed_tables():
    """
    Fetch allowed tables/views from sync_table_control DynamoDB table.
    Each item may have an 'object_type' field: 'table' (default) or 'view'.
    Returns two sets:
      databricks_tables: set of (catalog, db_name, table_name, object_type)
      glue_tables:       set of (db_name, table_name, object_type)
    """
    databricks_tables = set()
    glue_tables = set()

    try:
        response = sync_table_control.scan()

        for item in response['Items']:
            source = item.get('source', 'databricks')
            object_type = item.get('object_type', 'table')  # 'table' or 'view'

            if source == 'glue':
                # For Glue: (db_name, table_name, object_type)
                db_name = item.get('db_name')
                table_name = item.get('table_name')

                if db_name and table_name:
                    key = (db_name, table_name, object_type)
                    glue_tables.add(key)
                else:
                    print(f"Warning: Missing required fields for Glue table: {item}")
            else:
                # For Databricks: (catalog, db_name, table_name, object_type)
                catalog = item.get('catalog')
                db_name = item.get('db_name')
                table_name = item.get('table_name')

                if catalog and db_name and table_name:
                    key = (catalog, db_name, table_name, object_type)
                    databricks_tables.add(key)
                else:
                    print(f"Warning: Missing required fields for Databricks table: {item}")

        print(f"Found {len(databricks_tables)} Databricks tables/views and {len(glue_tables)} Glue tables/views")
        if databricks_tables:
            print(f"Databricks entries: {list(databricks_tables)[:3]}...")
        if glue_tables:
            print(f"Glue entries: {list(glue_tables)[:3]}...")

    except Exception as e:
        print(f"Error fetching allowed tables: {e}")
        raise e
    return databricks_tables, glue_tables


def sync_metadata():
    """
    Sync Databricks and Glue schema to DynamoDB metadata table.
    Returns detailed response with tables synced, columns synced, and timing information.
    """
    start_time = datetime.utcnow()
    now = start_time.isoformat()

    print(f"Starting metadata sync at {now}")

    # Initialize counters
    databricks_tables_synced = 0
    glue_tables_synced = 0
    databricks_columns_synced = 0
    glue_columns_synced = 0
    tables_processed = 0
    columns_processed = 0
    total_errors = 0

    try:
        databricks_tables, glue_tables = fetch_allowed_tables()
        print(f"Found {len(databricks_tables)} Databricks entries and {len(glue_tables)} Glue entries")
        print(f"Starting sync with {len(databricks_tables)} Databricks and {len(glue_tables)} Glue entries")

        # For Databricks, expect (catalog, db_name, table_name) tuples
        db_df = fetch_databricks_schema(databricks_tables)
        databricks_columns_synced = len(db_df)
        print(f"Fetched {databricks_columns_synced} Databricks columns")

        # For Glue, expect (db_name, table_name) tuples
        glue_df = fetch_glue_schema(glue_tables)
        glue_columns_synced = len(glue_df)
        print(f"Fetched {glue_columns_synced} Glue columns")

        # Count unique tables processed
        if not db_df.empty:
            databricks_tables_synced = len(db_df.drop_duplicates(['catalog', 'db_name', 'table_name']))
        if not glue_df.empty:
            glue_tables_synced = len(glue_df.drop_duplicates(['db_name', 'table_name']))

        # Ensure both dataframes have the same columns
        required_columns = ["catalog", "db_name", "table_name", "column_name", "column_type", "source", "object_type"]

        # Add missing columns to dataframes if they don't exist
        for col in required_columns:
            none_cols = {"catalog"}
            default_val = None if col in none_cols else ("table" if col == "object_type" else "")
            if col not in db_df.columns:
                db_df[col] = default_val
            if col not in glue_df.columns:
                glue_df[col] = default_val

        # Ensure Glue dataframe has catalog set to None
        if not glue_df.empty:
            glue_df["catalog"] = None

        # Reorder columns consistently
        db_df = db_df[required_columns] if not db_df.empty else pd.DataFrame(columns=required_columns)
        glue_df = glue_df[required_columns] if not glue_df.empty else pd.DataFrame(columns=required_columns)

        # Combine dataframes
        combined_df = pd.concat([db_df, glue_df], ignore_index=True)
        unique_tables = len(
            combined_df.drop_duplicates(['catalog', 'db_name', 'table_name'])) if not combined_df.empty else 0
        print(f"Combined total: {len(combined_df)} columns from {unique_tables} tables")

        # Build lookup set (3-tuple keys without object_type) and object_type map
        allowed_tables = set()
        object_type_map = {}
        for t in databricks_tables:
            catalog, db_name, table_name, object_type = t
            key = (catalog, db_name, table_name)
            allowed_tables.add(key)
            object_type_map[key] = object_type
        for t in glue_tables:
            db_name, table_name, object_type = t
            key = (None, db_name, table_name)
            allowed_tables.add(key)
            object_type_map[key] = object_type

        print(f"Processing {len(allowed_tables)} allowed entries")

    except Exception as e:
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        print(f"Error in data fetching phase: {e}")
        total_errors += 1

        # Check if it's an AWS credentials issue
        if "UnrecognizedClientException" in str(e) or "security token" in str(e).lower():
            return {
                "status": "error",
                "message": "AWS credentials issue detected during data fetching",
                "details": {
                    "databricks_tables_synced": 0,
                    "glue_tables_synced": 0,
                    "databricks_columns_synced": 0,
                    "glue_columns_synced": 0,
                    "total_tables_processed": 0,
                    "total_columns_processed": 0,
                    "errors": 1,
                    "duration_seconds": round(duration, 1),
                    "timestamp": end_time.isoformat()
                }
            }
        else:
            return {
                "status": "error",
                "message": f"Data fetching failed: {str(e)}",
                "details": {
                    "databricks_tables_synced": 0,
                    "glue_tables_synced": 0,
                    "databricks_columns_synced": 0,
                    "glue_columns_synced": 0,
                    "total_tables_processed": 0,
                    "total_columns_processed": 0,
                    "errors": 1,
                    "duration_seconds": round(duration, 1),
                    "timestamp": end_time.isoformat()
                }
            }

    # --- TABLES SYNC ---
    tables_errors = 0

    try:
        existing_tables = {}

        # Scan for existing tables
        try:
            response = schema_config.scan(
                FilterExpression=Attr('item_type').eq('table')
            )
            for item in response['Items']:
                key = (item.get('catalog'), item['db_name'], item['table_name'])
                existing_tables[key] = item
            print(f"Found {len(existing_tables)} existing tables in DynamoDB")
        except Exception as e:
            print(f"Error scanning existing tables: {e}")
            existing_tables = {}
            tables_errors += 1

        # CRITICAL: Even if no data fetched, still process tables from sync_table_control
        if combined_df.empty:
            print("No data fetched from sources, but will still process allowed tables for reactivation")

            # Create a minimal dataframe from allowed tables for reactivation
            reactivation_data = []
            for table_tuple in databricks_tables:
                catalog, db_name, table_name, object_type = table_tuple
                reactivation_data.append({
                    'catalog': catalog,
                    'db_name': db_name,
                    'table_name': table_name,
                    'column_name': 'placeholder',
                    'column_type': 'unknown',
                    'source': 'databricks',
                    'object_type': object_type,
                })
            for table_tuple in glue_tables:
                db_name, table_name, object_type = table_tuple
                reactivation_data.append({
                    'catalog': None,
                    'db_name': db_name,
                    'table_name': table_name,
                    'column_name': 'placeholder',
                    'column_type': 'unknown',
                    'source': 'glue',
                    'object_type': object_type,
                })

            if reactivation_data:
                combined_df = pd.DataFrame(reactivation_data)
                print(f"Created reactivation dataframe with {len(reactivation_data)} entries")

        # Get current tables from combined dataframe or allowed tables
        if not combined_df.empty:
            current_tables_df = combined_df.drop_duplicates(['catalog', 'db_name', 'table_name'])
        else:
            # Fallback: create from allowed tables directly
            current_tables_data = []
            for table_tuple in databricks_tables:
                catalog, db_name, table_name, object_type = table_tuple
                current_tables_data.append({
                    'catalog': catalog, 'db_name': db_name, 'table_name': table_name,
                    'source': 'databricks', 'object_type': object_type,
                })
            for table_tuple in glue_tables:
                db_name, table_name, object_type = table_tuple
                current_tables_data.append({
                    'catalog': None, 'db_name': db_name, 'table_name': table_name,
                    'source': 'glue', 'object_type': object_type,
                })
            current_tables_df = pd.DataFrame(current_tables_data)

        # ENHANCED LOGIC: Process ALL tables from sync_table_control
        print(f"Processing tables for reactivation...")

        # Immediately delete stale tables (not in allowed tables) and their columns
        deleted_count = 0
        for key, item in existing_tables.items():
            if key not in allowed_tables:
                try:
                    # Delete the table entry
                    schema_config.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})
                    
                    # Also delete all columns for this table
                    catalog, db_name, table_name = key
                    datasource = item.get('datasource', 'databricks')
                    if catalog:
                        pk_col_prefix = f"DATASOURCE#{datasource}#CATALOG#{catalog}#DATABASE#{db_name}#TABLE#{table_name}"
                    else:
                        pk_col_prefix = f"DATASOURCE#{datasource}#DATABASE#{db_name}#TABLE#{table_name}"
                    
                    # Query and delete all columns for this table
                    columns_response = schema_config.query(
                        KeyConditionExpression=Key('PK').eq(pk_col_prefix) & Key('SK').begins_with('COLUMN#')
                    )
                    columns_deleted = 0
                    for col_item in columns_response.get('Items', []):
                        schema_config.delete_item(Key={'PK': col_item['PK'], 'SK': col_item['SK']})
                        columns_deleted += 1
                    
                    deleted_count += 1
                    print(f"Deleted table and {columns_deleted} columns: {key}")
                except Exception as e:
                    print(f"Error deleting table {key}: {e}")
                    tables_errors += 1

        if deleted_count > 0:
            print(f"Deleted {deleted_count} stale tables and their columns")

        # ENHANCED: Process ALL allowed tables/views for reactivation
        for table_tuple in databricks_tables:
            catalog, db_name, table_name, object_type = table_tuple
            key = (catalog, db_name, table_name)

            try:
                # ENHANCED LOGIC: Check if table was previously deleted and reactivate it
                existing_item = existing_tables.get(key, {})

                if key not in existing_tables:
                    status = 'added'  # New table
                    print(f"Adding new table: {key}")
                elif existing_item.get('status') == 'deleted':
                    status = 'added'  # Reactivate deleted table
                    print(f"Reactivating previously deleted table: {key}")
                elif existing_item.get('status') in ['added', 'active']:
                    status = existing_item.get('status')  # Keep existing status
                    print(f"Keeping table status '{status}': {key}")
                else:
                    status = 'active'  # Default to active
                    print(f"Setting table to active: {key}")

                datasource = 'databricks'

                # Build PK based on whether catalog exists
                if catalog:
                    pk_table = f"DATASOURCE#{datasource}#CATALOG#{catalog}#DATABASE#{db_name}"
                else:
                    pk_table = f"DATASOURCE#{datasource}#DATABASE#{db_name}"
                sk_table = f"TABLE#{table_name}"

                # Preserve admin-editable fields if they exist (but reset for reactivated tables)
                if existing_item.get('status') != 'deleted':
                    # Preserve existing metadata for active/added tables
                    metadata_type = existing_item.get('metadata_type', '')
                    metadata_description = existing_item.get('metadata_description', '')
                    updated_at = existing_item.get('updated_at', now)
                else:
                    # Reset metadata for reactivated deleted tables
                    metadata_type = ''
                    metadata_description = ''
                    updated_at = now
                    print(f"Resetting metadata for reactivated table: {key}")

                schema_config.put_item(Item={
                    'PK': pk_table,
                    'SK': sk_table,
                    'item_type': 'table',
                    'datasource': datasource,
                    'catalog': catalog,
                    'db_name': db_name,
                    'table_name': table_name,
                    'object_type': object_type,
                    'status': status,
                    'sync_timestamp': now,
                    'source': datasource,
                    'metadata_description': metadata_description,
                    'metadata_type': metadata_type,
                    'updated_at': updated_at
                })
                tables_processed += 1

            except Exception as e:
                print(f"Error inserting/updating table {key}: {e}")
                tables_errors += 1

        # Process Glue tables/views similarly
        for table_tuple in glue_tables:
            db_name, table_name, object_type = table_tuple
            key = (None, db_name, table_name)

            try:
                existing_item = existing_tables.get(key, {})

                if key not in existing_tables:
                    status = 'added'
                    print(f"Adding new Glue table: {key}")
                elif existing_item.get('status') == 'deleted':
                    status = 'added'
                    print(f"Reactivating previously deleted Glue table: {key}")
                elif existing_item.get('status') in ['added', 'active']:
                    status = existing_item.get('status')
                    print(f"Keeping Glue table status '{status}': {key}")
                else:
                    status = 'active'
                    print(f"Setting Glue table to active: {key}")

                datasource = 'glue'
                pk_table = f"DATASOURCE#{datasource}#DATABASE#{db_name}"
                sk_table = f"TABLE#{table_name}"

                if existing_item.get('status') != 'deleted':
                    metadata_type = existing_item.get('metadata_type', '')
                    metadata_description = existing_item.get('metadata_description', '')
                    updated_at = existing_item.get('updated_at', now)
                else:
                    metadata_type = ''
                    metadata_description = ''
                    updated_at = now
                    print(f"Resetting metadata for reactivated Glue table: {key}")

                schema_config.put_item(Item={
                    'PK': pk_table,
                    'SK': sk_table,
                    'item_type': 'table',
                    'datasource': datasource,
                    'catalog': None,
                    'db_name': db_name,
                    'table_name': table_name,
                    'object_type': object_type,
                    'status': status,
                    'sync_timestamp': now,
                    'source': datasource,
                    'metadata_description': metadata_description,
                    'metadata_type': metadata_type,
                    'updated_at': updated_at
                })
                tables_processed += 1

            except Exception as e:
                print(f"Error inserting/updating Glue table {key}: {e}")
                tables_errors += 1

        print(f"Tables sync complete: {tables_processed} processed, {tables_errors} errors")

    except Exception as e:
        print(f"Error in tables sync phase: {e}")
        tables_errors += 1

    # --- COLUMNS SYNC (Only if we have actual column data) ---
    columns_errors = 0

    if not combined_df.empty and 'column_name' in combined_df.columns and combined_df['column_name'].notna().any():
        try:
            existing_columns = {}

            # Scan for existing columns
            try:
                response = schema_config.scan(
                    FilterExpression=Attr('item_type').eq('column')
                )
                for item in response['Items']:
                    key = (item.get('catalog'), item['db_name'], item['table_name'], item['column_name'])
                    existing_columns[key] = item
                print(f"Found {len(existing_columns)} existing columns in DynamoDB")
            except Exception as e:
                print(f"Error scanning existing columns: {e}")
                existing_columns = {}
                columns_errors += 1

            # Get current columns from combined dataframe
            db_columns = set(
                (row['catalog'], row['db_name'], row['table_name'], row['column_name'])
                for _, row in combined_df.iterrows()
                if (row['catalog'], row['db_name'], row['table_name']) in allowed_tables
                and pd.notna(row['column_name']) and row['column_name'] != 'placeholder'
            )
            print(f"Processing {len(db_columns)} current columns")

            # Mark deleted columns
            deleted_count = 0
            for key, item in existing_columns.items():
                if key not in db_columns:
                    try:
                        schema_config.update_item(
                            Key={'PK': item['PK'], 'SK': item['SK']},
                            UpdateExpression="SET #s = :s, sync_timestamp = :t",
                            ExpressionAttributeNames={'#s': 'status'},
                            ExpressionAttributeValues={':s': 'deleted', ':t': now}
                        )
                        deleted_count += 1
                    except Exception as e:
                        print(f"Error marking column as deleted {key}: {e}")
                        columns_errors += 1

            if deleted_count > 0:
                print(f"Marked {deleted_count} columns as deleted")

            # Add/update columns with ENHANCED LOGIC to reactivate deleted columns
            for _, row in combined_df.iterrows():
                table_key = (row['catalog'], row['db_name'], row['table_name'])
                if table_key not in allowed_tables or pd.isna(row['column_name']) or row[
                    'column_name'] == 'placeholder':
                    continue

                try:
                    col_key = (row['catalog'], row['db_name'], row['table_name'], row['column_name'])

                    # ENHANCED LOGIC: Check if column was previously deleted and reactivate it
                    existing_item = existing_columns.get(col_key, {})

                    if col_key not in existing_columns:
                        status = 'added'  # New column
                        print(f"Adding new column: {col_key}")
                    elif existing_item.get('status') == 'deleted':
                        status = 'added'  # Reactivate deleted column
                        print(f"Reactivating previously deleted column: {col_key}")
                    else:
                        status = 'active'  # Keep existing active/added status

                    datasource = row.get('source', 'databricks')

                    # Build PK based on whether catalog exists
                    if row['catalog']:
                        pk_col = f"DATASOURCE#{datasource}#CATALOG#{row['catalog']}#DATABASE#{row['db_name']}#TABLE#{row['table_name']}"
                    else:
                        pk_col = f"DATASOURCE#{datasource}#DATABASE#{row['db_name']}#TABLE#{row['table_name']}"
                    sk_col = f"COLUMN#{row['column_name']}"

                    # Preserve admin-editable fields if they exist (but reset for reactivated columns)
                    if existing_item.get('status') != 'deleted':
                        # Preserve existing metadata for active/added columns
                        metadata_type = existing_item.get('metadata_type', '')
                        metadata_description = existing_item.get('metadata_description', '')
                        updated_at = existing_item.get('updated_at', now)
                    else:
                        # Reset metadata for reactivated deleted columns
                        metadata_type = ''
                        metadata_description = ''
                        updated_at = now
                        print(f"Resetting metadata for reactivated column: {col_key}")

                    schema_config.put_item(Item={
                        'PK': pk_col,
                        'SK': sk_col,
                        'item_type': 'column',
                        'datasource': datasource,
                        'catalog': row['catalog'],
                        'db_name': row['db_name'],
                        'table_name': row['table_name'],
                        'column_name': row['column_name'],
                        'column_type': row['column_type'],
                        'object_type': row.get('object_type', 'table'),
                        'status': status,
                        'sync_timestamp': now,
                        'source': datasource,
                        'metadata_description': metadata_description,
                        'metadata_type': metadata_type,
                        'updated_at': updated_at
                    })
                    columns_processed += 1

                except Exception as e:
                    print(f"Error inserting/updating column {col_key}: {e}")
                    columns_errors += 1

            print(f"Columns sync complete: {columns_processed} processed, {columns_errors} errors")

        except Exception as e:
            print(f"Error in columns sync phase: {e}")
            columns_errors += 1
    else:
        print("No column data available, skipping columns sync")

    # --- CLEANUP OLD ENTRIES ---
    try:
        cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
        cleanup_response = schema_config.scan(
            FilterExpression=(
                    (Attr('status').eq('added') | Attr('status').eq('deleted')) &
                    Attr('sync_timestamp').lt(cutoff)
            )
        )

        cleanup_count = 0
        for item in cleanup_response['Items']:
            try:
                if item['status'] == 'added':
                    schema_config.update_item(
                        Key={'PK': item['PK'], 'SK': item['SK']},
                        UpdateExpression="SET #s = :s",
                        ExpressionAttributeNames={'#s': 'status'},
                        ExpressionAttributeValues={':s': 'active'}
                    )
                elif item['status'] == 'deleted':
                    schema_config.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})
                cleanup_count += 1
            except Exception as e:
                print(f"Error during cleanup for {item.get('PK', 'unknown')}: {e}")

        if cleanup_count > 0:
            print(f"Cleaned up {cleanup_count} old entries")

    except Exception as e:
        print(f"Error during cleanup phase: {e}")

    # --- FINAL SUMMARY ---
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    total_errors = tables_errors + columns_errors

    summary = f"Sync complete: {tables_processed} tables, {columns_processed} columns processed in {duration:.1f}s"
    if total_errors > 0:
        summary += f", {total_errors} errors occurred"

    print(f"{summary}")

    # Return enhanced response format
    status = "success"
    message = "Metadata sync completed successfully."

    if total_errors > 0:
        status = "partial_success"
        message = f"Metadata sync completed with {total_errors} errors."

    return {
        "status": status,
        "message": message,
        "details": {
            "databricks_tables_synced": databricks_tables_synced,
            "glue_tables_synced": glue_tables_synced,
            "databricks_columns_synced": databricks_columns_synced,
            "glue_columns_synced": glue_columns_synced,
            "total_tables_processed": tables_processed,
            "total_columns_processed": columns_processed,
            "errors": total_errors,
            "duration_seconds": round(duration, 1),
            "timestamp": end_time.isoformat()
        }
    }
