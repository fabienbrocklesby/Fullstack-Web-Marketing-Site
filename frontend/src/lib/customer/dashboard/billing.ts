/**
 * Billing portal navigation
 */
import { portalFetch } from "../../portal/api";

/**
 * Open Stripe billing portal
 */
export async function openBillingPortal(): Promise<void> {
  try {
    const data = await portalFetch<{ url: string }>("/api/customers/billing-portal", {
      method: "POST",
      body: JSON.stringify({ returnUrl: window.location.href }),
    });
    if (data.url) {
      window.location.href = data.url;
    }
  } catch (err) {
    alert("Failed to open billing portal. Please try again.");
  }
}
