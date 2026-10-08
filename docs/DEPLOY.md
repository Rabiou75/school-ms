# Production Deployment Guide

Deploy to a single Ubuntu VPS with Docker Compose.

## Requirements

- Ubuntu 22.04 or 24.04 VPS, 2 vCPU / 4 GB RAM minimum (Hetzner CX22, DO 4GB, Contabo M)
- A domain name pointing to the server's IP
- 30 minutes

## 1. Server setup

```bash
ssh root@YOUR_SERVER_IP

apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw

# Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

## 2. Upload the project

From your local machine:

```powershell
scp -r D:\school-ms root@YOUR_SERVER_IP:/opt/school-ms
```

Or clone from Git:

```bash
mkdir -p /opt && cd /opt
git clone https://your-repo.git school-ms
```

## 3. Configure environment

```bash
cd /opt/school-ms
cp docker/.env.prod.example .env
nano .env
```

Fill in:

- `POSTGRES_PASSWORD` — generate: `openssl rand -base64 24`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate: `openssl rand -hex 32`
- `PUBLIC_API_URL` — e.g. `https://school.yourdomain.com`
- CinetPay keys (optional if you don't want payments yet)

## 4. TLS certificate

```bash
apt install -y certbot

# Nothing must be listening on port 80
certbot certonly --standalone -d school.yourdomain.com

mkdir -p docker/certs
cp /etc/letsencrypt/live/school.yourdomain.com/fullchain.pem docker/certs/
cp /etc/letsencrypt/live/school.yourdomain.com/privkey.pem  docker/certs/
```

Auto-renewal:

```bash
crontab -e
```

Add:

```
0 3 * * 1 certbot renew --quiet --deploy-hook "docker compose -f /opt/school-ms/docker/docker-compose.prod.yml restart nginx"
```

## 5. Build and launch

```bash
cd /opt/school-ms
docker compose -f docker/docker-compose.prod.yml up -d --build
```

First build: 5-10 minutes. Subsequent: 1-2 minutes.

## 6. Migrations and seed

```bash
docker compose -f docker/docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

docker compose -f docker/docker-compose.prod.yml exec api \
  npx tsx packages/database/prisma/seed.ts
```

## 7. Verify

```bash
docker compose -f docker/docker-compose.prod.yml ps
curl -I https://school.yourdomain.com
```

Open `https://school.yourdomain.com` → /fr/login.

## 8. Backups

```bash
chmod +x /opt/school-ms/scripts/backup.sh
crontab -e
```

Add:

```
0 2 * * * POSTGRES_USER=school POSTGRES_DB=school_ms /opt/school-ms/scripts/backup.sh >> /var/log/school-backup.log 2>&1
```

## 9. Update workflow

```bash
cd /opt/school-ms
git pull
docker compose -f docker/docker-compose.prod.yml up -d --build
docker compose -f docker/docker-compose.prod.yml exec -T api \
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

## 10. Restore a backup

```bash
# Stop the API so nothing writes
docker compose -f docker/docker-compose.prod.yml stop api

# Drop and recreate DB
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U school -d postgres -c "DROP DATABASE school_ms;"
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  psql -U school -d postgres -c "CREATE DATABASE school_ms OWNER school;"

# Restore
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_restore -U school -d school_ms --clean --if-exists < backups/school_ms_YYYY-MM-DD.dump

# Restart
docker compose -f docker/docker-compose.prod.yml start api
```

## Troubleshooting

```bash
# Logs
docker compose -f docker/docker-compose.prod.yml logs -f
docker compose -f docker/docker-compose.prod.yml logs --tail=100 api

# Restart one service
docker compose -f docker/docker-compose.prod.yml restart api

# Disk usage / cleanup
docker system df
docker system prune -f    # safe; keeps volumes
```

## Security checklist

- [ ] POSTGRES_PASSWORD is 24+ random chars
- [ ] JWT secrets are distinct 32-byte hex strings
- [ ] .env is never committed
- [ ] UFW allows only 22, 80, 443
- [ ] HTTPS enforced
- [ ] Backups running nightly and tested monthly
- [ ] Admin password changed after first login
