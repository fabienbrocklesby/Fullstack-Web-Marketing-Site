export type PricingOfferType = "fixed" | "contact";

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
  price?: number;
  priceId?: string;
}

export const FOUNDERS_OFFER_DEADLINE = "2025-10-31T23:59:59Z";

export const pricingOffers: PricingOffer[] = [
  {
    name: "Hobbyist",
    schemaName: "Lightlane Hobbyist Plan",
    sku: "lightlane-hobbyist-lifetime",
    priceCurrency: "USD",
    price: 100,
    priceId: "price_starter",
    description:
      "One-time lifetime license for solo makers who need the core import → preview → engrave pipeline with offline activation.",
    ctaPath: "/pricing",
    availability: "https://schema.org/InStock",
    type: "fixed",
  },
  {
    name: "Pro",
    schemaName: "Lightlane Pro Plan",
    sku: "lightlane-pro-lifetime",
    priceCurrency: "USD",
    price: 200,
    priceId: "price_pro",
    description:
      "Adds Ruida controller support, premium templates, device streaming enhancements, and priority support.",
    ctaPath: "/pricing",
    availability: "https://schema.org/InStock",
    type: "fixed",
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
