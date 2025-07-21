#!/bin/bash

# Test script to verify affiliate tracking works from any entry point
# Run this script to test different entry points

echo "🧪 Testing Affiliate Tracking from Different Entry Points"
echo "=================================================="

# Function to test a URL
test_url() {
    local url="$1"
    local description="$2"
    echo ""
    echo "Testing: $description"
    echo "URL: $url"
    echo "Opening in browser..."
    
    # For macOS
    if command -v open >/dev/null 2>&1; then
        open "$url"
    # For Linux
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url"
    else
        echo "Please manually open: $url"
    fi
    
    echo "Check browser console for affiliate tracking logs"
    read -p "Press Enter to continue to next test..."
}

# Get the current port (default to 4321, but it might be 4322 as shown in logs)
PORT=${1:-4322}
BASE_URL="http://localhost:$PORT"

echo "Using base URL: $BASE_URL"
echo ""

# Test different entry points
test_url "$BASE_URL/test-affiliate-tracking.html?ref=test_homepage" "Test page from homepage with affiliate code"
test_url "$BASE_URL/?ref=homepage_entry" "Homepage with affiliate code"
test_url "$BASE_URL/pricing?ref=pricing_entry" "Pricing page with affiliate code"

echo ""
echo "🔍 Next Steps:"
echo "1. Check browser console logs for affiliate tracking messages"
echo "2. Look for messages like: '🔗 Journey tracker initialized:'"
echo "3. Verify affiliate code is detected and stored"
echo "4. Test navigation between pages to ensure persistence"
echo ""
echo "Expected behavior:"
echo "- Affiliate code should be detected from ?ref= parameter on ANY page"
echo "- Code should be stored in localStorage, sessionStorage, and cookies"
echo "- Code should persist when navigating to other pages"
echo ""
echo "If tracking is not working, check:"
echo "1. Browser console for JavaScript errors"
echo "2. Network tab to see if tracking API calls are being made"
echo "3. Application tab to verify storage is being set"
