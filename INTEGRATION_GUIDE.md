# SaaS Boilerplate Integration Guide

## 🚀 What's Been Set Up

### Frontend (Astro + Tailwind + DaisyUI)
- **Login Page** (`/login`) - Marketing team authentication
- **Dashboard** (`/dashboard`) - Sales analytics and affiliate management
- **Pricing Page** (`/pricing`) - Integrated with Stripe checkout
- **BuyButton Component** - Handles affiliate tracking and payments

### Backend (Strapi + SQLite/PostgreSQL)
- **Custom API Endpoints**:
  - `/api/affiliate-checkout` - Creates Stripe checkout sessions
  - `/api/stripe/webhook` - Handles payment confirmations
- **Content Types**:
  - `Affiliate` - Marketing partners with commission tracking
  - `Purchase` - Sales records with affiliate attribution
  - `Page` - CMS content management

## 🔧 Setup Instructions

### 1. Stripe Configuration (Required)

1. **Get your Stripe keys**:
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
   - Copy your `Secret key` (starts with `sk_test_`)
   - Copy your `Publishable key` (starts with `pk_test_`)

2. **Update backend/.env**:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
   ```

3. **Set up webhooks** (Optional but recommended):
   - Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
   - Create endpoint: `http://localhost:1337/api/stripe/webhook`
   - Select events: `checkout.session.completed`
   - Copy webhook secret and add to backend/.env:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

### 2. Create Strapi Admin Account

1. Go to [http://localhost:1337/admin](http://localhost:1337/admin)
2. Create your first administrator account
3. This will be used to manage content and view backend data

### 3. Create Marketing Users

Since we're using Strapi's built-in user system:

1. Go to [http://localhost:1337/admin](http://localhost:1337/admin)
2. Navigate to Content Manager > User (from users-permissions)
3. Create new users for your marketing team
4. Set their role to "Authenticated"

## 🧪 Testing the Integration

### 1. Test User Login
1. Go to [http://localhost:4321/login](http://localhost:4321/login)
2. Use the marketing user credentials you created
3. Should redirect to dashboard on success

### 2. Test Affiliate Tracking
1. Visit: [http://localhost:4321/pricing?ref=test123](http://localhost:4321/pricing?ref=test123)
2. The affiliate code `test123` will be saved in cookies
3. Any subsequent purchase will be attributed to this affiliate

### 3. Test Purchase Flow
1. Go to [http://localhost:4321/pricing](http://localhost:4321/pricing)
2. Click any "Buy" button
3. Should redirect to Stripe checkout
4. Use test card: `4242 4242 4242 4242`
5. Complete the purchase

### 4. Test Dashboard
1. Go to [http://localhost:4321/dashboard](http://localhost:4321/dashboard)
2. Should show your affiliate stats and recent sales
3. Copy your affiliate link and test it

## 💡 How It Works

### Affiliate Tracking Flow
1. User visits pricing page with `?ref=AFFILIATE_CODE`
2. Affiliate code is saved in browser cookies (30 days)
3. When user makes purchase, affiliate code is sent to Stripe metadata
4. Webhook creates Purchase record and links to Affiliate
5. Commission is calculated and added to affiliate earnings

### Marketing Dashboard
- Shows total sales, commission earned, and conversion rates
- Displays recent purchases with commission details
- Generates unique affiliate links for sharing
- Auto-creates affiliate records for new users

### Payment Processing
- Uses Stripe Checkout for secure payment processing
- Supports multiple products with different pricing tiers
- Handles webhook confirmations for purchase tracking
- Stores transaction details for reporting

## 🔑 Environment Variables

### Frontend (.env)
```bash
PUBLIC_CMS_URL=http://localhost:1337
```

### Backend (.env)
```bash
# Database
DATABASE_FILENAME=.tmp/data.db

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend
FRONTEND_URL=http://localhost:4321

# Strapi (auto-generated)
HOST=0.0.0.0
PORT=1337
APP_KEYS=...
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
JWT_SECRET=...
```

## 🚀 Production Deployment

### Frontend (Cloudflare Pages)
1. Update `PUBLIC_CMS_URL` to your production Strapi URL
2. Replace test Stripe keys with live keys
3. Update CORS settings in Strapi

### Backend (DigitalOcean/Heroku)
1. Switch to PostgreSQL database
2. Update Stripe webhook URL to production
3. Set all environment variables
4. Update CORS to allow your frontend domain

## 📊 Key Features

- ✅ **Affiliate Tracking**: Automatic commission calculation
- ✅ **Marketing Dashboard**: Real-time sales analytics
- ✅ **Stripe Integration**: Secure payment processing
- ✅ **User Authentication**: Role-based access control
- ✅ **Responsive Design**: Mobile-friendly interface
- ✅ **SEO Optimized**: Astro static site generation
- ✅ **TypeScript Support**: Type-safe development
- ✅ **Modern Stack**: Latest web technologies

## 🐛 Troubleshooting

### Common Issues

1. **Stripe checkout fails**: Check if `STRIPE_SECRET_KEY` is set correctly
2. **Login doesn't work**: Ensure users are created in Strapi admin
3. **Dashboard shows no data**: Check if affiliate records are created
4. **CORS errors**: Verify `FRONTEND_URL` in backend .env

### Debug Tips
- Check browser console for JavaScript errors
- Check Strapi logs for API errors
- Verify environment variables are loaded
- Test API endpoints directly in browser/Postman

## 🎯 Next Steps

1. **Add Real Stripe Products**: Replace test price IDs with real ones
2. **Email Notifications**: Set up email alerts for new sales
3. **Analytics Integration**: Add Google Analytics or similar
4. **Payment Methods**: Add PayPal, Apple Pay, etc.
5. **Subscription Support**: Add recurring billing options
6. **Advanced Reporting**: More detailed analytics and charts
