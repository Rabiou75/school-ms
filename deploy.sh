#!/usr/bin/env bash
# ============================================================
#  School Management System — one-shot VPS deployer
#  Target: Ubuntu 22.04 / 24.04, run as root
#  Usage:  bash deploy.sh
# ============================================================
set -euo pipefail

# ------------------------------------------------------------
# 0. Helpers
# ------------------------------------------------------------
RED=$'\033[0;31m'; GRN=$'\033[0;32m'; YLW=$'\033[1;33m'; CYN=$'\033[0;36m'; NC=$'\033[0m'

say()  { printf '%s\n' "${CYN}▸${NC} $*"; }
ok()   { printf '%s\n' "${GRN}✓${NC} $*"; }
warn() { printf '%s\n' "${YLW}!${NC} $*"; }
die()  { printf '%s\n' "${RED}✗${NC} $*" >&2; exit 1; }

need_root() {
  if [[ $EUID -ne 0 ]]; then
    die "Run as root:  sudo bash $0"
  fi
}

# ------------------------------------------------------------
# 1. Preflight
# ------------------------------------------------------------
need_root

say "Checking OS..."
if ! grep -qE 'Ubuntu (22|24)\.04' /etc/os-release 2>/dev/null; then
  warn "This script is tested on Ubuntu 22.04 / 24.04. Continuing on $(. /etc/os-release; echo "$PRETTY_NAME")."
fi

# ------------------------------------------------------------
# 2. Interactive inputs
# ------------------------------------------------------------
say "Deployment configuration"
echo

read -rp "Domain (e.g. school.yourdomain.com): " DOMAIN
[[ -n "$DOMAIN" ]] || die "Domain is required"
DOMAIN="${DOMAIN// /}"

read -rp "Email for Let's Encrypt notifications: " LE_EMAIL
[[ -n "$LE_EMAIL" ]] || die "Email is required"

read -rp "Project path on this server [/opt/school-ms]: " PROJ
PROJ="${PROJ:-/opt/school-ms}"

read -rp "Postgres user [school]: " PG_USER
PG_USER="${PG_USER:-school}"

read -rp "Postgres DB name [school_ms]: " PG_DB
PG_DB="${PG_DB:-school_ms}"

read -rsp "Postgres password (leave empty to auto-generate): " PG_PASS
echo
if [[ -z "$PG_PASS" ]]; then
  PG_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)
  say "Generated Postgres password: $PG_PASS"
fi

read -rp "Enable CinetPay integration? [y/N]: " ENABLE_CINET
ENABLE_CINET="${ENABLE_CINET:-N}"

if [[ "$ENABLE_CINET" =~ ^[Yy]$ ]]; then
  read -rp "  CinetPay API key (sk_test_… or sk_live_…): " CINET_KEY
  read -rp "  CinetPay Site ID: " CINET_SITE
fi

echo
say "Summary"
echo "  Domain       : $DOMAIN"
echo "  Project path : $PROJ"
echo "  Postgres DB  : $PG_DB (user $PG_USER)"
echo "  CinetPay     : $ENABLE_CINET"
echo
read -rp "Proceed? [y/N]: " GO
[[ "$GO" =~ ^[Yy]$ ]] || die "Aborted"

# ------------------------------------------------------------
# 3. System packages
# ------------------------------------------------------------
say "Installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw openssl certbot

# ------------------------------------------------------------
# 4. Docker
# ------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  apt-get install -y docker-compose-plugin
  systemctl enable --now docker
  ok "Docker installed"
else
  ok "Docker already present: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin missing. Run: apt-get install -y docker-compose-plugin"
fi

# ------------------------------------------------------------
# 5. Firewall
# ------------------------------------------------------------
say "Configuring UFW..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable >/dev/null 2>&1 || true
ok "Firewall: 22, 80, 443"

# ------------------------------------------------------------
# 6. Project presence
# ------------------------------------------------------------
if [[ ! -d "$PROJ" ]]; then
  die "Project directory $PROJ not found. Upload the project first (scp or git clone) and rerun."
fi
cd "$PROJ"

[[ -f docker/docker-compose.prod.yml ]] || die "docker/docker-compose.prod.yml missing — is this the school-ms repo?"
[[ -f docker/Dockerfile.api ]] || die "docker/Dockerfile.api missing"

ok "Project found at $PROJ"

# ------------------------------------------------------------
# 7. .env
# ------------------------------------------------------------
say "Writing .env..."
if [[ -f .env ]]; then
  warn ".env already exists — backing up to .env.bak.$(date +%s)"
  cp .env ".env.bak.$(date +%s)"
fi

JWT_A=$(openssl rand -hex 32)
JWT_R=$(openssl rand -hex 32)

cat > .env <<ENV
NODE_ENV=production

POSTGRES_USER=$PG_USER
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=$PG_DB

JWT_ACCESS_SECRET=$JWT_A
JWT_REFRESH_SECRET=$JWT_R
JWT_ACCESS_TTL=60m
JWT_REFRESH_TTL=7d

