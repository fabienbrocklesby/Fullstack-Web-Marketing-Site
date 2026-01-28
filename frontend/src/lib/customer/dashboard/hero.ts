/**
 * Hero section state management
 */
import { byId, maybeById, setHidden, toggleClass, setText, setHTML } from "./dom";
import { getEntitlements, getDevices, getTrialEligible, getTrialStatusLoaded, getTrialState } from "./state";
import { isActiveEntitlement, isActiveTrial, isActivePaid } from "../../portal/types";
import { startTrial, parseApiError } from "../../portal/api";
import { loadAllData } from "./data";
import { refreshAllUI } from "./init";
import { urgencyPill, urgencyPillCompact } from "./urgency-pill";

// ============================================================
// TRIAL BANNER DISMISSAL (localStorage)
// ============================================================
const TRIAL_BANNER_DISMISS_KEY = "trialBannerDismissedUntil";
const BANNER_DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function isTrialBannerDismissed(): boolean {
  const dismissedUntil = localStorage.getItem(TRIAL_BANNER_DISMISS_KEY);
  if (!dismissedUntil) return false;
  const dismissedUntilTs = parseInt(dismissedUntil, 10);
  return Date.now() < dismissedUntilTs;
}

function dismissTrialBanner(): void {
  const dismissUntil = Date.now() + BANNER_DISMISS_DURATION_MS;
  localStorage.setItem(TRIAL_BANNER_DISMISS_KEY, String(dismissUntil));
  updateTrialBanner();
}

/**
 * Update the trial expiry banner visibility and content.
 * Shows only when trial-only and <= 7 days left, unless dismissed.
 */
export function updateTrialBanner(): void {
  const banner = maybeById("trial-expiry-banner");
  if (!banner) return;

  const trialState = getTrialState();
  const { isTrialOnly, trialDaysLeft } = trialState;

  // Show banner only if: trial-only, 7 days or less left, not dismissed
  const shouldShow = isTrialOnly && 
    trialDaysLeft !== null && 
    trialDaysLeft <= 7 && 
    !isTrialBannerDismissed();

  setHidden(banner, !shouldShow);

  if (shouldShow && trialDaysLeft !== null) {
    const bannerText = maybeById("trial-banner-text");
    if (bannerText) {
      // Stronger copy for 0-3 days, calmer for 4-7 days
      if (trialDaysLeft <= 3) {
        bannerText.textContent = `Trial ending soon: ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left. Keep access to avoid interruption.`;
      } else {
        bannerText.textContent = `Your trial ends in ${trialDaysLeft} days. Keep access after trial.`;
      }
    }
  }
}

/**
 * Update trial-only specific UI elements (countdown badge, progress indicator, step subtext)
 */
function updateTrialOnlyUI(): void {
  const trialState = getTrialState();
  const { isTrialOnly, trialDaysLeft, trialExpiryLabel, hasActivatedDevices } = trialState;

  if (!isTrialOnly) return;

  // Update countdown badge with urgency pill
  const countdownBadge = maybeById("trial-countdown-badge");
  if (countdownBadge && trialDaysLeft !== null && trialExpiryLabel) {
    setHTML(countdownBadge, urgencyPill({
      daysLeft: trialDaysLeft,
      expiresLabel: trialExpiryLabel,
      size: "sm",
    }));
  }

  // Update progress indicator (1/4 = trial started, 2/4 = activated device)
  const progressIndicator = maybeById("trial-progress-indicator");
  if (progressIndicator) {
    const completed = hasActivatedDevices ? 2 : 1;
    progressIndicator.textContent = `${completed}/4 complete`;
  }

  // Update step 4 subtext with compact urgency pill
  const step4Subtext = maybeById("step4-subtext-trial");
  if (step4Subtext && trialDaysLeft !== null) {
    setHTML(step4Subtext, urgencyPillCompact({ daysLeft: trialDaysLeft }));
  }

  // Update CTA hint - stronger message when ≤3 days
  const ctaHint = maybeById("trial-cta-hint");
  if (ctaHint && trialDaysLeft !== null) {
    if (trialDaysLeft <= 3) {
      ctaHint.className = "text-sm text-warning font-medium";
      ctaHint.textContent = `Your trial ends soon. Purchase now to keep access.`;
    } else {
      ctaHint.className = "text-sm text-base-content/60";
      ctaHint.textContent = "Avoid interruption when your trial ends.";
    }
  }

  // Update step 3 appearance based on activation status
  const step3Toggle = maybeById("step3-toggle-trial");
  const step3Text = maybeById("step3-text-trial");
  if (step3Toggle && step3Text && hasActivatedDevices) {
    // Mark as completed
    step3Toggle.className = "flex items-center justify-center w-6 h-6 rounded-full bg-success text-success-content text-xs font-bold shrink-0";
    step3Toggle.textContent = "✓";
    step3Text.className = "text-sm text-base-content/70 line-through";
  }
}

