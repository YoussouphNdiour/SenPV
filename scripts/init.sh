#!/bin/bash
set -e

echo "=== SenPV — Initialisation ==="

# Load .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ .env créé depuis .env.example"
    echo "⚠ MODIFIEZ .env avec vos valeurs avant de lancer !"
    exit 1
fi

# shellcheck disable=SC1091
source .env

# Start containers
docker compose up -d

# Wait for PostgreSQL
echo "Attente de PostgreSQL..."
until docker compose exec postgres pg_isready -U "$POSTGRES_USER"; do
    sleep 2
done

# Run migrations
echo "Migrations Alembic..."
docker compose exec backend alembic upgrade head

# Seed equipment catalog
echo "Seed catalogue équipements..."
docker compose exec backend python -c "from app.services.seed_equipment import seed; seed()"

# Seed admin user
echo "Seed utilisateur admin..."
docker compose exec backend python -c "from app.seed import seed_admin; seed_admin()"

echo "=== SenPV prêt ! ==="
echo "Frontend : https://${DOMAIN}"
echo "API      : https://${DOMAIN}/api/health"
echo "Portainer: https://portainer.${DOMAIN}"
