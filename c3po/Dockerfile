# Use a specific Python version image
FROM python:3.11-bookworm AS backend

ENV LANG en_US.UTF-8
ENV LANG C.UTF-8

RUN apt-get -y update --fix-missing && apt-get install -y git
RUN apt-get update && apt-get install -y python3-pip

WORKDIR /backend

COPY ./backend/requirements.txt /backend/requirements.txt
COPY ./backend/core/c3po_core-0.1.3-py3-none-any.whl /backend/core/c3po_core-0.1.3-py3-none-any.whl
COPY ./backend/core/traceloop_wrapper-1.0.0-py3-none-any.whl /backend/core/traceloop_wrapper-1.0.0-py3-none-any.whl
RUN pip3 install --upgrade pip
RUN pip3 install --upgrade setuptools
RUN pip3 install -r requirements.txt --no-cache-dir

COPY ./backend /backend
RUN apt-get remove -y git && apt-get clean

COPY ./start.sh /backend/start.sh
RUN echo "=== Backend stage - Contents of /backend ===" && ls -la /backend/
RUN echo "=== Backend stage - Checking start.sh specifically ===" && ls -la /backend/start.sh
RUN echo "=== Backend stage - start.sh content ===" && cat /backend/start.sh


FROM node:24 AS ui_build
WORKDIR /app
COPY /ui/package.json ./
RUN npm install
COPY /ui .
RUN npm run build


# Use node:24 as the base for serving UI and running backend
FROM python:3.11-bookworm as final
WORKDIR /
# Verify Python version
RUN python --version && pip --version
RUN mkdir -p /ui /backend
ENV PYTHONPATH=/backend:$PYTHONPATH
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*
# Copy UI build
COPY --from=ui_build /app/dist /ui
# Copy UI source (for downstream rebuilds)
RUN mkdir -p /opt/ui-src
COPY --from=ui_build /app /opt/ui-src

# Copy backend files
COPY --from=backend /backend /backend
RUN echo "=== Final stage - Contents of /backend ===" && ls -la /backend/
RUN echo "=== Final stage - Looking for start.sh ===" && ls -la /backend/start.sh || echo "start.sh NOT FOUND!"
RUN echo "=== Final stage - Find all start.sh files ===" && find / -name "start.sh" 2>/dev/null || echo "No start.sh found anywhere"
RUN pip3 install --upgrade pip --break-system-packages
RUN pip3 install --upgrade setuptools --break-system-packages
RUN pip3 install /backend/core/c3po_core-0.1.3-py3-none-any.whl --no-cache-dir --break-system-packages
RUN pip3 install /backend/core/traceloop_wrapper-1.0.0-py3-none-any.whl --no-cache-dir --break-system-packages
RUN pip3 install -r /backend/requirements.txt --no-cache-dir --break-system-packages --only-binary tiktoken

RUN chmod +x /backend/start.sh
RUN echo "=== Final stage - Contents of /backend ===" && ls -la /backend/

# Install serve globally
RUN npm install -g serve

EXPOSE 80 8081 8000


# Entrypoint script to choose between UI (serve) and backend
RUN echo '#!/bin/sh' > /start-all.sh && \
    echo '' >> /start-all.sh && \
    echo '# Check SERVICE_TYPE environment variable' >> /start-all.sh && \
    echo 'if [ "$SERVICE_TYPE" = "ui" ]; then' >> /start-all.sh && \
    echo '    echo "Starting UI service (serve)..."' >> /start-all.sh && \
    echo '    serve -s /ui -l 80' >> /start-all.sh && \
    echo 'else' >> /start-all.sh && \
    echo '    echo "Starting backend service with SERVICE_TYPE=$SERVICE_TYPE"' >> /start-all.sh && \
    echo '    ls -la /backend/start.sh' >> /start-all.sh && \
    echo '    . /backend/start.sh' >> /start-all.sh && \
    echo 'fi' >> /start-all.sh && \
    chmod +x /start-all.sh

RUN echo "=== Final stage - Contents of /start-all.sh ===" && ls -la /start-all.sh

CMD ["/start-all.sh"]