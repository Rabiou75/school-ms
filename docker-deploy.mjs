import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const put = (p, c) => {
  const full = join(root, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, c, 'utf8');
  console.log('  + ' + p);
};

// ---------- Dockerfile.api ----------
put('docker/Dockerfile.api', `# ============================================================
# API — NestJS + Prisma
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @school/database generate
RUN pnpm --filter @school/shared build
RUN pnpm --filter @school/database build
RUN pnpm --filter api build

# ============================================================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && apk add --no-cache tini
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
`);

// ---------- Dockerfile.web ----------
put('docker/Dockerfile.web', `# ============================================================
# Web — Next.js standalone
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @school/shared build
RUN pnpm --filter web build

# ============================================================
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
`);

// ---------- docker-compose.prod.yml ----------
put('docker/docker-compose.prod.yml', `services:
  postgres:
    image: postgres:18-alpine
    restart: always
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [backend]

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis:/data
    networks: [backend]

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}?schema=public
      REDIS_URL: redis://redis:6379
      API_PORT: 4000
      JWT_ACCESS_SECRET: \${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: \${JWT_REFRESH_SECRET}
      JWT_ACCESS_TTL: 60m
      JWT_REFRESH_TTL: 7d
      CINETPAY_API_KEY: \${CINETPAY_API_KEY}
      CINETPAY_SITE_ID: \${CINETPAY_SITE_ID}
      CINETPAY_NOTIFY_URL: \${CINETPAY_NOTIFY_URL}
      CINETPAY_RETURN_URL: \${CINETPAY_RETURN_URL}
    networks: [backend]
    expose: ["4000"]

  web:
    build:
      context: ..
      dockerfile: docker/Dockerfile.web
    restart: always
    depends_on: [api]
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: \${PUBLIC_API_URL}
      API_INTERNAL_URL: http://api:4000
    networks: [backend]
    expose: ["3000"]

  nginx:
    image: nginx:1.27-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on: [web, api]
    networks: [backend]

volumes:
  pgdata:
  redis:

networks:
  backend:
    driver: bridge
`);

// ---------- nginx.conf ----------
put('docker/nginx.conf', `worker_processes auto;
events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  sendfile on;
  client_max_body_size 25m;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

  upstream web_upstream { server web:3000; }
  upstream api_upstream { server api:4000; }

  # HTTP -> HTTPS redirect
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  # HTTPS main
  server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
      proxy_pass http://api_upstream/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 120s;
    }

    location / {
      proxy_pass http://web_upstream;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
`);

// ---------- .dockerignore ----------
put('.dockerignore', `node_modules
.next
dist
.turbo
.git
.env
.env.local
*.log
coverage
docker/certs
backups
`);

// ---------- backup.sh ----------
put('scripts/backup.sh', `#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="\${BACKUP_DIR:-/opt/school-ms/backups}"
mkdir -p "\$BACKUP_DIR"

STAMP=\$(date +%Y-%m-%d_%H-%M)
FILE="\$BACKUP_DIR/school_ms_\$STAMP.dump"
COMPOSE="/opt/school-ms/docker/docker-compose.prod.yml"

docker compose -f "\$COMPOSE" exec -T postgres \\
  pg_dump -U "\${POSTGRES_USER:-school}" -Fc "\${POSTGRES_DB:-school_ms}" > "\$FILE"

# Keep 30 days
find "\$BACKUP_DIR" -name "school_ms_*.dump" -mtime +30 -delete

# Optional: sync off-site
# aws s3 cp "\$FILE" s3://your-bucket/school-ms/

echo "Backup complete: \$FILE"
`);

// ---------- env template ----------
put('docker/.env.prod.example', `# ============================================================
# Production .env template — copy to /opt/school-ms/.env
# Generate secrets with:  openssl rand -base64 24   or   openssl rand -hex 32
# ============================================================
NODE_ENV=production

# --- Postgres ---
POSTGRES_USER=school
POSTGRES_PASSWORD=CHANGE_ME_24_RANDOM_CHARS
POSTGRES_DB=school_ms

# --- JWT ---
JWT_ACCESS_SECRET=CHANGE_ME_HEX_32
JWT_REFRESH_SECRET=CHANGE_ME_HEX_32

# --- Public URL (used by the browser) ---
PUBLIC_API_URL=https://school.yourdomain.com

# --- CinetPay ---
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_NOTIFY_URL=https://school.yourdomain.com/api/v1/payments/cinetpay/webhook
CINETPAY_RETURN_URL=https://school.yourdomain.com/fr/parent
`);

