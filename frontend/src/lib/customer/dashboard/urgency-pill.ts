/**
 * TrialUrgencyPill HTML generator for runtime use
 * Mirrors the Astro component but generates HTML strings for dynamic rendering
 */

// SVG for clock icon (matches DashboardIcon "clock")
const clockIcon = (sizeClass: string) => `
  <svg class="${sizeClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke-width="2" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2" />
  </svg>
`;

interface UrgencyPillOptions {
  daysLeft: number;
  expiresLabel: string;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: {
    pill: "px-2 py-1 gap-1.5 text-xs",
    number: "text-base font-bold",
    icon: "w-3.5 h-3.5",
    dot: "w-1.5 h-1.5",
  },
  md: {
    pill: "px-3 py-1.5 gap-2 text-sm",
    number: "text-lg font-bold",
    icon: "w-4 h-4",
    dot: "w-2 h-2",
  },
};

/**
 * Generate trial urgency pill HTML
 */
export function urgencyPill(options: UrgencyPillOptions): string {
  const { daysLeft, expiresLabel, size = "md", className = "" } = options;

  const isUrgent = daysLeft <= 7;
  const isCritical = daysLeft <= 3;
  const s = sizeClasses[size];

  // Color scheme based on urgency
  const colorClasses = isCritical
    ? "bg-error/10 text-error border-error/20"
    : isUrgent
      ? "bg-warning/10 text-warning border-warning/20"
      : "bg-info/10 text-info border-info/20";

  const dotColorClasses = isCritical
    ? "bg-error"
    : isUrgent
      ? "bg-warning"
      : "bg-info";

  const dayText = daysLeft === 1 ? "day left" : "days left";

  // Pulsing dot for urgent states
  const pulseDot = isUrgent
    ? `
      <span class="relative flex items-center justify-center">
        <span class="absolute rounded-full opacity-75 motion-safe:animate-ping motion-reduce:animate-none ${dotColorClasses} ${s.dot}"></span>
        <span class="relative rounded-full ${dotColorClasses} ${s.dot}"></span>
      </span>
    `
    : "";

  return `
    <div class="inline-flex items-center rounded-full border ${colorClasses} ${s.pill} ${className}">
      ${pulseDot}
      ${clockIcon(s.icon)}
      <span class="${s.number} tabular-nums">${daysLeft}</span>
      <span class="opacity-80">${dayText}</span>
      <span class="opacity-40">·</span>
      <span class="opacity-70">Ends ${expiresLabel}</span>
    </div>
  `;
}

/**
 * Generate a compact version for tight spaces (step 4 subtext, etc)
 */
export function urgencyPillCompact(options: { daysLeft: number; isCritical?: boolean }): string {
  const { daysLeft, isCritical = daysLeft <= 3 } = options;
  const isUrgent = daysLeft <= 7;

  const colorClasses = isCritical
    ? "text-error"
    : isUrgent
      ? "text-warning"
      : "text-base-content/70";

  const dotColorClasses = isCritical
    ? "bg-error"
    : isUrgent
      ? "bg-warning"
      : "bg-info";

  const dayText = daysLeft === 1 ? "day" : "days";

  // Small pulsing dot for urgent states
  const pulseDot = isUrgent
    ? `
      <span class="relative inline-flex items-center justify-center mr-1">
        <span class="absolute w-1.5 h-1.5 rounded-full opacity-75 motion-safe:animate-ping motion-reduce:animate-none ${dotColorClasses}"></span>
        <span class="relative w-1.5 h-1.5 rounded-full ${dotColorClasses}"></span>
      </span>
    `
    : "";

  return `
    <span class="inline-flex items-center ${colorClasses}">
      ${pulseDot}
      <span class="tabular-nums font-semibold">${daysLeft}</span>&nbsp;${dayText} left${isCritical ? " · ends soon" : ""}
    </span>
  `;
}
