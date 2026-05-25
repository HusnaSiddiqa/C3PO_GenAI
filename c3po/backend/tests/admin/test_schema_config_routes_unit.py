import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException


class TestSyncMetadataEndpoint:
    @patch('admin.routes.schema_config_routes.sync_metadata')
    def test_sync_metadata_success(self, mock_sync_metadata):
        mock_sync_metadata.return_value = {
            "status": "success",
            "message": "Metadata sync completed successfully.",
            "details": {"databricks_tables_synced": 1}
        }
        from admin.routes.schema_config_routes import sync_metadata_endpoint
        result = sync_metadata_endpoint()
        assert result["status"] == "success"
        assert "databricks_tables_synced" in result["details"]

    @patch('admin.routes.schema_config_routes.sync_metadata')
    def test_sync_metadata_error(self, mock_sync_metadata):
        mock_sync_metadata.side_effect = Exception("sync failed")
        from admin.routes.schema_config_routes import sync_metadata_endpoint
        result = sync_metadata_endpoint()
        assert result["status"] == "error"
        assert "Metadata sync failed" in result["message"]


class TestGetSchemaConfig:
    @patch('admin.routes.schema_config_routes.schema_config')
    def test_get_schema_config_success(self, mock_table):
        mock_table.scan.return_value = {
            "Items": [
                {
                    "item_type": "table",
                    "datasource": "databricks",
                    "catalog": "main",
                    "db_name": "db1",
                    "table_name": "table1",
                    "status": "active"
                },
                {
                    "item_type": "table",
                    "datasource": "glue",
                    "catalog": None,
                    "db_name": "db2",
                    "table_name": "table2",
                    "status": "active"
                }
            ]
        }
        from admin.routes.schema_config_routes import get_schema_config
        result = get_schema_config()
        assert isinstance(result, list)
        assert any(ds["datasource"] == "databricks" for ds in result)
        assert any(ds["datasource"] == "glue" for ds in result)

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_get_schema_config_dynamodb_error(self, mock_table):
        mock_table.scan.side_effect = Exception("DynamoDB error")
        from admin.routes.schema_config_routes import get_schema_config
        result = get_schema_config()
        assert isinstance(result, list)
        assert any(ds["datasource"] == "databricks" for ds in result)


class TestGetSchemaMetadata:
    @patch('admin.routes.schema_config_routes.schema_config')
    def test_get_schema_metadata_success(self, mock_table):
        mock_table.query.side_effect = [
            {"Items": [{"PK": "PK1", "SK": "SK1", "item_type": "table"}]},
            {"Items": [{"PK": "PK2", "SK": "SK2", "item_type": "column"}]}
        ]
        from admin.routes.schema_config_routes import get_schema_metadata
        result = get_schema_metadata(
            db_name="db1",
            table_name="table1",
            datasource="databricks",
            catalog="main"
        )
        assert isinstance(result, list)
        assert any(item["item_type"] == "table" for item in result)
        assert any(item["item_type"] == "column" for item in result)

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_get_schema_metadata_dynamodb_error(self, mock_table):
        mock_table.query.side_effect = Exception("DynamoDB error")
        from admin.routes.schema_config_routes import get_schema_metadata

        with pytest.raises(HTTPException) as e:
            get_schema_metadata(
                db_name="db1",
                table_name="table1",
                datasource="databricks",
                catalog="main"
            )
        assert e.value.status_code == 404
        assert "DynamoDB error" in e.value.detail

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_get_schema_metadata_not_found(self, mock_table):
        mock_table.query.side_effect = [
            {"Items": []},
            {"Items": []}
        ]
        from admin.routes.schema_config_routes import get_schema_metadata
        with pytest.raises(HTTPException) as exc_info:
            get_schema_metadata(
                db_name="db1",
                table_name="table1",
                datasource="databricks",
                catalog="main"
            )
        assert exc_info.value.status_code == 404


class TestUpdateSchemaMetadata:
    @patch('admin.routes.schema_config_routes.schema_config')
    def test_update_schema_metadata_table_success(self, mock_table):
        mock_table.update_item.return_value = None
        from admin.routes.schema_config_routes import update_schema_metadata
        result = update_schema_metadata(
            db_name="db1",
            table_name="table1",
            column_name=None,
            metadata_description="desc",
            metadata_type="type",
            datasource="databricks",
            catalog="main"
        )
        assert result["status"] == "updated"
        assert "updated_fields" in result["details"]

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_update_schema_metadata_column_success(self, mock_table):
        mock_table.update_item.return_value = None
        from admin.routes.schema_config_routes import update_schema_metadata
        result = update_schema_metadata(
            db_name="db1",
            table_name="table1",
            column_name="col1",
            metadata_description="desc",
            metadata_type="type",
            datasource="databricks",
            catalog="main"
        )
        assert result["status"] == "updated"
        assert "updated_fields" in result["details"]

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_update_schema_metadata_no_changes(self, mock_table):
        from admin.routes.schema_config_routes import update_schema_metadata
        result = update_schema_metadata(
            db_name="db1",
            table_name="table1",
            column_name=None,
            metadata_description=None,
            metadata_type=None,
            datasource="databricks",
            catalog="main"
        )
        assert result["status"] == "no changes"

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_update_schema_metadata_dynamodb_error(self, mock_table):
        mock_table.update_item.side_effect = Exception("DynamoDB error")
        from admin.routes.schema_config_routes import update_schema_metadata
        result = update_schema_metadata(
            db_name="db1",
            table_name="table1",
            column_name=None,
            metadata_description="desc",
            metadata_type="type",
            datasource="databricks",
            catalog="main"
        )
        assert result["status"] == "mock_update_due_to_db_error"
        assert "error" in result["details"]


class TestExportSchemaConfig:
    @patch('admin.routes.schema_config_routes.schema_config')
    def test_export_schema_config_success(self, mock_table):
        mock_table.query.side_effect = [
            {"Items": [{"PK": "PK1", "SK": "TABLE#table1", "item_type": "table"}]},
            {"Items": [{"PK": "PK2", "SK": "COLUMN#col1", "item_type": "column"}]}
        ]
        mock_table.scan.return_value = {"Items": []}
        from admin.routes.schema_config_routes import export_schema_config
        response = export_schema_config(
            datasource="databricks",
            db_name="db1",
            table_name="table1",
            catalog="main"
        )
        # Should be a StreamingResponse
        from fastapi.responses import StreamingResponse
        assert isinstance(response, StreamingResponse)

    @patch('admin.routes.schema_config_routes.schema_config')
    def test_export_schema_config_dynamodb_error(self, mock_table):
        mock_table.query.side_effect = Exception("DynamoDB error")
        mock_table.scan.return_value = {"Items": []}
        from admin.routes.schema_config_routes import export_schema_config
        response = export_schema_config(
            datasource="databricks",
            db_name="db1",
            table_name="table1",
            catalog="main"
        )
        from fastapi.responses import StreamingResponse
        assert isinstance(response, StreamingResponse)
