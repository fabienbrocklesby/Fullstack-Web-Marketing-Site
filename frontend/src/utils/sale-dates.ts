/**
 * Subscription pricing utilities
 * 
 * Lightlane uses a subscription model with monthly and yearly billing options.
 * 14-day free trial included with all plans - no credit card required.
 */

/**
 * Check if countdown timer should be shown
 * Currently disabled - no active countdown
 */
export function shouldShowCountdownTimer(): boolean {
  return false;
}

/**
 * Get the appropriate title for the pricing page
 */
export function getSaleTitle(): string {
  return "Start Creating Today";
}

/**
 * Get the description for the pricing page
 */
export function getSaleDescription(): string {
  return 'Try Lightlane <span class="font-semibold text-primary">free for 14 days</span>. Full access to every feature. No credit card required to start.';
}

/**
 * Get badge text for homepage
 */
export function getSaleBadgeText(): string {
  return "14-day free trial";
}

/**
 * Get the alert message for pricing page
 * Returns empty string as we no longer show a deadline-based alert
 */
export function getSaleAlertMessage(): string {
  return "";
}

/**
 * Get the hero section pricing note
 */
export function getHeroPricingNote(): string {
  return "Start your free trial today. Cancel anytime.";
}