/**
 * Update hero section based on current entitlements/devices state
 */
export function updateHeroState(): void {
  const loading = byId("hero-loading");
  const heroNoEnt = byId("hero-no-entitlements");
  const heroTrialOnly = maybeById("hero-trial-only");
  const heroNoActivated = byId("hero-no-activated");
  const heroAllGood = byId("hero-all-good");

  setHidden(loading, true);
  setHidden(heroNoEnt, true);
  if (heroTrialOnly) setHidden(heroTrialOnly, true);
  setHidden(heroNoActivated, true);
  setHidden(heroAllGood, true);

  const entitlements = getEntitlements();
  const devices = getDevices();

  const activeEnts = entitlements.filter(isActiveEntitlement);
  
  // Compute trial-only state: has active trial but no paid subscriptions
  const hasActiveTrial = entitlements.some(isActiveTrial);
  const hasActivePaidEnt = entitlements.some(isActivePaid);
  const isTrialOnly = hasActiveTrial && !hasActivePaidEnt;

  // Update trial banner (always called - will hide if not applicable)
  updateTrialBanner();

  // No active entitlements at all
  if (activeEnts.length === 0) {
    setHidden(heroNoEnt, false);
    // Update trial button visibility based on eligibility
    updateTrialButtonVisibility();
    // Update step 1 text for no-entitlements state
    updateStep1Text("no-entitlements");
    return;
  }

  // Trial-only state (active trial, no paid subscription)
  if (isTrialOnly && heroTrialOnly) {
    setHidden(heroTrialOnly, false);
    // Update trial-only specific UI elements
    updateTrialOnlyUI();
    return;
  }

  // Has paid entitlements but no activated devices
  const hasActivated = devices.some((d) => d.isActivated);
  if (!hasActivated) {
    setHidden(heroNoActivated, false);
    return;
  }

  // All good - has activated devices
  setHidden(heroAllGood, false);
}

/**
 * Update step 1 text in the activation checklist based on state.
 * - "no-entitlements": "Buy a subscription or activate a trial"
 * - Trial-only state is handled by the separate hero section with pre-checked step
 */
function updateStep1Text(state: "no-entitlements"): void {
  if (state === "no-entitlements") {
    // Update step 1 text in the no-entitlements checklist (suffix="1")
    const step1Text = maybeById("step1-text-1");
    if (step1Text) {
      step1Text.textContent = "Buy a subscription or activate a trial";
    }
  }
}

/**
 * Update trial button visibility based on eligibility state.
 * Only show trial CTA if customer is eligible (never had any entitlements).
 */
function updateTrialButtonVisibility(): void {
  const trialBtn = maybeById("hero-start-trial-btn");
  const trialSection = maybeById("hero-trial-section");
  
  // If trial status not yet loaded, keep hidden (no flash)
  const trialStatusLoaded = getTrialStatusLoaded();
  const trialEligible = getTrialEligible();
  
  // Hide trial section/button if not eligible
  if (trialSection) {
    setHidden(trialSection, !trialStatusLoaded || !trialEligible);
  } else if (trialBtn) {
    setHidden(trialBtn, !trialStatusLoaded || !trialEligible);
  }
}

/**
 * Handle trial start button click
 */
async function handleTrialStart(): Promise<void> {
  const trialBtn = maybeById("hero-start-trial-btn") as HTMLButtonElement | null;
  const trialLoading = maybeById("hero-trial-loading");
  const trialError = maybeById("hero-trial-error");
  const trialErrorText = maybeById("hero-trial-error-text");

  if (!trialBtn) return;

  // Show loading state
  trialBtn.disabled = true;
  setHidden(trialLoading, false);
  setHidden(trialError, true);

  try {
    await startTrial();
    // Success - reload data and refresh UI
    await loadAllData();
    refreshAllUI();
  } catch (err) {
    // Show error message
    const message = parseApiError(err);
    if (trialErrorText) {
      trialErrorText.textContent = message;
    }
    setHidden(trialError, false);
    trialBtn.disabled = false;
  } finally {
    setHidden(trialLoading, true);
  }
}

/**
 * Initialize hero section event listeners
 */
export function initHero(): void {
  const heroAddDeviceBtn = maybeById("hero-add-device-btn");
  const heroAddDeviceInfo = maybeById("hero-add-device-info");
  
  heroAddDeviceBtn?.addEventListener("click", () => {
    toggleClass(heroAddDeviceInfo, "hidden");
  });

  // Trial start button
  const trialBtn = maybeById("hero-start-trial-btn");
  trialBtn?.addEventListener("click", handleTrialStart);

  // Trial banner dismiss button
  const bannerDismissBtn = maybeById("trial-banner-dismiss-btn");
  bannerDismissBtn?.addEventListener("click", dismissTrialBanner);
}
