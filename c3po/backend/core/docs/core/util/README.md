# Utility Module Documentation

The utility module provides essential helper functions and utilities for the C3PO framework, including configuration management, AWS services integration, and data warehouse connectivity.

## Overview

The utility module contains common utilities used across the framework for:
- Configuration and secrets management
- AWS S3 operations
- Database connectivity (Databricks)
- Environment variable handling

## Components

### 1. ConfigLoader

Handles configuration loading from environment variables and AWS Secrets Manager.

#### Functions

**get_secret(secret_name, region_name)**
- Retrieves secrets from AWS Secrets Manager
- Handles JSON and plain text secrets
- Provides comprehensive error handling

```python
def get_secret(secret_name, region_name="us-west-2"):
    """
    Retrieve a secret from AWS Secrets Manager
    
    Args:
        secret_name: Name of the secret in AWS Secrets Manager
        region_name: AWS region (default: us-west-2)
    
    Returns:
        dict or str: Parsed JSON secret or plain text
    """
```

**load_env_variables(env_file)**
- Loads environment variables from .env file
- Returns dictionary of all environment variables

```python
def load_env_variables(env_file=".env"):
    """
    Load environment variables from file
    
    Args:
        env_file: Path to environment file (default: .env)
    
    Returns:
        dict: Dictionary of environment variables
    """
```

### 2. S3Utils

Comprehensive AWS S3 operations utility class.

#### Constructor
```python
def __init__(self, aws_region: str = "us-west-2")
```

#### Methods

**put_object(bucket_name, key, data, content_type, metadata)**
- Uploads objects to S3 with optional metadata
- Supports content type specification
- Returns success/failure status

**get_object(bucket_name, key)**
- Downloads objects from S3
- Handles missing objects gracefully
- Returns binary data or None

**delete_object(bucket_name, key)**
- Deletes objects from S3
- Provides error handling

**list_objects(bucket_name, prefix)**
- Lists objects in S3 bucket with optional prefix
- Returns list of object keys

### 3. DataWarehouse

Provides connectivity and operations for Databricks data warehouse.

#### Constructor
```python
def __init__(self, host_name, http_path, access_token)
```

#### Methods

**get_data_from_warehouse(sql_query)**
- Executes SQL queries against Databricks
- Returns results as list of dictionaries
- Handles connection errors and reconnection

**reconnect()**
- Re-establishes database connection
- Handles authentication and session management

## Usage Examples

### Configuration Management

```python
from core.util.ConfigLoader import get_secret, load_env_variables

# Load environment variables
env_vars = load_env_variables()
database_host = env_vars.get('DATABASE_HOST')
api_region = env_vars.get('AWS_REGION', 'us-west-2')

# Get secrets from AWS Secrets Manager
try:
    db_credentials = get_secret('database-credentials', 'us-west-2')
    username = db_credentials['username']
    password = db_credentials['password']
except Exception as e:
    print(f"Failed to retrieve secrets: {e}")
    # Handle fallback or error
```

### Advanced Configuration Pattern

```python
from core.util.ConfigLoader import get_secret, load_env_variables

class ConfigManager:
    def __init__(self):
        self.env = load_env_variables()
        self._secrets_cache = {}
    
    def get_config(self, key: str, secret_name: str = None):
        """Get configuration from env vars or secrets"""
        # Try environment variables first
        env_value = self.env.get(key)
        if env_value:
            return env_value
        
        # Fall back to secrets if secret_name provided
        if secret_name:
            return self.get_secret_value(secret_name, key)
        
        return None
    
    def get_secret_value(self, secret_name: str, key: str):
        """Get specific key from cached secret"""
        if secret_name not in self._secrets_cache:
            self._secrets_cache[secret_name] = get_secret(
                secret_name, 
                self.env.get('AWS_REGION', 'us-west-2')
            )
        
        secret_data = self._secrets_cache[secret_name]
        return secret_data.get(key) if isinstance(secret_data, dict) else secret_data

# Usage
config = ConfigManager()
api_key = config.get_config('API_KEY', 'app-secrets')
database_url = config.get_config('DATABASE_URL')
```

### S3 Operations

```python
from core.util.S3Utils import S3Utils

# Initialize S3 utility
s3_utils = S3Utils(aws_region="us-west-2")

# Upload data
data = "Hello, world!"
success = s3_utils.put_object(
    bucket_name="my-bucket",
    key="data/hello.txt",
    data=data.encode('utf-8'),
    content_type="text/plain",
    metadata={"author": "system", "version": "1.0"}
)

if success:
    print("Upload successful")

# Download data
content = s3_utils.get_object(
    bucket_name="my-bucket",
    key="data/hello.txt"
)

if content:
    text = content.decode('utf-8')
    print(f"Downloaded: {text}")

# List objects
objects = s3_utils.list_objects(
    bucket_name="my-bucket",
    prefix="data/"
)

for obj_key in objects:
    print(f"Found object: {obj_key}")
```

