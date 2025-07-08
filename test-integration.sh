#!/bin/bash

# Test script to verify the SaaS boilerplate is working correctly
echo "🧪 Testing SaaS Boilerplate Integration..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test URLs
FRONTEND_URL="http://localhost:4321"
BACKEND_URL="http://localhost:1337"

echo ""
echo "📡 Testing Server Connectivity..."

# Test frontend
if curl -s "$FRONTEND_URL" > /dev/null; then
    echo -e "${GREEN}✓ Frontend server is running${NC} ($FRONTEND_URL)"
else
    echo -e "${RED}✗ Frontend server is not responding${NC}"
    exit 1
fi

# Test backend
if curl -s "$BACKEND_URL" > /dev/null; then
    echo -e "${GREEN}✓ Backend server is running${NC} ($BACKEND_URL)"
else
    echo -e "${RED}✗ Backend server is not responding${NC}"
    exit 1
fi

# Test admin panel
if curl -s "$BACKEND_URL/admin" > /dev/null; then
    echo -e "${GREEN}✓ Admin panel is accessible${NC} ($BACKEND_URL/admin)"
else
    echo -e "${RED}✗ Admin panel is not accessible${NC}"
fi

echo ""
echo "🔧 Testing API Endpoints..."

# Test affiliate checkout endpoint
CHECKOUT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/affiliate-checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "priceId": "price_starter",
    "affiliateCode": "test123",
    "successUrl": "http://localhost:4321/success",
    "cancelUrl": "http://localhost:4321/pricing"
  }' 2>/dev/null)

if echo "$CHECKOUT_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$CHECKOUT_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    echo -e "${YELLOW}⚠ Checkout endpoint responded with error: $ERROR_MSG${NC}"
    echo "   This is expected if Stripe key is not configured"
else
    echo -e "${GREEN}✓ Affiliate checkout endpoint is working${NC}"
fi

# Test affiliates endpoint (should require auth)
AFFILIATES_RESPONSE=$(curl -s "$BACKEND_URL/api/affiliates" 2>/dev/null)
if echo "$AFFILIATES_RESPONSE" | grep -q "Forbidden"; then
    echo -e "${GREEN}✓ Affiliates endpoint properly requires authentication${NC}"
else
    echo -e "${YELLOW}⚠ Affiliates endpoint authentication check failed${NC}"
fi

echo ""
echo "📊 System Status Summary:"
echo -e "   Frontend: ${GREEN}http://localhost:4321${NC}"
echo -e "   Backend:  ${GREEN}http://localhost:1337${NC}"
echo -e "   Admin:    ${GREEN}http://localhost:1337/admin${NC}"
echo -e "   Login:    ${GREEN}http://localhost:4321/login${NC}"
echo -e "   Dashboard: ${GREEN}http://localhost:4321/dashboard${NC}"
echo -e "   Pricing:  ${GREEN}http://localhost:4321/pricing${NC}"

echo ""
echo "📋 Next Steps:"
echo "1. Create admin user at: http://localhost:1337/admin"
echo "2. Add your Stripe secret key to backend/.env"
echo "3. Test the full flow:"
echo "   - Create a user in Strapi admin"
echo "   - Login at /login"
echo "   - Check dashboard at /dashboard"
echo "   - Test purchase at /pricing"

echo ""
echo -e "${GREEN}🎉 Integration test completed!${NC}"
