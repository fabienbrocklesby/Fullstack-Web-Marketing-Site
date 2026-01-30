/**
 * Badge HTML helper for dynamically generated badges in TypeScript.
 * Mirrors the ResponsiveBadge.astro component for consistency.
 */

export type BadgeVariant = "accent" | "success" | "warning" | "neutral" | "ghost" | "primary" | "info" | "error" | "outline";
export type BadgeSize = "xs" | "sm" | "md";

interface BadgeOptions {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  extraClasses?: string;
}

/**
 * Generate a badge HTML string with consistent responsive-safe classes.
 * Use this for all dynamically generated badges in the dashboard.
 */
export function badge(options: BadgeOptions): string {
  const { text, variant = "neutral", size = "sm", outline = false, extraClasses = "" } = options;

  const classes = [
    "badge",
    `badge-${size}`,
    outline ? "badge-outline" : "",
    `badge-${variant}`,
    // Responsive safety classes (match ResponsiveBadge.astro)
    "whitespace-nowrap",
    "h-auto",
    "py-0.5",
    "leading-tight",
    "shrink-0",
    extraClasses,
  ]
    .filter(Boolean)
    .join(" ");

  return `<span class="${classes}">${text}</span>`;
}

/**
 * Shorthand for common badge variants
 */
export const badges = {
  success: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "success", size }),
  warning: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "warning", size }),
  info: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "info", size }),
  error: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "error", size }),
  ghost: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "ghost", size }),
  accent: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "accent", size }),
  primary: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "primary", size }),
  outlineSuccess: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "success", size, outline: true }),
  outlineInfo: (text: string, size: BadgeSize = "sm") => badge({ text, variant: "info", size, outline: true }),
};
