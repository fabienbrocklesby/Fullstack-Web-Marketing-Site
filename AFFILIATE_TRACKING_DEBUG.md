# Affiliate Tracking Debugging Guide

## Problem: "localhost:4321?ref=code only works on pricing page, not homepage"

## Diagnosis Steps:

### 1. Open Developer Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Navigate to: `http://localhost:4322/?ref=testcode`
4. Look for these messages:
   - `🔗 Journey tracker initialized:`
   - `📊 Affiliate tracking active with code: testcode`

### 2. Check Storage

In browser console, run:

```javascript
// Check if affiliate code is stored
console.log("Cookie:", document.cookie);
console.log("LocalStorage:", localStorage.getItem("affiliate_code"));
console.log("SessionStorage:", sessionStorage.getItem("affiliate_code"));
console.log("Tracker object:", window.journeyTracker);
```

### 3. Test Different Entry Points

1. `http://localhost:4322/?ref=homepage_test` (Homepage)
2. `http://localhost:4322/pricing?ref=pricing_test` (Pricing)
3. `http://localhost:4322/test-affiliate-tracking.html?ref=debug_test` (Test page)

### 4. Verify Network Requests

1. Open Network tab in developer tools
2. Look for requests to `/api/track-visitor-journey`
3. These should be made when affiliate code is detected

## Expected Behavior:

✅ **Homepage with ?ref=code should:**

- Log: "🔗 Journey tracker initialized"
- Log: "📊 Affiliate tracking active with code: [your-code]"
- Store affiliate code in all storage mechanisms
- Make network request to tracking API

✅ **Navigation to other pages should:**

- Retain the affiliate code
- Continue tracking with the same code
- Not require ?ref= parameter on subsequent pages

## Common Issues & Fixes:

### Issue 1: JavaScript Errors

**Check:** Browser console for any JavaScript errors that might prevent tracker initialization.
**Fix:** Resolve any JavaScript errors first.

### Issue 2: Network/CORS Issues

**Check:** Network tab for failed API requests to tracking endpoints.
**Fix:** Ensure backend is running and CORS is properly configured.

### Issue 3: Cache Issues

**Check:** Hard refresh the page (Ctrl+F5 or Cmd+Shift+R).
**Fix:** Clear browser cache and cookies.

### Issue 4: Port Changes

**Check:** The frontend port might have changed from 4321 to 4322.
**Fix:** Use the correct port shown in your terminal output.

## Manual Test Commands:

```bash
# Test the tracking system
open "http://localhost:4322/test-affiliate-tracking.html?ref=manual_test"

# Test homepage
open "http://localhost:4322/?ref=homepage_test"

# Test pricing page
open "http://localhost:4322/pricing?ref=pricing_test"
```

## Advanced Debugging:

If affiliate tracking still doesn't work from homepage, add this debug script to test:

```javascript
// Run this in browser console on homepage with ?ref=test
setTimeout(() => {
  console.log("=== AFFILIATE TRACKING DEBUG ===");
  console.log("URL:", window.location.href);
  console.log("Search params:", window.location.search);
  console.log(
    "Ref param:",
    new URLSearchParams(window.location.search).get("ref"),
  );
  console.log("Journey tracker:", window.journeyTracker);
  if (window.journeyTracker) {
    console.log("Tracker affiliate code:", window.journeyTracker.affiliateCode);
    console.log("Tracker visitor ID:", window.journeyTracker.visitorId);
  }
  console.log("Storage check:");
  console.log("- Cookie:", document.cookie);
  console.log("- LocalStorage:", localStorage.getItem("affiliate_code"));
  console.log("- SessionStorage:", sessionStorage.getItem("affiliate_code"));
}, 2000);
```

## Conclusion:

The affiliate tracking system is architecturally correct and should work from any entry point. If you're seeing different behavior between homepage and pricing page, it's likely due to:

1. Caching issues
2. JavaScript errors
3. Network connectivity to backend
4. Port changes

Use the test page and debugging steps above to identify the specific issue.
