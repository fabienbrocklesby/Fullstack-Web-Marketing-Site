/**
 * Unified FAQ entries for site-wide consistency.
 *
 * IMPORTANT: When editing, ensure all pages using these FAQs stay in sync.
 * Used by: index.astro, pricing.astro (and their schema.org structured data)
 *
 * Controller support truth:
 * - G-code / GRBL: fully supported now
 * - Ruida: included in Pro as early alpha (not fully done)
 * - K40 / M2-Nano: on roadmap (no timing promises)
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

/**
 * Core FAQs - displayed on homepage and pricing page
 */
export const coreFaq: FaqEntry[] = [
  {
    id: "free-trial",
    question: "How does the free trial work?",
    answer:
      "Create a free account and download the app. Your 14-day trial starts automatically with full access to all features. No credit card required. When the trial ends, choose a plan or your projects pause until you subscribe.",
  },
  {
    id: "manage-billing",
    question: "Where do I manage my plan and billing?",
    answer:
      "Everything lives in your Light Lane Portal. Log in at lightlane.app/customer/dashboard to view your subscription, update payment details, switch plans, or download invoices.",
  },
  {
    id: "cancel-anytime",
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel from your dashboard whenever you like. You keep access until the end of your billing period - no surprise charges, no questions asked.",
  },
  {
    id: "controllers-supported",
    question: "Which controllers are supported?",
    answer:
      "G-code and GRBL controllers are fully supported on all plans. Ruida support is included in Pro as an early alpha - functional but still being refined. K40 / M2-Nano is on the roadmap.",
  },
  {
    id: "ruida-status",
    question: "Is Ruida fully supported?",
    answer:
      "Ruida is available in Pro as early alpha. Core features work, but some advanced operations are still being polished. We ship updates regularly and prioritize feedback from Pro users.",
  },
  {
    id: "ai-features",
    question: "What does the AI do?",
    answer:
      "The AI Assistant (Pro plan) tunes your image for engraving-adjusting contrast, tone, and color balance for how lasers interact with materials. Tell it your material, laser, and desired look, and it suggests power, speed, and pass settings as a starting point. You stay in control of the final result.",
  },
  {
    id: "manual-control",
    question: "Do I still get manual control?",
    answer:
      "Absolutely. AI suggestions are optional hints. You have full manual control over every parameter - power, speed, passes, layers, and device settings. Override or ignore suggestions whenever you want.",
  },
];

/**
 * Homepage FAQ subset - focused on general usage questions
 */
export const homepageFaq: FaqEntry[] = [
  coreFaq.find((f) => f.id === "free-trial")!,
  coreFaq.find((f) => f.id === "controllers-supported")!,
  coreFaq.find((f) => f.id === "ruida-status")!,
  coreFaq.find((f) => f.id === "ai-features")!,
  coreFaq.find((f) => f.id === "manual-control")!,
];

/**
 * Pricing page FAQ subset - focused on billing/subscription questions
 */
export const pricingFaq: FaqEntry[] = [
  coreFaq.find((f) => f.id === "free-trial")!,
  coreFaq.find((f) => f.id === "manage-billing")!,
  coreFaq.find((f) => f.id === "cancel-anytime")!,
  coreFaq.find((f) => f.id === "controllers-supported")!,
  coreFaq.find((f) => f.id === "ruida-status")!,
];

/**
 * Extended FAQ for dedicated FAQ page or help center (if needed)
 */
export const allFaq: FaqEntry[] = coreFaq;
