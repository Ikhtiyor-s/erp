# Aniq ERP — Production Deployment

VPS minimal talab: 2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 22.04+

## 1. Server tayyorlash

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Nginx + Certbot
sudo apt update
sudo apt install -y nginx python3-certbot-nginx ufw

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 2. Loyihani joylash

```bash
sudo mkdir -p /opt/aniq-erp
sudo chown $USER /opt/aniq-erp
git clone <repo-url> /opt/aniq-erp
cd /opt/aniq-erp
```

## 3. Environment

```bash
cp .env.production.example .env

# Generate SECRET_KEY
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env

# Generate POSTGRES_PASSWORD
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

# Manually edit:
#   YOUR_DOMAIN, CORS_ORIGINS, ANTHROPIC_API_KEY, SENTRY_DSN
nano .env
```

## 4. Ishga tushirish

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Wait for healthy
docker compose ps

# Run extra seed (optional, for demo data)
docker exec erp-api python -m app.db.seed_demo
docker exec erp-api python -m app.db.seed_extra

# Run tests to verify
docker exec erp-api sh -c 'cd /app && python -m pytest tests/ -v'
```

## 5. Nginx + SSL

```bash
# Replace <YOUR_DOMAIN> in config
sudo sed "s/<YOUR_DOMAIN>/yourdomain.uz/g" \
    /opt/aniq-erp/infra/nginx/aniq-erp.conf | \
    sudo tee /etc/nginx/sites-available/aniq-erp.conf

# Add rate limit zone to main nginx.conf
sudo sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;' \
    /etc/nginx/nginx.conf

# Enable site
sudo ln -sf /etc/nginx/sites-available/aniq-erp.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL via Let's Encrypt
sudo certbot --nginx -d yourdomain.uz -d www.yourdomain.uz \
    --redirect --agree-tos -m admin@yourdomain.uz

# Verify auto-renewal
sudo certbot renew --dry-run
```

## 6. Backup cron

```bash
sudo chmod +x /opt/aniq-erp/infra/scripts/backup.sh
sudo chmod +x /opt/aniq-erp/infra/scripts/restore.sh

# Daily at 03:00 UTC
sudo crontab -l 2>/dev/null | { cat; echo "0 3 * * * /opt/aniq-erp/infra/scripts/backup.sh >> /var/log/aniq-erp-backup.log 2>&1"; } | sudo crontab -

# Test backup immediately
sudo /opt/aniq-erp/infra/scripts/backup.sh
ls -lh /var/backups/aniq-erp/daily/
```

## 7. Monitoring (ixtiyoriy)

```bash
cd /opt/aniq-erp/infra/monitoring

# Set Grafana password
echo "GRAFANA_PASSWORD=$(openssl rand -base64 16)" > .env
echo "POSTGRES_PASSWORD=<same-as-main-env>" >> .env

docker compose up -d

# Access via SSH tunnel (NOT exposed publicly)
#   ssh -L 9090:127.0.0.1:9090 -L 3001:127.0.0.1:3001 user@server
# Then visit http://localhost:9090 + http://localhost:3001
```

## 8. Smoke test

```bash
# API health
curl https://yourdomain.uz/api/v1/health
# {"status":"ok","env":"production"}

# Login page renders
curl -I https://yourdomain.uz/login
# HTTP/1.1 200 OK
```

## 9. Yangilash (deploy)

```bash
cd /opt/aniq-erp
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Manual schema migrations bo'lsa
# (Alembic to be added)

# Final test
docker exec erp-api sh -c 'cd /app && python -m pytest tests/ -v'
```

## 10. Rollback

```bash
# Restore from latest daily backup
ls -lh /var/backups/aniq-erp/daily/
sudo /opt/aniq-erp/infra/scripts/restore.sh \
    /var/backups/aniq-erp/daily/erp-YYYY-MM-DD.sql.gz

# Git rollback
cd /opt/aniq-erp
git log --oneline -10
git checkout <previous-commit>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Faqat tekshirish

- **Web**: `https://yourdomain.uz` (login: `qa@example.com` / `Qa12345!`)
- **API docs**: `https://yourdomain.uz/docs`
- **API health**: `https://yourdomain.uz/api/v1/health`
- **Postgres**: SSH orqali → `psql -h 127.0.0.1 -p 5434 -U erp`
- **Logs**: `docker logs -f erp-api` / `docker logs -f erp-web`
- **Backup**: `/var/backups/aniq-erp/` (daily/weekly/monthly)
- **Monitoring**: SSH tunnel → `http://localhost:9090` (Prometheus), `http://localhost:3001` (Grafana)

## Xavfsizlik tekshiruvi

- [ ] `.env` git'da yo'q (`echo ".env" >> .gitignore`)
- [ ] `SECRET_KEY` 64-hex (`openssl rand -hex 32`)
- [ ] `POSTGRES_PASSWORD` kuchli
- [ ] PgAdmin Production'da o'chirilgan (`profiles: ["disabled"]`)
- [ ] Postgres faqat 127.0.0.1 ga bog'langan (Nginx orqali tashqi yo'q)
- [ ] Nginx CSP + HSTS yoqilgan
- [ ] UFW firewall faqat 22/80/443
- [ ] Let's Encrypt avto-renewal ishlamoqda
- [ ] Backup avto-cron faol va S3 yoki tashqi diskka ham nusxa olinmoqda
- [ ] Sentry DSN o'rnatilgan (xato monitoring)
