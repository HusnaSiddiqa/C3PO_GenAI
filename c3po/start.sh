#!/bin/bash
set -e

if [[ -z "$SERVICE_TYPE" ]]; then
  echo "ERROR: SERVICE_TYPE environment variable not set. Must be one of: admin, chat-mgr"
  exit 1
fi

case "$SERVICE_TYPE" in
  admin)
    echo "Starting admin service on port 80..."
    exec nohup uvicorn backend.admin.main:app --host 0.0.0.0 --port 80 > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  chat-mgr)
    echo "Starting chat-mgr service on port 8081..."
    exec nohup uvicorn chat_manager.main:app --host 0.0.0.0 --port 8081 > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  nlq)
    echo "Starting nlq service on port 8000..."
    exec nohup python /backend/agents/nlq/NLQAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  byod)
    echo "Starting byod service on port 8000..."
    exec nohup python /backend/agents/byod/BYODAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  orchestrator)
    echo "Starting orchestrator service on port 8000..."
    exec nohup python /backend/agents/orchestrator/OrchestratorAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  precanned_deck)
    echo "Starting precanned_deck service on port 8000..."
    exec nohup python /backend/agents/precanned_deck/deck_refresh_agent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  ppt)
    echo "Starting ppt service on port 8000..."
    exec nohup python /backend/agents/ppt/ppt_agent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  chart)
    echo "Starting chart service on port 8000..."
    exec nohup python /backend/agents/chart/ChartAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  onc_driver_analysis)
    echo "Starting onc_driver_analysis service on port 8000..."
    exec python /backend/agents/onc_driver_analysis/onc_driver_analysisAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  pmr)
    echo "Starting pmr service on port 8000..."
    exec python /backend/agents/pmr/pmrAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  chartaudit)
    echo "Starting chartaudit service on port 8000..."
    exec python /backend/agents/chartaudit/ChartauditAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
    nlq_dso)
    echo "Starting nlq_dso service on port 8000..."
    exec nohup python /backend/agents/nlq_dso/NLQ_DSOAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
    rag)
    echo "Starting rag service on port 8000..."
    exec nohup python /backend/agents/rag/RAGAgent.py > /var/log/app.log 2>&1 &
    exec tail -n 100 -F /var/log/app.log &
    ;;
  *)
    echo "ERROR: Unknown SERVICE_TYPE: $SERVICE_TYPE"
    echo "Must be one of: admin, nlq, chat-mgr"
    exit 1
    ;;
esac

wait