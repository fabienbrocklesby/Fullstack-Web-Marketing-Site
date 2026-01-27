/**
 * Air-gapped provisioning, lease refresh, and deactivation logic
 */
import { byId, maybeById, setHidden, setText, addClass, removeClass } from "./dom";
import { portalFetch, parseApiError } from "../../portal/api";
import type {
  OfflineProvisionResponse,
  OfflineLeaseRefreshResponse,
  OfflineDeactivateResponse,
  Entitlement,
} from "../../portal/types";
import { formatTier } from "../../portal/types";
import { getEntitlements, getEntitlementsError, getDevices } from "./state";

// Callback to reload all data after successful operations
let reloadAllDataFn: () => Promise<void>;

/**
 * Set the reload data callback
 */
export function setAirgapReloadCallback(fn: () => Promise<void>): void {
  reloadAllDataFn = fn;
}

// Regex for base64url validation
const BASE64URL_REGEX = /^[A-Za-z0-9_-]+={0,2}$/;

// ============================================================
// HELPERS
// ============================================================

function validateBase64UrlCode(code: string, fieldName: string): string | null {
  if (!code || !code.trim()) return `Please paste the ${fieldName} from your air-gapped machine`;
  const trimmed = code.trim();
  if (trimmed.length < 20) return `${fieldName} is too short - check you copied the complete code`;
  if (trimmed.length > 50000) return `${fieldName} is too large`;
  if (!BASE64URL_REGEX.test(trimmed)) return `Invalid ${fieldName} format - must be a base64url encoded string`;
  return null;
}

