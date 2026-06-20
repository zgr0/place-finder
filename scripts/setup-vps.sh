#!/bin/bash
# One-time VPS setup for venuewar.com
# Run as root on a fresh Hetzner CX32 (Ubuntu 24.04)

set -e

DOMAIN="venuewar.com"
EMAIL="ozkara583@gmail.com"
APP_DIR="/opt/venuewar"

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== Creating app directory ==="
mkdir -p "$APP_DIR/certbot/conf"
mkdir -p "$APP_DIR/certbot/www"
mkdir -p "$APP_DIR/models"
mkdir -p "$APP_DIR/nginx"
cd "$APP_DIR"

echo ""
echo "=== Copy project files to $APP_DIR ==="
echo "Run from your local machine:"
echo "  scp docker-compose.yml nginx/venuewar.conf .env.example root@VPS_IP:$APP_DIR/"
echo "  cp .env.example .env && nano .env  (fill in secrets)"
echo ""
read -p "Press Enter when files are copied and .env is configured..."

echo "=== Obtaining SSL certificate ==="
docker run --rm \
  -v "$APP_DIR/certbot/conf:/etc/letsencrypt" \
  -v "$APP_DIR/certbot/www:/var/www/certbot" \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN"

echo "=== SSL cert obtained! ==="
echo ""
echo "=== Uploading GGUF model ==="
echo "Run from your local machine (after running scripts/convert_to_gguf.py):"
echo "  scp models/quest-model-q4km.gguf root@VPS_IP:$APP_DIR/models/"
echo ""
read -p "Press Enter when model is uploaded (or skip to deploy without AI)..."

echo "=== Logging into GHCR ==="
echo "Create a GitHub Personal Access Token with read:packages scope"
read -p "GitHub username: " GH_USER
read -s -p "GitHub PAT (read:packages): " GH_TOKEN
echo ""
echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin

echo "=== Starting services ==="
docker compose pull
docker compose up -d

echo ""
echo "=== Done! ==="
echo "Services running at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f server    # server logs"
echo "  docker compose logs -f ai        # AI inference logs"
echo "  docker compose ps                # service status"
