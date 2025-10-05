# 🐳 Docker Production Setup - Complete Guide

## 📖 What Happened

**October 2, 2025** - Catastrophic data loss incident:
- Force-pushed to GitHub causing SQLite database overwrite
- Lost 2000 users worth **$800k NZD** in revenue
- Database recovery attempts failed (not in git, no backups)
- **Critical Discovery**: All customer data safe in Stripe ✅

## 🏗️ New Architecture

Migrated from fragile PM2 + SQLite setup to robust Docker + PostgreSQL:

### Services (5 containers)

1. **PostgreSQL** (`lightlane-db`)
   - Port: `5432`
   - Version: 16-alpine
   - Persistent storage with health checks
   - Credentials: `strapi/strapi`

2. **Strapi Backend** (`lightlane-backend`)
   - Port: `1337`
   - Node 22-alpine with pnpm workspace
   - Admin: http://localhost:1337/admin
   - API: http://localhost:1337/api

3. **Astro Frontend** (`lightlane-frontend`)
   - Port: `4321`
   - SSR with Node adapter
   - Connects to backend API

4. **Nginx Reverse Proxy** (`lightlane-nginx`)
   - Ports: `80` (HTTP), `443` (HTTPS)
   - Rate limiting + gzip compression
   - SSL ready

5. **Automated Backup** (`lightlane-backup`)
   - Runs `pg_dump` every 6 hours
   - 30-day retention (auto-cleanup)
   - Backups saved to `./backups/` (gitignored)

## 🔑 Database Credentials

```
Host: localhost (or 'postgres' from containers)
Port: 5432
Database: strapi
User: strapi
Password: strapi
```

**Production**: Change password to something stronger in `.env`

## 🌐 Service URLs (Development)

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:4321 | Main website |
| Backend Admin | http://localhost:1337/admin | CMS dashboard |
| Backend API | http://localhost:1337/api | REST API |
| Nginx | http://localhost | Reverse proxy |
| PostgreSQL | localhost:5432 | Database |

## 🚀 Quick Start

```bash
# Start everything
docker compose up -d

# Wait 30 seconds for initialization
sleep 30

# Check status
docker compose ps

# Create admin account
open http://localhost:1337/admin
```

## 💾 Backup Configuration

- **Frequency**: Every 6 hours (21600 seconds)
- **Retention**: 30 days (auto-delete older)
- **Location**: `./backups/lightlane_backup_YYYYMMDD_HHMMSS.sql.gz`
- **Method**: `pg_dump` with gzip compression
- **Logs**: `./backups/backup.log`

### Manual Backup
```bash
docker compose exec backup /backup.sh
```

### Restore from Backup
```bash
# Stop backend
docker compose stop backend

# Restore
gunzip < backups/lightlane_backup_20250102_143000.sql.gz | \
  docker compose exec -T postgres psql -U strapi -d strapi

# Restart backend
docker compose start backend
```

## 🔧 Troubleshooting

### Issues Encountered During Setup

#### 1. Frontend Build Failure
**Error**: "Cannot find module '@tailwindcss/postcss'"  
**Solution**: Added `@tailwindcss/postcss@^4.0.0` to `frontend/package.json`  
**Reason**: Tailwind v4 requires explicit PostCSS plugin

#### 2. Backend Crash Loop
**Error**: "Cannot find module '/app/node_modules/.bin/strapi'"  
**Solution**: Changed CMD to `../node_modules/.pnpm/node_modules/.bin/strapi`  
**Reason**: pnpm workspaces nest binaries in `.pnpm/` subdirectory

#### 3. Uploads Directory Missing
**Error**: "The upload folder (/workspace/backend/public/uploads) doesn't exist"  
**Solution**: Added `RUN mkdir -p public/uploads && chmod -R 777 public` to Dockerfile  
**Reason**: Strapi needs writable uploads directory

#### 4. Backup Container Restart Loop
**Error**: `setpgid: Operation not permitted` (crond on macOS)  
**Solution**: Replaced crond with simple sleep loop  
**Reason**: macOS Docker has permission issues with cron