### Advanced S3 Usage

```python
from core.util.S3Utils import S3Utils
import json
from datetime import datetime

class S3DataManager:
    def __init__(self, bucket_name: str, region: str = "us-west-2"):
        self.s3_utils = S3Utils(region)
        self.bucket_name = bucket_name
    
    def save_json_data(self, key: str, data: dict):
        """Save dictionary as JSON to S3"""
        json_data = json.dumps(data, indent=2)
        metadata = {
            "content_type": "application/json",
            "upload_time": datetime.now().isoformat()
        }
        
        return self.s3_utils.put_object(
            bucket_name=self.bucket_name,
            key=key,
            data=json_data.encode('utf-8'),
            content_type="application/json",
            metadata=metadata
        )
    
    def load_json_data(self, key: str) -> dict:
        """Load JSON data from S3"""
        content = self.s3_utils.get_object(
            bucket_name=self.bucket_name,
            key=key
        )
        
        if content:
            return json.loads(content.decode('utf-8'))
        return None
    
    def backup_data(self, source_key: str, backup_prefix: str = "backups/"):
        """Create backup copy of data"""
        # Download original
        data = self.s3_utils.get_object(self.bucket_name, source_key)
        if not data:
            return False
        
        # Create backup key with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_key = f"{backup_prefix}{timestamp}_{source_key}"
        
        # Upload backup
        return self.s3_utils.put_object(
            bucket_name=self.bucket_name,
            key=backup_key,
            data=data,
            metadata={"backup_of": source_key, "backup_time": timestamp}
        )

# Usage
data_manager = S3DataManager("my-data-bucket")

# Save configuration
config_data = {
    "app_name": "C3PO",
    "version": "1.0.0",
    "settings": {"debug": True, "max_retries": 3}
}

data_manager.save_json_data("config/app_config.json", config_data)

# Load configuration
loaded_config = data_manager.load_json_data("config/app_config.json")
print(f"Loaded config: {loaded_config}")
```

### Database Operations

```python
from core.util.DataWareHouse import DataWarehouse
from core.util.ConfigLoader import get_secret

# Initialize with credentials
secrets = get_secret('databricks-credentials')
warehouse = DataWarehouse(
    host_name=secrets['host_name'],
    http_path=secrets['http_path'],
    access_token=secrets['access_token']
)

# Execute query
sql_query = """
SELECT customer_id, SUM(order_amount) as total_spent
FROM orders 
WHERE order_date >= '2024-01-01'
GROUP BY customer_id
ORDER BY total_spent DESC
LIMIT 10
"""

try:
    results = warehouse.get_data_from_warehouse(sql_query)
    for row in results:
        print(f"Customer {row['customer_id']}: ${row['total_spent']}")
except Exception as e:
    print(f"Query failed: {e}")
```

### Advanced Database Usage

```python
from core.util.DataWareHouse import DataWarehouse
import pandas as pd

class DataAnalyzer:
    def __init__(self, warehouse: DataWarehouse):
        self.warehouse = warehouse
    
    def get_sales_summary(self, start_date: str, end_date: str):
        """Get sales summary for date range"""
        query = f"""
        SELECT 
            DATE(order_date) as date,
            COUNT(*) as order_count,
            SUM(order_amount) as total_revenue,
            AVG(order_amount) as avg_order_value
        FROM orders 
        WHERE order_date BETWEEN '{start_date}' AND '{end_date}'
        GROUP BY DATE(order_date)
        ORDER BY date
        """
        
        return self.warehouse.get_data_from_warehouse(query)
    
    def get_customer_segments(self):
        """Analyze customer segments"""
        query = """
        WITH customer_stats AS (
            SELECT 
                customer_id,
                COUNT(*) as order_count,
                SUM(order_amount) as total_spent,
                AVG(order_amount) as avg_order_value,
                MAX(order_date) as last_order_date
            FROM orders
            GROUP BY customer_id
        )
        SELECT 
            CASE 
                WHEN total_spent > 1000 THEN 'High Value'
                WHEN total_spent > 500 THEN 'Medium Value'
                ELSE 'Low Value'
            END as segment,
            COUNT(*) as customer_count,
            AVG(total_spent) as avg_spent,
            AVG(order_count) as avg_orders
        FROM customer_stats
        GROUP BY segment
        """
        
        return self.warehouse.get_data_from_warehouse(query)
    
    def export_to_s3(self, query_results: list, s3_key: str, s3_utils):
        """Export query results to S3 as CSV"""
        if not query_results:
            return False
        
        # Convert to DataFrame for easy CSV export
        df = pd.DataFrame(query_results)
        csv_data = df.to_csv(index=False)
        
        return s3_utils.put_object(
            bucket_name="analytics-exports",
            key=s3_key,
            data=csv_data.encode('utf-8'),
            content_type="text/csv"
        )

# Usage
analyzer = DataAnalyzer(warehouse)
sales_data = analyzer.get_sales_summary('2024-01-01', '2024-12-31')
segments = analyzer.get_customer_segments()

# Export results
from core.util.S3Utils import S3Utils
s3_utils = S3Utils()
analyzer.export_to_s3(sales_data, "exports/sales_summary.csv", s3_utils)
```

