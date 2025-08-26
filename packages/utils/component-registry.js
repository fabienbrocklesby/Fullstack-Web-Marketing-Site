export const COMPONENT_REGISTRY = {
  "blocks.hero": {
    uid: "blocks.hero",
    name: "Hero Section",
    icon: "🚀",
    description: "Hero section with title, subtitle and call-to-action",
    defaultProps: {
      title: "Build Your SaaS Faster",
      subtitle: "A production-ready SaaS marketing site boilerplate with modern tools, affiliate tracking, and seamless payments integration.",
      buttonText: "Get Started Now",
      buttonLink: "/pricing",
      buttonVariant: "primary"
    }
  },
  "blocks.feature-grid": {
    uid: "blocks.feature-grid",
    name: "Feature Grid",
    icon: "📋",
    description: "Grid layout showing multiple features",
    defaultProps: {
      title: "Features",
      subtitle: "Everything you need to build your SaaS",
      features: [
        { icon: "🚀", title: "Modern Stack", description: "Built with the latest technologies" },
        { icon: "💳", title: "Stripe Integration", description: "Complete payment processing" },
        { icon: "🔗", title: "Affiliate System", description: "Built-in affiliate tracking" }
      ]
    }
  },
  "blocks.testimonial": {
    uid: "blocks.testimonial",
    name: "Testimonials",
    icon: "💬",
    description: "Customer testimonials section",
    defaultProps: {
      title: "What Our Customers Say",
      subtitle: "Trusted by developers worldwide",
      testimonials: [
        { quote: "This boilerplate saved me months of development time.", author: "John Doe", role: "CEO", company: "TechCorp" }
      ]
    }
  },
  "blocks.cta": {
    uid: "blocks.cta",
    name: "Call to Action",
    icon: "🎯",
    description: "Call-to-action section",
    defaultProps: {
      title: "Ready to Get Started?",
      subtitle: "Start building your SaaS today",
      buttonText: "Get Started Today",
      buttonLink: "/pricing",
      buttonVariant: "accent",
      backgroundColor: "primary"
    }
  },
  "blocks.content": {
    uid: "blocks.content",
    name: "Content Section",
    icon: "📝",
    description: "Rich text content section",
    defaultProps: {
      title: "Content Section",
      content: "<p>Add your content here. You can use rich text formatting.</p>",
      layout: "centered"
    }
  },
  "blocks.pricing": {
    uid: "blocks.pricing",
    name: "Pricing",
    icon: "💰",
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
          features: ["Complete source code", "Basic documentation", "Email support"],
          buttonText: "Get Starter",
          buttonLink: "/pricing"
        }
      ]
    }
  }
};

export function getComponentMeta(uid) {
  return COMPONENT_REGISTRY[uid] || null;
}

export function getAllComponentTypes() {
  return Object.values(COMPONENT_REGISTRY);
}

export function generateSectionId() {
  return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createNewSection(componentUid) {
  const meta = getComponentMeta(componentUid);
  if (!meta) throw new Error(`Unknown component type: ${componentUid}`);
  return { __component: componentUid, ...meta.defaultProps };
}
