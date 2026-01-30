/**
 * Data loading functions for dashboard
 */
import { portalFetch, parseApiError, getTrialStatus } from "../../portal/api";
import type { EntitlementsResponse, DevicesResponse } from "../../portal/types";
import {
  setEntitlements,
  setDevices,
  setEntitlementsError,
  setDevicesError,
  setTrialEligible,
  setTrialStatusLoaded,
} from "./state";

/**
 * Load entitlements from API
 */
export async function loadEntitlements(): Promise<void> {
  try {
    setEntitlementsError(null);
    const data = await portalFetch<EntitlementsResponse>(
      "/api/customers/me/entitlements",
      { cache: "no-store" }
    );
    setEntitlements(data.entitlements || []);
  } catch (err) {
    console.error("Failed to load entitlements:", err);
    setEntitlements([]);
    setEntitlementsError(parseApiError(err));
  }
}

/**
 * Load devices from API
 */
export async function loadDevices(): Promise<void> {
  try {
    setDevicesError(null);
    const data = await portalFetch<DevicesResponse>(
      "/api/customers/me/devices",
      { cache: "no-store" }
    );
    setDevices(data.devices || []);
  } catch (err) {
    console.error("Failed to load devices:", err);
    setDevices([]);
    setDevicesError(parseApiError(err));
  }
}

/**
 * Load trial eligibility status from API
 */
export async function loadTrialStatus(): Promise<void> {
  try {
    const data = await getTrialStatus();
    setTrialEligible(data.trialEligible);
    setTrialStatusLoaded(true);
  } catch (err) {
    console.error("Failed to load trial status:", err);
    // Default to not eligible on error (safe default)
    setTrialEligible(false);
    setTrialStatusLoaded(true);
  }
}

/**
 * Load all dashboard data
 */
export async function loadAllData(): Promise<void> {
  await Promise.all([loadEntitlements(), loadDevices(), loadTrialStatus()]);
}
