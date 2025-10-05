# 🚀 QUICKSTART - LightLane Deployment

## 🎯 Production Deployment (Recommended)

**Use Dokploy for automatic production deployments!**

👉 **See [DOKPLOY-SETUP.md](./DOKPLOY-SETUP.md) for complete production setup guide**

### Why Dokploy?

- ✅ **Auto-deploy on GitHub push** - Push to main → live in 2-3 min
- ✅ **Built-in PostgreSQL** - Auto-backups every 6 hours, 30-day retention
- ✅ **Zero-downtime deployments** - Rolling updates with health checks
- ✅ **One-click rollbacks** - Instant revert if issues occur
- ✅ **Automatic SSL** - Let's Encrypt certificates auto-renewed
- ✅ **Web dashboard** - Real-time logs, monitoring, metrics
- ✅ **Traefik reverse proxy** - Better than nginx for Docker

**Setup time:** ~30 minutes | **Monthly cost:** ~$24/month

---

## 💻 Local Development

For local testing without Dokploy:

### Prerequisites
- Docker & Docker Compose installed
- 2GB+ RAM available

### Step 1: Start Local Services

```bash
cd /Volumes/Samsung\ T7/LightLane/Development/Main-Website

# Start PostgreSQL, Strapi backend, and Astro frontend
docker compose up -d
```

Wait ~30 seconds for services to initialize:

```bash
docker compose ps
```

You should see:
- ✅ `backend` (Strapi API) - **Up**
- ✅ `frontend` (Astro SSR) - **Up**

**Note:** For local dev, you'll need to set up PostgreSQL separately or use Dokploy's managed database.

### Step 2: Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:4321 | Main website |
| Backend Admin | http://localhost:1337/admin | CMS dashboard |
| Backend API | http://localhost:1337/api | REST API |

### Step 3: Create Strapi Admin Account

1. Visit http://localhost:1337/admin
2. Create your first admin user
3. Login and configure your CMS

---

## 🌐 Production Deployment

**Don't deploy this docker-compose.yml directly to production!**

Instead, use Dokploy for production deployment:

1. **Follow [DOKPLOY-SETUP.md](./DOKPLOY-SETUP.md)**
2. **Push code to GitHub**
3. **Let Dokploy handle:**
   - PostgreSQL database with auto-backups
   - SSL certificates (Let's Encrypt)
   - Traefik reverse proxy
   - Auto-deploy on git push
   - Zero-downtime updates
   - Monitoring & logs

---

## 📊 What's Different in Production?

| Feature | Local Dev | Production (Dokploy) |
|---------|-----------|----------------------|
| Database | Manual setup | Managed PostgreSQL |
| Backups | Manual | Auto every 6 hours |
| SSL | None | Auto Let's Encrypt |
| Reverse Proxy | None | Traefik (auto) |
| Deploy | Manual | Git push → auto-deploy |
| Monitoring | Docker logs | Web dashboard |
| Rollback | Manual | One-click |

---



### Backend won't start
```bash
docker compose logs backend --tail 100
```
Common issues:
- Database connection: Configure database in Dokploy or use local PostgreSQL
- Port conflict: Ensure port 1337 is free
- Missing env vars: Check `.env` file

### Frontend won't start  
```bash
docker compose logs frontend --tail 100
```
Common issues:
- Port conflict: Ensure port 4321 is free
- Missing dependencies: Rebuild with `docker compose build --no-cache frontend`
- Backend not ready: Wait for backend to start first

## 🛑 Stop Local Development

```bash
# Stop services
docker compose down

# Stop and delete all data
docker compose down -v
```

## � View Logs

```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs backend -f
docker compose logs frontend -f

# Last 50 lines
docker compose logs backend --tail 50
```

---

## 📝 Important Files

- `docker-compose.yml` - Local development services
- `.env` - Environment variables (gitignored)
- `Dockerfile.backend` - Strapi build configuration  
- `Dockerfile.frontend` - Astro build configuration
- `DOKPLOY-SETUP.md` - **Complete production deployment guide**

---

## 🎯 Next Steps

1. ✅ **Local development working** - You can develop locally
2. 📚 **Read DOKPLOY-SETUP.md** - Complete production deployment guide
3. 🚀 **Deploy to production** - Push to GitHub, auto-deploy with Dokploy
4. 💾 **Auto-backups enabled** - Every 6 hours via Dokploy
5. 📊 **Monitor your app** - Real-time logs in Dokploy dashboard

---

**🎉 Ready for production?** Follow [DOKPLOY-SETUP.md](./DOKPLOY-SETUP.md) for bulletproof deployment with auto-deploy, backups, and monitoring!