function tryDecodeCode(code: string): { ok: true; data: Record<string, unknown> } | { ok: false } {
  try {
    const trimmed = code.trim();
    if (!BASE64URL_REGEX.test(trimmed)) return { ok: false };
    const decoded = atob(trimmed.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(decoded);
    if (typeof data !== "object" || data === null) return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

function mapAirgapError(err: unknown): string {
  const errObj = err as { code?: string; message?: string };
  const code = errObj?.code || "";
  const message = errObj?.message || "An error occurred";
  const errorMap: Record<string, string> = {
    VALIDATION_ERROR: message.includes("required")
      ? "Missing required field - please check your input"
      : "Invalid input format",
    INVALID_SETUP_CODE: "Invalid device setup code format or structure",
    INVALID_REQUEST_CODE: "Invalid refresh request code format or structure",
    INVALID_DEACTIVATION_CODE: "Invalid deactivation code format or structure",
    INVALID_PUBLIC_KEY: "The device public key in the code is invalid or corrupted",
    SIGNATURE_VERIFICATION_FAILED: "Signature verification failed - the code may be corrupted or tampered",
    REPLAY_REJECTED: "This code has already been used (replay rejected)",
    DEVICE_NOT_FOUND: "Device not found - it may not be registered yet",
    DEVICE_NOT_OWNED: "Device is not registered to your account",
    DEVICE_NOT_BOUND: "Device is not bound to this entitlement - provision it first",
    ENTITLEMENT_NOT_FOUND: "Entitlement not found",
    ENTITLEMENT_NOT_ACTIVE: "Entitlement is not active",
    MAX_DEVICES_EXCEEDED: "Maximum devices reached - deactivate another device first",
    LIFETIME_NOT_SUPPORTED: "Lifetime licenses do not support offline activation",
  };
  if (message.includes("JSON") || message.includes("Unexpected token") || message.includes("SyntaxError")) {
    return "Invalid code format - not a valid encoded code";
  }
  return errorMap[code] || message;
}

function downloadCodeAsFile(content: string, prefix: string, deviceId?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const deviceSuffix = deviceId ? `_${deviceId.slice(0, 8)}` : "";
  const filename = `${prefix}${deviceSuffix}_${timestamp}.txt`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupFileLoader(
  btnId: string,
  inputId: string,
  targetId: string,
  updateFn: () => void
): void {
  const btn = maybeById(btnId);
  const input = maybeById<HTMLInputElement>(inputId);
  const target = maybeById<HTMLTextAreaElement>(targetId);
  if (!btn || !input || !target) return;

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      target.value = (reader.result as string).trim();
      updateFn();
    };
    reader.readAsText(file);
    input.value = "";
  });
}

// ============================================================
// BUTTON STATE UPDATERS
// ============================================================

function updateAgProvBtn(): void {
  const entId = maybeById<HTMLSelectElement>("ag-prov-entitlement")?.value;
  const setupCode = maybeById<HTMLTextAreaElement>("ag-prov-setup-code")?.value.trim();
  const btn = maybeById<HTMLButtonElement>("ag-prov-btn");
  if (btn) btn.disabled = !entId || !setupCode;
}

function updateAgRefreshBtn(): void {
  const requestCode = maybeById<HTMLTextAreaElement>("ag-refresh-request-code")?.value.trim();
  const btn = maybeById<HTMLButtonElement>("ag-refresh-btn");
  if (btn) btn.disabled = !requestCode;
}

function updateAgDeactBtn(): void {
  const deactCode = maybeById<HTMLTextAreaElement>("ag-deact-code")?.value.trim();
  const btn = maybeById<HTMLButtonElement>("ag-deact-btn");
  if (btn) btn.disabled = !deactCode;
}

// ============================================================
// PREVIEWS
// ============================================================

function updateRefreshPreview(): void {
  const code = maybeById<HTMLTextAreaElement>("ag-refresh-request-code")?.value.trim();
  const previewEl = maybeById("ag-refresh-preview");
  const contentEl = maybeById("ag-refresh-preview-content");
  if (!previewEl || !contentEl) return;

  if (!code) {
    setHidden(previewEl, true);
    return;
  }

  const decoded = tryDecodeCode(code);
  if (decoded.ok) {
    const parts: string[] = [];
    if (decoded.data.type) parts.push(`Type: ${decoded.data.type}`);
    if (decoded.data.deviceId)
      parts.push(`Device: ${String(decoded.data.deviceId).slice(0, 16)}...`);
    if (decoded.data.entitlementId) parts.push(`Entitlement: ${decoded.data.entitlementId}`);
    setText(contentEl, parts.join(" | "));
    setHidden(previewEl, false);
  } else {
    setHidden(previewEl, true);
  }
}

function updateDeactivatePreview(): void {
  const code = maybeById<HTMLTextAreaElement>("ag-deact-code")?.value.trim();
  const previewEl = maybeById("ag-deact-preview");
  const contentEl = maybeById("ag-deact-preview-content");
  if (!previewEl || !contentEl) return;

  if (!code) {
    setHidden(previewEl, true);
    return;
  }

  const decoded = tryDecodeCode(code);
  if (decoded.ok) {
    const parts: string[] = [];
    if (decoded.data.type) parts.push(`Type: ${decoded.data.type}`);
    if (decoded.data.deviceId)
      parts.push(`Device: ${String(decoded.data.deviceId).slice(0, 16)}...`);
    if (decoded.data.entitlementId) parts.push(`Entitlement: ${decoded.data.entitlementId}`);
    setText(contentEl, parts.join(" | "));
    setHidden(previewEl, false);
  } else {
    setHidden(previewEl, true);
  }
}

// ============================================================
// TABS WITHIN AIR-GAPPED SECTION
// ============================================================

function setupAirgappedTabs(): void {
  const tabNames = ["provision", "refresh", "deactivate"] as const;
  tabNames.forEach((tabName) => {
    const tabEl = maybeById(`ag-tab-${tabName}`);
    tabEl?.addEventListener("click", () => {
      tabNames.forEach((t) => {
        const tEl = maybeById(`ag-tab-${t}`);
        const panelEl = maybeById(`ag-panel-${t}`);
        if (tEl && panelEl) {
          if (t === tabName) {
            addClass(tEl, "tab-active");
            setHidden(panelEl, false);
          } else {
            removeClass(tEl, "tab-active");
            setHidden(panelEl, true);
          }
        }
      });
    });
  });
}

// ============================================================
// COPY BUTTON HELPER
// ============================================================

function setCopyButtonSuccess(btn: HTMLButtonElement): void {
  btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span>Copied!</span>`;
  removeClass(btn, "btn-accent");
  addClass(btn, "btn-success");
  setTimeout(() => {
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg><span>Copy</span>`;
    removeClass(btn, "btn-success");
    addClass(btn, "btn-accent");
  }, 2000);
}

