import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from admin.routes.schema_config_routes import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


class TestSyncMetadataEndpoint:
    def test_sync_metadata_success(self, mocker):
        mocker.patch('admin.routes.schema_config_routes.sync_metadata', return_value={
            "status": "success",
            "message": "Metadata sync completed successfully.",
            "details": {"databricks_tables_synced": 1}
        })
        response = client.post("/sync-metadata")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "databricks_tables_synced" in data["details"]

    def test_sync_metadata_error(self, mocker):
        mocker.patch('admin.routes.schema_config_routes.sync_metadata', side_effect=Exception("sync failed"))
        response = client.post("/sync-metadata")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert "Metadata sync failed" in data["message"]


class TestGetSchemaConfig:
    def test_get_schema_config_success(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
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
        response = client.get("/schema-config")
        assert response.status_code == 200
        data = response.json()
        assert any(ds["datasource"] == "databricks" for ds in data)
        assert any(ds["datasource"] == "glue" for ds in data)

    def test_get_schema_config_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.scan.side_effect = Exception("DynamoDB error")
        response = client.get("/schema-config")
        assert response.status_code == 200
        data = response.json()
        assert any(ds["datasource"] == "databricks" for ds in data)


class TestGetSchemaMetadata:
    def test_get_schema_metadata_success(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.query.side_effect = [
            {"Items": [{"PK": "PK1", "SK": "SK1", "item_type": "table"}]},
            {"Items": [{"PK": "PK2", "SK": "SK2", "item_type": "column"}]}
        ]
        response = client.get("/schema-metadata?db_name=db1&table_name=table1&datasource=databricks&catalog=main")
        assert response.status_code == 200
        data = response.json()
        assert any(item["item_type"] == "table" for item in data)
        assert any(item["item_type"] == "column" for item in data)

    def test_get_schema_metadata_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.query.side_effect = Exception("DynamoDB error")

        response = client.get("/schema-metadata?db_name=db1&table_name=table1&datasource=databricks&catalog=main")

        assert response.status_code == 404
        assert "Error retrieving schema metadata" in response.json()["detail"]

    def test_get_schema_metadata_not_found(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.query.side_effect = [
            {"Items": []},
            {"Items": []}
        ]
        response = client.get("/schema-metadata?db_name=db1&table_name=table1&datasource=databricks&catalog=main")
        assert response.status_code == 404
        assert "Metadata not found" in response.json()["detail"]

class TestUpdateSchemaMetadata:
    def test_update_schema_metadata_table_success(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.update_item.return_value = None
        payload = {
            "db_name": "db1",
            "table_name": "table1",
            "metadata_description": "desc",
            "metadata_type": "type",
            "datasource": "databricks",
            "catalog": "main"
        }
        response = client.put("/schema-metadata", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        assert "updated_fields" in data["details"]

    def test_update_schema_metadata_column_success(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.update_item.return_value = None
        payload = {
            "db_name": "db1",
            "table_name": "table1",
            "column_name": "col1",
            "metadata_description": "desc",
            "metadata_type": "type",
            "datasource": "databricks",
            "catalog": "main"
        }
        response = client.put("/schema-metadata", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "updated"
        assert "updated_fields" in data["details"]

    def test_update_schema_metadata_no_changes(self, mocker):
        payload = {
            "db_name": "db1",
            "table_name": "table1",
            "datasource": "databricks",
            "catalog": "main"
        }
        response = client.put("/schema-metadata", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "no changes"

    def test_update_schema_metadata_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.update_item.side_effect = Exception("DynamoDB error")
        payload = {
            "db_name": "db1",
            "table_name": "table1",
            "metadata_description": "desc",
            "metadata_type": "type",
            "datasource": "databricks",
            "catalog": "main"
        }
        response = client.put("/schema-metadata", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "mock_update_due_to_db_error"
        assert "error" in data["details"]


class TestExportSchemaConfig:
    def test_export_schema_config_success(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.query.side_effect = [
            {"Items": [{"PK": "PK1", "SK": "TABLE#table1", "item_type": "table"}]},
            {"Items": [{"PK": "PK2", "SK": "COLUMN#col1", "item_type": "column"}]}
        ]
        mock_table.scan.return_value = {"Items": []}
        response = client.get("/export-schema-config?datasource=databricks&db_name=db1&table_name=table1&catalog=main")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")

    def test_export_schema_config_dynamodb_error(self, mocker):
        mock_table = mocker.patch('admin.routes.schema_config_routes.schema_config')
        mock_table.query.side_effect = Exception("DynamoDB error")
        mock_table.scan.return_value = {"Items": []}
        response = client.get("/export-schema-config?datasource=databricks&db_name=db1&table_name=table1&catalog=main")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
