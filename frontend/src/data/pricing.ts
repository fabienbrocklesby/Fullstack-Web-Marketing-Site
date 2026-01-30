export type PricingOfferType = "subscription" | "contact";

export interface PricingOffer {
  name: string;
  schemaName: string;
  priceCurrency: string;
  description: string;
  ctaPath: string;
  availability:
    | "https://schema.org/InStock"
    | "https://schema.org/PreOrder"
    | "https://schema.org/OnlineOnly";
  type: PricingOfferType;
  sku?: string;
  monthlyPrice?: number;
  priceId?: string;
  tier?: "maker" | "pro";
  popular?: boolean;
}

// For schema.org priceValidUntil - empty string means no expiry date shown
export function getPriceValidUntil(): string {
  return "";
}

export const pricingOffers: PricingOffer[] = [
  {
    name: "Maker",
    schemaName: "Lightlane Maker Plan",
    sku: "lightlane-maker-subscription",
    priceCurrency: "USD",
    monthlyPrice: 12,
    priceId: "price_maker",
    tier: "maker",
    description:
      "Perfect for hobbyists and solo makers. Full access to the core import → preview → engrave pipeline.",
    ctaPath: "/customer/dashboard",
    availability: "https://schema.org/InStock",
    type: "subscription",
  },
  {
    name: "Pro",
    schemaName: "Lightlane Pro Plan",
    sku: "lightlane-pro-subscription",
    priceCurrency: "USD",
    monthlyPrice: 24,
    priceId: "price_pro",
    tier: "pro",
    popular: true,
    description:
      "For serious makers and small businesses. Includes AI Assistant, Material Test Grid, Ruida support, and priority support.",
    ctaPath: "/customer/dashboard",
    availability: "https://schema.org/InStock",
    type: "subscription",
  },
  {
    name: "Enterprise",
    schemaName: "Lightlane Enterprise Deployment",
    priceCurrency: "USD",
    description:
      "Custom rollouts for production facilities requiring governance, automation APIs, and roadmap alignment.",
    ctaPath: "/contact?subject=Enterprise%20Enquiry#contact-form",
    availability: "https://schema.org/PreOrder",
    type: "contact",
  },
  {
    name: "Education",
    schemaName: "Lightlane Education Program",
    priceCurrency: "USD",
    description:
      "Institutional access for labs, classrooms, and maker programs needing managed stations and central resources.",
    ctaPath: "/contact?subject=Education%20Access%20Enquiry#contact-form",
    availability: "https://schema.org/PreOrder",
    type: "contact",
  },
];