// ============================================================
// PROVISION
// ============================================================

/**
 * Offline provisioning eligibility result for a single entitlement.
 */
interface OfflineEligibility {
  entitlement: Entitlement;
  eligible: boolean;
  reason: string | null; // null if eligible, otherwise explains why not
}

/**
 * Check if an entitlement is eligible for offline provisioning.
 * Rules (from docs/licensing-portal-current-state.md):
 * - Must NOT be lifetime (LIFETIME_NOT_SUPPORTED)
 * - Must be in active/trialing status (ENTITLEMENT_NOT_ACTIVE)
 * - Must not have reached maxDevices (MAX_DEVICES_EXCEEDED)
 */
function checkOfflineEligibility(ent: Entitlement, boundDeviceCount: number): OfflineEligibility {
  // Rule 1: Lifetime entitlements are not supported for offline
  if (ent.isLifetime) {
    return { entitlement: ent, eligible: false, reason: "Lifetime licenses don't support offline activation" };
  }

  // Rule 2: Must be in an active state (active or trialing)
  // Note: past_due is usable for regular activation but risky for offline since lease could expire during payment resolution
  const activeStatuses = ["active", "trialing"];
  if (!activeStatuses.includes(ent.status)) {
    const statusLabels: Record<string, string> = {
      inactive: "Subscription inactive",
      canceled: "Subscription canceled",
      expired: "Subscription expired",
      past_due: "Subscription payment overdue",
    };
    return { entitlement: ent, eligible: false, reason: statusLabels[ent.status] || `Status: ${ent.status}` };
  }

  // Rule 3: Must have available device slots
  if (boundDeviceCount >= ent.maxDevices) {
    return { entitlement: ent, eligible: false, reason: `All ${ent.maxDevices} device seats in use` };
  }

  return { entitlement: ent, eligible: true, reason: null };
}

/**
 * Render the provision entitlement dropdown.
 * Call this after data is loaded (or reloaded) to populate the select.
 * 
 * Shows ONLY eligible entitlements (subscription + active/trialing + seats available).
 * If none eligible, shows a clear empty state with reasons.
 */
