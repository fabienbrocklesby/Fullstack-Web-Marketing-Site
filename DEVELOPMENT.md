# Development Guide

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# 3. Configure your environment variables
# Edit frontend/.env and backend/.env with your actual values

# 4. Start development servers
pnpm dev
```

## Environment Variables

### Frontend (.env)
```env
PUBLIC_CMS_URL=http://localhost:1337
```

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/strapi
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
FRONTEND_URL=http://localhost:4321
HOST=0.0.0.0
PORT=1337
APP_KEYS=your-app-keys-here
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret
```

## Database Setup

1. Install PostgreSQL locally or use a cloud provider
2. Create a new database for your project
3. Update the DATABASE_URL in backend/.env

## Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Create your products and prices
4. Update the STRIPE_SECRET_KEY in backend/.env
5. Set up webhooks for your local development using Stripe CLI

## Content Management

1. Start the backend server: `pnpm --filter backend dev`
2. Navigate to http://localhost:1337/admin
3. Create your admin account
4. Add content types: Pages, Affiliates, Purchases
5. Create sample content

## Available Scripts

- `pnpm dev` - Start both frontend and backend in development mode
- `pnpm build` - Build both applications for production
- `pnpm lint` - Lint all code
- `pnpm format` - Format all code
- `pnpm --filter frontend dev` - Start only frontend
- `pnpm --filter backend dev` - Start only backend

## File Structure

```
├── frontend/           # Astro frontend application
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── layouts/    # Page layouts
│   │   └── pages/      # Route pages
│   ├── public/         # Static assets
│   └── astro.config.mjs
├── backend/            # Strapi backend application
│   ├── src/
│   │   └── api/        # API routes and controllers
│   ├── config/         # Strapi configuration
│   └── Dockerfile      # Docker configuration
├── package.json        # Root package.json
└── pnpm-workspace.yaml # Workspace configuration
```

## Key Features

### Affiliate System
- Tracks referral codes via URL parameters (?ref=code)
- Stores affiliate codes in cookies for 30 days
- Calculates commissions on successful purchases

### Payment Integration
- Stripe Checkout for secure payments
- Webhook handling for purchase confirmation
- Automatic commission calculation

### SEO Optimization
- Meta tags and Open Graph support
- Sitemap generation
- Robots.txt configuration

### Responsive Design
- Mobile-first approach
- DaisyUI component library
- Tailwind CSS for styling

## Deployment

### Frontend (Cloudflare Pages)
1. Connect repository to Cloudflare Pages
2. Set build command: `pnpm --filter frontend build`
3. Set output directory: `frontend/dist`
4. Configure environment variables

### Backend (DigitalOcean App Platform)
1. Create new app in DigitalOcean
2. Connect repository
3. Set source directory: `backend/`
4. Configure environment variables
5. Provision PostgreSQL database

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in environment files
2. **Database connection**: Verify DATABASE_URL format
3. **Stripe webhooks**: Use Stripe CLI for local testing
4. **CORS errors**: Check FRONTEND_URL in backend config

### Getting Help

- Check the README.md for setup instructions
- Review the code comments for implementation details
- Submit issues on the project repository
