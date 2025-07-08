# Deployment Guide

## Overview

This guide covers deploying the SaaS Boilerplate to production environments:
- **Frontend**: Cloudflare Pages
- **Backend**: DigitalOcean App Platform  
- **Database**: PostgreSQL (managed service)

## Prerequisites

- GitHub repository with your code
- Cloudflare account
- DigitalOcean account
- Stripe account (for payments)
- Domain name (optional)

## Frontend Deployment (Cloudflare Pages)

### 1. Repository Setup
```bash
# Push your code to GitHub
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Cloudflare Pages Setup
1. Log into Cloudflare dashboard
2. Go to "Pages" > "Create a project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `pnpm --filter frontend build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `/` (leave empty)

### 3. Environment Variables
In Cloudflare Pages dashboard, add:
```env
PUBLIC_CMS_URL=https://your-backend-url.ondigitalocean.app
```

### 4. Custom Domain (Optional)
1. Add your domain in Pages settings
2. Configure DNS records as instructed
3. Enable SSL/TLS

## Backend Deployment (DigitalOcean App Platform)

### 1. Database Setup
1. Create a managed PostgreSQL database:
   - Go to DigitalOcean > Databases
   - Create new PostgreSQL cluster
   - Note the connection string

### 2. App Platform Setup
1. Go to DigitalOcean > Apps
2. Create new app from GitHub repository
3. Configure app settings:
   - **Source**: Your GitHub repository
   - **Source directory**: `backend/`
   - **Autodeploy**: Enable
   - **Build command**: `npm run build`
   - **Run command**: `npm start`

### 3. Environment Variables
Add these environment variables in App Platform:
```env
DATABASE_URL=postgresql://user:password@host:port/database
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
FRONTEND_URL=https://your-frontend-domain.pages.dev
HOST=0.0.0.0
PORT=8080
APP_KEYS=generate-random-keys-here
API_TOKEN_SALT=generate-random-salt-here
ADMIN_JWT_SECRET=generate-random-secret-here
TRANSFER_TOKEN_SALT=generate-random-salt-here
JWT_SECRET=generate-random-secret-here
```

### 4. Generate Secure Keys
```bash
# Generate random keys for production
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Stripe Configuration

### 1. Production Keys
1. Get your live API keys from Stripe dashboard
2. Update environment variables with live keys
3. Create your products and prices in live mode

### 2. Webhook Setup
1. Go to Stripe Dashboard > Webhooks
2. Create new webhook endpoint
3. URL: `https://your-backend-url.ondigitalocean.app/api/stripe/webhook`
4. Events: `checkout.session.completed`
5. Copy the webhook secret to your environment variables

## DNS Configuration

### Frontend (Cloudflare)
```
Type: CNAME
Name: www
Target: your-app.pages.dev
```

### Backend (DigitalOcean)
```
Type: A
Name: api
Target: [DigitalOcean App IP]
```

## SSL/TLS

Both platforms provide automatic SSL/TLS certificates:
- **Cloudflare Pages**: Automatic with custom domains
- **DigitalOcean Apps**: Automatic SSL provisioning

## Health Checks

### Frontend Health Check
```bash
curl -I https://your-domain.com
```

### Backend Health Check
```bash
curl -I https://your-api-domain.com/api/health
```

## Monitoring & Logging

### Cloudflare Pages
- View deployment logs in Pages dashboard
- Monitor performance with Cloudflare Analytics

### DigitalOcean Apps
- View application logs in App Platform
- Monitor resource usage and performance

## Rollback Strategy

### Frontend
1. Go to Cloudflare Pages dashboard
2. Select previous deployment
3. Click "Retry deployment"

### Backend
1. Go to DigitalOcean App Platform
2. Select previous deployment from history
3. Click "Redeploy"

## Security Considerations

### Environment Variables
- Never commit sensitive keys to version control
- Use different keys for development and production
- Rotate keys regularly

### CORS Configuration
- Restrict origins to your actual domains
- Don't use wildcards in production

### Database Security
- Use SSL connections
- Restrict database access to your app only
- Regular backups

## Performance Optimization

### Frontend
- Enable Cloudflare caching
- Optimize images and assets
- Use CDN for static resources

### Backend
- Enable database connection pooling
- Implement caching strategies
- Monitor API response times

## Troubleshooting

### Common Issues

1. **Build failures**: Check build logs for dependency issues
2. **Database connection**: Verify connection string format
3. **CORS errors**: Check frontend URL in backend config
4. **Stripe webhooks**: Verify endpoint URL and secret

### Getting Help

- Check deployment logs for error messages
- Review environment variable configuration
- Test API endpoints individually
- Verify database connectivity

## Backup Strategy

### Database
- DigitalOcean provides automatic backups
- Set up additional backup schedules as needed

### Code
- Use Git for version control
- Tag releases for easy rollback
- Keep environment configs documented

## Cost Optimization

### Cloudflare Pages
- Free tier includes unlimited static sites
- Pro tier for advanced features

### DigitalOcean
- Start with smallest app size
- Scale up based on usage
- Monitor resource usage regularly

## Next Steps

1. Set up monitoring and alerting
2. Configure automated testing
3. Implement continuous deployment
4. Add error tracking (Sentry, etc.)
5. Set up performance monitoring