export function renderAirgappedProvision(): void {
  const select = maybeById<HTMLSelectElement>("ag-prov-entitlement");
  const loadErrorEl = maybeById("ag-prov-load-error");
  const loadErrorText = maybeById("ag-prov-load-error-text");
  const emptyStateEl = maybeById("ag-prov-empty-state");
  
  if (!select) return;

  // Check for API error first
  const apiError = getEntitlementsError();
  if (apiError) {
    if (loadErrorEl && loadErrorText) {
      setText(loadErrorText, `Couldn't load entitlements: ${apiError}. Please refresh the page.`);
      setHidden(loadErrorEl, false);
    }
    if (emptyStateEl) setHidden(emptyStateEl, true);
    select.innerHTML = '<option value="">Unable to load entitlements</option>';
    select.disabled = true;
    return;
  }

  // Hide load error if previously shown
  if (loadErrorEl) setHidden(loadErrorEl, true);
  select.disabled = false;

  const entitlements = getEntitlements();
  const devices = getDevices();

  // Count bound devices per entitlement
  const boundCounts = new Map<number, number>();
  for (const device of devices) {
    if (device.entitlement?.id) {
      boundCounts.set(device.entitlement.id, (boundCounts.get(device.entitlement.id) || 0) + 1);
    }
  }

  // Check eligibility for each entitlement
  const eligibilityResults = entitlements.map((ent) => 
    checkOfflineEligibility(ent, boundCounts.get(ent.id) || 0)
  );

  // Separate eligible from ineligible
  const eligible = eligibilityResults.filter((r) => r.eligible);
  const ineligible = eligibilityResults.filter((r) => !r.eligible);

  // Show empty state if no eligible entitlements
  if (eligible.length === 0) {
    select.innerHTML = '<option value="">No eligible entitlements</option>';
    select.disabled = true;
    
    // Build detailed empty state message
    if (emptyStateEl) {
      let reasons = "";
      if (entitlements.length === 0) {
        reasons = "You don't have any entitlements. Purchase a subscription to get started.";
      } else {
        const reasonList = ineligible.map((r) => 
          `• ${formatTier(r.entitlement.tier)}: ${r.reason}`
        ).join("\n");
        reasons = `None of your entitlements are eligible for offline provisioning:\n${reasonList}`;
      }
      setText(emptyStateEl, reasons);
      setHidden(emptyStateEl, false);
    }
    return;
  }

  // Hide empty state if we have eligible entitlements
  if (emptyStateEl) setHidden(emptyStateEl, true);

  // Build options for eligible entitlements only
  const options = eligible.map((r) => {
    const ent = r.entitlement;
    const boundCount = boundCounts.get(ent.id) || 0;
    const availableSeats = ent.maxDevices - boundCount;
    const seatInfo = ent.maxDevices > 1 ? ` (${availableSeats}/${ent.maxDevices} seats available)` : "";
    return `<option value="${ent.id}">${formatTier(ent.tier)} Subscription${seatInfo}</option>`;
  });

  select.innerHTML = '<option value="">Select entitlement...</option>' + options.join("");
}

