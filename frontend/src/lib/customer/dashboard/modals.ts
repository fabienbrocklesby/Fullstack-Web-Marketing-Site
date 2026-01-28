/**
 * All dashboard modals: purchase, register, activate, deactivate, refresh, how-to-activate
 */
import { byId, maybeById, setHidden, setText, addClass, removeClass } from "./dom";
import { portalFetch, parseApiError } from "../../portal/api";
import type {
  CheckoutResponse,
  RegisterDeviceResponse,
  ActivateResponse,
  DeactivateResponse,
  RefreshResponse,
} from "../../portal/types";
import { formatDate, formatTier, isActiveEntitlement } from "../../portal/types";
import { getEntitlements } from "./state";
import { switchTab } from "./tabs";
import { setModalOpeners } from "./devicesTable";

// Callback to reload all data after modal actions
let reloadAllDataFn: () => Promise<void>;

/**
 * Set the reload data callback
 */
export function setReloadCallback(fn: () => Promise<void>): void {
  reloadAllDataFn = fn;
}

// ============================================================
// PURCHASE MODAL
// ============================================================
let purchaseModal: HTMLDialogElement;
let purchaseForm: HTMLFormElement;
let purchaseTierSelect: HTMLSelectElement;

/**
 * Open purchase modal. If fromTrialOnly=true, preselect Maker tier.
 */
function openPurchaseModal(fromTrialOnly: boolean = false): void {
  if (fromTrialOnly && purchaseTierSelect) {
    purchaseTierSelect.value = "maker";
  }
  purchaseModal.showModal();
}

/**
 * Export for use by other modules (hero, trial banner)
 */
export function openPurchaseModalFromTrial(): void {
  openPurchaseModal(true);
}

function initPurchaseModal(): void {
  purchaseModal = byId<HTMLDialogElement>("purchase-modal");
  purchaseForm = byId<HTMLFormElement>("purchase-form");
  purchaseTierSelect = byId<HTMLSelectElement>("purchase-tier");

  // Regular purchase buttons (non-trial context)
  maybeById("hero-buy-btn")?.addEventListener("click", () => openPurchaseModal(false));
  maybeById("hero-buy-another-btn")?.addEventListener("click", () => openPurchaseModal(false));
  maybeById("add-plan-btn")?.addEventListener("click", () => openPurchaseModal(false));
  maybeById("plans-empty-buy")?.addEventListener("click", () => openPurchaseModal(false));

  // Trial-only purchase buttons (preselect Maker)
  // Use data-trial-purchase attribute to identify these
  document.querySelectorAll("[data-trial-purchase]").forEach((btn) => {
    btn.addEventListener("click", () => openPurchaseModal(true));
  });

  purchaseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tier = purchaseTierSelect.value;
    const btnText = byId("purchase-btn-text");
    const btnLoad = byId("purchase-btn-loading");
    const errorEl = byId("purchase-error");
    const errorText = byId("purchase-error-text");

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);

    try {
      const data = await portalFetch<CheckoutResponse>("/api/customer-checkout-subscription", {
        method: "POST",
        body: JSON.stringify({
          tier,
          successPath: "/customer/success",
          cancelPath: "/customer/dashboard",
        }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setText(errorText, parseApiError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
    }
  });
}

// ============================================================
// HOW TO ACTIVATE MODAL
// ============================================================
function initHowToActivateModal(): void {
  const htaModal = maybeById<HTMLDialogElement>("how-to-activate-modal");
  
  maybeById("how-to-activate-btn")?.addEventListener("click", () => htaModal?.showModal());
  maybeById("hta-advanced-btn")?.addEventListener("click", () => {
    htaModal?.close();
    switchTab("advanced", "airgapped-section");
  });
}

// ============================================================
// REGISTER MODAL
// ============================================================
let registerModal: HTMLDialogElement;
let registerForm: HTMLFormElement;

function openRegisterModal(): void {
  (byId<HTMLInputElement>("register-device-id")).value = "";
  (byId<HTMLInputElement>("register-device-name")).value = "";
  (byId<HTMLSelectElement>("register-device-platform")).value = "";
  setHidden(byId("register-error"), true);
  registerModal.showModal();
}

function initRegisterModal(): void {
  registerModal = byId<HTMLDialogElement>("register-modal");
  registerForm = byId<HTMLFormElement>("register-form");

  maybeById("overview-register-btn")?.addEventListener("click", openRegisterModal);
  maybeById("adv-register-device-btn")?.addEventListener("click", openRegisterModal);
  maybeById("devices-empty-register")?.addEventListener("click", openRegisterModal);
  maybeById("adv-devices-empty-register")?.addEventListener("click", openRegisterModal);

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deviceId = (byId<HTMLInputElement>("register-device-id")).value.trim();
    const deviceName = (byId<HTMLInputElement>("register-device-name")).value.trim();
    const platform = (byId<HTMLSelectElement>("register-device-platform")).value;

    const btnText = byId("register-btn-text");
    const btnLoad = byId("register-btn-loading");
    const errorEl = byId("register-error");
    const errorText = byId("register-error-text");

    if (!deviceId) {
      setText(errorText, "Device ID is required");
      setHidden(errorEl, false);
      return;
    }

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);

    try {
      await portalFetch<RegisterDeviceResponse>("/api/device/register", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          deviceName: deviceName || undefined,
          platform: platform || undefined,
        }),
      });
      registerModal.close();
      await reloadAllDataFn();
    } catch (err) {
      setText(errorText, parseApiError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
    }
  });
}

