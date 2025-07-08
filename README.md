# Full-Stack SaaS Marketing Site Boilerplate

A production-ready SaaS marketing site boilerplate built with Astro frontend and Strapi backend.

## 🚀 Tech Stack

### Frontend (Astro)
- **Framework**: Astro with SSG/SSR capabilities
- **Deployment**: Cloudflare Pages with `@astrojs/cloudflare` adapter
- **Styling**: Tailwind CSS with DaisyUI components
- **SEO**: Astro SEO plugin for meta tags, Open Graph, sitemap, and robots.txt
- **Content**: Markdown/MDX support for blog posts
- **Affiliate System**: Built-in affiliate tracking with cookies

### Backend (Strapi)
- **Framework**: Strapi v4 (JavaScript)
- **Database**: PostgreSQL
- **Deployment**: DigitalOcean App Platform
- **Payments**: Stripe integration with webhooks
- **Content Types**: Pages, Affiliates, Purchases

## 📁 Project Structure

```
├── frontend/          # Astro application
├── backend/           # Strapi CMS
├── package.json       # Root package.json
├── pnpm-workspace.yaml # PNPM workspace configuration
└── README.md         # This file
```

## 🛠 Setup Instructions

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL database

### 1. Clone and Install Dependencies
```bash
git clone <your-repo-url>
cd fullstack-saas-boilerplate
pnpm install
```

### 2. Environment Variables

#### Frontend (.env)
```bash
cp frontend/.env.example frontend/.env
```
Edit `frontend/.env` with your values:
```
PUBLIC_CMS_URL=http://localhost:1337
```

#### Backend (.env)
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` with your values:
```
DATABASE_URL=postgresql://user:password@localhost:5432/strapi
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:4321
```

### 3. Development
```bash
# Start both frontend and backend
pnpm dev

# Or start individually
pnpm --filter frontend dev
pnpm --filter backend dev
```

## 🚢 Deployment

### Frontend (Cloudflare Pages)
1. Connect your repository to Cloudflare Pages
2. Set build command: `pnpm --filter frontend build`
3. Set build output directory: `frontend/dist`
4. Add environment variables in Cloudflare Pages dashboard

### Backend (DigitalOcean App Platform)
1. Create a new App in DigitalOcean
2. Connect your repository
3. Set source directory: `backend/`
4. Use the included Dockerfile
5. Add environment variables in DigitalOcean dashboard
6. Provision a PostgreSQL database

## 🔧 Available Scripts

```bash
pnpm dev      # Start development servers
pnpm build    # Build both applications
pnpm lint     # Lint all code
pnpm format   # Format all code
```

## 📋 Features

- ✅ Affiliate tracking system
- ✅ Stripe checkout integration
- ✅ SEO optimization
- ✅ Responsive design
- ✅ Content management
- ✅ Production-ready deployment configs
- ✅ Pre-commit hooks
- ✅ Code formatting and linting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details