function initProvision(): void {
  // Event listeners only - do NOT populate dropdown here (data not loaded yet)
  maybeById("ag-prov-entitlement")?.addEventListener("change", updateAgProvBtn);
  maybeById("ag-prov-setup-code")?.addEventListener("input", updateAgProvBtn);

  maybeById("ag-prov-btn")?.addEventListener("click", async () => {
    const entId = byId<HTMLSelectElement>("ag-prov-entitlement").value;
    const setupCode = byId<HTMLTextAreaElement>("ag-prov-setup-code").value.trim();
    const btn = byId<HTMLButtonElement>("ag-prov-btn");
    const btnText = byId("ag-prov-btn-text");
    const btnLoad = byId("ag-prov-btn-loading");
    const errorEl = byId("ag-prov-error");
    const errorText = byId("ag-prov-error-text");

    if (!entId) {
      setText(errorText, "Please select an entitlement");
      setHidden(errorEl, false);
      return;
    }
    const validationError = validateBase64UrlCode(setupCode, "Device Setup Code");
    if (validationError) {
      setText(errorText, validationError);
      setHidden(errorEl, false);
      return;
    }

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);
    btn.disabled = true;

    try {
      const data = await portalFetch<OfflineProvisionResponse>("/api/licence/offline-provision", {
        method: "POST",
        body: JSON.stringify({ entitlementId: parseInt(entId, 10), deviceSetupCode: setupCode }),
      });
      setHidden(byId("ag-prov-result"), false);
      byId<HTMLTextAreaElement>("ag-prov-output").value = data.activationPackage;
      const expiry = new Date(data.leaseExpiresAt);
      const daysLeft = Math.round((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setText(byId("ag-prov-expiry"), `Valid for ${daysLeft} days`);
      setHidden(byId<HTMLSelectElement>("ag-prov-entitlement").closest(".form-control")!, true);
      setHidden(byId<HTMLTextAreaElement>("ag-prov-setup-code").closest(".form-control")!, true);
      setHidden(btn, true);
      await reloadAllDataFn();
    } catch (err) {
      setText(errorText, mapAirgapError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
      btn.disabled = false;
    }
  });

  maybeById("ag-prov-copy-btn")?.addEventListener("click", async () => {
    const output = byId<HTMLTextAreaElement>("ag-prov-output");
    const btn = byId<HTMLButtonElement>("ag-prov-copy-btn");
    try {
      await navigator.clipboard.writeText(output.value);
      setCopyButtonSuccess(btn);
    } catch {
      output.select();
      document.execCommand("copy");
    }
  });

  maybeById("ag-prov-download-btn")?.addEventListener("click", () => {
    const output = maybeById<HTMLTextAreaElement>("ag-prov-output")?.value;
    if (!output) return;
    const setupCode = maybeById<HTMLTextAreaElement>("ag-prov-setup-code")?.value;
    let deviceId: string | undefined;
    if (setupCode) {
      const decoded = tryDecodeCode(setupCode);
      if (decoded.ok && decoded.data.deviceId) deviceId = String(decoded.data.deviceId);
    }
    downloadCodeAsFile(output, "activation_package", deviceId);
  });

  maybeById("ag-prov-reset-btn")?.addEventListener("click", () => {
    setHidden(byId("ag-prov-result"), true);
    byId<HTMLSelectElement>("ag-prov-entitlement").value = "";
    byId<HTMLTextAreaElement>("ag-prov-setup-code").value = "";
    byId<HTMLTextAreaElement>("ag-prov-output").value = "";
    setHidden(byId<HTMLSelectElement>("ag-prov-entitlement").closest(".form-control")!, false);
    setHidden(byId<HTMLTextAreaElement>("ag-prov-setup-code").closest(".form-control")!, false);
    setHidden(byId("ag-prov-btn"), false);
    setHidden(byId("ag-prov-error"), true);
    updateAgProvBtn();
  });

  setupFileLoader("ag-prov-load-file-btn", "ag-prov-file-input", "ag-prov-setup-code", updateAgProvBtn);
}

// ============================================================
// REFRESH
// ============================================================

function initRefresh(): void {
  maybeById("ag-refresh-request-code")?.addEventListener("input", () => {
    updateAgRefreshBtn();
    updateRefreshPreview();
  });

  maybeById("ag-refresh-btn")?.addEventListener("click", async () => {
    const requestCode = byId<HTMLTextAreaElement>("ag-refresh-request-code").value.trim();
    const btn = byId<HTMLButtonElement>("ag-refresh-btn");
    const btnText = byId("ag-refresh-btn-text");
    const btnLoad = byId("ag-refresh-btn-loading");
    const errorEl = byId("ag-refresh-error");
    const errorText = byId("ag-refresh-error-text");

    const validationError = validateBase64UrlCode(requestCode, "Lease Refresh Request Code");
    if (validationError) {
      setText(errorText, validationError);
      setHidden(errorEl, false);
      return;
    }

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);
    btn.disabled = true;

    try {
      const data = await portalFetch<OfflineLeaseRefreshResponse>("/api/licence/offline-lease-refresh", {
        method: "POST",
        body: JSON.stringify({ requestCode }),
      });
      setHidden(byId("ag-refresh-result"), false);
      byId<HTMLTextAreaElement>("ag-refresh-output").value = data.refreshResponseCode;
      const expiry = new Date(data.leaseExpiresAt);
      const daysLeft = Math.round((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setText(byId("ag-refresh-expiry"), `Valid for ${daysLeft} days`);
      setHidden(byId<HTMLTextAreaElement>("ag-refresh-request-code").closest(".form-control")!, true);
      setHidden(btn, true);
    } catch (err) {
      setText(errorText, mapAirgapError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
      btn.disabled = false;
    }
  });

  maybeById("ag-refresh-copy-btn")?.addEventListener("click", async () => {
    const output = byId<HTMLTextAreaElement>("ag-refresh-output");
    const btn = byId<HTMLButtonElement>("ag-refresh-copy-btn");
    try {
      await navigator.clipboard.writeText(output.value);
      setCopyButtonSuccess(btn);
    } catch {
      output.select();
      document.execCommand("copy");
    }
  });

  maybeById("ag-refresh-download-btn")?.addEventListener("click", () => {
    const output = maybeById<HTMLTextAreaElement>("ag-refresh-output")?.value;
    if (!output) return;
    const requestCode = maybeById<HTMLTextAreaElement>("ag-refresh-request-code")?.value;
    let deviceId: string | undefined;
    if (requestCode) {
      const decoded = tryDecodeCode(requestCode);
      if (decoded.ok && decoded.data.deviceId) deviceId = String(decoded.data.deviceId);
    }
    downloadCodeAsFile(output, "lease_refresh_response", deviceId);
  });

  maybeById("ag-refresh-reset-btn")?.addEventListener("click", () => {
    setHidden(byId("ag-refresh-result"), true);
    byId<HTMLTextAreaElement>("ag-refresh-request-code").value = "";
    byId<HTMLTextAreaElement>("ag-refresh-output").value = "";
    setHidden(byId<HTMLTextAreaElement>("ag-refresh-request-code").closest(".form-control")!, false);
    setHidden(byId("ag-refresh-btn"), false);
    setHidden(byId("ag-refresh-error"), true);
    updateAgRefreshBtn();
  });

  setupFileLoader("ag-refresh-load-file-btn", "ag-refresh-file-input", "ag-refresh-request-code", () => {
    updateAgRefreshBtn();
    updateRefreshPreview();
  });
}

// ============================================================
// DEACTIVATE
// ============================================================

function initDeactivate(): void {
  maybeById("ag-deact-code")?.addEventListener("input", () => {
    updateAgDeactBtn();
    updateDeactivatePreview();
  });

  maybeById("ag-deact-btn")?.addEventListener("click", async () => {
    const deactCode = byId<HTMLTextAreaElement>("ag-deact-code").value.trim();
    const btn = byId<HTMLButtonElement>("ag-deact-btn");
    const btnText = byId("ag-deact-btn-text");
    const btnLoad = byId("ag-deact-btn-loading");
    const errorEl = byId("ag-deact-error");
    const errorText = byId("ag-deact-error-text");

    const validationError = validateBase64UrlCode(deactCode, "Deactivation Code");
    if (validationError) {
      setText(errorText, validationError);
      setHidden(errorEl, false);
      return;
    }

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);
    btn.disabled = true;

    try {
      await portalFetch<OfflineDeactivateResponse>("/api/licence/offline-deactivate", {
        method: "POST",
        body: JSON.stringify({ deactivationCode: deactCode }),
      });
      setHidden(byId("ag-deact-result"), false);
      setHidden(byId<HTMLTextAreaElement>("ag-deact-code").closest(".form-control")!, true);
      setHidden(btn, true);
      await reloadAllDataFn();
    } catch (err) {
      setText(errorText, mapAirgapError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
      btn.disabled = false;
    }
  });

  maybeById("ag-deact-reset-btn")?.addEventListener("click", () => {
    setHidden(byId("ag-deact-result"), true);
    byId<HTMLTextAreaElement>("ag-deact-code").value = "";
    setHidden(byId<HTMLTextAreaElement>("ag-deact-code").closest(".form-control")!, false);
    setHidden(byId("ag-deact-btn"), false);
    setHidden(byId("ag-deact-error"), true);
    updateAgDeactBtn();
  });

  setupFileLoader("ag-deact-load-file-btn", "ag-deact-file-input", "ag-deact-code", () => {
    updateAgDeactBtn();
    updateDeactivatePreview();
  });
}

// ============================================================
// INIT
// ============================================================

export function initAirgapped(): void {
  setupAirgappedTabs();
  initProvision();
  initRefresh();
  initDeactivate();
}
