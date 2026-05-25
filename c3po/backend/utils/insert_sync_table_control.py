import boto3
from dynamodb import (get_table)
from utils.constants import SYNC_TABLE_CONTROL_TABLE, DATABRICKS_SYNC_TABLE_CONTROL
# from utils.constants import GLUE_SYNC_TABLE_CONTROL  # Uncomment if needed

sync_table_control = get_table(SYNC_TABLE_CONTROL_TABLE)

# Databricks tables (with catalog)

# Glue tables (no catalog)

# Insert all mock data
#for item in DATABRICKS_SYNC_TABLE_CONTROL + GLUE_SYNC_TABLE_CONTROL:
for item in DATABRICKS_SYNC_TABLE_CONTROL:
    sync_table_control.put_item(Item=item)
    print(f"Inserted: {item['PK']}")