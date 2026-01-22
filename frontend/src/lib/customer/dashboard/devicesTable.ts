/**
 * Advanced devices table rendering and pagination
 */
import { byId, setHidden, setText, setHTML, setDisabled, maybeById } from "./dom";
import {
  getDevices,
  DEVICES_ADV_PAGE_SIZE,
  getDevicesAdvPage,
  setDevicesAdvPage,
} from "./state";
import { formatDate, formatTier } from "../../portal/types";
import type { Device } from "../../portal/types";
import { getPlatformIcon } from "./icons";
import { badges } from "./badge";

// Modal opener functions - will be set by modals module
let openActivateModalFn: (deviceId: string, deviceName: string) => void;
let openDeactivateModalFn: (deviceId: string, entId: string, deviceName: string, entTier: string) => void;
let openRefreshModalFn: (deviceId: string, entId: string, deviceName: string, entTier: string) => void;

/**
 * Set modal opener functions (called from modals module)
 */
export function setModalOpeners(
  activate: typeof openActivateModalFn,
  deactivate: typeof openDeactivateModalFn,
  refresh: typeof openRefreshModalFn
): void {
  openActivateModalFn = activate;
  openDeactivateModalFn = deactivate;
  openRefreshModalFn = refresh;
}

/**
 * Get entitlement name for a device
 */
function getDeviceEntitlementName(device: Device): string | null {
  if (!device.isActivated || !device.entitlement) return null;
  return formatTier(device.entitlement.tier);
}

/**
 * Render advanced devices table with pagination
 */
export function renderDevicesTable(): void {
  const loading = byId("adv-devices-loading");
  const error = byId("adv-devices-error");
  const empty = byId("adv-devices-empty");
  const table = byId("adv-devices-table");
  const tbody = byId("adv-devices-tbody");
  const pagination = byId("adv-devices-pagination");
  const prevBtn = byId<HTMLButtonElement>("adv-devices-prev");
  const nextBtn = byId<HTMLButtonElement>("adv-devices-next");
  const pageInfo = byId("adv-devices-page-info");

  const devices = getDevices();

  setHidden(loading, true);
  setHidden(error, true);

  if (devices.length === 0) {
    setHidden(empty, false);
    setHidden(table, true);
    setHidden(pagination, true);
    return;
  }

  setHidden(empty, true);
  setHidden(table, false);

  const totalPages = Math.ceil(devices.length / DEVICES_ADV_PAGE_SIZE);
  let page = getDevicesAdvPage();
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  setDevicesAdvPage(page);

  const startIdx = (page - 1) * DEVICES_ADV_PAGE_SIZE;
  const pageDevices = devices.slice(startIdx, startIdx + DEVICES_ADV_PAGE_SIZE);

  const html = pageDevices
    .map((d) => {
      const icon = getPlatformIcon(d.platform);
      const entName = getDeviceEntitlementName(d);
      const statusBadge = d.isActivated
        ? badges.success(entName || "Activated", "sm")
        : badges.warning("No plan active", "sm");
      const lastSeen = d.lastSeen ? formatDate(d.lastSeen) : "Never";

      let actions = "";
      if (d.isActivated && d.entitlement) {
        actions = `
          <button class="btn btn-ghost btn-xs refresh-btn" data-device-id="${d.deviceId}" data-ent-id="${d.entitlement.id}" data-device-name="${d.name || d.deviceId}" data-ent-tier="${d.entitlement.tier}" title="Refresh">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
          <button class="btn btn-ghost btn-xs text-error deactivate-btn" data-device-id="${d.deviceId}" data-ent-id="${d.entitlement.id}" data-device-name="${d.name || d.deviceId}" data-ent-tier="${d.entitlement.tier}" title="Deactivate">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
          </button>
        `;
      } else {
        actions = `<button class="btn btn-primary btn-xs activate-btn" data-device-id="${d.deviceId}" data-device-name="${d.name || d.deviceId}">Activate</button>`;
      }

      return `
        <tr>
          <td>
            <div class="flex items-center gap-2">
              <span class="text-base-content/70">${icon}</span>
              <div>
                <div class="font-medium">${d.name || d.deviceId}</div>
                <div class="text-xs text-base-content/50 font-mono">${d.deviceId}</div>
              </div>
            </div>
          </td>
          <td>${d.platform || "-"}</td>
          <td>${statusBadge}</td>
          <td class="text-sm">${lastSeen}</td>
          <td class="text-right"><div class="flex justify-end gap-1">${actions}</div></td>
        </tr>
      `;
    })
    .join("");

  setHTML(tbody, html);

  // Bind action buttons
  tbody.querySelectorAll(".activate-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openActivateModalFn(
        btn.getAttribute("data-device-id")!,
        btn.getAttribute("data-device-name")!
      );
    });
  });

  tbody.querySelectorAll(".deactivate-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openDeactivateModalFn(
        btn.getAttribute("data-device-id")!,
        btn.getAttribute("data-ent-id")!,
        btn.getAttribute("data-device-name")!,
        btn.getAttribute("data-ent-tier")!
      );
    });
  });

  tbody.querySelectorAll(".refresh-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openRefreshModalFn(
        btn.getAttribute("data-device-id")!,
        btn.getAttribute("data-ent-id")!,
        btn.getAttribute("data-device-name")!,
        btn.getAttribute("data-ent-tier")!
      );
    });
  });

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
 * Initialize advanced devices table pagination event listeners
 */
export function initDevicesTable(): void {
  maybeById("adv-devices-prev")?.addEventListener("click", () => {
    const page = getDevicesAdvPage();
    if (page > 1) {
      setDevicesAdvPage(page - 1);
      renderDevicesTable();
    }
  });

  maybeById("adv-devices-next")?.addEventListener("click", () => {
    const devices = getDevices();
    const totalPages = Math.ceil(devices.length / DEVICES_ADV_PAGE_SIZE);
    const page = getDevicesAdvPage();
    if (page < totalPages) {
      setDevicesAdvPage(page + 1);
      renderDevicesTable();
    }
  });
}