// ---------- DEPLOY.md ----------
put('docs/DEPLOY.md', `# Production Deployment Guide

Deploy to a single Ubuntu VPS with Docker Compose.

## Requirements

- Ubuntu 22.04 or 24.04 VPS, 2 vCPU / 4 GB RAM minimum (Hetzner CX22, DO 4GB, Contabo M)
- A domain name pointing to the server's IP
- 30 minutes

## 1. Server setup

\`\`\`bash
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
\`\`\`

## 2. Upload the project

From your local machine:

\`\`\`powershell
scp -r D:\\school-ms root@YOUR_SERVER_IP:/opt/school-ms
\`\`\`

Or clone from Git:

\`\`\`bash
mkdir -p /opt && cd /opt
git clone https://your-repo.git school-ms
\`\`\`

## 3. Configure environment

\`\`\`bash
cd /opt/school-ms
cp docker/.env.prod.example .env
nano .env
\`\`\`

Fill in:

- \`POSTGRES_PASSWORD\` — generate: \`openssl rand -base64 24\`
- \`JWT_ACCESS_SECRET\`, \`JWT_REFRESH_SECRET\` — generate: \`openssl rand -hex 32\`
- \`PUBLIC_API_URL\` — e.g. \`https://school.yourdomain.com\`
- CinetPay keys (optional if you don't want payments yet)

## 4. TLS certificate

\`\`\`bash
apt install -y certbot

# Nothing must be listening on port 80
certbot certonly --standalone -d school.yourdomain.com

mkdir -p docker/certs
cp /etc/letsencrypt/live/school.yourdomain.com/fullchain.pem docker/certs/
cp /etc/letsencrypt/live/school.yourdomain.com/privkey.pem  docker/certs/
\`\`\`

Auto-renewal:

\`\`\`bash
crontab -e
\`\`\`

Add:

\`\`\`
0 3 * * 1 certbot renew --quiet --deploy-hook "docker compose -f /opt/school-ms/docker/docker-compose.prod.yml restart nginx"
\`\`\`

## 5. Build and launch

\`\`\`bash
cd /opt/school-ms
docker compose -f docker/docker-compose.prod.yml up -d --build
\`\`\`

First build: 5-10 minutes. Subsequent: 1-2 minutes.

## 6. Migrations and seed

\`\`\`bash
docker compose -f docker/docker-compose.prod.yml exec api \\
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

docker compose -f docker/docker-compose.prod.yml exec api \\
  npx tsx packages/database/prisma/seed.ts
\`\`\`

## 7. Verify

\`\`\`bash
docker compose -f docker/docker-compose.prod.yml ps
curl -I https://school.yourdomain.com
\`\`\`

Open \`https://school.yourdomain.com\` → /fr/login.

## 8. Backups

\`\`\`bash
chmod +x /opt/school-ms/scripts/backup.sh
crontab -e
\`\`\`

Add:

\`\`\`
0 2 * * * POSTGRES_USER=school POSTGRES_DB=school_ms /opt/school-ms/scripts/backup.sh >> /var/log/school-backup.log 2>&1
\`\`\`

## 9. Update workflow

\`\`\`bash
cd /opt/school-ms
git pull
docker compose -f docker/docker-compose.prod.yml up -d --build
docker compose -f docker/docker-compose.prod.yml exec -T api \\
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
\`\`\`

## 10. Restore a backup

\`\`\`bash
# Stop the API so nothing writes
docker compose -f docker/docker-compose.prod.yml stop api

# Drop and recreate DB
docker compose -f docker/docker-compose.prod.yml exec -T postgres \\
  psql -U school -d postgres -c "DROP DATABASE school_ms;"
docker compose -f docker/docker-compose.prod.yml exec -T postgres \\
  psql -U school -d postgres -c "CREATE DATABASE school_ms OWNER school;"

# Restore
docker compose -f docker/docker-compose.prod.yml exec -T postgres \\
  pg_restore -U school -d school_ms --clean --if-exists < backups/school_ms_YYYY-MM-DD.dump

# Restart
docker compose -f docker/docker-compose.prod.yml start api
\`\`\`

## Troubleshooting

\`\`\`bash
# Logs
docker compose -f docker/docker-compose.prod.yml logs -f
docker compose -f docker/docker-compose.prod.yml logs --tail=100 api

# Restart one service
docker compose -f docker/docker-compose.prod.yml restart api

# Disk usage / cleanup
docker system df
docker system prune -f    # safe; keeps volumes
\`\`\`

## Security checklist

- [ ] POSTGRES_PASSWORD is 24+ random chars
- [ ] JWT secrets are distinct 32-byte hex strings
- [ ] .env is never committed
- [ ] UFW allows only 22, 80, 443
- [ ] HTTPS enforced
- [ ] Backups running nightly and tested monthly
- [ ] Admin password changed after first login
`);

console.log('\n✅ Docker deployment files written');
console.log('   Files: docker/Dockerfile.api, docker/Dockerfile.web,');
console.log('          docker/docker-compose.prod.yml, docker/nginx.conf,');
console.log('          docker/.env.prod.example, .dockerignore,');
console.log('          scripts/backup.sh, docs/DEPLOY.md');