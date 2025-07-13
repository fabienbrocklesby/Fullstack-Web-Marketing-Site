// FIXED: Complete visitor journey tracking system
class JourneyTracker {
  constructor() {
    this.visitorId = this.getOrCreateVisitorId();
    this.sessionId = this.getOrCreateSessionId();
    this.affiliateCode = this.getAffiliateCode();
    this.sessionStart = this.getSessionStartTime();
    this.lastActivity = Date.now();
    this.currentPage = window.location.pathname;

    console.log(`🔗 Journey tracker initialized:`, {
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      affiliateCode: this.affiliateCode,
      sessionStart: new Date(this.sessionStart).toISOString(),
    });

    if (this.affiliateCode) {
      this.initializeTracking();
    } else {
      console.log("📊 No affiliate code found - tracking disabled");
    }
  }

  getOrCreateVisitorId() {
    let visitorId = sessionStorage.getItem("tab_visitor_id");
    if (!visitorId) {
      // Create a persistent visitor ID that won't change
      visitorId =
        "visitor_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      sessionStorage.setItem("tab_visitor_id", visitorId);
      sessionStorage.setItem("visitor_created", new Date().toISOString());
    }
    return visitorId;
  }

  getOrCreateSessionId() {
    const sessionKey = "session_id";
    const sessionTimeKey = "session_start_time";

    let sessionId = sessionStorage.getItem(sessionKey);
    let sessionStartTime = sessionStorage.getItem(sessionTimeKey);

    // Create new session if none exists or session is older than 30 minutes
    if (
      !sessionId ||
      !sessionStartTime ||
      Date.now() - parseInt(sessionStartTime) > 30 * 60 * 1000
    ) {
      sessionId =
        "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      sessionStartTime = Date.now().toString();
      sessionStorage.setItem(sessionKey, sessionId);
      sessionStorage.setItem(sessionTimeKey, sessionStartTime);
    }

    return sessionId;
  }

  getSessionStartTime() {
    const sessionStartTime = sessionStorage.getItem("session_start_time");
    return sessionStartTime ? parseInt(sessionStartTime) : Date.now();
  }

  getAffiliateCode() {
    // Check URL parameters first (support both 'ref' and 'affiliate' parameters)
    const urlParams = new URLSearchParams(window.location.search);
    const urlAffiliateCode = urlParams.get("ref") || urlParams.get("affiliate");

    if (urlAffiliateCode) {
      // Store in both cookies and localStorage
      this.setAffiliateCode(urlAffiliateCode);
      return urlAffiliateCode;
    }

    // Check stored affiliate code
    return (
      this.getCookie("affiliate_code") || localStorage.getItem("affiliate_code")
    );
  }

  setAffiliateCode(code) {
    // Store in cookie (30 days) and localStorage
    document.cookie = `affiliate_code=${code}; path=/; max-age=${30 * 24 * 60 * 60}`;
    localStorage.setItem("affiliate_code", code);
    localStorage.setItem("affiliate_visit_timestamp", new Date().toISOString());
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  async initializeTracking() {
    // Track initial page view
    await this.trackAction("page_view", window.location.pathname, {
      title: document.title,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
    });

    // Set up automatic tracking
    this.setupPageViewTracking();
    this.setupClickTracking();
    this.setupFormTracking();
  }

  setupPageViewTracking() {
    // Track page changes (for SPAs)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handlePageChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handlePageChange();
    };

    // Listen for back/forward button
    window.addEventListener("popstate", () => {
      this.handlePageChange();
    });
  }

