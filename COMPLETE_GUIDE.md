# 🚀 SaaS Boilerplate - Complete Setup Guide

## 📋 Overview
This is a complete full-stack SaaS boilerplate with:
- **Frontend**: Astro + Tailwind CSS + DaisyUI
- **Backend**: Strapi v4 + SQLite (dev) / PostgreSQL (prod)
- **Payments**: Stripe integration with affiliate tracking
- **Features**: User authentication, affiliate dashboard, commission tracking

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Servers
```bash
# Start both frontend and backend
pnpm dev

# Or start individually
cd frontend && pnpm dev
cd backend && pnpm dev
```

### 3. Setup Admin Account
1. Go to http://localhost:1337/admin
2. Create your first admin user
3. Note down the credentials

### 4. Configure Stripe (Required for payments)
1. Get your Stripe test keys from https://dashboard.stripe.com/test/apikeys
2. Update `backend/.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

## 🔧 Available Commands

### Root Commands
```bash
# Start development servers
pnpm dev

# Reset database and restart
pnpm reset

# Complete reset (database + node_modules)
pnpm reset:hard

# Setup from scratch
pnpm setup

# Just restart servers
pnpm restart

# Create admin user via CLI
pnpm backend:admin

# Reset just backend
pnpm backend:reset
```

### Frontend Commands
```bash
cd frontend
pnpm dev        # Start dev server
pnpm build      # Build for production
pnpm preview    # Preview production build
```

### Backend Commands
```bash
cd backend
pnpm dev        # Start dev server
pnpm build      # Build admin panel
pnpm start      # Start production server
```

## 🌐 URLs

- **Frontend**: http://localhost:4321
- **Backend API**: http://localhost:1337
- **Admin Panel**: http://localhost:1337/admin
- **Login Page**: http://localhost:4321/login
- **Dashboard**: http://localhost:4321/dashboard
- **Pricing**: http://localhost:4321/pricing

## 📊 How It Works

### User Journey
1. **User registers** in Strapi admin or via frontend
2. **User logs in** at `/login`
3. **System auto-creates** affiliate record
4. **User gets dashboard** with affiliate link and stats
5. **User shares** affiliate link (`/pricing?ref=their_code`)
6. **Customers buy** through affiliate link
7. **Commission tracked** automatically via Stripe webhooks

### Data Flow
1. **Customer clicks** affiliate link with `?ref=code`
2. **Frontend stores** affiliate code in cookies
3. **Customer clicks** Buy button
4. **Frontend calls** `/api/affiliate-checkout`
5. **Backend creates** Stripe checkout session
6. **Customer pays** via Stripe
7. **Stripe webhook** notifies backend
8. **Backend creates** Purchase record
9. **Backend updates** affiliate earnings

## 🗄️ Database Schema

### Users (Strapi built-in)
- `id`, `email`, `username`, `password`

### Affiliates
- `id`, `name`, `email`, `code`, `user` (relation)
- `commissionRate`, `totalEarnings`, `isActive`
- `joinedAt`, `notes`, `payoutDetails`

### Purchases
- `id`, `stripeSessionId`, `amount`, `customerEmail`
- `priceId`, `affiliate` (relation), `commissionAmount`
- `status`, `metadata`

### Pages
- `id`, `title`, `slug`, `content`, `seo`

## 🔐 Authentication

### Frontend Login
- Uses Strapi's built-in auth (`/api/auth/local`)
- Stores JWT in localStorage
- Redirects to dashboard on success

### API Authentication
- All API calls use `Authorization: Bearer <jwt>`
- Affiliate endpoints require authentication
- Users can only access their own data

## 💳 Stripe Integration

### Test Mode Setup
1. Get test keys from Stripe dashboard
2. Update `.env` with `STRIPE_SECRET_KEY`
3. Test with card: `4242 4242 4242 4242`

### Price Configuration
Currently uses test prices:
- **Starter**: $99 (10% commission)
- **Pro**: $199 (10% commission)  
- **Enterprise**: $499 (10% commission)

### Webhook Setup (Optional)
1. Create webhook endpoint: `http://localhost:1337/api/stripe/webhook`
2. Select events: `checkout.session.completed`
3. Add webhook secret to `.env`

## 🐛 Troubleshooting

### Common Issues

**"sqlite3 bindings not found"**
```bash
pnpm approve-builds
# Select sqlite3 and approve
```

**"Database reset needed"**
```bash
pnpm reset
```

**"Affiliate code is blank"**
- Check if user is logged in
- Check if affiliate record was created
- Check browser console for errors

**"Stripe checkout not working"**
- Verify `STRIPE_SECRET_KEY` in `.env`
- Check console for API errors
- Test with different price IDs

### Debug Mode
```bash
# Enable debug logs
DEBUG=strapi:* pnpm dev
```

## 🚀 Production Deployment

### Frontend (Cloudflare Pages)
1. Connect GitHub repo
2. Set build command: `pnpm build`
3. Set output directory: `dist`
4. Add environment variables:
   - `PUBLIC_CMS_URL=https://your-backend.com`

### Backend (DigitalOcean App Platform)
1. Connect GitHub repo
2. Set build command: `pnpm build`
3. Set run command: `pnpm start`
4. Add environment variables (see `.env.example`)
5. Add PostgreSQL database

## 📈 Features

### ✅ Completed
- User authentication
- Affiliate tracking
- Stripe payments
- Commission calculation
- Dashboard analytics
- Responsive design

### 🔄 TODO
- Email notifications
- Payout management
- Advanced analytics
- Multi-tier commissions
- API documentation
- Unit tests

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📝 License

MIT License - see LICENSE file for details.
