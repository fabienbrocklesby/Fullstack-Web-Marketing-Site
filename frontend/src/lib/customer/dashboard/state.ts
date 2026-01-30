/**
 * Dashboard state management
 * Holds entitlements, devices, and pagination state.
 */
import type { Entitlement, Device } from "../../portal/types";
import { isActiveEntitlement, isActiveTrial, isActivePaid, getDaysLeft, formatDate } from "../../portal/types";

// ============================================================
// DATA STATE
// ============================================================
let entitlements: Entitlement[] = [];
let devices: Device[] = [];

// Error state - track if API calls failed
let entitlementsError: string | null = null;
let devicesError: string | null = null;

// Trial eligibility state
let trialEligible: boolean = false;
let trialStatusLoaded: boolean = false;

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

export function getTrialEligible(): boolean {
  return trialEligible;
}

export function setTrialEligible(eligible: boolean): void {
  trialEligible = eligible;
}

export function getTrialStatusLoaded(): boolean {
  return trialStatusLoaded;
}

export function setTrialStatusLoaded(loaded: boolean): void {
  trialStatusLoaded = loaded;
}

// ============================================================
// DERIVED TRIAL STATE (computed from entitlements)
// ============================================================

export interface TrialState {
  hasActiveTrial: boolean;
  hasActivePaid: boolean;
  isTrialOnly: boolean;
  trialExpiresAt: string | null;
  trialDaysLeft: number | null;
  trialExpiryLabel: string | null;
  hasActivatedDevices: boolean;
}

/**
 * Compute derived trial state from current entitlements and devices.
 * Use this to keep trial-related UI consistent across hero, plans, steps, and banner.
 */
export function getTrialState(): TrialState {
  const activeTrialEnt = entitlements.find(isActiveTrial);
  const hasActiveTrial = !!activeTrialEnt;
  const hasActivePaid = entitlements.some(isActivePaid);
  const isTrialOnly = hasActiveTrial && !hasActivePaid;
  const hasActivatedDevices = devices.some((d) => d.isActivated);
  
  const trialExpiresAt = activeTrialEnt?.expiresAt ?? null;
  const trialDaysLeft = trialExpiresAt ? getDaysLeft(trialExpiresAt) : null;
  const trialExpiryLabel = trialExpiresAt ? formatDate(trialExpiresAt) : null;

  return {
    hasActiveTrial,
    hasActivePaid,
    isTrialOnly,
    trialExpiresAt,
    trialDaysLeft,
    trialExpiryLabel,
    hasActivatedDevices,
  };
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
