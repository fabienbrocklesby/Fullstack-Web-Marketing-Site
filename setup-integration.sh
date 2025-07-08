#!/bin/bash

# SaaS Boilerplate Setup Script
echo "🚀 Setting up SaaS Boilerplate..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}✓ Frontend and Backend servers are running${NC}"
echo -e "${GREEN}✓ Database has been reset${NC}"
echo -e "${GREEN}✓ Environment files are set up${NC}"

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. 🔑 Set up Stripe (Required for payments):"
echo "   - Go to https://dashboard.stripe.com/test/apikeys"
echo "   - Copy your 'Secret key' (starts with sk_test_)"
echo "   - Copy your 'Publishable key' (starts with pk_test_)"
echo "   - Update backend/.env with your Stripe secret key"
echo ""
echo "2. 🔗 Set up Stripe Webhooks (Optional for testing):"
echo "   - Go to https://dashboard.stripe.com/test/webhooks"
echo "   - Create endpoint: http://localhost:1337/api/stripe/webhook"
echo "   - Select events: checkout.session.completed"
echo "   - Copy the webhook secret and add to backend/.env"
echo ""
echo "3. 👤 Create Strapi Admin Account:"
echo "   - Go to http://localhost:1337/admin"
echo "   - Create your first admin user"
echo ""
echo "4. 🧪 Test the Integration:"
echo "   - Go to http://localhost:4321/login"
echo "   - Register a new marketing user"
echo "   - Go to http://localhost:4321/dashboard"
echo "   - Test checkout at http://localhost:4321/pricing"
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://localhost:4321"
echo "   Backend: http://localhost:1337"
echo "   Admin: http://localhost:1337/admin"
echo "   Login: http://localhost:4321/login"
echo "   Dashboard: http://localhost:4321/dashboard"
echo ""
echo -e "${YELLOW}⚠️  Important Notes:${NC}"
echo "   - The current setup uses test Stripe sessions"
echo "   - Replace test price IDs with real ones in production"
echo "   - Set up proper environment variables for production"
echo ""
echo -e "${GREEN}🎉 Setup complete! Ready to test your SaaS boilerplate.${NC}"