## Integration Patterns

### Unified Configuration Service

```python
from core.util.ConfigLoader import get_secret, load_env_variables
from core.util.S3Utils import S3Utils
from core.util.DataWareHouse import DataWarehouse

class ServiceFactory:
    def __init__(self):
        self.env = load_env_variables()
        self._secrets_cache = {}
    
    def create_s3_utils(self):
        """Create S3Utils with configured region"""
        region = self.env.get('AWS_REGION', 'us-west-2')
        return S3Utils(aws_region=region)
    
    def create_data_warehouse(self):
        """Create DataWarehouse with credentials from secrets"""
        secret_name = self.env.get('DB_SECRET_NAME', 'databricks-creds')
        secrets = self._get_secret(secret_name)
        
        return DataWarehouse(
            host_name=secrets['host_name'],
            http_path=secrets['http_path'],
            access_token=secrets['access_token']
        )
    
    def _get_secret(self, secret_name: str):
        """Get and cache secrets"""
        if secret_name not in self._secrets_cache:
            region = self.env.get('AWS_REGION', 'us-west-2')
            self._secrets_cache[secret_name] = get_secret(secret_name, region)
        return self._secrets_cache[secret_name]

# Usage in agents
factory = ServiceFactory()
s3_utils = factory.create_s3_utils()
warehouse = factory.create_data_warehouse()
```

### Error Handling and Retry Patterns

```python
import time
from typing import Callable, Any
import logging

class RetryableOperation:
    def __init__(self, max_retries: int = 3, delay: float = 1.0):
        self.max_retries = max_retries
        self.delay = delay
        self.logger = logging.getLogger(__name__)
    
    def execute(self, operation: Callable, *args, **kwargs) -> Any:
        """Execute operation with retry logic"""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                return operation(*args, **kwargs)
            except Exception as e:
                last_exception = e
                self.logger.warning(
                    f"Attempt {attempt + 1} failed: {e}"
                )
                
                if attempt < self.max_retries:
                    time.sleep(self.delay * (2 ** attempt))  # Exponential backoff
                else:
                    self.logger.error(
                        f"All {self.max_retries + 1} attempts failed"
                    )
                    raise last_exception

# Usage with utilities
from core.util.S3Utils import S3Utils

s3_utils = S3Utils()
retry_op = RetryableOperation(max_retries=3, delay=1.0)

# Retry S3 operations
content = retry_op.execute(
    s3_utils.get_object,
    bucket_name="my-bucket",
    key="important-data.json"
)

# Retry database operations
from core.util.DataWareHouse import DataWarehouse

warehouse = DataWarehouse(host, path, token)
results = retry_op.execute(
    warehouse.get_data_from_warehouse,
    "SELECT * FROM critical_table"
)
```

## Testing

### Unit Tests

```python
import pytest
from unittest.mock import patch, MagicMock
from core.util.ConfigLoader import get_secret, load_env_variables
from core.util.S3Utils import S3Utils

def test_load_env_variables():
    with patch('c3po_core.util.ConfigLoader.load_dotenv'):
        with patch('c3po_core.util.ConfigLoader.os.getenv') as mock_getenv:
            mock_getenv.return_value = "test_value"
            
            result = load_env_variables()
            assert isinstance(result, dict)

@patch('c3po_core.util.ConfigLoader.boto3')
def test_get_secret_json(mock_boto3):
    # Mock boto3 client
    mock_client = MagicMock()
    mock_boto3.client.return_value = mock_client
    
    # Mock secret response
    mock_client.get_secret_value.return_value = {
        'SecretString': '{"key": "value"}'
    }
    
    result = get_secret('test-secret')
    assert result == {"key": "value"}

@patch('c3po_core.util.S3Utils.boto3')
def test_s3_put_object(mock_boto3):
    mock_client = MagicMock()
    mock_boto3.client.return_value = mock_client
    
    s3_utils = S3Utils()
    result = s3_utils.put_object("bucket", "key", b"data")
    
    assert result is True
    mock_client.put_object.assert_called_once()
```

### Integration Tests

