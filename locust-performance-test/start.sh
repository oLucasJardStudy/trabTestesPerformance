#!/bin/bash
set -e

cd "$(dirname "$0")"

docker network inspect node-api-connect >/dev/null 2>&1 \
  || docker network create node-api-connect

docker rm -f locust-master locust-worker \
  locust-performance-test_master_1 locust-performance-test_worker_1 \
  2>/dev/null || true

docker-compose up -d --force-recreate

echo ""
echo "Locust disponível em: http://localhost:8089"
echo "Host da API (já configurado): http://node-api:4444"
echo ""
echo "Logs: docker-compose logs -f master worker"
