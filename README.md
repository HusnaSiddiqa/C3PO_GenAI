# C3PO - Multi-Agent GenAI Orchestration Platform

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-19.1.0-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.13-green.svg)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3.26-green.svg)](https://www.langchain.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.4.8-green.svg)](https://langchain-ai.github.io/langgraph/)

[![AWS Bedrock](https://img.shields.io/badge/AWS-Bedrock-orange.svg)](https://aws.amazon.com/bedrock/)
[![Kubernetes](https://img.shields.io/badge/kubernetes-ready-brightgreen.svg)](https://kubernetes.io/)
[![Docker](https://img.shields.io/badge/Docker-containerized-blue.svg)](https://www.docker.com/)
[![Helm](https://img.shields.io/badge/Helm-v3-blue.svg)](https://helm.sh/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-purple.svg)](https://www.terraform.io/)

[![Vite](https://img.shields.io/badge/Vite-7.0-yellow.svg)](https://vitejs.dev/)
[![Material-UI](https://img.shields.io/badge/MUI-7.x-blue.svg)](https://mui.com/)
[![Databricks](https://img.shields.io/badge/Databricks-SQL-red.svg)](https://www.databricks.com/)
[![OpenSearch](https://img.shields.io/badge/OpenSearch-vector--db-blue.svg)](https://opensearch.org/)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-NoSQL-orange.svg)](https://aws.amazon.com/dynamodb/)
[![S3](https://img.shields.io/badge/AWS-S3-orange.svg)](https://aws.amazon.com/s3/)

[![Dynatrace](https://img.shields.io/badge/Dynatrace-monitoring-purple.svg)](https://www.dynatrace.com/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-tracing-blue.svg)](https://opentelemetry.io/)
[![Okta](https://img.shields.io/badge/Okta-Auth-blue.svg)](https://www.okta.com/)

> An enterprise-grade, cloud-native conversational AI platform that leverages multiple specialized AI agents for intelligent data analysis, document processing, and report generation through natural language interaction.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [AI Agents](#ai-agents)
- [System Components](#system-components)
- [Data Flow](#data-flow)
- [Infrastructure](#infrastructure)
- [Security](#security)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Observability](#observability)
- [Contributing](#contributing)

---

## 🎯 Overview

C3PO (Cloud Conversational Cognitive Platform and Orchestrator) is a sophisticated multi-agent AI system designed for enterprise business intelligence and healthcare analytics. The platform intelligently routes user queries to specialized AI agents, enabling seamless natural language interaction with complex data sources, document repositories, and analytical tools.

### What Makes This Special?

- **Multi-Agent Orchestration**: Intelligent routing of queries to specialized AI agents based on intent classification
- **Enterprise-Ready**: Production-grade microservices architecture with Kubernetes deployment
- **Cloud-Native**: Built on AWS services (Bedrock, S3, DynamoDB, OpenSearch) with auto-scaling capabilities
- **Real-Time Streaming**: Progressive response delivery with live status updates
- **Extensible**: Modular agent design allowing easy addition of new specialized agents
- **Healthcare-Focused**: Specialized agents for oncology data analysis and patient medical records

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                            │
│                    (React + TypeScript + MUI)                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS/REST API
┌───────────────────────────────▼─────────────────────────────────────┐
│                       CHAT MANAGER SERVICE                          │
│              (Conversation Management & Routing)                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ A2A Protocol (JSON-RPC)
┌───────────────────────────────▼─────────────────────────────────────┐
│                      ORCHESTRATOR AGENT                             │
│           (Intent Classification & Agent Selection)                 │
└───────────────┬────────────┬────────────┬────────────┬──────────────┘
                │            │            │            │
      ┌─────────▼───┐  ┌─────▼─────┐  ┌──▼────┐  ┌───▼──────┐
      │  NLQ Agent  │  │ RAG Agent │  │ BYOD  │  │   PPT    │
      │  (SQL Gen)  │  │(Knowledge)│  │ Agent │  │  Agent   │
      └──────┬──────┘  └─────┬─────┘  └───┬───┘  └────┬─────┘
             │               │             │           │
      ┌──────▼──────────────┬▼─────────────▼───────────▼─────────────┐
      │                   DATA LAYER                                  │
      │  Databricks │ OpenSearch │ S3 │ DynamoDB │ AWS Bedrock      │
      └───────────────────────────────────────────────────────────────┘
```

### Agent-to-Agent (A2A) Protocol

The platform implements a custom A2A communication protocol:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Requester   │  HTTP   │ Orchestrator │  HTTP   │  Specialized │
│    Agent     │────────▶│    Agent     │────────▶│    Agent     │
│              │  POST   │              │  POST   │              │
└──────────────┘         └──────────────┘         └──────────────┘
       ▲                        │                         │
       │         Streaming      │                         │
       └────────Response────────┴─────────────────────────┘
              (Server-Sent Events)
```

**Key Components:**
- **Agent Card**: `.well-known/agent.json` for agent discovery
- **Message Format**: JSON-RPC style with streaming support
- **State Management**: LangGraph-based state machines
- **Error Handling**: Retry policies with exponential backoff

---

## ✨ Key Features

### 🤖 Intelligent Agent Orchestration
- Automatic intent classification and agent selection
- Multi-agent collaboration for complex queries
- Dynamic sub-agent routing based on query type
- Conversation memory with context awareness

### 📊 Natural Language to SQL (NLQ)
- Converts natural language questions to SQL queries
- Query validation and revision with context
- Direct execution against Databricks SQL warehouse
- Structured data results with intelligent analysis
- AWS Bedrock prompt caching for optimization

### 📄 Document Intelligence (BYOD)
- Upload and analyze documents (PDF, Excel, CSV, JSON, PPTX)
- Retrieval Augmented Generation (RAG) over user documents
- Vector-based semantic search
- Multi-document synthesis

### 🔍 Knowledge Base Retrieval (RAG)
- Hybrid search (semantic + keyword) via OpenSearch
- Document reranking and transformation
- PMR (Patient Medical Records) specialized indexing
- Domain-specific knowledge retrieval

### 📈 Data Visualization
- Automated chart generation from data
- Intelligent chart type selection
- Chart.js compatible output formats
- Interactive visualization rendering

### 🎨 Presentation Generation
- Automated PowerPoint creation from data and insights
- Template-based slide generation
- Integrated visualization and summary sub-agents
- Pre-canned deck support with scheduled refresh

### 🔐 Enterprise Security
- Okta OAuth 2.0/OIDC integration
- IAM role-based access control
- AWS Secrets Manager for credential management
- User group validation (admin vs user roles)

### 📡 Real-Time Streaming
- Progressive response delivery
- Live status updates during processing
- Server-Sent Events (SSE) for streaming
- Token-by-token LLM response streaming

### 🎯 Admin Configuration
- Web-based settings management
- Prompt template administration
- Schema configuration
- Clickable questions management
- Agent benchmarking and testing

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.0 | UI framework with concurrent features |
| **TypeScript** | 5.x | Type-safe development |
| **Vite** | 7.0 | Lightning-fast build tool |
| **Material-UI (MUI)** | 7.x | Enterprise UI component library |
| **TanStack Query** | Latest | Server state management |
| **Emotion** | Latest | CSS-in-JS styling |
| **Chart.js** | Latest | Data visualization |
| **Okta React** | Latest | Authentication integration |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.11 | Primary backend language |
| **FastAPI** | 0.115.13 | High-performance API framework |
| **Uvicorn** | Latest | ASGI server with async support |
| **LangChain** | 0.3.26 | LLM application framework |
| **LangGraph** | 0.4.8 | Agent state machine orchestration |
| **Pydantic** | 2.x | Data validation with type hints |
| **boto3** | Latest | AWS SDK for Python |
| **httpx** | Latest | Async HTTP client |

### AI & ML
| Technology | Purpose |
|------------|---------|
| **AWS Bedrock** | LLM inference (Amazon Nova Pro models) |
| **Amazon Titan Embed** | Text embeddings for vector search |
| **LangChain** | LLM application orchestration |
| **LangGraph** | Agent workflow state machines |
| **OpenSearch** | Vector storage and hybrid search |
| **MLflow** | Model tracking and versioning |

### Data Layer
| Technology | Purpose |
|------------|---------|
| **Databricks SQL** | Data warehouse and SQL execution |
| **AWS S3** | Object storage for documents and files |
| **DynamoDB** | NoSQL database for conversations and metadata |
| **OpenSearch** | Vector database for RAG |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Kubernetes (EKS)** | Container orchestration |
| **Helm** | Kubernetes package management |
| **Docker** | Containerization |
| **Terraform** | Infrastructure as Code |
| **AWS IAM** | Identity and access management |
| **AWS ACM** | Certificate management |

### Observability
| Technology | Purpose |
|------------|---------|
| **Dynatrace** | Application performance monitoring |
| **OpenTelemetry** | Distributed tracing |
| **Structured Logging** | JSON-formatted application logs |

---

## 🤖 AI Agents

The platform features **10+ specialized AI agents**, each designed for specific analytical tasks:

### 1. 🎯 Orchestrator Agent
**Location**: `c3po/backend/agents/orchestrator/OrchestratorAgent.py`

**Responsibilities**:
- Intent classification from user queries
- Agent selection based on query type
- Multi-agent workflow coordination
- Response aggregation and summarization
- Conversation flow management

**Technologies**: LangGraph, AWS Bedrock Nova Pro, Custom A2A protocol

---

### 2. 💬 NLQ Agent (Natural Language Query)
**Location**: `c3po/backend/agents/nlq/NLQAgent.py`

**Responsibilities**:
- Natural language to SQL translation
- Query validation and revision
- SQL execution against Databricks
- Result formatting and analysis
- Context-aware query refinement

**Key Features**:
- Prompt caching for performance optimization
- Multi-stage processing pipeline
- Query completeness checking
- Structured data output

**State Machine Flow**:
```
User Query → Check Completeness → Revise Query → Generate SQL
→ Execute Query → Fetch Results → Format & Analyze → Return
```

---

### 3. 📄 BYOD Agent (Bring Your Own Document)
**Location**: `c3po/backend/agents/byod/BYODAgent.py`

**Responsibilities**:
- Document upload and processing
- File parsing (PDF, Excel, CSV, JSON, PPTX, TXT)
- RAG over user-uploaded documents
- Vector-based semantic search
- Document Q&A

**Supported Formats**: PDF, XLSX, CSV, JSON, PPTX, TXT, DOC

---

### 4. 🔍 RAG Agent
**Location**: `c3po/backend/agents/rag/RAGAgent.py`

**Responsibilities**:
- Knowledge base retrieval from OpenSearch
- Hybrid search (semantic + BM25 keyword search)
- Document reranking and transformation
- PMR (Patient Medical Records) querying
- Context-aware information retrieval

**Search Strategy**: Combines semantic embeddings with keyword matching for optimal relevance

---

### 5. 📊 Chart Agent
**Location**: `c3po/backend/agents/chart/ChartAgent.py`

**Responsibilities**:
- Data visualization generation
- Intelligent chart type selection
- Chart.js compatible output
- Interactive visualization configuration

**Supported Chart Types**: Bar, Line, Pie, Doughnut, Scatter, Area

---

### 6. 🎨 PPT Agent (PowerPoint Generation)
**Location**: `c3po/backend/agents/ppt/ppt_agent.py`

**Responsibilities**:
- Automated PowerPoint creation
- Multi-slide presentation generation
- Data visualization integration
- Summary and insights generation
- Template-based design

**Sub-Agents**:
- Visualization Agent: Creates charts for slides
- Summary Agent: Generates executive summaries

---

### 7. 📦 Precanned Deck Agent
**Responsibilities**:
- Pre-configured presentation generation
- Scheduled deck refresh capabilities
- Template-based recurring reports

---

### 8. ✅ Chart Audit Agent
**Responsibilities**:
- Chart data quality validation
- Visualization accuracy auditing
- Data integrity checks

---

### 9. 💼 NLQ DSO Agent
**Responsibilities**:
- Days Sales Outstanding (DSO) analysis
- Specialized financial metrics queries
- Receivables analytics

---

### 10. 🏥 PMR Agent
**Responsibilities**:
- Patient Medical Records querying
- HIPAA-compliant data handling
- Healthcare-specific data analysis

---

### 11. 🧬 ONC Driver Analysis Agent
**Responsibilities**:
- Oncology driver analysis
- Cancer treatment pathway insights
- Clinical decision support

---

## 🧩 System Components

### Backend Services

#### 1. Chat Manager Service
**Port**: 8081
**Purpose**: Central hub for conversation management

**Capabilities**:
- Chat session lifecycle management
- Message routing to agents
- Conversation history persistence (DynamoDB)
- Source selection (multi-tenant routing)
- User feedback collection
- Real-time streaming coordination

**Key Files**:
- `c3po/backend/admin/routes_chatmanager.py`
- Message handling, session management, agent communication

---

#### 2. Admin Service
**Port**: 80
**Purpose**: Platform configuration and management

**Capabilities**:
- Settings management (system-wide configuration)
- Feedback collection and analysis
- Schema configuration for data sources
- Clickable questions management
- Agent benchmark testing
- Prompt template administration
- User role management

**Key Files**:
- `c3po/backend/admin/routes_admin.py`
- Admin UI serving, API endpoints

---

#### 3. Agent Services
**Port**: 8000 (per agent)
**Purpose**: Specialized AI agent execution

**Architecture**: Each agent runs as an independent microservice for:
- **Isolation**: Agent failures don't cascade
- **Scalability**: Independent horizontal scaling
- **Flexibility**: Different resource allocations per agent
- **Deployment**: Independent update cycles

---

### Frontend Application

**Location**: `c3po/ui/`
**Build**: Vite-based React application

**Key Features**:
- **Chat Interface**: Modern conversational UI with message streaming
- **Document Upload**: Drag-and-drop file upload with preview
- **Visualization Rendering**: Dynamic chart display using Chart.js
- **Authentication**: Okta-integrated SSO
- **Admin Panel**: Configuration management interface
- **Responsive Design**: Mobile-friendly Material-UI components
- **Dark Mode**: Theme switching support

**Main Components**:
- `c3po/ui/src/components/ChatInterface.tsx`: Main chat UI
- `c3po/ui/src/components/MessageList.tsx`: Message rendering
- `c3po/ui/src/components/ChartRenderer.tsx`: Visualization display
- `c3po/ui/src/services/api.ts`: Backend API client

---

### Shared Utilities

**Location**: `c3po/backend/utils/`

**Core Modules**:

1. **`constants.py`**: Centralized configuration constants
2. **`s3_util.py`**: S3 file operations (upload, download, listing)
3. **`databricks_sql_wrapper.py`**: Databricks query execution
4. **`okta_auth.py`**: Authentication and authorization
5. **`dynamo_util.py`**: DynamoDB table operations
6. **`source_selector.py`**: Multi-tenant data source routing
7. **`traceloop_wrapper.py`**: Observability and tracing

---

## 🔄 Data Flow

### End-to-End Request Flow

```
1. User Input (Browser)
   │
   ├─→ UI Component (React)
   │
   ├─→ API Request (HTTPS)
   │
   ├─→ Chat Manager Service (FastAPI)
   │   ├─ Authenticate User (Okta)
   │   ├─ Load Conversation Context (DynamoDB)
   │   └─ Route to Orchestrator
   │
   ├─→ Orchestrator Agent (A2A Protocol)
   │   ├─ Classify Intent (LLM)
   │   ├─ Select Agent(s)
   │   └─ Forward Request
   │
   ├─→ Specialized Agent (e.g., NLQ Agent)
   │   ├─ Process Query (LangGraph State Machine)
   │   │   ├─ Check Completeness
   │   │   ├─ Revise Query (if needed)
   │   │   ├─ Execute Main Task
   │   │   │   ├─ Generate SQL (LLM)
   │   │   │   ├─ Execute Query (Databricks)
   │   │   │   └─ Fetch Results
   │   │   └─ Format Response
   │   └─ Stream Results (SSE)
   │
   ├─→ Chat Manager (Aggregation)
   │   ├─ Store Message (DynamoDB)
   │   └─ Return Response
   │
   └─→ UI Update (Real-time Display)
```

### LangGraph State Machine Example

Each agent implements a state graph for workflow orchestration:

```python
# Simplified NLQ Agent State Machine

workflow = StateGraph(AgentState)

# Define nodes
workflow.add_node("check_query_completeness", check_query_completeness)
workflow.add_node("revise_query", revise_query)
workflow.add_node("nlq", nlq_function)
workflow.add_node("fetch_results", fetch_results)

# Define edges
workflow.set_entry_point("check_query_completeness")
workflow.add_conditional_edges(
    "check_query_completeness",
    route_query,
    {
        "complete": "nlq",
        "incomplete": "revise_query"
    }
)
workflow.add_edge("revise_query", "nlq")
workflow.add_edge("nlq", "fetch_results")
workflow.add_edge("fetch_results", END)

agent = workflow.compile()
```

---

## ☁️ Infrastructure

### Kubernetes Architecture

**Cluster**: AWS EKS (Elastic Kubernetes Service)
**Namespace**: Dedicated per environment (dev, staging, prod)

#### Resources Overview

| Resource Type | Count | Purpose |
|--------------|-------|---------|
| Deployments | 9 | Microservice containers |
| Services (ClusterIP) | 9 | Internal service networking |
| Ingress | 9 | External HTTPS access |
| HPA | 9 | Auto-scaling policies |
| ConfigMap | 1 | Environment variables |
| Service Account | 1 | AWS IAM integration |

#### Pod Specifications

**Resource Allocation** (per pod):
```yaml
resources:
  requests:
    cpu: 2000m
    memory: 4Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

**Auto-Scaling**:
```yaml
minReplicas: 2
maxReplicas: 4
targetMemoryUtilizationPercentage: 60
```

**Health Checks**:
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 10
  periodSeconds: 30

livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 60
  periodSeconds: 30
```

#### Ingress Configuration

- **TLS**: AWS ACM certificate integration
- **Path-based routing**: Each service has dedicated path
- **Annotations**: AWS ALB controller configuration

```yaml
# Example Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: <ACM_CERT_ARN>
spec:
  ingressClassName: alb
  rules:
    - host: c3po.example.com
      http:
        paths:
          - path: /chat
            pathType: Prefix
            backend:
              service:
                name: chat-manager
                port:
                  number: 8081
```

---

### Docker Multi-Stage Build

**Strategy**: Optimize image size and security

```dockerfile
# Stage 1: Backend dependencies
FROM python:3.11-slim AS backend
WORKDIR /app
COPY c3po/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY c3po/backend/ .

# Stage 2: UI build
FROM node:24 AS ui-build
WORKDIR /app
COPY c3po/ui/package*.json .
RUN npm ci
COPY c3po/ui/ .
RUN npm run build

# Stage 3: Final image
FROM python:3.11-slim
WORKDIR /app

# Copy backend from stage 1
COPY --from=backend /app /app
COPY --from=backend /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy UI build from stage 2
COPY --from=ui-build /app/dist /app/ui/dist

# Install serve for UI hosting
RUN npm install -g serve

# Service selection via env var
ENV SERVICE_TYPE=chat_manager

# Entry point
CMD ["bash", "start.sh"]
```

**Benefits**:
- **Smaller images**: Only runtime dependencies
- **Faster builds**: Layer caching
- **Security**: No build tools in final image

---

### Helm Chart Structure

```
helm/
├── Chart.yaml                    # Chart metadata
├── values/
│   ├── values_dev.yaml          # Development environment
│   ├── values_staging.yaml      # Staging environment
│   └── values_prod.yaml         # Production environment
└── templates/
    ├── deployment-admin.yaml
    ├── deployment-chatmanager.yaml
    ├── deployment-ui.yaml
    ├── deployment-nlq.yaml
    ├── deployment-byod.yaml
    ├── deployment-orchestrator.yaml
    ├── deployment-rag.yaml
    ├── deployment-ppt.yaml
    ├── deployment-chart.yaml
    ├── service-*.yaml           # ClusterIP services
    ├── ingress-*.yaml           # ALB ingress
    ├── hpa-*.yaml              # Auto-scaling
    ├── configmap.yaml          # Environment config
    └── serviceaccount.yaml     # IAM integration
```

---

### Terraform Infrastructure

**Location**: `terraform/`

**Resources Managed**:
- EKS cluster
- VPC and networking
- IAM roles and policies
- S3 buckets
- DynamoDB tables
- OpenSearch domain
- Security groups
- ACM certificates

**State Management**: Remote state in S3 with DynamoDB locking

---

## 🔐 Security

### Authentication & Authorization

**Identity Provider**: Okta OAuth 2.0 / OIDC

**Flow**:
1. User authenticates via Okta
2. JWT token issued with user claims
3. Token validated on every API request
4. User groups checked for authorization
5. Admin endpoints require `admin` group membership

**Implementation**: `c3po/backend/utils/okta_auth.py`

### AWS IAM Integration

**Service Account**: Kubernetes service account with IAM role annotation

**Capabilities**:
- S3 bucket access (least privilege)
- DynamoDB table operations
- Bedrock model invocation
- OpenSearch access
- Secrets Manager retrieval

### Secrets Management

**Strategy**: AWS Secrets Manager + Kubernetes secrets

**Secrets Stored**:
- Database credentials
- API keys
- Okta client secrets
- AWS access keys (for non-IRSA services)

### Network Security

- **Private subnets**: Backend services in private subnets
- **Security groups**: Least privilege ingress/egress rules
- **TLS**: End-to-end encryption (ACM certificates)
- **WAF** (optional): Web Application Firewall for ingress

---

## 🚀 Getting Started

### Prerequisites

- **Docker**: v20.x or higher
- **Kubernetes**: v1.28+ (or AWS EKS access)
- **Helm**: v3.x
- **kubectl**: v1.28+
- **AWS CLI**: v2.x (configured with credentials)
- **Node.js**: v24.x (for UI development)
- **Python**: 3.11 (for backend development)

### Local Development

#### 1. Clone Repository

```bash
git clone <repository-url>
cd Container
```

#### 2. Set Up Backend

```bash
cd c3po/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export AWS_REGION=us-east-1
export DYNAMODB_TABLE_NAME=c3po-conversations
export S3_BUCKET_NAME=c3po-documents
# ... (see Configuration section)

# Run service (example: Chat Manager)
export SERVICE_TYPE=chat_manager
uvicorn main:app --reload --port 8081
```

#### 3. Set Up Frontend

```bash
cd c3po/ui

# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:5173
```

#### 4. Run Tests

**Backend**:
```bash
cd c3po/backend
pytest tests/ --cov=. --cov-report=html
```

**Frontend**:
```bash
cd c3po/ui
npm run test
```

---

## ⚙️ Configuration

### Environment Variables

**Critical Variables** (90+ total):

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `DYNAMODB_TABLE_NAME` | Conversation table | `c3po-conversations` |
| `S3_BUCKET_NAME` | Document storage | `c3po-documents` |
| `DATABRICKS_SQL_WAREHOUSE` | SQL endpoint | `<warehouse-id>` |
| `OPENSEARCH_ENDPOINT` | Vector DB endpoint | `https://...` |
| `BEDROCK_MODEL_ID` | LLM model | `amazon.nova-pro-v1:0` |
| `OKTA_DOMAIN` | Okta tenant | `example.okta.com` |
| `OKTA_CLIENT_ID` | OAuth client ID | `<client-id>` |
| `DYNATRACE_API_KEY` | Observability | `<api-key>` |
| `SERVICE_TYPE` | Service to run | `chat_manager`, `nlq`, `orchestrator`, etc. |

**Full list**: See `helm/templates/configmap.yaml`

### Feature Flags

**Location**: DynamoDB settings table

```json
{
  "setting_key": "feature_flags",
  "value": {
    "enable_source_selection": true,
    "enable_thinking_mode": false,
    "enable_sub_agent_routing": true
  }
}
```

---

## 🛠️ Development

### Project Structure

```
Container/
├── c3po/
│   ├── backend/
│   │   ├── agents/
│   │   │   ├── orchestrator/
│   │   │   │   ├── OrchestratorAgent.py
│   │   │   │   └── prompts/
│   │   │   ├── nlq/
│   │   │   │   ├── NLQAgent.py
│   │   │   │   └── prompts/
│   │   │   ├── byod/
│   │   │   ├── rag/
│   │   │   ├── chart/
│   │   │   └── ppt/
│   │   ├── admin/
│   │   │   ├── routes_admin.py
│   │   │   └── routes_chatmanager.py
│   │   ├── utils/
│   │   │   ├── constants.py
│   │   │   ├── s3_util.py
│   │   │   ├── databricks_sql_wrapper.py
│   │   │   ├── okta_auth.py
│   │   │   └── dynamo_util.py
│   │   ├── tests/
│   │   ├── main.py
│   │   └── requirements.txt
│   └── ui/
│       ├── src/
│       │   ├── components/
│       │   │   ├── ChatInterface.tsx
│       │   │   ├── MessageList.tsx
│       │   │   └── ChartRenderer.tsx
│       │   ├── services/
│       │   │   └── api.ts
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       └── vite.config.ts
├── helm/
│   ├── Chart.yaml
│   ├── values/
│   └── templates/
├── terraform/
├── Dockerfile
└── README.md
```

### Adding a New Agent

1. **Create agent directory**: `c3po/backend/agents/<agent_name>/`
2. **Implement agent class**: Inherit from base agent
3. **Define prompts**: Create `prompts/` directory
4. **Create LangGraph workflow**: Define state machine
5. **Add agent card**: Create `.well-known/agent.json`
6. **Update orchestrator**: Add agent to selection logic
7. **Create Helm deployment**: `helm/templates/deployment-<agent_name>.yaml`
8. **Add tests**: `c3po/backend/tests/test_<agent_name>.py`

### Code Style

**Python**: PEP 8 with Black formatter
```bash
black c3po/backend/ --line-length 100
```

**TypeScript**: ESLint + Prettier
```bash
npm run lint
npm run format
```

### Testing Strategy

**Unit Tests**: Individual function testing
**Integration Tests**: Agent workflow testing
**E2E Tests**: Full user journey testing

---

## 📦 Deployment

### Helm Deployment

```bash
# Add Helm repo (if external)
helm repo add c3po <repo-url>
helm repo update

# Install/Upgrade
helm upgrade --install c3po ./helm \
  -f helm/values/values_dev.yaml \
  --namespace c3po \
  --create-namespace

# Verify deployment
kubectl get pods -n c3po
kubectl get ingress -n c3po
```

### CI/CD Pipeline

**Recommended Flow**:
```yaml
# .github/workflows/deploy.yml (example)

1. Lint & Test
   - Python: pytest, black, mypy
   - TypeScript: eslint, prettier, vitest

2. Build Docker Images
   - Multi-stage build
   - Tag with commit SHA

3. Push to ECR
   - AWS ECR push

4. Update Helm Values
   - Update image tags

5. Deploy to EKS
   - Helm upgrade

6. Health Check
   - Verify all pods running
   - Check ingress endpoints
```

### Monitoring Deployment

```bash
# Watch pods
kubectl get pods -n c3po -w

# Check logs
kubectl logs -n c3po deployment/chat-manager -f

# Check HPA
kubectl get hpa -n c3po

# Check ingress
kubectl describe ingress -n c3po
```

---

## 📊 Observability

### Distributed Tracing

**Stack**: OpenTelemetry → Dynatrace

**Instrumentation**: `c3po/backend/utils/traceloop_wrapper.py`

**Trace Propagation**: Across all agent calls via A2A protocol

**Key Metrics**:
- Request latency per agent
- LLM token usage
- Database query time
- S3 operation latency

### Logging

**Format**: Structured JSON logging

```python
logger.info(
    "Query executed",
    extra={
        "user_id": user_id,
        "query": query,
        "latency_ms": latency,
        "result_count": count
    }
)
```

**Aggregation**: CloudWatch Logs → Dynatrace

### Health Checks

**Endpoints**:
- `/health`: Liveness check
- `/ready`: Readiness check (includes dependency checks)

**Monitored**:
- Service uptime
- Dependency availability (DB, S3, Bedrock)
- Memory/CPU usage

### Alerts

**Recommended Alerts**:
- Pod crash loop
- High memory utilization (>80%)
- Increased error rate (>5%)
- Slow response time (>5s p95)
- Failed health checks

---

## 🧪 Testing

### Backend Tests

```bash
cd c3po/backend

# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=. --cov-report=html --cov-report=term

# Run specific test file
pytest tests/test_nlq_agent.py -v

# Run with markers
pytest -m "not integration" tests/
```

### Frontend Tests

```bash
cd c3po/ui

# Run tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Integration Tests

```bash
# Test agent communication
pytest tests/integration/test_agent_communication.py

# Test end-to-end flow
pytest tests/integration/test_e2e_nlq.py
```

---

## 🤝 Contributing

### Development Workflow

1. **Fork repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Run tests**: Ensure all tests pass
5. **Push to branch**: `git push origin feature/amazing-feature`
6. **Open Pull Request**

### Pull Request Guidelines

- **Title**: Clear, concise description
- **Description**: What, why, and how
- **Tests**: Add tests for new features
- **Documentation**: Update README if needed
- **Code style**: Follow existing conventions
- **Review**: Address all review comments

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No secrets committed
- [ ] Performance considered
- [ ] Security best practices followed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**Husna Siddiqa** - AI/ML Engineer

Built for pharmaceutical analytics at **Setuserv Informatics Pvt Ltd**

## 📞 Contact

For questions, issues, or contributions:

- **GitHub Issues**: [Create an issue](../../issues)
- **Documentation**: [Wiki](../../wiki)

---

## 🙏 Acknowledgments

- **AWS Bedrock**: For powerful LLM capabilities
- **LangChain/LangGraph**: For agent orchestration framework
- **FastAPI**: For high-performance API framework
- **React Team**: For excellent UI framework
- **Databricks**: For robust data warehousing

---

## 🗺️ Roadmap

### Upcoming Features

- [ ] **Multi-modal support**: Image and audio input processing
- [ ] **Enhanced RAG**: Improved retrieval with reranking
- [ ] **Agent marketplace**: Community-contributed agents
- [ ] **Voice interface**: Speech-to-text integration
- [ ] **Real-time collaboration**: Multi-user chat sessions
- [ ] **Advanced analytics**: User behavior tracking
- [ ] **Custom agent builder**: Low-code agent creation UI
- [ ] **Offline mode**: Local LLM support

---

## 📚 Additional Resources

### Documentation
- [Architecture Deep Dive](docs/architecture.md)
- [Agent Development Guide](docs/agent-development.md)
- [API Reference](docs/api-reference.md)
- [Deployment Guide](docs/deployment.md)

### Tutorials
- [Getting Started Tutorial](docs/tutorials/getting-started.md)
- [Building Your First Agent](docs/tutorials/first-agent.md)
- [Integrating New Data Sources](docs/tutorials/data-sources.md)

### Examples
- [Example Queries](examples/queries.md)
- [Custom Agent Examples](examples/agents/)
- [Integration Examples](examples/integrations/)

---

<div align="center">

**Author : Husna Siddiqa**

*AI/ML Engineer | Setuserv Informatics Pvt Ltd*

*Developed for pharmaceutical analytics and business intelligence*

---

⭐ Star this repo if you find it useful!

</div>
