/**
 * Dashboard state management
 * Holds entitlements, devices, and pagination state.
 */
import type { Entitlement, Device } from "../../portal/types";

// ============================================================
// DATA STATE
// ============================================================
let entitlements: Entitlement[] = [];
let devices: Device[] = [];

// Error state - track if API calls failed
let entitlementsError: string | null = null;
let devicesError: string | null = null;

export function getEntitlements(): Entitlement[] {
  return entitlements;
}

export function setEntitlements(data: Entitlement[]): void {
  entitlements = data;
}

export function getEntitlementsError(): string | null {
  return entitlementsError;
}

export function setEntitlementsError(error: string | null): void {
  entitlementsError = error;
}

export function getDevices(): Device[] {
  return devices;
}

export function setDevices(data: Device[]): void {
  devices = data;
}

export function getDevicesError(): string | null {
  return devicesError;
}

export function setDevicesError(error: string | null): void {
  devicesError = error;
}

// ============================================================
// PAGINATION CONSTANTS
// ============================================================
export const PLANS_PAGE_SIZE = 5;
export const DEVICES_OVERVIEW_PAGE_SIZE = 3;
export const DEVICES_ADV_PAGE_SIZE = 10;

// ============================================================
// PAGINATION STATE
// ============================================================
let plansPage = 1;
let devicesOverviewPage = 1;
let devicesAdvPage = 1;

export function getPlansPage(): number {
  return plansPage;
}

export function setPlansPage(page: number): void {
  plansPage = page;
}

export function getDevicesOverviewPage(): number {
  return devicesOverviewPage;
}

export function setDevicesOverviewPage(page: number): void {
  devicesOverviewPage = page;
}

export function getDevicesAdvPage(): number {
  return devicesAdvPage;
}

export function setDevicesAdvPage(page: number): void {
  devicesAdvPage = page;
}
