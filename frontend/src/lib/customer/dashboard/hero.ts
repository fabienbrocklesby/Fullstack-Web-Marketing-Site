/**
 * Hero section state management
 */
import { byId, maybeById, setHidden, toggleClass } from "./dom";
import { getEntitlements, getDevices } from "./state";
import { isActiveEntitlement } from "../../portal/types";

/**
 * Update hero section based on current entitlements/devices state
 */
export function updateHeroState(): void {
  const loading = byId("hero-loading");
  const heroNoEnt = byId("hero-no-entitlements");
  const heroNoActivated = byId("hero-no-activated");
  const heroAllGood = byId("hero-all-good");

  setHidden(loading, true);
  setHidden(heroNoEnt, true);
  setHidden(heroNoActivated, true);
  setHidden(heroAllGood, true);

  const entitlements = getEntitlements();
  const devices = getDevices();

  const activeEnts = entitlements.filter(isActiveEntitlement);
  if (activeEnts.length === 0) {
    setHidden(heroNoEnt, false);
    return;
  }

  const hasActivated = devices.some((d) => d.isActivated);
  if (!hasActivated) {
    setHidden(heroNoActivated, false);
    return;
  }

  setHidden(heroAllGood, false);
}

/**
 * Initialize hero section event listeners
 */
export function initHero(): void {
  const heroAddDeviceBtn = maybeById("hero-add-device-btn");
  const heroAddDeviceInfo = maybeById("hero-add-device-info");
  
  heroAddDeviceBtn?.addEventListener("click", () => {
    toggleClass(heroAddDeviceInfo, "hidden");
  });
}