// ============================================================
// ACTIVATE MODAL
// ============================================================
let activateModal: HTMLDialogElement;
let activateForm: HTMLFormElement;

function openActivateModal(deviceId: string, deviceName: string): void {
  (byId<HTMLInputElement>("activate-device-id")).value = deviceId;
  setText(byId("activate-device-name"), deviceName);

  const select = byId<HTMLSelectElement>("activate-entitlement");
  const entitlements = getEntitlements();
  select.innerHTML =
    '<option value="">Select entitlement...</option>' +
    entitlements
      .filter(isActiveEntitlement)
      .map(
        (e) =>
          `<option value="${e.id}">${formatTier(e.tier)} (${e.isLifetime ? "Lifetime" : "Subscription"})</option>`
      )
      .join("");

  setHidden(byId("activate-error"), true);
  setHidden(byId("activate-success"), true);
  activateModal.showModal();
}

function initActivateModal(): void {
  activateModal = byId<HTMLDialogElement>("activate-modal");
  activateForm = byId<HTMLFormElement>("activate-form");

  activateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deviceId = (byId<HTMLInputElement>("activate-device-id")).value;
    const entitlementId = (byId<HTMLSelectElement>("activate-entitlement")).value;

    const btnText = byId("activate-btn-text");
    const btnLoad = byId("activate-btn-loading");
    const errorEl = byId("activate-error");
    const errorText = byId("activate-error-text");
    const successEl = byId("activate-success");
    const successText = byId("activate-success-text");

    if (!entitlementId) {
      setText(errorText, "Please select an entitlement");
      setHidden(errorEl, false);
      return;
    }

    setHidden(errorEl, true);
    setHidden(successEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);

    try {
      const data = await portalFetch<ActivateResponse>("/api/licence/activate", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          entitlementId: parseInt(entitlementId, 10),
        }),
      });
      setText(
        successText,
        `Activated! ${data.expiresAt ? `Expires ${formatDate(data.expiresAt)}` : ""}`
      );
      setHidden(successEl, false);
      setTimeout(() => {
        activateModal.close();
        reloadAllDataFn();
      }, 1500);
    } catch (err) {
      setText(errorText, parseApiError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
    }
  });
}

// ============================================================
// DEACTIVATE MODAL
// ============================================================
let deactivateModal: HTMLDialogElement;
let deactivateForm: HTMLFormElement;

