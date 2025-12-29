/**
 * Sale date utilities for managing holiday and new year promotions
 * 
 * Timeline:
 * - Before Jan 1, 2026: "Holiday Sale" with countdown timer and decorations
 * - Jan 1 - Jan 7, 2026: "New Year's Sale" without timer/decorations (same prices)
 * - After Jan 7, 2026: No sale active
 */

// Holiday sale ends at midnight Pacific on January 1, 2026
export const HOLIDAY_SALE_END = "2026-01-01T08:00:00Z"; // Midnight Pacific = 8 AM UTC

// New Year's sale extends pricing until January 7, 2026
export const NEW_YEAR_SALE_END = "2026-01-08T08:00:00Z"; // Midnight Pacific = 8 AM UTC

export type SaleType = "holiday" | "newyear" | "none";

/**
 * Determine which sale is currently active
 */
export function getCurrentSaleType(): SaleType {
  const now = new Date();
  const holidayEnd = new Date(HOLIDAY_SALE_END);
  const newYearEnd = new Date(NEW_YEAR_SALE_END);

  if (now < holidayEnd) {
    return "holiday";
  } else if (now < newYearEnd) {
    return "newyear";
  }
  return "none";
}

/**
 * Check if holiday decorations should be shown (only during holiday sale)
 */
export function shouldShowHolidayDecorations(): boolean {
  return getCurrentSaleType() === "holiday";
}

/**
 * Check if countdown timer should be shown (only during holiday sale)
 */
export function shouldShowCountdownTimer(): boolean {
  return getCurrentSaleType() === "holiday";
}

/**
 * Check if any sale pricing is active
 */
export function isSalePricingActive(): boolean {
  return getCurrentSaleType() !== "none";
}

/**
 * Get the appropriate sale title for the pricing page
 */
export function getSaleTitle(): string {
  const saleType = getCurrentSaleType();
  switch (saleType) {
    case "holiday":
      return "Limited Holiday Pricing";
    case "newyear":
      return "New Year's Sale";
    default:
      return "Pricing Plans";
  }
}

/**
 * Get the sale description for the pricing page
 */
export function getSaleDescription(): string {
  const saleType = getCurrentSaleType();
  switch (saleType) {
    case "holiday":
      return 'Prices increase on <span class="font-semibold">January 1, 2026</span>. Lock in a <span class="font-semibold">one‑time lifetime</span> license today and keep this rate forever.';
    case "newyear":
      return 'Start the new year right! Extended sale pricing until <span class="font-semibold">January 7, 2026</span>. Lock in your <span class="font-semibold">one‑time lifetime</span> license before prices increase.';
    default:
      return 'Choose the plan that fits your workflow. All plans include <span class="font-semibold">lifetime updates</span> with a one-time payment.';
  }
}

/**
 * Get sale badge text for homepage
 */
export function getSaleBadgeText(): string {
  const saleType = getCurrentSaleType();
  switch (saleType) {
    case "holiday":
      return "Holiday pricing now live";
    case "newyear":
      return "New Year's Sale - extended pricing";
    default:
      return "Public launch";
  }
}

/**
 * Get the alert message for pricing page
 */
export function getSaleAlertMessage(): string {
  const saleType = getCurrentSaleType();
  switch (saleType) {
    case "holiday":
      return "Holiday founders window closes January 1, 2026.";
    case "newyear":
      return "New Year's Sale ends January 7, 2026 - don't miss out!";
    default:
      return "";
  }
}

/**
 * Get the hero section pricing note
 */
export function getHeroPricingNote(): string {
  const saleType = getCurrentSaleType();
  switch (saleType) {
    case "holiday":
      return "Limited holiday lifetime pricing is available through January 1, 2026.";
    case "newyear":
      return "New Year's Sale: Extended lifetime pricing available through January 7, 2026.";
    default:
      return "Lifetime pricing available. One-time payment, updates forever.";
  }
}
