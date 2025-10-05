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

### Step 1: Choose your Docker workflow

#### 🔄 Hot Reload (Recommended for daily development)

```bash
cd /Volumes/Samsung\ T7/LightLane/Development/Main-Website

# Create .env files if you haven't already
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start PostgreSQL, Strapi (watch mode), and Astro dev server with live reload
docker compose -f docker-compose.dev.yml up --build
```

This stack mounts your local code into the containers so changes you make in VS Code are reflected immediately.

#### 🧪 Production-like stack (no hot reload)

```bash
docker compose up -d
```

Use this when you want to mimic the production build artefacts that Dokploy deploys.

> ⏱️ Both stacks can live side-by-side. Use `docker compose -f docker-compose.dev.yml down` to stop the hot reload stack.

### Step 2: Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:4321 | Main website |
| Backend Admin | http://localhost:1337/admin | CMS dashboard |
| Backend API | http://localhost:1337/api | REST API |

#### Database connection hints

- When services run inside Docker (`docker-compose.dev.yml`), use `DATABASE_HOST=postgres` in `backend/.env`.
- When running Strapi directly on your host (without Docker), connect to the same database with `DATABASE_HOST=localhost` and port `5432`.
- Any external tool (pgAdmin, psql) from your machine can reach the database at `localhost:5432`, credentials from `.env` (defaults: `strapi/strapi`).

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

> For the hot reload stack, prepend `-f docker-compose.dev.yml` to the commands above.

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
# Stop hot reload stack
docker compose -f docker-compose.dev.yml down

# Stop production-like stack
docker compose down

# Remove all volumes/data for both stacks
docker compose -f docker-compose.dev.yml down -v
docker compose down -v
```

## � View Logs

```bash
# View all logs (hot reload stack)
docker compose -f docker-compose.dev.yml logs -f

# View specific service
docker compose -f docker-compose.dev.yml logs backend -f
docker compose -f docker-compose.dev.yml logs frontend -f

# Last 50 lines
docker compose -f docker-compose.dev.yml logs backend --tail 50
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
