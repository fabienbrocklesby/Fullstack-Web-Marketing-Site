# 🚀 Dokploy Setup Guide for LightLane

**Complete guide to deploy your full-stack app to production with automatic deployments**

---

## 📖 What is Dokploy?

Dokploy is a **self-hosted Platform-as-a-Service (PaaS)** that makes deploying Docker applications incredibly easy. Think of it as your own personal Heroku/Vercel that you control.

### Why Dokploy for LightLane?

After losing $800k in revenue from the SQLite data loss incident, we need:
- ✅ **Automatic deployments** - Push to GitHub → instant deployment
- ✅ **Built-in backups** - PostgreSQL auto-backup every 6 hours
- ✅ **Zero-downtime deploys** - Rolling updates with health checks
- ✅ **One-click rollbacks** - Instant revert if something breaks
- ✅ **Automatic SSL** - Let's Encrypt certificates auto-renewed
- ✅ **Web-based monitoring** - Real-time logs, metrics, alerts
- ✅ **Traefik reverse proxy** - Better than nginx for Docker
- ✅ **No vendor lock-in** - Self-hosted, you own everything

---

## 🎯 What You'll Get

Once set up, your workflow will be:

```
Local Development:
  1. Make changes to code
  2. git add . && git commit -m "Update feature"
  3. git push origin main
  
  ↓ (Automatic via GitHub webhook)
  
Dokploy Server:
  ✓ Detects GitHub push
  ✓ Pulls latest code
  ✓ Builds Docker images
  ✓ Runs health checks
  ✓ Zero-downtime rolling update
  ✓ Monitors deployment
  
  ↓ (2-3 minutes later)
  
Production:
  ✅ Live at lightlane.app
  ✅ API at api.lightlane.app
  ✅ Admin at api.lightlane.app/admin
```

**No SSH, no manual commands, no downtime!**

---

## 📋 Prerequisites

Before starting, you need:

- ✅ **DigitalOcean Droplet** (or any VPS)
  - Minimum: 2GB RAM, 2 vCPUs, 50GB SSD
  - Recommended: 4GB RAM, 2 vCPUs, 80GB SSD
  - OS: Ubuntu 22.04 LTS
  
- ✅ **Domain configured**
  - `lightlane.app` → Point to server IP
  - `*.lightlane.app` → Wildcard for subdomains
  - `dokploy.lightlane.app` → For Dokploy dashboard
  
- ✅ **GitHub repository**
  - Repository: `fabienbrocklesby/Fullstack-Web-Marketing-Site`
  - Branch: `main`
  - Code pushed to GitHub

---

## 🔧 Part 1: Install Dokploy on Server

### Step 1: Prepare Server

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git
```

### Step 2: Install Dokploy

```bash
# One-line installer (installs Docker + Dokploy)
curl -sSL https://dokploy.com/install.sh | sh
```

This will:
- ✓ Install Docker and Docker Compose
- ✓ Install Dokploy
- ✓ Set up Traefik reverse proxy
- ✓ Create admin user
- ✓ Start Dokploy on port 3000

**Installation takes ~3-5 minutes**

### Step 3: Access Dokploy Dashboard

```bash
# Get your server IP
curl -4 ifconfig.me

# Access Dokploy
# Open browser: http://YOUR_SERVER_IP:3000
```

### Step 4: Initial Setup

1. **Create admin account:**
   - Email: your-email@example.com
   - Password: Strong password (save this!)
   
2. **Set server domain:**
   - Domain: `dokploy.lightlane.app`
   - Click "Save"
   
3. **Enable SSL (Let's Encrypt):**
   - Toggle "Enable SSL"
   - Email: your-email@example.com
   - Click "Generate Certificate"

**Now Dokploy is at:** `https://dokploy.lightlane.app`

---

## 🗄️ Part 2: Create PostgreSQL Database

### In Dokploy Dashboard:

1. **Go to "Databases"** (left sidebar)

2. **Click "Create Database"**

3. **Configure PostgreSQL:**
   - **Name:** `lightlane-db`
   - **Type:** PostgreSQL
   - **Version:** 16
   - **Database Name:** `strapi`
   - **Username:** `strapi`
   - **Password:** (auto-generated or create strong one)
   - **Port:** 5432
   
4. **Enable Backups:**
   - Toggle "Enable Automatic Backups"
   - Frequency: Every 6 hours
   - Retention: 30 days
   
5. **Click "Create Database"**

