/**
 * Portal authentication utilities for customer-facing pages.
 * Handles token storage, auth guards, and logout.
 */

export interface Customer {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AuthState {
  token: string;
  customer: Customer;
}

const TOKEN_KEY = "customerToken";
const CUSTOMER_KEY = "customer";
const LOGIN_PATH = "/customer/login";

/**
 * Get the stored auth state if valid, or null if not logged in.
 */
export function getAuthState(): AuthState | null {
  if (typeof window === "undefined") return null;
  
  const token = localStorage.getItem(TOKEN_KEY);
  const customerStr = localStorage.getItem(CUSTOMER_KEY);
  
  if (!token || !customerStr) return null;
  
  try {
    const customer = JSON.parse(customerStr) as Customer;
    if (!customer.id) return null;
    return { token, customer };
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated. If not, redirect to login.
 * Returns the auth state if valid.
 * Use at the top of authenticated page scripts.
 */
export function requireCustomerAuth(): AuthState | null {
  const state = getAuthState();
  if (!state) {
    window.location.href = LOGIN_PATH;
    return null;
  }
  return state;
}

/**
 * Store auth credentials after successful login.
 */
export function setAuthState(token: string, customer: Customer): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

/**
 * Update the stored customer data (e.g., after profile refresh).
 */
export function updateCustomer(customer: Customer): void {
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
}

/**
 * Clear auth state and redirect to login.
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
  window.location.href = LOGIN_PATH;
}

/**
 * Clear auth state without redirect (for 401 handling).
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_KEY);
}

/**
 * Get customer display name.
 */
export function getDisplayName(customer: Customer): string {
  const full = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
  return full || customer.email || "Customer";
}

/**
 * Get customer initials for avatar.
 */
export function getInitials(customer: Customer): string {
  const first = customer.firstName?.[0] || "";
  const last = customer.lastName?.[0] || "";
  return (first + last).toUpperCase() || "CU";
}
