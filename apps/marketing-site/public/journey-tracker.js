// COMPLETELY REBUILT: Proper visitor tracking system
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
      currentPage: this.currentPage,
    });

    // Don't track anything on team authentication pages (but allow customer pages)
    if (this.isTeamAuthPage(this.currentPage)) {
      console.log(
        "📊 Team authentication page detected - tracking completely disabled",
      );
      return;
    }

    // Always initialize tracking - we want to track all user journeys
    // If there's an affiliate code, it will be used for attribution
    // If not, we still track for general analytics
    this.initializeTracking();

    if (this.affiliateCode) {
      console.log(
        `📊 Affiliate tracking active with code: ${this.affiliateCode}`,
      );
    } else {
      console.log("📊 General tracking active (no affiliate code)");
    }
  }

  isTeamAuthPage(path = window.location.pathname) {
    const teamAuthPaths = [
      "/dashboard", // Marketing Dashboard (team only)
      "/login", // Team Login - Staff Portal
      "/register", // Team Registration - Staff Portal
      "/site-editor", // Site Editor - Team Portal
    ];

    // Important: Only block team authentication pages, NOT customer pages
    // Customer pages like /customer/login and /customer/register should continue tracking
    return (
      teamAuthPaths.some((teamPath) => path.startsWith(teamPath)) &&
      !path.startsWith("/customer/")
    );
  }

  // FIXED: Create persistent visitor ID using localStorage - same visitor across tabs
  getOrCreateVisitorId() {
    let visitorId = localStorage.getItem("persistent_visitor_id");
    if (!visitorId) {
      // Create a new visitor ID that persists across browser tabs
      visitorId =
        "visitor_" +
        Math.random().toString(36).substr(2, 12) +
        "_" +
        Date.now();
      localStorage.setItem("persistent_visitor_id", visitorId);
      localStorage.setItem("visitor_created", new Date().toISOString());
      console.log(
        `🆕 New visitor created (persistent across tabs): ${visitorId}`,
      );
    } else {
      console.log(`🔄 Existing visitor loaded: ${visitorId}`);
    }
    return visitorId;
  }

  // SIMPLIFIED: Each tab gets a new session, reset after 30 minutes of inactivity
  getOrCreateSessionId() {
    const sessionKey = "current_session_id";
    const sessionTimeKey = "last_activity_time";
    const sessionStartKey = "session_start_time";

    let sessionId = sessionStorage.getItem(sessionKey);
    let lastActivityTime = sessionStorage.getItem(sessionTimeKey);

    // Create new session if none exists or last activity was more than 30 minutes ago
    const thirtyMinutesInMs = 30 * 60 * 1000;
    if (
      !sessionId ||
      !lastActivityTime ||
      Date.now() - parseInt(lastActivityTime) > thirtyMinutesInMs
    ) {
      sessionId =
        "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      const currentTime = Date.now();
      sessionStorage.setItem(sessionKey, sessionId);
      sessionStorage.setItem(sessionStartKey, currentTime.toString());
      console.log(`🆕 New session started for this tab: ${sessionId}`);
    }

    // Always update the last activity time
    sessionStorage.setItem(sessionTimeKey, Date.now().toString());

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
      // Store in both sessionStorage (for this tab) and localStorage (for persistence)
      this.setAffiliateCode(urlAffiliateCode);
      return urlAffiliateCode;
    }

    // Check session storage first (tab-specific), then localStorage (persistent)
    return (
      sessionStorage.getItem("affiliate_code") ||
      this.getCookie("affiliate_code") ||
      localStorage.getItem("affiliate_code")
    );
  }

  setAffiliateCode(code) {
    // Store in sessionStorage (for this tab), cookie (persistent), and localStorage (fallback)
    sessionStorage.setItem("affiliate_code", code);
    document.cookie = `affiliate_code=${code}; path=/; max-age=${30 * 24 * 60 * 60}`;
    localStorage.setItem("affiliate_code", code);
    sessionStorage.setItem(
      "affiliate_visit_timestamp",
      new Date().toISOString(),
    );
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
    return null;
  }

  async initializeTracking() {
    // Track initial page view with enhanced details
    const currentPage = window.location.pathname;
    const pageTitle = document.title;
    const referrer = document.referrer;

    await this.trackAction("page_view", currentPage, {
      title: pageTitle,
      referrer: referrer,
      url: window.location.href,
      queryParams: window.location.search,
      pagePath: currentPage,
      pageType: this.getPageType(currentPage),
      timestamp: new Date().toISOString(),
    });

    // Set up automatic tracking
    this.setupPageViewTracking();
    this.setupClickTracking();
    this.setupFormTracking();
    this.setupScrollTracking();
  }

  // Helper to categorize pages
  getPageType(path) {
    if (path === "/" || path === "/index.html") return "home";
    if (path.includes("/pricing")) return "pricing";
    if (path.includes("/blog")) return "blog";
    if (path.includes("/customer/register")) return "registration";
    if (path.includes("/customer/login")) return "login";
    if (path.includes("/dashboard")) return "dashboard";
    return "other";
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
      console.log(`📍 Page changed from ${this.currentPage} to ${newPage}`);
      this.currentPage = newPage;
      await this.trackAction("page_view", newPage, {
        title: document.title,
        url: window.location.href,
        queryParams: window.location.search,
        pagePath: newPage,
        pageType: this.getPageType(newPage),
        fromNavigation: true,
        timestamp: new Date().toISOString(),
      });
    }
  }

  setupClickTracking() {
    // Track all clicks on buttons, links, and important elements
    document.addEventListener("click", async (event) => {
      const target = event.target;
      const tagName = target.tagName.toLowerCase();
      const currentPage = window.location.pathname; // Use actual current page

      // Don't track clicks on team authentication pages
      if (this.isTeamAuthPage(currentPage)) {
        return;
      }

      // Track button clicks with enhanced details
      if (tagName === "button" || target.classList.contains("btn")) {
        await this.trackAction("button_click", currentPage, {
          buttonText: target.textContent.trim(),
          buttonId: target.id || "unnamed-button",
          buttonClass: target.className,
          buttonType: target.getAttribute("type") || "unknown",
          elementPath: this.getElementPath(target),
        });
      }

      // Track link clicks with enhanced details
      if (tagName === "a") {
        await this.trackAction("link_click", currentPage, {
          linkText: target.textContent.trim(),
          linkHref: target.href || "no-href",
          linkId: target.id || "unnamed-link",
          linkTarget: target.target,
          elementPath: this.getElementPath(target),
        });
      }

      // Track specific pricing buttons with enhanced details
      if (target.id && target.id.startsWith("buy-button-")) {
        const priceId = target.getAttribute("data-price-id") || "unknown-price";
        await this.trackAction("pricing_button_click", currentPage, {
          priceId: priceId,
          buttonText: target.textContent.trim(),
          buttonId: target.id,
          elementPath: this.getElementPath(target),
        });
      }
    });
  }

  // Helper to get element selector path for better identification
  getElementPath(element, maxLength = 3) {
    const path = [];
    let currentElement = element;

    while (currentElement && path.length < maxLength) {
      let selector = currentElement.tagName.toLowerCase();

      if (currentElement.id) {
        selector += `#${currentElement.id}`;
        // ID is unique, so we can stop here
        path.unshift(selector);
        break;
      } else if (
        currentElement.className &&
        typeof currentElement.className === "string"
      ) {
        const classes = currentElement.className.trim().split(/\s+/);
        if (classes.length) {
          selector += `.${classes[0]}`;
        }
      }

      path.unshift(selector);
      currentElement = currentElement.parentElement;
    }

    return path.join(" > ");
  }

  // Helper to get a better field label
  getFieldLabel(element) {
    // Try to find associated label
    if (element.labels && element.labels.length > 0) {
      return element.labels[0].textContent.trim();
    }

    // Try to find label by for attribute
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent.trim();
      }
    }

    // Try to find placeholder
    if (element.placeholder) {
      return element.placeholder;
    }

    // Try to find parent label
    const parentLabel = element.closest("label");
    if (parentLabel) {
      // Get text content but exclude the input itself
      const labelText = Array.from(parentLabel.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .join(" ");
      if (labelText) {
        return labelText;
      }
    }

    // Try to find nearby text (previous sibling)
    const prevSibling = element.previousElementSibling;
    if (
      prevSibling &&
      (prevSibling.tagName.toLowerCase() === "label" ||
        prevSibling.tagName.toLowerCase() === "span" ||
        prevSibling.tagName.toLowerCase() === "div")
    ) {
      const text = prevSibling.textContent.trim();
      if (text && text.length < 50) {
        // Reasonable label length
        return text;
      }
    }

    // Try to get aria-label
    if (element.getAttribute("aria-label")) {
      return element.getAttribute("aria-label");
    }

    return "unlabeled-field";
  }

  setupFormTracking() {
    // Track form submissions with enhanced details
    document.addEventListener("submit", async (event) => {
      const form = event.target;

      // Always use current page location for accuracy
      const actualPage = window.location.pathname;

      // Don't track team authentication page form submissions
      if (this.isTeamAuthPage(actualPage)) {
        return;
      }

      // Gather form field data (without sensitive values)
      const formFields = Array.from(form.elements)
        .filter(
          (el) =>
            el.name &&
            !["password", "credit-card", "cc-number", "card-number"].includes(
              el.name.toLowerCase(),
            ),
        )
        .map((el) => ({
          name: el.name,
          type: el.type,
          id: el.id || "unnamed",
          hasValue: !!el.value,
          required: el.required || false,
        }));

      console.log(`📝 Form submitted on page: ${actualPage}`, {
        formId:
          form.id || form.getAttribute("data-form-name") || "unnamed-form",
        fieldCount: formFields.length,
      });

      await this.trackAction("form_submit", actualPage, {
        formId:
          form.id || form.getAttribute("data-form-name") || "unnamed-form",
        formAction: form.action || "no-action",
        formMethod: form.method || "unknown",
        formClass: form.className,
        formFields: formFields,
        pageTitle: document.title,
        formElementPath: this.getElementPath(form),
        actualPagePath: actualPage,
        timestamp: new Date().toISOString(),
      });
    });

    // Track form field focus and blur events for better engagement tracking
    document.addEventListener(
      "focus",
      async (event) => {
        const target = event.target;

        // Only track form elements
        if (
          !(
            target.tagName.toLowerCase() === "input" ||
            target.tagName.toLowerCase() === "textarea" ||
            target.tagName.toLowerCase() === "select"
          )
        ) {
          return;
        }

        // Always use current page location for accuracy
        const actualPage = window.location.pathname;

        // Don't track team authentication page interactions
        if (this.isTeamAuthPage(actualPage)) {
          return;
        }

        // Avoid tracking password and sensitive fields
        if (
          ["password", "credit-card", "cc-number", "card-number"].includes(
            target.type || target.name?.toLowerCase() || "",
          )
        ) {
          return;
        }

        // Get parent form information if available
        const parentForm = target.closest("form");
        const formId = parentForm
          ? parentForm.id ||
            parentForm.getAttribute("data-form-name") ||
            "form-" + Math.random().toString(36).substr(2, 5)
          : "no-form-context";

        // Get better field identification
        const fieldLabel = this.getFieldLabel(target);
        const fieldName =
          target.name ||
          target.id ||
          target.getAttribute("data-field-name") ||
          target.placeholder ||
          "unknown-field";

        console.log(`🎯 Form field focus tracked on ${actualPage}:`, {
          fieldName,
          fieldLabel,
          formId,
          elementPath: this.getElementPath(target),
        });

        await this.trackAction("form_field_focus", actualPage, {
          fieldName: fieldName,
          fieldType: target.type || "text",
          fieldId: target.id || "no-id",
          fieldLabel: fieldLabel,
          formId: formId,
          pageTitle: document.title,
          elementPath: this.getElementPath(target),
          required: target.required || false,
          actualPagePath: actualPage,
          timestamp: new Date().toISOString(),
        });
      },
      true,
    );

    // Track select/dropdown changes
    document.addEventListener(
      "change",
      async (event) => {
        const target = event.target;

        // Only track form elements
        if (
          !(
            target.tagName.toLowerCase() === "select" ||
            (target.tagName.toLowerCase() === "input" &&
              (target.type === "checkbox" || target.type === "radio"))
          )
        ) {
          return;
        }

        // Always use current page location for accuracy
        const actualPage = window.location.pathname;

        // Don't track team authentication page interactions
        if (this.isTeamAuthPage(actualPage)) {
          return;
        }

        // Get parent form information if available
        const parentForm = target.closest("form");
        const formId = parentForm
          ? parentForm.id ||
            parentForm.getAttribute("data-form-name") ||
            "form-" + Math.random().toString(36).substr(2, 5)
          : "no-form-context";

        let valueData = {};
        if (target.type === "checkbox") {
          valueData.checked = target.checked;
        } else if (target.type === "radio") {
          valueData.selected = true;
          valueData.value = target.value;
        } else if (target.tagName.toLowerCase() === "select") {
          valueData.selectedIndex = target.selectedIndex;
          valueData.selectedValue = target.value;
          if (
            target.selectedIndex >= 0 &&
            target.options[target.selectedIndex]
          ) {
            valueData.selectedText = target.options[target.selectedIndex].text;
          }
        }

        const fieldName =
          target.name ||
          target.id ||
          target.getAttribute("data-field-name") ||
          target.placeholder ||
          "unknown-field";

        console.log(`📝 Form field changed on ${actualPage}:`, {
          fieldName,
          formId,
          valueData,
        });

        await this.trackAction("form_field_change", actualPage, {
          fieldName: fieldName,
          fieldType: target.type || "select",
          fieldId: target.id || "no-id",
          formId: formId,
          ...valueData,
          pageTitle: document.title,
          actualPagePath: actualPage,
          timestamp: new Date().toISOString(),
        });
      },
      true,
    );
  }

  setupScrollTracking() {
    let hasScrolled25 = false;
    let hasScrolled50 = false;
    let hasScrolled75 = false;

    window.addEventListener("scroll", async () => {
      const scrollPercent =
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
        100;

      if (scrollPercent >= 25 && !hasScrolled25) {
        hasScrolled25 = true;
        await this.trackAction("scroll_25", window.location.pathname, {
          scrollPercent: 25,
          timestamp: new Date().toISOString(),
        });
      }
      if (scrollPercent >= 50 && !hasScrolled50) {
        hasScrolled50 = true;
        await this.trackAction("scroll_50", window.location.pathname, {
          scrollPercent: 50,
          timestamp: new Date().toISOString(),
        });
      }
      if (scrollPercent >= 75 && !hasScrolled75) {
        hasScrolled75 = true;
        await this.trackAction("scroll_75", window.location.pathname, {
          scrollPercent: 75,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  async trackAction(action, page, eventData = {}) {
    // Don't track anything on team authentication pages
    const actualPage = window.location.pathname;
    if (this.isTeamAuthPage(actualPage)) {
      console.log("📊 Skipping tracking on team authentication page");
      return;
    }

    try {
      const cmsUrl =
        document.documentElement.getAttribute("data-cms-url") ||
        "http://localhost:1337";

      // Create a single timestamp for this action
      const actionTimestamp = new Date().toISOString();

      // If there's an affiliate code, track for affiliate attribution
      if (this.affiliateCode) {
        console.log(
          `🛤️ Tracking ${action} on actual page: ${actualPage} (stored: ${page}) for affiliate: ${this.affiliateCode}`,
        );

        // FIXED: Send both visitor ID and session ID for proper tracking
        await fetch(`${cmsUrl}/api/track-visitor-journey`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            affiliateCode: this.affiliateCode,
            action: action,
            page: actualPage, // Use actual page, not the stored page
            eventData: {
              visitorId: this.visitorId,
              sessionId: this.sessionId,
              sessionStart: this.sessionStart,
              timestamp: actionTimestamp, // Use single consistent timestamp
              originalPage: page, // Store the original page for reference
              actualPage: actualPage, // Store the actual page where the event occurred
              ...eventData,
            },
          }),
        });

        // Also track with the original conversion event system for backward compatibility
        if (["button_click", "pricing_button_click"].includes(action)) {
          await this.trackConversionEvent("button_click", eventData);
        }
      } else {
        // No affiliate code - just log for general analytics
        console.log(
          `� General tracking ${action} on actual page: ${actualPage} (stored: ${page}) - no affiliate code`,
        );
      }

      this.lastActivity = Date.now();
    } catch (error) {
      console.warn("Failed to track action:", error);
    }
  }

  async trackConversionEvent(eventType, eventData = {}) {
    // Only track conversion events if there's an affiliate code (these are for affiliate attribution)
    if (!this.affiliateCode) {
      console.log(
        `🎯 Skipping conversion event ${eventType} - no affiliate code for attribution`,
      );
      return;
    }

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

  // Development helper function to reset tracking data
  resetTrackingData() {
    sessionStorage.removeItem("tab_visitor_id");
    sessionStorage.removeItem("visitor_created");
    sessionStorage.removeItem("current_session_id");
    sessionStorage.removeItem("last_activity_time");
    sessionStorage.removeItem("session_start_time");
    sessionStorage.removeItem("affiliate_code");
    sessionStorage.removeItem("affiliate_visit_timestamp");
    console.log("🧹 Tracking data reset for this tab");
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

  // Development helper functions
  window.resetTracking = () => {
    if (journeyTracker) {
      journeyTracker.resetTrackingData();
      // Reload to reinitialize
      window.location.reload();
    }
  };

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
});
