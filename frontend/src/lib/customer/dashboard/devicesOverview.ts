/**
 * Devices overview card rendering and pagination
 */
import { byId, setHidden, setText, setHTML, setDisabled, maybeById } from "./dom";
import {
  getDevices,
  DEVICES_OVERVIEW_PAGE_SIZE,
  getDevicesOverviewPage,
  setDevicesOverviewPage,
} from "./state";
import { formatTier } from "../../portal/types";
import type { Device } from "../../portal/types";
import { getPlatformIcon } from "./icons";
import { badges } from "./badge";

/**
 * Get entitlement name for a device
 */
function getDeviceEntitlementName(device: Device): string | null {
  if (!device.isActivated || !device.entitlement) return null;
  return formatTier(device.entitlement.tier);
}

/**
 * Render devices overview list with pagination
 */
export function renderDevicesOverview(): void {
  const loading = byId("devices-overview-loading");
  const empty = byId("devices-overview-empty");
  const list = byId("devices-overview-list");
  const more = byId("devices-overview-more");
  const count = byId("devices-count");
  const pagination = byId("devices-overview-pagination");
  const prevBtn = byId<HTMLButtonElement>("devices-overview-prev");
  const nextBtn = byId<HTMLButtonElement>("devices-overview-next");
  const pageInfo = byId("devices-overview-page-info");

  const devices = getDevices();

  setHidden(loading, true);
  setText(count, String(devices.length));

  if (devices.length === 0) {
    setHidden(empty, false);
    setHidden(list, true);
    setHidden(more, true);
    setHidden(pagination, true);
    return;
  }

  setHidden(empty, true);
  setHidden(list, false);

  const totalPages = Math.ceil(devices.length / DEVICES_OVERVIEW_PAGE_SIZE);
  let page = getDevicesOverviewPage();
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  setDevicesOverviewPage(page);

  const startIdx = (page - 1) * DEVICES_OVERVIEW_PAGE_SIZE;
  const shown = devices.slice(startIdx, startIdx + DEVICES_OVERVIEW_PAGE_SIZE);

  const html = shown
    .map((d) => {
      const icon = getPlatformIcon(d.platform);
      const entName = getDeviceEntitlementName(d);
      const statusInfo = d.isActivated
        ? badges.success(entName || "Activated", "xs")
        : badges.warning("No plan active", "xs");

      return `
        <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg mb-2">
          <div class="flex items-center gap-3">
            <span class="text-base-content/70">${icon}</span>
            <div>
              <div class="font-medium">${d.name || d.deviceId}</div>
              <div class="text-xs text-base-content/50 font-mono">${d.deviceId}</div>
            </div>
          </div>
          ${statusInfo}
        </div>
      `;
    })
    .join("");

  setHTML(list, html);
  setHidden(more, true);

  if (totalPages > 1) {
    setHidden(pagination, false);
    setText(pageInfo, `Page ${page} of ${totalPages}`);
    setDisabled(prevBtn, page <= 1);
    setDisabled(nextBtn, page >= totalPages);
  } else {
    setHidden(pagination, true);
  }
}

/**
 * Initialize devices overview pagination event listeners
 */
export function initDevicesOverview(): void {
  maybeById("devices-overview-prev")?.addEventListener("click", () => {
    const page = getDevicesOverviewPage();
    if (page > 1) {
      setDevicesOverviewPage(page - 1);
      renderDevicesOverview();
    }
  });

  maybeById("devices-overview-next")?.addEventListener("click", () => {
    const devices = getDevices();
    const totalPages = Math.ceil(devices.length / DEVICES_OVERVIEW_PAGE_SIZE);
    const page = getDevicesOverviewPage();
    if (page < totalPages) {
      setDevicesOverviewPage(page + 1);
      renderDevicesOverview();
    }
  });
}