  async handlePageChange() {
    const newPage = window.location.pathname;
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      await this.trackAction("page_view", newPage, {
        title: document.title,
        timestamp: new Date().toISOString(),
      });
    }
  }

  setupClickTracking() {
    // Track all clicks on buttons, links, and important elements
    document.addEventListener("click", async (event) => {
      const target = event.target;
      const tagName = target.tagName.toLowerCase();

      // Track button clicks
      if (tagName === "button" || target.classList.contains("btn")) {
        await this.trackAction("button_click", window.location.pathname, {
          buttonText: target.textContent.trim(),
          buttonId: target.id,
          buttonClass: target.className,
          timestamp: new Date().toISOString(),
        });
      }

      // Track link clicks
      if (tagName === "a") {
        await this.trackAction("link_click", window.location.pathname, {
          linkText: target.textContent.trim(),
          linkHref: target.href,
          linkId: target.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Track specific pricing buttons
      if (target.id && target.id.startsWith("buy-button-")) {
        const priceId = target.getAttribute("data-price-id");
        await this.trackAction(
          "pricing_button_click",
          window.location.pathname,
          {
            priceId: priceId,
            buttonText: target.textContent.trim(),
            timestamp: new Date().toISOString(),
          },
        );
      }

      // Track navigation clicks
      if (target.closest("nav") || target.closest(".navbar")) {
        await this.trackAction("navigation_click", window.location.pathname, {
          linkText: target.textContent.trim(),
          linkHref: target.href || "",
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  setupFormTracking() {
    // Track form interactions
    document.addEventListener("submit", async (event) => {
      const form = event.target;
      await this.trackAction("form_submit", window.location.pathname, {
        formId: form.id,
        formClass: form.className,
        timestamp: new Date().toISOString(),
      });
    });
  }

  async trackAction(action, page, eventData = {}) {
    if (!this.affiliateCode) return;

    try {
      const cmsUrl =
        document.documentElement.getAttribute("data-cms-url") ||
        "http://localhost:1337";

      // Track with the new journey system using consistent visitor ID
      await fetch(`${cmsUrl}/api/track-visitor-journey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          affiliateCode: this.affiliateCode,
          action: action,
          page: page,
          eventData: {
            visitorId: this.visitorId,
            sessionId: this.sessionId,
            sessionStart: this.sessionStart,
            ...eventData,
          },
        }),
      });

      // Also track with the original conversion event system for backward compatibility
      if (["button_click", "pricing_button_click"].includes(action)) {
        await this.trackConversionEvent("button_click", eventData);
      }

      this.lastActivity = Date.now();
      console.log(
        `🛤️ Tracked ${action} on ${page} for affiliate ${this.affiliateCode}`,
      );
    } catch (error) {
      console.warn("Failed to track action:", error);
    }
  }

  async trackConversionEvent(eventType, eventData = {}) {
    if (!this.affiliateCode) return;

    try {
      const cmsUrl =
        document.documentElement.getAttribute("data-cms-url") ||
        "http://localhost:1337";

      await fetch(`${cmsUrl}/api/track-conversion-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          affiliateCode: this.affiliateCode,
          eventType: eventType,
          eventData: {
            visitorId: this.visitorId,
            sessionId: this.sessionId,
            ...eventData,
          },
        }),
      });

      console.log(
        `🎯 Tracked conversion event: ${eventType} for affiliate ${this.affiliateCode}`,
      );
    } catch (error) {
      console.warn("Failed to track conversion event:", error);
    }
  }

  // Public methods for manual tracking
  async trackRegistrationAttempt(email, hasSelectedProduct = false) {
    await this.trackAction("registration_attempt", window.location.pathname, {
      email: email,
      hasSelectedProduct: hasSelectedProduct,
      timestamp: new Date().toISOString(),
    });

    await this.trackConversionEvent("registration_attempt", {
      email: email,
      hasSelectedProduct: hasSelectedProduct,
      timestamp: new Date().toISOString(),
    });
  }

  async trackRegistrationComplete(customerId, email) {
    await this.trackAction("registration_complete", window.location.pathname, {
      customerId: customerId,
      email: email,
      timestamp: new Date().toISOString(),
    });

    await this.trackConversionEvent("registration_complete", {
      customerId: customerId,
      email: email,
      timestamp: new Date().toISOString(),
    });
  }

  async trackCheckoutInitiated(priceId, customerId) {
    await this.trackAction("checkout_initiated", window.location.pathname, {
      priceId: priceId,
      customerId: customerId,
      timestamp: new Date().toISOString(),
    });

    await this.trackConversionEvent("checkout_initiated", {
      priceId: priceId,
      customerId: customerId,
      timestamp: new Date().toISOString(),
    });
  }

  async trackPurchaseComplete(purchaseId, amount, priceId) {
    await this.trackAction("purchase_complete", window.location.pathname, {
      purchaseId: purchaseId,
      amount: amount,
      priceId: priceId,
      timestamp: new Date().toISOString(),
    });

    await this.trackConversionEvent("purchase_complete", {
      purchaseId: purchaseId,
      amount: amount,
      priceId: priceId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Initialize the tracker when the page loads
let journeyTracker;

document.addEventListener("DOMContentLoaded", () => {
  journeyTracker = new JourneyTracker();

  // Make it globally available
  window.journeyTracker = journeyTracker;

  // Backward compatibility functions
  window.trackAffiliateVisit = async (affiliateCode) => {
    if (journeyTracker) {
      await journeyTracker.trackAction(
        "affiliate_visit",
        window.location.pathname,
        {
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        },
      );
    }
  };

  window.trackPageView = async (affiliateCode, page) => {
    if (journeyTracker) {
      await journeyTracker.trackAction("page_view", page, {
        referrer: document.referrer,
        timestamp: new Date().toISOString(),
      });
    }
  };

  window.trackConversionEvent = async (affiliateCode, eventType, eventData) => {
    if (journeyTracker) {
      await journeyTracker.trackConversionEvent(eventType, eventData);
    }
  };

  // Registration tracking methods
  window.journeyTracker.trackRegistrationAttempt = async (
    email,
    hasSelectedProduct = false,
  ) => {
    if (journeyTracker) {
      await journeyTracker.trackAction(
        "registration_attempt",
        window.location.pathname,
        {
          email: email,
          hasSelectedProduct: hasSelectedProduct,
          timestamp: new Date().toISOString(),
        },
      );
    }
  };

  window.journeyTracker.trackRegistrationComplete = async (
    customerId,
    customerData = {},
  ) => {
    if (journeyTracker) {
      await journeyTracker.trackAction(
        "registration_complete",
        window.location.pathname,
        {
          customerId: customerId,
          customerData: customerData,
          timestamp: new Date().toISOString(),
        },
      );
    }
  };
});
