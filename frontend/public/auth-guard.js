/**
 * Client-side authentication guard
 * Handles route protection and redirects based on authentication state
 */

class AuthGuard {
  constructor() {
    this.checkAuthAndRedirect();
  }

  checkAuthAndRedirect() {
    const customerToken = localStorage.getItem("customerToken");
    const affiliateJWT = localStorage.getItem("jwt");
    const customer = this.parseJSONSafely(localStorage.getItem("customer"));
    const user = this.parseJSONSafely(localStorage.getItem("user"));

    const currentPath = window.location.pathname;

    console.log("🔍 Auth Guard checking:", {
      path: currentPath,
      hasCustomerToken: !!customerToken,
      hasAffiliateJWT: !!affiliateJWT,
      hasCustomer: !!customer,
      hasUser: !!user,
    });

    // If customer is authenticated and tries to access login/register pages
    if (customerToken && customer && this.isCustomerAuthPage(currentPath)) {
      console.log(
        "👤 Customer already authenticated, redirecting to dashboard",
      );
      window.location.href = "/customer/dashboard";
      return;
    }

    // If affiliate is authenticated and tries to access login pages
    if (affiliateJWT && user && this.isAffiliateAuthPage(currentPath)) {
      console.log(
        "👔 Affiliate already authenticated, redirecting to dashboard",
      );
      window.location.href = "/dashboard";
      return;
    }

    // If accessing protected customer pages without authentication
    if (!customerToken && this.isProtectedCustomerPage(currentPath)) {
      console.log(
        "🚫 Customer page requires authentication, redirecting to login",
      );
      window.location.href = "/customer/login";
      return;
    }

    // If accessing protected affiliate pages without authentication
    if (!affiliateJWT && this.isProtectedAffiliatePage(currentPath)) {
      console.log(
        "🚫 Affiliate page requires authentication, redirecting to login",
      );
      window.location.href = "/login";
      return;
    }

    console.log("✅ Auth guard check passed");
  }

  isCustomerAuthPage(path) {
    const customerAuthPages = ["/customer/login", "/customer/register"];
    return customerAuthPages.includes(path);
  }

  isAffiliateAuthPage(path) {
    const affiliateAuthPages = ["/login"];
    return affiliateAuthPages.includes(path);
  }

  isProtectedCustomerPage(path) {
    const protectedPages = [
      "/customer/dashboard",
      "/customer/profile",
      "/customer/success",
    ];
    return protectedPages.some((page) => path.startsWith(page));
  }

  isProtectedAffiliatePage(path) {
    const protectedPages = ["/dashboard"];
    return protectedPages.some((page) => path.startsWith(page));
  }

  parseJSONSafely(str) {
    try {
      return str ? JSON.parse(str) : null;
    } catch (e) {
      return null;
    }
  }
}

// Initialize auth guard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AuthGuard();
});

// Also check when page becomes visible (tab switching)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    new AuthGuard();
  }
});
