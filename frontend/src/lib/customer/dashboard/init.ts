/**
 * Main dashboard initialization orchestrator.
 * Import this and call initCustomerDashboard() from the dashboard.astro script.
 */
import { maybeById, addClass, removeClass } from "./dom";
import { loadAllData } from "./data";
import { initTabs, initTabFromUrl } from "./tabs";
import { initChecklist } from "./checklist";
import { initHero, updateHeroState } from "./hero";
import { initPlans, renderPlans } from "./plans";
import { initDevicesOverview, renderDevicesOverview } from "./devicesOverview";
import { initDevicesTable, renderDevicesTable } from "./devicesTable";
import { initModals, setReloadCallback } from "./modals";
import { initAirgapped, setAirgapReloadCallback } from "./airgapped";

/**
 * Reload all data and re-render all sections.
 * Called after modal actions complete.
 */
async function reloadAll(): Promise<void> {
  await loadAllData();
  updateHeroState();
  renderPlans();
  renderDevicesOverview();
  renderDevicesTable();
}

/**
 * Initialize the customer dashboard.
 * Should be called once when the page loads.
 */
export async function initCustomerDashboard(): Promise<void> {
  // Check for localStorage refresh signal (from success page redirect)
  const needsRefresh = localStorage.getItem("portalNeedsRefresh");
  if (needsRefresh) localStorage.removeItem("portalNeedsRefresh");

  // Clean up URL query param if present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("refresh")) {
    const url = new URL(window.location.href);
    url.searchParams.delete("refresh");
    window.history.replaceState({}, "", url.pathname);
  }

  // Wire up reload callback for modals and air-gapped
  setReloadCallback(reloadAll);
  setAirgapReloadCallback(reloadAll);

  // Initialize all sections
  initTabs();
  initChecklist();
  initHero();
  initPlans();
  initDevicesOverview();
  initDevicesTable();
  initModals();
  initAirgapped();

  // Set up refresh data button
  maybeById("refresh-data-btn")?.addEventListener("click", async () => {
    const btn = maybeById<HTMLButtonElement>("refresh-data-btn");
    if (btn) {
      addClass(btn, "loading");
      addClass(btn, "btn-disabled");
    }
    await reloadAll();
    if (btn) {
      removeClass(btn, "loading");
      removeClass(btn, "btn-disabled");
    }
  });

  // Initial data load and render
  await loadAllData();
  updateHeroState();
  renderPlans();
  renderDevicesOverview();
  renderDevicesTable();

  // Sync tab state from URL
  initTabFromUrl();
}
