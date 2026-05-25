# Agents Module Tests

This directory contains tests for the agents module. **Currently, no tests have been implemented yet.**

## Test Structure (To Be Implemented)

### 📁 `nlq/` - Natural Language Query Agent Tests
- **Unit Tests** (`test_nlq_agent_unit.py`): Core NLQ agent functionality
- **Integration Tests** (`test_nlq_agent_integration.py`): End-to-end NLQ workflows
- **Tools Tests** (`test_nlq_tools_unit.py`): SQL generation and query processing

### 📁 `chart/` - Chart Generation Agent Tests
- **Unit Tests** (`test_chart_agent_unit.py`): Chart agent initialization and processing
- **Integration Tests** (`test_chart_agent_integration.py`): End-to-end chart generation
- **Visualization Tests** (`test_chart_visualization_unit.py`): Chart rendering and formatting

### 📁 `byod/` - Bring Your Own Data Agent Tests
- **Unit Tests** (`test_byod_agent_unit.py`): BYOD agent functionality
- **Integration Tests** (`test_byod_agent_integration.py`): Document processing workflows
- **Tools Tests** (`test_byod_tools_unit.py`): Document parsing and analysis

### 📁 `orchestrator/` - Orchestrator Agent Tests
- **Unit Tests** (`test_orchestrator_agent_unit.py`): Agent coordination logic
- **Integration Tests** (`test_orchestrator_integration.py`): Multi-agent workflows
- **Coordination Tests** (`test_agent_coordination_unit.py`): Inter-agent communication

### 📁 `ppt/` - PowerPoint Generation Agent Tests
- **Unit Tests** (`test_ppt_agent_unit.py`): PPT agent functionality
- **Integration Tests** (`test_ppt_agent_integration.py`): End-to-end presentation generation
- **Generator Tests** (`test_ppt_generator_unit.py`): Slide creation and formatting
- **Summary Tests** (`test_summary_agent_unit.py`): Content summarization
- **Visualization Tests** (`test_visualization_agent_unit.py`): Chart and image generation

### 📁 `precanned_deck/` - Pre-canned Deck Agent Tests
- **Unit Tests** (`test_precanned_deck_agent_unit.py`): Deck refresh functionality
- **Integration Tests** (`test_precanned_deck_integration.py`): End-to-end deck updates
- **Job Tests** (`test_databricks_job_tool_unit.py`): Databricks job execution

## Test Coverage Goals

### NLQ Agent
- Agent initialization and configuration
- Query parsing and understanding
- SQL generation and validation
- Error handling and edge cases
- Performance testing for large queries

### Chart Agent
- Chart type selection logic
- Data validation and preprocessing
- Chart generation and formatting
- Export functionality (PNG, SVG, etc.)
- Error handling for invalid data

### BYOD Agent
- Document upload and validation
- Text extraction from various formats
- Document analysis and processing
- Security and access control
- Large document handling

### Orchestrator Agent
- Agent selection and routing
- Workflow coordination
- Error handling and recovery
- Performance optimization
- Load balancing

### PPT Agent
- Presentation structure creation
- Content generation and formatting
- Slide layout and design
- Chart and image integration
- Export functionality

### Pre-canned Deck Agent
- Template management
- Data refresh and updates
- Job scheduling and execution
- Version control
- Rollback functionality

## Implementation Priority

1. **High Priority** (Core functionality):
   - NLQ Agent unit tests
   - Chart Agent unit tests
   - Orchestrator Agent unit tests

2. **Medium Priority** (Enhanced functionality):
   - BYOD Agent unit tests
   - PPT Agent unit tests
   - Integration tests for all agents

3. **Low Priority** (Advanced features):
   - Performance tests
   - Load testing
   - Advanced error scenarios

## Test Dependencies

### Required Packages
```bash
pip install pytest pytest-asyncio httpx moto pytest-mock
```

### Mock Services
- AWS services (S3, DynamoDB)
- Database connections
- External APIs
- File system operations

### Test Data
- Sample documents (PDF, DOCX, PPTX)
- Test databases
- Mock API responses
- Sample charts and visualizations

## Running Tests

Once implemented, tests can be run with:

```bash
# Run all agent tests
pytest tests/agents/ -v

# Run specific agent tests
pytest tests/agents/nlq/ -v
pytest tests/agents/chart/ -v
pytest tests/agents/byod/ -v
pytest tests/agents/orchestrator/ -v
pytest tests/agents/ppt/ -v
pytest tests/agents/precanned_deck/ -v

# Run with coverage
pytest tests/agents/ --cov=agents --cov-report=html
```

## Test Standards

### Naming Convention
- Test files: `test_[module]_[type].py`
- Test classes: `Test[Module][Type]`
- Test methods: `test_[functionality]_[scenario]`

### Test Structure
```python
class TestNLQAgent:
    def test_nlq_agent_initialization(self):
        """Test NLQ agent initialization with valid configuration."""
        pass
    
    def test_nlq_query_processing_success(self):
        """Test successful query processing."""
        pass
    
    def test_nlq_query_processing_error(self):
        """Test error handling in query processing."""
        pass
```

### Coverage Requirements
- **Unit Tests**: Minimum 80% line coverage
- **Integration Tests**: Cover all major workflows
- **Error Scenarios**: Test all error conditions
- **Performance**: Test with realistic data volumes

## Current Status

- ❌ **NLQ Agent Tests**: Not implemented
- ❌ **Chart Agent Tests**: Not implemented  
- ❌ **BYOD Agent Tests**: Not implemented
- ❌ **Orchestrator Agent Tests**: Not implemented
- ❌ **PPT Agent Tests**: Not implemented
- ❌ **Pre-canned Deck Agent Tests**: Not implemented

## Next Steps

1. Create test directory structure
2. Implement unit tests for each agent
3. Add integration tests for workflows
4. Set up CI/CD pipeline integration
5. Monitor test coverage and performance

## Notes

- Tests should be independent and not rely on external services
- Use mocking for external dependencies
- Include both positive and negative test cases
- Document test data and setup requirements
- Maintain test data separately from production data
