/**
 * Data loading functions for dashboard
 */
import { portalFetch } from "../../portal/api";
import type { EntitlementsResponse, DevicesResponse } from "../../portal/types";
import { setEntitlements, setDevices } from "./state";

/**
 * Load entitlements from API
 */
export async function loadEntitlements(): Promise<void> {
  try {
    const data = await portalFetch<EntitlementsResponse>(
      "/api/customers/me/entitlements",
      { cache: "no-store" }
    );
    setEntitlements(data.entitlements || []);
  } catch (err) {
    console.error("Failed to load entitlements:", err);
    setEntitlements([]);
  }
}

/**
 * Load devices from API
 */
export async function loadDevices(): Promise<void> {
  try {
    const data = await portalFetch<DevicesResponse>(
      "/api/customers/me/devices",
      { cache: "no-store" }
    );
    setDevices(data.devices || []);
  } catch (err) {
    console.error("Failed to load devices:", err);
    setDevices([]);
  }
}

/**
 * Load all dashboard data
 */
export async function loadAllData(): Promise<void> {
  await Promise.all([loadEntitlements(), loadDevices()]);
}
