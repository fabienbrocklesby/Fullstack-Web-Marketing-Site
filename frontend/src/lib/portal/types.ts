/**
 * Type definitions for portal API responses.
 * Based on Stage 6A contract from docs/licensing-portal-current-state.md
 */

// === Entitlements ===

export interface Entitlement {
  id: number;
  tier: string;
  status: "active" | "inactive" | "canceled" | "expired" | "past_due" | "trialing";
  isLifetime: boolean;
  leaseRequired: boolean; // true for subscriptions, false for lifetime
  maxDevices: number;
  expiresAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  source?: string;
  licenseKey?: {
    key: string;
  };
}

export interface EntitlementsResponse {
  ok: true;
  entitlements: Entitlement[];
}

// === Devices ===

export interface Device {
  id: number;
  deviceId: string;
  name: string | null;
  platform: string | null;
  status: "active" | "blocked" | "revoked" | "deactivated";
  lastSeen: string | null;
  isActivated: boolean;
  entitlement: {
    id: number;
    tier: string;
    isLifetime: boolean;
  } | null;
}

export interface DevicesResponse {
  ok: true;
  devices: Device[];
  meta: {
    total: number;
    activatedCount: number;
  };
}

// === Customer ===

export interface CustomerProfile {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  purchases?: unknown[];
  licenseKeys?: unknown[];
  [key: string]: unknown;
}

export interface CustomerResponse {
  ok: true;
  customer: CustomerProfile;
}

// === Device Registration ===

export interface RegisterDeviceRequest {
  deviceId: string;
  deviceName?: string;
  platform?: string;
}

export interface RegisterDeviceResponse {
  ok: true;
  deviceId: string;
  status: string;
  message: string;
}

// === Activation ===

export interface ActivateRequest {
  deviceId: string;
  entitlementId: number;
}

export interface ActivateResponse {
  ok: true;
  message: string;
  binding?: {
    expiresAt?: string;
  };
  expiresAt?: string;
}

// === Deactivation ===

export interface DeactivateRequest {
  deviceId: string;
  entitlementId: number;
}

export interface DeactivateResponse {
  ok: true;
  message: string;
}

// === Refresh ===

export interface RefreshRequest {
  deviceId: string;
  entitlementId: number;
}

export interface RefreshResponse {
  ok: true;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  leaseRequired: boolean;
  serverTime: string;
  message?: string;
}

// === Offline Refresh ===

export interface OfflineRefreshRequest {
  challenge: string; // The challenge token from the offline machine
}

export interface OfflineRefreshResponse {
  ok: true;
  leaseToken: string;
  leaseExpiresAt: string;
  message: string;
}

// === Offline Provision (Air-gapped) ===

export interface OfflineProvisionRequest {
  entitlementId: number;
  deviceSetupCode: string;
}

export interface OfflineProvisionResponse {
  ok: true;
  activationPackage: string;
  leaseExpiresAt: string;
}

// === Offline Lease Refresh (Air-gapped) ===

export interface OfflineLeaseRefreshRequest {
  requestCode: string;
}

export interface OfflineLeaseRefreshResponse {
  ok: true;
  refreshResponseCode: string;
  leaseExpiresAt: string;
}

// === Offline Deactivate (Air-gapped) ===

export interface OfflineDeactivateRequest {
  deactivationCode: string;
}

export interface OfflineDeactivateResponse {
  ok: true;
  message: string;
}

// === Checkout ===

export interface CheckoutSubscriptionRequest {
  tier: "maker" | "pro";
  successPath: string;
  cancelPath: string;
}

export interface CheckoutResponse {
  ok: true;
  url: string;
}

// === Billing Portal ===

export interface BillingPortalRequest {
  returnUrl: string;
}

export interface BillingPortalResponse {
  ok: true;
  url: string;
}

// === Purchase Status (Success Page) ===

export interface PurchaseStatusResponse {
  ok: true;
  status: "pending" | "complete";
  mode?: "subscription" | "payment";
  tier?: string;
  isLifetime?: boolean;
  purchaseId?: string;
  display?: {
    accessLabel?: string;
    billingLabel?: string;
  };
}

// === Utility Types ===

export type EntitlementStatus = Entitlement["status"];

export function isActiveEntitlement(ent: Entitlement): boolean {
  return ["active", "trialing", "past_due"].includes(ent.status);
}

export function isSubscriptionEntitlement(ent: Entitlement): boolean {
  return ent.leaseRequired === true;
}

/**
 * Check if an entitlement is an active trial (tier="trial" and active status)
 */
export function isActiveTrial(ent: Entitlement): boolean {
  return ent.tier === "trial" && isActiveEntitlement(ent);
}

/**
 * Check if an entitlement is a paid subscription (not trial, active status)
 */
export function isActivePaid(ent: Entitlement): boolean {
  return ent.tier !== "trial" && isActiveEntitlement(ent);
}

export function formatTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return null;
  }
}

/**
 * Calculate days remaining until a date. Returns null if date is invalid/past.
 */
export function getDaysLeft(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const targetDate = new Date(dateStr);
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
