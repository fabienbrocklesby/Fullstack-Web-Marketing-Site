// Quick test to verify affiliate tracking works from any entry point
// Open browser console and run this script on any page with ?ref=test

function testAffiliateTracking() {
  console.log("🔍 AFFILIATE TRACKING TEST STARTING...");
  console.log("=====================================");

  // Test URL parameter detection
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get("ref");
  console.log("1. URL ref parameter:", refParam || "NONE");

  // Test journey tracker presence
  const trackerExists = !!window.journeyTracker;
  console.log("2. Journey tracker loaded:", trackerExists ? "YES" : "NO");

  if (!trackerExists) {
    console.error(
      "❌ Journey tracker not found! Check if script is loading properly.",
    );
    return;
  }

  // Test tracker properties
  console.log("3. Tracker properties:");
  console.log("   - Visitor ID:", window.journeyTracker.visitorId || "NOT SET");
  console.log("   - Session ID:", window.journeyTracker.sessionId || "NOT SET");
  console.log(
    "   - Affiliate Code:",
    window.journeyTracker.affiliateCode || "NOT SET",
  );
  console.log(
    "   - Current Page:",
    window.journeyTracker.currentPage || "NOT SET",
  );

  // Test storage
  console.log("4. Storage check:");
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("affiliate_code="));
  console.log("   - Cookie:", cookie ? cookie.split("=")[1] : "NOT SET");
  console.log(
    "   - LocalStorage:",
    localStorage.getItem("affiliate_code") || "NOT SET",
  );
  console.log(
    "   - SessionStorage:",
    sessionStorage.getItem("affiliate_code") || "NOT SET",
  );

  // Test if tracking should be active
  const shouldTrack =
    !window.journeyTracker.isTeamAuthPage ||
    !window.journeyTracker.isTeamAuthPage();
  console.log("5. Should track on this page:", shouldTrack ? "YES" : "NO");

  // Test manual tracking
  console.log("6. Testing manual tracking...");
  if (window.journeyTracker.trackAction) {
    window.journeyTracker
      .trackAction("test_action", window.location.pathname, {
        test: true,
        timestamp: new Date().toISOString(),
      })
      .then(() => {
        console.log("✅ Manual tracking test successful");
      })
      .catch((error) => {
        console.error("❌ Manual tracking test failed:", error);
      });
  }

  // Summary
  console.log("=====================================");
  if (
    refParam &&
    window.journeyTracker &&
    window.journeyTracker.affiliateCode === refParam
  ) {
    console.log("✅ SUCCESS: Affiliate tracking is working correctly!");
    console.log("   - URL parameter detected and stored");
    console.log("   - Tracker initialized properly");
    console.log("   - Should persist across page navigation");
  } else if (
    refParam &&
    (!window.journeyTracker || !window.journeyTracker.affiliateCode)
  ) {
    console.log(
      "❌ ISSUE: Affiliate parameter found but not stored in tracker",
    );
    console.log("   - Check for JavaScript errors");
    console.log("   - Verify tracker initialization");
  } else if (!refParam && window.journeyTracker) {
    console.log("ℹ️ INFO: No affiliate parameter in URL, but tracker is ready");
    console.log("   - Add ?ref=testcode to URL to test affiliate tracking");
  } else {
    console.log("❌ CRITICAL: Tracker not loaded or major issue");
    console.log("   - Check if journey-tracker.js is loading");
    console.log("   - Check browser console for errors");
  }

  console.log(
    "🔍 Test complete. Check Network tab for API calls if affiliate code was detected.",
  );
}

// Run the test
testAffiliateTracking();

// Also provide a way to test different scenarios
window.testAffiliateTracking = testAffiliateTracking;