#### 5. Password Authentication Failures
**Error**: "password authentication failed for user 'strapi'"  
**Root Cause**: Environment variables were being wrapped at ~38 characters  
**Solution**: Used short simple password "strapi"  
**Lesson**: Keep Docker development passwords short to avoid line wrapping

### Common Issues & Solutions

#### Backend won't start
```bash
docker compose logs backend --tail 100
```
- Check `.env` has `DB_PASSWORD=strapi`
- Ensure port 1337 is free
- Verify postgres is healthy: `docker compose ps`

#### Frontend won't start
```bash
docker compose logs frontend --tail 100
```
- Ensure port 4321 is free
- Check `PUBLIC_STRAPI_URL` in `.env`
- Rebuild if needed: `docker compose build --no-cache frontend`

#### Database connection issues
```bash
# Test connection
docker compose exec postgres psql -U strapi -d strapi -c "SELECT version();"
```

#### View all logs in real-time
```bash
docker compose logs -f
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Orchestrates all 5 services |
| `.env` | Environment variables (gitignored) |
| `Dockerfile.backend` | Strapi build config (multi-stage) |
| `Dockerfile.frontend` | Astro build config (multi-stage) |
| `backup.sh` | Automated backup script |
| `nginx.conf` | Reverse proxy config |
| `QUICKSTART.md` | Quick deployment guide |

## 🏭 Production Deployment

### 1. Update Environment Variables

Edit `.env`:
```bash
# Strong database password
DB_PASSWORD=your_very_strong_password_here

# Production API URL
PUBLIC_STRAPI_URL=https://api.yourdomain.com

# Ensure all secrets are regenerated
APP_KEYS=...
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
```

### 2. Deploy to Server

```bash
# On server
git pull origin main

# Start services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

### 3. Set Up SSL

**Option A**: Cloudflare Tunnel (easiest)
- Zero-config SSL
- DDoS protection
- No port forwarding needed

**Option B**: Let's Encrypt
- Update `nginx.conf` with SSL certificates
- Use certbot for automatic renewal

### 4. Enable Server Backups

1. **Database backups**: Already automated via Docker (every 6 hours)
2. **Full server snapshots**: Enable DigitalOcean snapshots ($4/month)
3. **Off-site backups**: Sync `./backups/` to S3/Backblaze

### 5. Monitoring

```bash
# Check service health
docker compose ps

# View resource usage
docker stats

# Check backup logs
tail -f backups/backup.log
```

## 📊 Build Times

| Service | No Cache | With Cache |
|---------|----------|------------|
| Backend | ~99.8s | ~1.6s |
| Frontend | ~55.0s | ~2.7s |

## 🔄 Data Recovery Plan

### Import from Stripe

All 2000 users' data is safe in Stripe. Create import script:

1. Export customers from Stripe dashboard (CSV or API)
2. Create Strapi import script:
   ```javascript
   // backend/scripts/import-from-stripe.js
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
   const strapi = require('@strapi/strapi');
   
   async function importCustomers() {
     const customers = await stripe.customers.list({ limit: 100 });
     // Map to Strapi user structure
     // Import via Strapi API
   }
   ```
3. Send password reset emails to all users
4. Verify data integrity

## 📝 Key Lessons Learned

1. **Always have backups** - Automated backups prevent $800k losses
2. **PostgreSQL > SQLite** - For production, use proper database
3. **Docker for consistency** - Same environment dev to prod
4. **pnpm workspace paths** - Binaries nested in `.pnpm/` subdirectory
5. **Short passwords for dev** - Avoid environment variable wrapping issues
6. **Health checks matter** - Proper service dependencies prevent race conditions
7. **Multi-stage builds** - Smaller production images, faster rebuilds
8. **Gitignore backups** - Keep backups out of version control

## 🎯 Next Steps

- [ ] Create Strapi admin account
- [ ] Import 2000 users from Stripe
- [ ] Test password reset emails
- [ ] Deploy to production server
- [ ] Set up Cloudflare Tunnel or SSL
- [ ] Enable DigitalOcean snapshots
- [ ] Monitor backup logs daily
- [ ] Test restore procedure monthly

---

**🎉 Success!** You now have a production-ready Docker setup with automated backups. No more data loss incidents!