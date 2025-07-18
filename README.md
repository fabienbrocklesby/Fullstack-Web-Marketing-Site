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

## 🎯 Demo Data Setup

For a quick start with demo data, use these commands to set up a complete demo environment with sample customers, affiliates, purchases, and license keys.

### Quick Demo Setup (Recommended)

```bash
# Complete demo setup with full data reset
pnpm demo:complete
```

This command will:

1. 🧹 Reset the backend completely (clear database, builds, uploads)
2. 📦 Install dependencies and build the backend
3. 🌱 Seed comprehensive demo data
4. ✅ Prepare everything for `pnpm dev`

### Demo Commands Available

```bash
# Complete demo reset and setup (recommended for first-time setup)
pnpm demo:complete    # Full reset + build + seed data

# Quick demo data seeding (if backend is already built)
pnpm demo:quick      # Just seed data (faster)

# Verify demo data is properly set up
pnpm demo:verify     # Check that all demo data exists

# Manual demo workflow
pnpm demo:reset      # Reset backend completely
pnpm demo:build      # Build backend only
pnpm demo:seed       # Seed demo data only

# Start with demo data (alternative to regular pnpm dev)
pnpm demo:start      # Start with SEED_DATA=true environment
```

### What Demo Data Includes

After running `pnpm demo:complete`, you'll have:

#### 👤 **Demo Customers** (for customer login testing)

- **customer1@example.com** / password123 - Alice Johnson
- **customer2@example.com** / password123 - Bob Smith
- **customer3@example.com** / password123 - Carol Davis

#### 🤝 **Demo Affiliates** (for affiliate dashboard testing)

- **John Marketing** (john@marketingpro.com) - High performer, 15% commission
- **Sarah Influence** (sarah@socialinfluence.com) - Social media, 12% commission
- **Tech Review Hub** (contact@techreviewhub.com) - Tech reviews, 10% commission
- **Inactive Partner** (inactive@example.com) - Deactivated account

#### 💳 **Demo Purchases & License Keys**

- Multiple purchase records for each customer
- License keys for Starter ($29), Pro ($99), and Enterprise ($299) plans
- Realistic activation data and device information
- Commission tracking linked to affiliates

#### 📄 **Demo Pages**

- About Us page with sample content
- Terms of Service with legal template
- Privacy Policy with data protection info

### Access Points After Demo Setup

- **Frontend**: http://localhost:4321
- **Strapi Admin**: http://localhost:1337/admin
- **Customer Dashboard**: http://localhost:4321/customer/login
- **Customer Profile**: http://localhost:4321/customer/profile

### Next Steps After Demo Setup

1. **Create Strapi Admin User**:

   ```bash
   pnpm backend:admin
   ```

2. **Start the Application**:

   ```bash
   pnpm dev
   ```

3. **Login to Customer Dashboard**:
   - Go to http://localhost:4321/customer/login
   - Use any demo customer credentials above
   - View purchases, license keys, and account details

4. **Explore Strapi Admin**:
   - Access http://localhost:1337/admin
   - View demo customers, affiliates, purchases, and license keys
   - Understand the data structure for development

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
