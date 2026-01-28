/**
 * Portal API client for customer-facing pages.
 * Handles authenticated fetch requests with consistent error handling.
 */

import { clearAuth } from "./auth";

/**
 * Get the CMS API base URL from the HTML data attribute.
 */
export function getCmsUrl(): string {
  if (typeof document === "undefined") return "http://localhost:1337";
  return (
    document.documentElement.getAttribute("data-cms-url") ||
    "http://localhost:1337"
  );
}

/**
 * Standard API error shape from Stage 6A.
 */
export interface ApiError {
  ok: false;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Authenticated fetch wrapper for portal API calls.
 * - Injects Authorization header from localStorage
 * - Handles 401 by clearing auth and redirecting to login
 * - Returns parsed JSON response
 */
export async function portalFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cmsUrl = getCmsUrl();
  const token = localStorage.getItem("customerToken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${cmsUrl}${path}`, {
    ...options,
    headers,
  });

  // Handle 401 - clear auth and redirect
  if (response.status === 401) {
    clearAuth();
    window.location.href = "/customer/login";
    throw new Error("Session expired");
  }

  const data = await response.json();

  // Throw on error responses
  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return data as T;
}

/**
 * Parse API error for display.
 */
export function parseApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error === "string") return e.error;
  }
  return "An unexpected error occurred";
}

/**
 * Start a 14-day free trial for the authenticated customer.
 * One trial per account - throws on 409 if trial already used.
 */
export interface StartTrialResponse {
  ok: true;
  entitlement: {
    id: number;
    tier: string;
    status: string;
    isLifetime: boolean;
    expiresAt: string;
    maxDevices: number;
    source: string;
    createdAt: string;
    leaseRequired: boolean;
  };
  message: string;
}

export async function startTrial(): Promise<StartTrialResponse> {
  return portalFetch<StartTrialResponse>("/api/trial/start", {
    method: "POST",
  });
}

// === Trial Status ===

export interface TrialStatusResponse {
  ok: true;
  trialEligible: boolean;
  hasEverHadEntitlements: boolean;
  hasUsedTrial: boolean;
}

export async function getTrialStatus(): Promise<TrialStatusResponse> {
  return portalFetch<TrialStatusResponse>("/api/trial/status");
}
