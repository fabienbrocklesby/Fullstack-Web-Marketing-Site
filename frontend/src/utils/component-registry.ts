import type { ComponentMeta } from "../types/site-editor";

// Component registry mapping Strapi UIDs to local components
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = {
  "blocks.hero": {
    uid: "blocks.hero",
    name: "Hero Section",
    icon: "rocket",
    description: "Hero section with title, subtitle and call-to-action",
    defaultProps: {
      title: "Build Your SaaS Faster",
      subtitle:
        "A production-ready SaaS marketing site boilerplate with modern tools, affiliate tracking, and seamless payments integration.",
      buttonText: "Get Started Now",
      buttonLink: "/pricing",
      buttonVariant: "primary",
    },
  },
  "blocks.feature-grid": {
    uid: "blocks.feature-grid",
    name: "Feature Grid",
    icon: "layout-grid",
    description: "Grid layout showing multiple features",
    defaultProps: {
      title: "Features",
      subtitle: "Everything you need to build your SaaS",
      features: [
        {
          icon: "rocket",
          title: "Modern Stack",
          description: "Built with the latest technologies",
        },
        {
          icon: "credit-card",
          title: "Stripe Integration",
          description: "Complete payment processing",
        },
        {
          icon: "link",
          title: "Affiliate System",
          description: "Built-in affiliate tracking",
        },
      ],
    },
  },
  "blocks.testimonial": {
    uid: "blocks.testimonial",
    name: "Testimonials",
    icon: "message-square",
    description: "Customer testimonials section",
    defaultProps: {
      title: "What Our Customers Say",
      subtitle: "Trusted by developers worldwide",
      testimonials: [
        {
          quote: "This boilerplate saved me months of development time.",
          author: "John Doe",
          role: "CEO",
          company: "TechCorp",
        },
      ],
    },
  },
  "blocks.cta": {
    uid: "blocks.cta",
    name: "Call to Action",
    icon: "target",
    description: "Call-to-action section",
    defaultProps: {
      title: "Ready to Get Started?",
      subtitle: "Start building your SaaS today",
      buttonText: "Get Started Today",
      buttonLink: "/pricing",
      buttonVariant: "accent",
      backgroundColor: "primary",
    },
  },
  "blocks.content": {
    uid: "blocks.content",
    name: "Content Section",
    icon: "file-text",
    description: "Rich text content section",
    defaultProps: {
      title: "Content Section",
      content:
        "<p>Add your content here. You can use rich text formatting.</p>",
      layout: "centered",
    },
  },
  "blocks.pricing": {
    uid: "blocks.pricing",
    name: "Pricing",
    icon: "coins",
    description: "Pricing plans section",
    defaultProps: {
      title: "Choose Your Plan",
      subtitle: "Select the perfect plan for your needs",
      plans: [
        {
          name: "Starter",
          price: 99,
          currency: "USD",
          interval: "one-time",
          features: [
            "Complete source code",
            "Basic documentation",
            "Email support",
          ],
          buttonText: "Get Starter",
          buttonLink: "/pricing",
        },
      ],
    },
  },
};

/**
 * Get component metadata by UID
 */
export function getComponentMeta(uid: string): ComponentMeta | null {
  return COMPONENT_REGISTRY[uid] || null;
}

/**
 * Get all available component types
 */
export function getAllComponentTypes(): ComponentMeta[] {
  return Object.values(COMPONENT_REGISTRY);
}

/**
 * Generate a unique ID for a new section
 */
export function generateSectionId(): string {
  return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new section with default props
 */
export function createNewSection(componentUid: string): any {
  const meta = getComponentMeta(componentUid);
  if (!meta) {
    throw new Error(`Unknown component type: ${componentUid}`);
  }

  return {
    __component: componentUid,
    ...meta.defaultProps,
  };
}