```python
import pytest
from core.util.S3Utils import S3Utils
from core.util.DataWareHouse import DataWarehouse

@pytest.mark.integration
def test_s3_roundtrip():
    """Test actual S3 upload/download"""
    s3_utils = S3Utils()
    
    test_data = b"integration test data"
    bucket = "test-bucket"
    key = "test/integration_test.txt"
    
    # Upload
    upload_success = s3_utils.put_object(bucket, key, test_data)
    assert upload_success
    
    # Download
    downloaded = s3_utils.get_object(bucket, key)
    assert downloaded == test_data
    
    # Cleanup
    s3_utils.delete_object(bucket, key)

@pytest.mark.integration
def test_database_connection():
    """Test actual database connectivity"""
    # This requires real credentials
    warehouse = DataWarehouse(
        host_name="test-host",
        http_path="test-path",
        access_token="test-token"
    )
    
    # Test simple query
    try:
        result = warehouse.get_data_from_warehouse("SELECT 1 as test")
        assert len(result) > 0
        assert result[0]['test'] == 1
    except Exception as e:
        pytest.skip(f"Database not available: {e}")
```

## Best Practices

1. **Error Handling**: Always implement proper error handling for external services
2. **Credential Management**: Use AWS Secrets Manager for sensitive information
3. **Connection Pooling**: Reuse connections when possible for better performance
4. **Retry Logic**: Implement retry mechanisms for transient failures
5. **Logging**: Add comprehensive logging for debugging and monitoring
6. **Configuration**: Use environment variables for configuration management
7. **Testing**: Use mocking for unit tests and integration tests for real services
8. **Resource Cleanup**: Properly close connections and clean up resources

## Performance Considerations

1. **Connection Reuse**: Cache database connections and S3 clients
2. **Batch Operations**: Use batch operations for multiple S3 uploads/downloads
3. **Query Optimization**: Optimize database queries for better performance
4. **Caching**: Cache frequently accessed configuration and secrets
5. **Async Operations**: Consider async operations for I/O intensive tasks

## Security Considerations

1. **Secrets Management**: Never hard-code credentials
2. **IAM Permissions**: Use least-privilege IAM roles and policies
3. **Encryption**: Enable encryption at rest and in transit
4. **Network Security**: Use VPC endpoints for AWS services when possible
5. **Audit Logging**: Enable CloudTrail and S3 access logging

## Integration with Other Modules

The utility module integrates with all other modules:

- **Agent Module**: Provides configuration and external service access
- **Model Provider**: Supplies credentials and configuration
- **Prompt Module**: Enables S3-based prompt storage
- **Memory Module**: Supports S3-based memory storage

This utility module provides the foundation for all external service interactions and configuration management across the C3PO framework.

# List objects
objects = s3_utils.list_objects("prefix/")
```

### Data Warehouse Operations

```python
from core.util.DataWareHouse import DataWareHouse

# Initialize data warehouse connection
dw = DataWareHouse(
    host="your-host",
    database="your-db",
    user="your-user",
    password="your-password"
)

# Execute query
results = dw.execute_query("SELECT * FROM your_table")
```

## Best Practices

1. Environment Management
   - Use environment variables for configuration
   - Keep sensitive information in secrets
   - Use appropriate environment-specific settings

2. Error Handling
   ```python
   try:
       config = load_env_variables()
   except ConfigurationError as e:
       logger.error(f"Configuration error: {e}")
       # Handle error appropriately
   ```

3. Resource Management
   ```python
   # Use context managers when possible
   with DataWareHouse() as dw:
       results = dw.execute_query("YOUR QUERY")
   ```

4. Logging
   ```python
   import logging
   
   logger = logging.getLogger(__name__)
   logger.info("Operation completed successfully")
   logger.error("Error occurred: %s", error_message)
   ```

## Configuration Management

### Environment Variables
Required environment variables:
```
PROVIDER=your_provider
MODEL=your_model
MODEL_BASE_URL=your_base_url
SECRET_NAME=your_secret_name
```

### Secrets Management
```python
# Example secret structure
{
    "API_KEY": "your-api-key",
    "DATABASE_PASSWORD": "your-db-password",
    "AWS_SECRET_KEY": "your-aws-secret"
}
```

## Data Handling

### File Operations
```python
# Example file handling
def safe_file_operation(file_path, operation):
    try:
        with open(file_path, operation) as f:
            return f.read()
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        raise
    except PermissionError:
        logger.error(f"Permission denied: {file_path}")
        raise
```

### Data Transformation
```python
# Example data transformation utility
def transform_data(data, format_type):
    if format_type == "json":
        return json.dumps(data)
    elif format_type == "csv":
        return csv.writer(data)
    # Add more formats as needed
```

## Performance Considerations

1. Use caching when appropriate
2. Implement connection pooling for database operations
3. Handle resources efficiently
4. Use appropriate batch sizes for bulk operations
5. Implement retry mechanisms for external service calls 