function openDeactivateModal(
  deviceId: string,
  entId: string,
  deviceName: string,
  entTier: string
): void {
  (byId<HTMLInputElement>("deactivate-device-id")).value = deviceId;
  (byId<HTMLInputElement>("deactivate-entitlement-id")).value = entId;
  setText(byId("deactivate-device-name"), deviceName);
  setText(byId("deactivate-ent-name"), formatTier(entTier));
  setHidden(byId("deactivate-error"), true);
  deactivateModal.showModal();
}

function initDeactivateModal(): void {
  deactivateModal = byId<HTMLDialogElement>("deactivate-modal");
  deactivateForm = byId<HTMLFormElement>("deactivate-form");

  deactivateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deviceId = (byId<HTMLInputElement>("deactivate-device-id")).value;
    const entitlementId = (byId<HTMLInputElement>("deactivate-entitlement-id")).value;

    const btnText = byId("deactivate-btn-text");
    const btnLoad = byId("deactivate-btn-loading");
    const errorEl = byId("deactivate-error");
    const errorText = byId("deactivate-error-text");

    setHidden(errorEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);

    try {
      await portalFetch<DeactivateResponse>("/api/licence/deactivate", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          entitlementId: parseInt(entitlementId, 10),
        }),
      });
      deactivateModal.close();
      await reloadAllDataFn();
    } catch (err) {
      setText(errorText, parseApiError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
    }
  });
}

// ============================================================
// REFRESH MODAL
// ============================================================
let refreshModal: HTMLDialogElement;
let refreshForm: HTMLFormElement;

function openRefreshModal(
  deviceId: string,
  entId: string,
  deviceName: string,
  entTier: string
): void {
  (byId<HTMLInputElement>("refresh-device-id")).value = deviceId;
  (byId<HTMLInputElement>("refresh-entitlement-id")).value = entId;
  setText(byId("refresh-device-name"), deviceName);
  setText(byId("refresh-ent-name"), formatTier(entTier));
  setHidden(byId("refresh-error"), true);
  setHidden(byId("refresh-success"), true);
  refreshModal.showModal();
}

function initRefreshModal(): void {
  refreshModal = byId<HTMLDialogElement>("refresh-modal");
  refreshForm = byId<HTMLFormElement>("refresh-form");

  refreshForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deviceId = (byId<HTMLInputElement>("refresh-device-id")).value;
    const entitlementId = (byId<HTMLInputElement>("refresh-entitlement-id")).value;

    const btnText = byId("refresh-btn-text");
    const btnLoad = byId("refresh-btn-loading");
    const errorEl = byId("refresh-error");
    const errorText = byId("refresh-error-text");
    const successEl = byId("refresh-success");
    const successText = byId("refresh-success-text");

    setHidden(errorEl, true);
    setHidden(successEl, true);
    setHidden(btnText, true);
    setHidden(btnLoad, false);

    try {
      const data = await portalFetch<RefreshResponse>("/api/licence/refresh", {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          entitlementId: parseInt(entitlementId, 10),
        }),
      });
      let msg = "Refreshed successfully";
      if (data.leaseToken && data.leaseExpiresAt) {
        msg = `Lease renewed until ${formatDate(data.leaseExpiresAt)}`;
      }
      setText(successText, msg);
      setHidden(successEl, false);
      setTimeout(() => {
        refreshModal.close();
        reloadAllDataFn();
      }, 1500);
    } catch (err) {
      setText(errorText, parseApiError(err));
      setHidden(errorEl, false);
    } finally {
      setHidden(btnText, false);
      setHidden(btnLoad, true);
    }
  });
}

// ============================================================
// INIT ALL MODALS
// ============================================================
export function initModals(): void {
  initPurchaseModal();
  initHowToActivateModal();
  initRegisterModal();
  initActivateModal();
  initDeactivateModal();
  initRefreshModal();

  // Wire up modal openers to devices table
  setModalOpeners(openActivateModal, openDeactivateModal, openRefreshModal);
}