PUBLIC_API_URL=https://$DOMAIN

CINETPAY_API_KEY=${CINET_KEY:-}
CINETPAY_SITE_ID=${CINET_SITE:-}
CINETPAY_NOTIFY_URL=https://$DOMAIN/api/v1/payments/cinetpay/webhook
CINETPAY_RETURN_URL=https://$DOMAIN/fr/parent
ENV
chmod 600 .env
ok ".env written"

# ------------------------------------------------------------
# 8. TLS certificate
# ------------------------------------------------------------
say "Issuing Let's Encrypt certificate for $DOMAIN..."
mkdir -p docker/certs

# Free port 80 if anything is listening
docker compose -f docker/docker-compose.prod.yml down 2>/dev/null || true

if [[ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]]; then
  ok "Certificate already exists"
else
  certbot certonly --standalone --non-interactive --agree-tos -m "$LE_EMAIL" -d "$DOMAIN"
fi

cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" docker/certs/fullchain.pem
cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem"   docker/certs/privkey.pem
chmod 644 docker/certs/*.pem

# Auto-renewal cron
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
  (crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet --deploy-hook \"docker compose -f $PROJ/docker/docker-compose.prod.yml restart nginx\"") | crontab -
  ok "Certbot auto-renewal scheduled (Mondays 3 AM)"
fi

# ------------------------------------------------------------
# 9. Build & launch
# ------------------------------------------------------------
say "Building and starting containers (this takes 5–10 minutes the first time)..."
docker compose -f docker/docker-compose.prod.yml up -d --build

say "Waiting for Postgres to be healthy..."
for i in {1..30}; do
  if docker compose -f docker/docker-compose.prod.yml ps postgres | grep -q "healthy"; then
    ok "Postgres healthy"
    break
  fi
  sleep 3
  [[ $i -eq 30 ]] && die "Postgres never became healthy. Check: docker compose -f docker/docker-compose.prod.yml logs postgres"
done

# ------------------------------------------------------------
# 10. Migrations + seed
# ------------------------------------------------------------
say "Running Prisma migrations..."
docker compose -f docker/docker-compose.prod.yml exec -T api \
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

say "Seeding demo data (idempotent — safe to rerun)..."
docker compose -f docker/docker-compose.prod.yml exec -T api \
  npx tsx packages/database/prisma/seed.ts || warn "Seed skipped (may already be seeded)"

# ------------------------------------------------------------
# 11. Backups
# ------------------------------------------------------------
say "Setting up nightly backups..."
mkdir -p "$PROJ/backups"
chmod +x "$PROJ/scripts/backup.sh" 2>/dev/null || true

if ! crontab -l 2>/dev/null | grep -q "school-ms/scripts/backup.sh"; then
  (crontab -l 2>/dev/null; echo "0 2 * * * POSTGRES_USER=$PG_USER POSTGRES_DB=$PG_DB $PROJ/scripts/backup.sh >> /var/log/school-backup.log 2>&1") | crontab -
  ok "Nightly backup scheduled (2 AM)"
fi

# ------------------------------------------------------------
# 12. Health check
# ------------------------------------------------------------
say "Health check..."
sleep 5
HTTP=$(curl -sk -o /dev/null -w '%{http_code}' "https://$DOMAIN" || echo "000")
if [[ "$HTTP" == "200" || "$HTTP" == "301" || "$HTTP" == "302" ]]; then
  ok "Site responds: HTTP $HTTP"
else
  warn "Site returned HTTP $HTTP — check logs:"
  echo "  docker compose -f $PROJ/docker/docker-compose.prod.yml logs --tail=50 nginx"
fi

# ------------------------------------------------------------
# 13. Done
# ------------------------------------------------------------
cat <<EOF

${GRN}============================================================${NC}
${GRN}  Deployment complete${NC}
${GRN}============================================================${NC}

  URL      : https://$DOMAIN
  Login    : https://$DOMAIN/fr/login
  Admin    : admin@demo-school.cm / Admin@1234
  Teacher  : m.ngo@lby.cm / Teacher@1234
  Parent   : parent@lby.cm / Parent@1234

${YLW}Change the admin password immediately after first login.${NC}

Useful commands
---------------
  Logs       : docker compose -f $PROJ/docker/docker-compose.prod.yml logs -f
  Restart    : docker compose -f $PROJ/docker/docker-compose.prod.yml restart
  Stop       : docker compose -f $PROJ/docker/docker-compose.prod.yml down
  Update     : cd $PROJ && git pull && \\
               docker compose -f docker/docker-compose.prod.yml up -d --build && \\
               docker compose -f docker/docker-compose.prod.yml exec -T api \\
                 npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
  Backup now : POSTGRES_USER=$PG_USER POSTGRES_DB=$PG_DB $PROJ/scripts/backup.sh

  Postgres password is in $PROJ/.env (chmod 600, not committed)
  Backups land in $PROJ/backups

EOF