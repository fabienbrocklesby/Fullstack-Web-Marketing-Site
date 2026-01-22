/**
 * Tab switching logic for Overview/Advanced tabs
 */
import { byId, maybeById, addClass, removeClass, setHidden } from "./dom";

let tabOverview: HTMLElement;
let tabAdvanced: HTMLElement;
let panelOverview: HTMLElement;
let panelAdvanced: HTMLElement;

/**
 * Switch to specified tab, optionally scrolling to an element
 */
export function switchTab(tab: "overview" | "advanced", scrollToId?: string): void {
  if (tab === "overview") {
    addClass(tabOverview, "tab-active");
    removeClass(tabAdvanced, "tab-active");
    setHidden(panelOverview, false);
    setHidden(panelAdvanced, true);
  } else {
    removeClass(tabOverview, "tab-active");
    addClass(tabAdvanced, "tab-active");
    setHidden(panelOverview, true);
    setHidden(panelAdvanced, false);
  }

  // Update URL without reload
  const url = new URL(window.location.href);
  if (tab === "advanced") {
    url.searchParams.set("tab", "advanced");
  } else {
    url.searchParams.delete("tab");
  }
  url.hash = scrollToId || "";
  history.replaceState(null, "", url.toString());

  // Scroll to element if specified
  if (scrollToId) {
    requestAnimationFrame(() => {
      const el = document.getElementById(scrollToId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    });
  }
}

/**
 * Initialize tab state from URL params/hash
 */
export function initTabFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace("#", "");
  const tab = params.get("tab");

  if (tab === "advanced") {
    switchTab("advanced", hash || undefined);
  } else if (hash) {
    const el = document.getElementById(hash);
    if (el && panelAdvanced.contains(el)) {
      switchTab("advanced", hash);
    }
  }
}

/**
 * Initialize tab event listeners
 */
export function initTabs(): void {
  tabOverview = byId("tab-overview");
  tabAdvanced = byId("tab-advanced");
  panelOverview = byId("panel-overview");
  panelAdvanced = byId("panel-advanced");

  tabOverview.addEventListener("click", () => switchTab("overview"));
  tabAdvanced.addEventListener("click", () => switchTab("advanced"));

  // Navigation links
  maybeById("view-all-devices")?.addEventListener("click", () => {
    switchTab("advanced");
  });

  ["hero-advanced-link-1", "hero-advanced-link-2", "hero-advanced-link-3"].forEach((id) => {
    maybeById(id)?.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("advanced", "airgapped-section");
    });
  });
}
