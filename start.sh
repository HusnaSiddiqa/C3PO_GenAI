#!/bin/bash
set -e

if [[ -z "$SERVICE_TYPE" ]]; then
  echo "ERROR: SERVICE_TYPE environment variable not set. Must be one of: admin, chat-mgr"
  exit 1
fi

case "$SERVICE_TYPE" in
  admin)
    echo "Starting admin service on port 80..."
    exec uvicorn admin.sample:app --host 0.0.0.0 --port 80 &
    ;;
  chat-mgr)
    echo "Starting chat-mgr service on port 8081..."
    exec uvicorn chat_manager.sample:app --host 0.0.0.0 --port 8081 &
    ;;
  *)
    echo "ERROR: Unknown SERVICE_TYPE: $SERVICE_TYPE"
    echo "Must be one of: admin, chat-mgr"
    exit 1
    ;;
esac

wait