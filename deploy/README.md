# Trustello — Server-Setup (Hetzner Ubuntu 24.04)

## Einmaliges Setup

### 1. Server vorbereiten
```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git curl
```

### 2. Repo clonen
```bash
git clone git@github.com:Beseco/trustello.git /opt/trustello
cd /opt/trustello
```

### 3. Env befüllen
```bash
cp .env.example .env.production
nano .env.production   # MASTER_KEY, NEXTAUTH_SECRET, DB-Passwörter setzen
```

Wichtige Env-Variablen für Production:
- `MASTER_KEY`: `openssl rand -base64 32`
- `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- `POSTGRES_PASSWORD`: Starkes zufälliges Passwort
- `REDIS_PASSWORD`: Starkes zufälliges Passwort
- `DATABASE_URL`: `postgresql://trustello:${POSTGRES_PASSWORD}@postgres:5432/trustello_prod`

### 4. TLS-Zertifikat
```bash
certbot --nginx -d app.trustello.de -d reseller.trustello.de -d trustello.de
```

### 5. Nginx-Config
```bash
cp deploy/nginx/*.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/app.trustello.de.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 6. App starten
```bash
cd /opt/trustello
docker compose -f deploy/docker-compose.prod.yml build
docker compose -f deploy/docker-compose.prod.yml up -d
docker compose -f deploy/docker-compose.prod.yml exec app node -e \
  "require('./node_modules/.bin/prisma').migrate.deploy()"
```

### 7. Backup-Cron
```bash
chmod +x deploy/backup-cron.sh
crontab -e
# Eintragen: 0 2 * * * /opt/trustello/deploy/backup-cron.sh
```

## Updates deployen
```bash
cd /opt/trustello
git pull
docker compose -f deploy/docker-compose.prod.yml build app
docker compose -f deploy/docker-compose.prod.yml up -d --no-deps app
docker compose -f deploy/docker-compose.prod.yml exec app pnpm prisma migrate deploy
```

## Logs
```bash
docker compose -f deploy/docker-compose.prod.yml logs -f app
```
