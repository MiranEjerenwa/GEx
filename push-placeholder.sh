#!/bin/bash
set -euo pipefail

ACCOUNT_ID="636385936792"
REGION="us-east-1"
REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

SERVICES=(catalog order gift-card booking partner admin notification auth wishlist community payment)

echo "==> Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY

echo "==> Building placeholder image..."
docker build -t egp-placeholder ./placeholder

for svc in "${SERVICES[@]}"; do
  REPO="egp/${svc}"
  IMAGE="${REGISTRY}/${REPO}:latest"
  echo "==> Tagging and pushing ${IMAGE}..."
  docker tag egp-placeholder "${IMAGE}"
  docker push "${IMAGE}"
done

echo "==> All images pushed successfully!"
