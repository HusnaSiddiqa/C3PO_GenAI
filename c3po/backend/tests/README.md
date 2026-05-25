# Backend Tests

This directory contains comprehensive tests for the backend API endpoints, organized by module.

## Test Structure

### 📁 `chat_manager/` - Chat Manager Module Tests
Contains all tests related to the chat manager functionality:

- **Unit Tests** (`test_chat_routes_unit.py`): 22 tests covering core business logic with 98% coverage
- **Integration Tests** (`test_chat_routes.py`): 15 tests for full API endpoints
- **Feedback Unit Tests** (`test_feedback_routes_unit.py`): 9 tests covering feedback functionality with 98% coverage
- **Feedback Integration Tests** (`test_feedback_routes.py`): 9 tests for feedback API endpoints
- **Fixtures** (`conftest.py`): Module-specific test fixtures
- **Documentation** (`README.md`): Detailed documentation for chat manager tests



## Test Organization

The tests are organized by module to provide:
- **Better organization**: Each module has its own test directory
- **Isolated fixtures**: Module-specific fixtures in their own conftest.py
- **Clearer structure**: Easy to find and maintain tests for specific functionality
- **Scalability**: Easy to add new modules following the same pattern

## Running Tests

### Prerequisites
Install the test dependencies:
```bash
pip install -r requirements.txt
```

### Run all tests
```bash
# From the backend directory
python run_tests.py

# Or directly with pytest
pytest tests/ -v
```

### Run specific test classes
```bash
# Run only onboarding tests
pytest tests/chat_manager/test_chat_routes_unit.py::TestOnboardingLogic -v

# Run only conversation tests
pytest tests/chat_manager/test_chat_routes_unit.py::TestConversationLogic -v
```

### Run with coverage
```bash
# Run all tests with coverage
python -m pytest tests/ --cov=chat_manager --cov-report=html

# Run unit tests only with coverage
python -m pytest tests/chat_manager/test_chat_routes_unit.py --cov=chat_manager.routes.chat_routes --cov-report=term-missing
```

### Run specific test methods
```bash
# Run a specific test
pytest tests/chat_manager/test_chat_routes_unit.py::TestOnboardingLogic::test_onboarding_data_processing -v
```

## Test Coverage

The tests cover:
- ✅ Happy path scenarios
- ✅ Error handling (404, 500 errors)
- ✅ DynamoDB integration errors
- ✅ Data validation
- ✅ Edge cases (empty results, missing data)
- ✅ File attachments
- ✅ Chart data handling
- ✅ Time-based categorization

## Mocking Strategy

- **DynamoDB**: Uses `moto` library to mock AWS DynamoDB
- **External Services**: Uses `unittest.mock` for patching external dependencies
- **Environment Variables**: Patches environment variables for testing different configurations

## Adding New Tests

When adding new endpoints or functionality:

1. Create test methods in the appropriate test class
2. Use the existing fixtures or create new ones in `conftest.py`
3. Follow the naming convention: `test_<method_name>_<scenario>`
4. Include both success and error scenarios
5. Add appropriate assertions for response status codes and data structure

## Continuous Integration

The test suite is designed to run in CI/CD pipelines. The `pytest.ini` configuration includes:
- Coverage reporting
- Verbose output
- HTML coverage reports
- Test markers for categorization 