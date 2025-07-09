# Demo Data Setup Guide

This guide explains how to set up comprehensive demo data for your SaaS boilerplate, including customers, affiliates, purchases, license keys, and content pages.

## Quick Start

### Option 1: Complete Demo Setup (Recommended)

```bash
# This will reset everything and create demo data
pnpm run demo:setup
```

### Option 2: Reset + Start with Auto-Seeding

```bash
# Reset the backend
pnpm run demo:reset

# Start with automatic seeding (via environment variable)
pnpm run demo:start
```

### Option 3: Manual Seeding

```bash
# Reset the backend first
pnpm run demo:reset

# Run the standalone seeder
node demo-seeder.js

# Then start normally
pnpm dev
```

## What Gets Created

### 👤 **3 Demo Customers**

- **Alice Johnson** (`customer1@example.com` / `password123`)
  - Multiple purchases and license keys
  - Some activated, some unused
- **Bob Smith** (`customer2@example.com` / `password123`)
  - Mix of different product tiers
  - Various activation states
- **Carol Davis** (`customer3@example.com` / `password123`)
  - Unverified email (for testing email verification flows)

### 🤝 **4 Demo Affiliates**

- **John Marketing** - High performer (15% commission, $1,250 earned)
- **Sarah Influence** - Social media influencer (12% commission, $850 earned)
- **Tech Review Hub** - Review website (10% commission, $650 earned)
- **Inactive Partner** - Deactivated account for testing

### 💳 **Realistic Purchases & License Keys**

- Multiple product tiers: Starter ($29), Pro ($99), Enterprise ($299)
- Random purchase dates within the last 90 days
- Corresponding license keys with proper activation data
- Various device information and usage patterns
- Commission tracking for affiliate purchases

### 📄 **3 Content Pages**

- **About Us** - Company information and mission
- **Terms of Service** - Legal terms and conditions
- **Privacy Policy** - Data protection and privacy information

### 🔧 **System Features Demonstrated**

- Customer authentication and profiles
- License key generation and management
- Device restriction and activation tracking
- Affiliate commission calculations
- Purchase history and relationships
- Content management for legal pages

## Access Points After Setup

| Service                | URL                                  | Credentials                                                |
| ---------------------- | ------------------------------------ | ---------------------------------------------------------- |
| **Frontend**           | http://localhost:4321                | -                                                          |
| **Customer Dashboard** | http://localhost:4321/customer/login | See customer list above                                    |
| **Strapi Admin**       | http://localhost:1337/admin          | Create with: `cd backend && pnpm strapi admin:create-user` |

## Commands Reference

| Command               | Description                           |
| --------------------- | ------------------------------------- |
| `pnpm run demo:setup` | Complete reset and demo data creation |
| `pnpm run demo:reset` | Reset backend (clear data, rebuild)   |
| `pnpm run demo:start` | Start with auto-seeding enabled       |
| `node demo-seeder.js` | Standalone demo data seeder           |
| `pnpm dev`            | Start normal development servers      |

## Troubleshooting

### Seeding Fails

```bash
# Clear everything and try again
rm -rf backend/.tmp backend/build backend/dist
cd backend && pnpm install
pnpm run demo:setup
```

### Strapi Won't Start

```bash
# Kill any running processes
pkill -f 'strapi develop'

# Clear cache and rebuild
rm -rf backend/.tmp backend/build
pnpm run demo:setup
```

### Database Issues

```bash
# Nuclear option - reset everything
pnpm run reset:hard
pnpm run demo:setup
```

## Development Workflow

1. **Initial Setup**: `pnpm run demo:setup`
2. **Create Strapi Admin**: `cd backend && pnpm strapi admin:create-user`
3. **Start Development**: `pnpm dev`
4. **Login to Customer Dashboard**: Use any of the demo customer credentials
5. **Explore Strapi Admin**: Check the created data in Content Manager

## Data Structure

```
Customers (3)
├── Purchases (6-9 total)
│   ├── License Keys (1:1 relationship)
│   └── Affiliate Commissions (when applicable)
├── Device Activations (realistic patterns)
└── Account States (active, verified, etc.)

Affiliates (4)
├── Commission Rates (8-15%)
├── Earnings History
├── Payout Details
└── Active/Inactive States

Content Pages (3)
├── SEO Metadata
├── Rich Text Content
└── Published States
```

This setup provides a realistic testing environment that demonstrates all the key features of your SaaS boilerplate!
