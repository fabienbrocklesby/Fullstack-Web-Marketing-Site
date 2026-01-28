/**
 * Plans list rendering and pagination
 */
import { byId, setHidden, setText, setHTML, setDisabled, maybeById } from "./dom";
import {
  getEntitlements,
  getDevices,
  PLANS_PAGE_SIZE,
  getPlansPage,
  setPlansPage,
} from "./state";
import { formatDate, formatTier, isActiveEntitlement, isActiveTrial, getDaysLeft } from "../../portal/types";
import { openBillingPortal } from "./billing";
import { badge, badges } from "./badge";
import { urgencyPill } from "./urgency-pill";
import { openPurchaseModalFromTrial } from "./modals";

/**
 * Get count of devices linked to an entitlement
 */
function getLinkedDeviceCount(entitlementId: number): number {
  const devices = getDevices();
  return devices.filter((d) => d.isActivated && d.entitlement?.id === entitlementId).length;
}

/**
 * Render plans list with pagination
 */
export function renderPlans(): void {
  const loading = byId("plans-loading");
  const empty = byId("plans-empty");
  const list = byId("plans-list");
  const countEl = byId("plans-count");
  const pagination = byId("plans-pagination");
  const prevBtn = byId<HTMLButtonElement>("plans-prev");
  const nextBtn = byId<HTMLButtonElement>("plans-next");
  const pageInfo = byId("plans-page-info");

  const entitlements = getEntitlements();

  setHidden(loading, true);
  setText(countEl, String(entitlements.length));

  if (entitlements.length === 0) {
    setHidden(empty, false);
    setHidden(list, true);
    setHidden(pagination, true);
    return;
  }

  setHidden(empty, true);
  setHidden(list, false);

  const totalPages = Math.ceil(entitlements.length / PLANS_PAGE_SIZE);
  let page = getPlansPage();
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  setPlansPage(page);

  const startIdx = (page - 1) * PLANS_PAGE_SIZE;
  const pageEntitlements = entitlements.slice(startIdx, startIdx + PLANS_PAGE_SIZE);

  const html = pageEntitlements
    .map((ent) => {
      const isTrial = isActiveTrial(ent);
      const statusVariant = isActiveEntitlement(ent)
        ? "success"
        : ent.status === "canceled"
          ? "error"
          : "ghost";
      const statusText =
        ent.status === "active"
          ? ent.cancelAtPeriodEnd
            ? "Canceling"
            : "Active"
          : ent.status === "trialing"
            ? "Active"
            : ent.status.charAt(0).toUpperCase() + ent.status.slice(1);
      
      // Type label: Trial, Lifetime, or Subscription
      const typeLabel = isTrial ? "Trial" : ent.isLifetime ? "Lifetime" : "Subscription";
      
      // Renewal info: different for trial vs lifetime vs subscription
      let renewInfo = "";
      let trialPillHtml = "";
      if (isTrial && ent.expiresAt) {
        const daysLeft = getDaysLeft(ent.expiresAt);
        const expiryDate = formatDate(ent.expiresAt);
        // Use urgency pill for trial entitlements
        if (daysLeft !== null && daysLeft >= 0 && expiryDate) {
          trialPillHtml = urgencyPill({
            daysLeft,
            expiresLabel: expiryDate,
            size: "sm",
          });
        } else if (expiryDate) {
          renewInfo = `Expires ${expiryDate}`;
        }
      } else if (ent.isLifetime) {
        renewInfo = "No renewal needed";
      } else if (ent.currentPeriodEnd) {
        renewInfo = `${ent.cancelAtPeriodEnd ? "Ends" : "Renews"} ${formatDate(ent.currentPeriodEnd)}`;
      }

      const linkedCount = getLinkedDeviceCount(ent.id);
      const deviceBadge =
        linkedCount > 0
          ? badges.outlineSuccess(`In use on ${linkedCount} device${linkedCount > 1 ? "s" : ""}`, "sm")
          : badges.outlineInfo("Available", "sm");
      
      // Show Manage button only for paid subscriptions (not trial, not lifetime)
      const showManageBtn = !ent.isLifetime && !isTrial;
      
      // Show "Keep access" CTA for trial entitlements
      const showKeepAccessBtn = isTrial;

      return `
        <div class="flex items-center justify-between p-3 bg-base-200 rounded-lg" data-entitlement-id="${ent.id}">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold">${formatTier(ent.tier)}</span>
              ${badge({ text: statusText, variant: statusVariant as "success" | "error" | "ghost", size: "sm" })}
              ${badges.ghost(typeLabel, "sm")}
              ${deviceBadge}
            </div>
            <div class="mt-2">
              ${trialPillHtml || `<p class="text-sm text-base-content/60">${renewInfo}</p>`}
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${showKeepAccessBtn ? `<button class="btn btn-primary btn-sm keep-access-btn" data-trial-purchase>Keep access</button>` : ""}
            ${showManageBtn ? `<button class="btn btn-ghost btn-sm billing-btn" data-ent-id="${ent.id}">Manage</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  setHTML(list, html);

  // Bind billing buttons
  list.querySelectorAll(".billing-btn").forEach((btn) => {
    btn.addEventListener("click", openBillingPortal);
  });

  // Bind Keep access buttons for trial entitlements
  list.querySelectorAll(".keep-access-btn").forEach((btn) => {
    btn.addEventListener("click", openPurchaseModalFromTrial);
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
 * Initialize plans pagination event listeners
 */
export function initPlans(): void {
  maybeById("plans-prev")?.addEventListener("click", () => {
    const page = getPlansPage();
    if (page > 1) {
      setPlansPage(page - 1);
      renderPlans();
    }
  });

  maybeById("plans-next")?.addEventListener("click", () => {
    const entitlements = getEntitlements();
    const totalPages = Math.ceil(entitlements.length / PLANS_PAGE_SIZE);
    const page = getPlansPage();
    if (page < totalPages) {
      setPlansPage(page + 1);
      renderPlans();
    }
  });
}