**Save these credentials** - you'll need them for environment variables:
```
Database Host: lightlane-db (internal Docker network)
Database Port: 5432
Database Name: strapi
Database User: strapi
Database Password: [copy from Dokploy]
```

---

## 🎨 Part 3: Deploy Frontend (Astro)

### In Dokploy Dashboard:

1. **Go to "Applications"** → **"Create Application"**

2. **Basic Info:**
   - **Name:** `lightlane-frontend`
   - **Type:** Docker
   
3. **Source Code:**
   - **Provider:** GitHub
   - **Repository:** `fabienbrocklesby/Fullstack-Web-Marketing-Site`
   - **Branch:** `main`
   - **Auto Deploy:** ✅ Enabled (deploys on every push!)
   
4. **Build Configuration:**
   - **Build Type:** Dockerfile
   - **Dockerfile Path:** `Dockerfile.frontend`
   - **Build Context:** `.` (workspace root)
   
5. **Environment Variables:**
   ```
   PUBLIC_STRAPI_URL=https://api.lightlane.app
   NODE_ENV=production
   ```
   
6. **Domain & SSL:**
   - **Domain:** `lightlane.app`
   - **Alias:** `www.lightlane.app`
   - **SSL:** ✅ Auto (Let's Encrypt)
   - **Force HTTPS:** ✅ Enabled
   
7. **Health Check:**
   - **Path:** `/`
   - **Port:** 4321
   - **Interval:** 30s
   - **Timeout:** 10s
   
8. **Resources (optional):**
   - **CPU Limit:** 1 core
   - **Memory Limit:** 512MB
   
9. **Click "Deploy"**

**Deployment takes ~2-3 minutes**

---

## ⚙️ Part 4: Deploy Backend (Strapi)

### In Dokploy Dashboard:

1. **Go to "Applications"** → **"Create Application"**

2. **Basic Info:**
   - **Name:** `lightlane-backend`
   - **Type:** Docker
   
3. **Source Code:**
   - **Provider:** GitHub
   - **Repository:** `fabienbrocklesby/Fullstack-Web-Marketing-Site`
   - **Branch:** `main`
   - **Auto Deploy:** ✅ Enabled
   
4. **Build Configuration:**
   - **Build Type:** Dockerfile
   - **Dockerfile Path:** `Dockerfile.backend`
   - **Build Context:** `.`
   
5. **Environment Variables:**
   ```
   NODE_ENV=production
   DATABASE_CLIENT=postgres
   DATABASE_HOST=lightlane-db
   DATABASE_PORT=5432
   DATABASE_NAME=strapi
   DATABASE_USER=strapi
   DATABASE_PASSWORD=[paste from database settings]
   APP_KEYS=[generate with: openssl rand -base64 32]
   API_TOKEN_SALT=[generate with: openssl rand -base64 32]
   ADMIN_JWT_SECRET=[generate with: openssl rand -base64 32]
   TRANSFER_TOKEN_SALT=[generate with: openssl rand -base64 32]
   JWT_SECRET=[generate with: openssl rand -base64 32]
   ```
   
   **Generate secrets on your local machine:**
   ```bash
   # Run these commands to generate secrets:
   echo "APP_KEYS=$(openssl rand -base64 32)"
   echo "API_TOKEN_SALT=$(openssl rand -base64 32)"
   echo "ADMIN_JWT_SECRET=$(openssl rand -base64 32)"
   echo "TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)"
   echo "JWT_SECRET=$(openssl rand -base64 32)"
   ```
   
6. **Domain & SSL:**
   - **Domain:** `api.lightlane.app`
   - **SSL:** ✅ Auto (Let's Encrypt)
   - **Force HTTPS:** ✅ Enabled
   
7. **Health Check:**
   - **Path:** `/_health`
   - **Port:** 1337
   - **Interval:** 30s
   - **Timeout:** 10s
   - **Start Period:** 40s (Strapi takes time to start)
   
8. **Persistent Storage:**
   - **Volume Name:** `uploads`
   - **Mount Path:** `/workspace/backend/public/uploads`
   
9. **Dependencies:**
   - **Link to Database:** Select `lightlane-db`
   
10. **Click "Deploy"**

**Deployment takes ~3-5 minutes** (backend builds slower)

---

## ✅ Part 5: Verify Deployment

### Check Application Status

In Dokploy Dashboard:

1. **Applications** → You should see:
   - ✅ `lightlane-frontend` - Status: Running (green)
   - ✅ `lightlane-backend` - Status: Running (green)

2. **Databases** → You should see:
   - ✅ `lightlane-db` - Status: Healthy (green)

### Test Your Websites

1. **Frontend:** https://lightlane.app
   - Should load your Astro website
   - SSL certificate valid (green padlock)

2. **Backend API:** https://api.lightlane.app/api
   - Should return Strapi API response

3. **Admin Panel:** https://api.lightlane.app/admin
   - Should load Strapi admin login
   - Create your first admin account

### Check Logs

In Dokploy for each app:
- Click "Logs" tab
- Real-time logs streaming
- Filter by time range
- Search for errors

---

## 🔄 Part 6: Set Up GitHub Auto-Deploy

### Configure GitHub Webhook (Already Done!)

When you enabled "Auto Deploy" in Dokploy, it automatically:
- ✅ Created GitHub webhook
- ✅ Configured deployment trigger
- ✅ Set up build pipeline

### Test Auto-Deploy

```bash
# On your local machine
cd /path/to/Fullstack-Web-Marketing-Site

# Make a small change
echo "# Test deploy" >> README.md

# Commit and push
git add .
git commit -m "Test auto-deploy"
git push origin main
```

**Watch the magic happen:**
1. Go to Dokploy → Applications → `lightlane-frontend`
2. Click "Deployments" tab
3. You'll see new deployment starting automatically!
4. Live logs streaming
5. ~2-3 minutes → ✅ Deployed!

---

## 📊 Part 7: Monitoring & Management

### Dokploy Dashboard Features

#### 1. Real-Time Logs
```
Applications → [Your App] → Logs
- Live streaming logs
- Filter by level (info, warn, error)
- Search within logs
- Download logs
```

#### 2. Resource Monitoring
```
Applications → [Your App] → Metrics
- CPU usage graph
- Memory usage graph
- Network I/O
- Disk usage
```

#### 3. Deployment History
```
Applications → [Your App] → Deployments
- All past deployments
- Deployment status (success/failed)
- Build time
- Commit hash
- One-click rollback
```

#### 4. One-Click Rollback
```
If deployment fails or breaks:
1. Go to Deployments
2. Find last working deployment
3. Click "Rollback"
4. ✅ Instant revert to previous version
```

#### 5. Database Backups
```
Databases → lightlane-db → Backups
- Automatic backups every 6 hours
- 30-day retention
- One-click restore
- Download backup files
```

---

## 🔒 Part 8: Security & Best Practices

### Secure Your Dokploy Dashboard

1. **Use strong admin password**
   ```
   Settings → Change Password
   Use password manager
   ```

2. **Enable 2FA (if available)**
   ```
   Settings → Security → Two-Factor Authentication
   ```

3. **Restrict IP access (optional)**
   ```
   Only allow access from your office/home IP
   Configure in server firewall (UFW)
   ```

### Secure Your Applications

1. **Environment Variables**
   - Never commit `.env` to git
   - Store secrets only in Dokploy dashboard
   - Rotate secrets regularly

2. **Database**
   - Strong password (auto-generated by Dokploy)
   - Not exposed to public internet
   - Only accessible within Docker network

3. **SSL/HTTPS**
   - Enabled for all domains
   - Auto-renewed by Let's Encrypt
   - Force HTTPS redirect

4. **Firewall**
   ```bash
   # On server, configure UFW
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP (redirects to HTTPS)
   ufw allow 443/tcp   # HTTPS
   ufw allow 3000/tcp  # Dokploy (optional: restrict by IP)
   ufw enable
   ```

---

## 🆘 Troubleshooting

### Deployment Fails

**Check build logs:**
```
Applications → [Your App] → Deployments → Click failed deployment → View Logs
```

**Common issues:**
- Missing environment variables → Add in Settings
- Build error → Check Dockerfile syntax
- Health check failing → Verify health check path/port

**Solution:** Fix issue, push to GitHub, auto-deploy retries

### Application Crashes

**Check runtime logs:**
```
Applications → [Your App] → Logs → Filter: Errors
```

**Common issues:**
- Database connection failed → Verify DATABASE_HOST, credentials
- Out of memory → Increase memory limit in Settings
- Port conflict → Check exposed ports

**Quick fix:** Click "Restart" button in Dokploy

### Database Connection Issues

**Verify database is running:**
```
Databases → lightlane-db → Should show "Healthy"
```

**Check connection from backend:**
```
Applications → lightlane-backend → Terminal (if available)
# Or check logs for connection errors
```

**Fix:**
- Ensure DATABASE_HOST = `lightlane-db` (Docker network name)
- Verify credentials match database settings
- Restart backend application

### SSL Certificate Issues

**If SSL fails to generate:**
1. Verify domain DNS points to server
2. Wait 5-10 minutes for DNS propagation
3. Try regenerating certificate
4. Check port 80 and 443 are open

### Rollback Deployment

**If new deployment breaks production:**
```
1. Go to Applications → [Your App] → Deployments
2. Find last working deployment (green checkmark)
3. Click "⋮" menu → "Rollback"
4. Confirm
5. ✅ Previous version restored in ~30 seconds
```

---

## 📈 Scaling & Optimization

### Horizontal Scaling

**Run multiple instances:**
```
Applications → [Your App] → Settings → Replicas
Set to 2 or 3 instances
Dokploy + Traefik automatically load balances
```

### Vertical Scaling

**Increase resources:**
```
Applications → [Your App] → Settings → Resources
- CPU Limit: 2 cores
- Memory Limit: 1GB
```

### Database Optimization

**For production with 2000+ users:**
```
Databases → lightlane-db → Settings
- Increase max connections: 100
- Increase shared buffers: 256MB
- Enable query caching
```

---

## 💰 Cost Breakdown

### DigitalOcean Droplet
| Tier | RAM | CPU | Storage | Cost/Month |
|------|-----|-----|---------|------------|
| Basic | 2GB | 2 | 50GB | $18 |
| **Recommended** | **4GB** | **2** | **80GB** | **$24** |
| Production | 8GB | 4 | 160GB | $48 |

### Additional Costs
- **Domain (lightlane.app):** $10-15/year
- **Backups:** Included in Dokploy ✅
- **SSL Certificates:** Free (Let's Encrypt) ✅
- **Monitoring:** Included in Dokploy ✅

**Total Monthly Cost:** ~$24-50 (vs Heroku $50-200+)

---

## 🎯 Quick Reference

### Useful Commands (on server)

```bash
# Check Dokploy status
systemctl status dokploy

# Restart Dokploy
systemctl restart dokploy

# View Dokploy logs
journalctl -u dokploy -f

# Check Docker containers
docker ps

# View container logs
docker logs -f [container-name]

# Free up disk space
docker system prune -a --volumes -f
```

### Important URLs

- **Dokploy Dashboard:** https://dokploy.lightlane.app
- **Frontend:** https://lightlane.app
- **Backend API:** https://api.lightlane.app
- **Admin Panel:** https://api.lightlane.app/admin

### Environment Variables Reference

**Backend (Strapi):**
```env
NODE_ENV=production
DATABASE_CLIENT=postgres
DATABASE_HOST=lightlane-db
DATABASE_PORT=5432
DATABASE_NAME=strapi
DATABASE_USER=strapi
DATABASE_PASSWORD=[from Dokploy database settings]
APP_KEYS=[openssl rand -base64 32]
API_TOKEN_SALT=[openssl rand -base64 32]
ADMIN_JWT_SECRET=[openssl rand -base64 32]
TRANSFER_TOKEN_SALT=[openssl rand -base64 32]
JWT_SECRET=[openssl rand -base64 32]
```

**Frontend (Astro):**
```env
PUBLIC_STRAPI_URL=https://api.lightlane.app
NODE_ENV=production
```

---

## ✅ Post-Deployment Checklist

After completing setup:

- [ ] Frontend accessible at https://lightlane.app
- [ ] Backend API at https://api.lightlane.app/api
- [ ] Admin panel at https://api.lightlane.app/admin
- [ ] SSL certificates valid (green padlock)
- [ ] Auto-deploy tested (push to GitHub → auto-deploy)
- [ ] Database backups enabled (every 6 hours)
- [ ] Created Strapi admin account
- [ ] Import 2000 users from Stripe (separate script)
- [ ] Monitoring enabled
- [ ] Server firewall configured
- [ ] Health checks passing

---

## 🚀 You're Live!

**Congratulations!** Your LightLane app is now:

✅ **Automatically deploying** - Push to GitHub → live in 2-3 min  
✅ **Automatically backing up** - Database snapshots every 6 hours  
✅ **Zero-downtime deploys** - Rolling updates with health checks  
✅ **SSL secured** - HTTPS everywhere, auto-renewed  
✅ **Monitored 24/7** - Real-time logs and metrics  
✅ **Disaster-proof** - One-click rollbacks if issues  

**No more $800k data losses!** 🎉

---

**Need help?** Check Dokploy docs: https://docs.dokploy.com  
**Community:** https://discord.gg/dokploy
