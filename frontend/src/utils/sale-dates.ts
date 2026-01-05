/**
 * Founders Lifetime pricing utilities
 * 
 * Founders Lifetime is available for a limited number of early customers.
 * A new pricing model is coming soon - this rate will be removed when the new pricing goes live.
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
  return "Founders Lifetime";
}

/**
 * Get the description for the pricing page
 */
export function getSaleDescription(): string {
  return 'Founders Lifetime is available for a <span class="font-semibold">limited number</span> of early customers. A new pricing model is coming soon.';
}

/**
 * Get badge text for homepage
 */
export function getSaleBadgeText(): string {
  return "Founders Lifetime available";
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
  return "Founders Lifetime pricing for early customers. One-time payment, updates forever.";
}
