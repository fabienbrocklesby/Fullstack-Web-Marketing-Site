import type { Schema, Attribute } from '@strapi/strapi';

export interface BlocksContent extends Schema.Component {
  collectionName: 'components_blocks_contents';
  info: {
    displayName: 'Content';
    description: 'Rich text content section';
  };
  attributes: {
    title: Attribute.String;
    content: Attribute.RichText & Attribute.Required;
    layout: Attribute.Enumeration<['full-width', 'centered', 'two-column']> &
      Attribute.DefaultTo<'centered'>;
  };
}

export interface BlocksCta extends Schema.Component {
  collectionName: 'components_blocks_ctas';
  info: {
    displayName: 'Call to Action';
    description: 'Call-to-action section';
  };
  attributes: {
    title: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Ready to Get Started?'>;
    subtitle: Attribute.Text &
      Attribute.DefaultTo<'Start building your SaaS today'>;
    buttonText: Attribute.String & Attribute.DefaultTo<'Get Started Today'>;
    buttonLink: Attribute.String & Attribute.DefaultTo<'/pricing'>;
    buttonVariant: Attribute.Enumeration<
      ['primary', 'secondary', 'accent', 'ghost']
    > &
      Attribute.DefaultTo<'accent'>;
    backgroundColor: Attribute.Enumeration<
      ['primary', 'secondary', 'accent', 'base-100', 'base-200']
    > &
      Attribute.DefaultTo<'primary'>;
  };
}

export interface BlocksFeatureGrid extends Schema.Component {
  collectionName: 'components_blocks_feature_grids';
  info: {
    displayName: 'Feature Grid';
    description: 'Grid layout showing multiple features';
  };
  attributes: {
    title: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Features'>;
    subtitle: Attribute.Text;
    features: Attribute.Component<'elements.feature-item', true>;
  };
}

export interface BlocksHero extends Schema.Component {
  collectionName: 'components_blocks_heroes';
  info: {
    displayName: 'Hero';
    description: 'Hero section with title, subtitle and call-to-action';
  };
  attributes: {
    title: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Build Your SaaS Faster'>;
    subtitle: Attribute.Text &
      Attribute.DefaultTo<'A production-ready SaaS marketing site boilerplate with modern tools, affiliate tracking, and seamless payments integration.'>;
    buttonText: Attribute.String & Attribute.DefaultTo<'Get Started Now'>;
    buttonLink: Attribute.String & Attribute.DefaultTo<'/pricing'>;
    buttonVariant: Attribute.Enumeration<
      ['primary', 'secondary', 'accent', 'ghost']
    > &
      Attribute.DefaultTo<'primary'>;
    backgroundImage: Attribute.Media<'images'>;
  };
}

export interface BlocksPricing extends Schema.Component {
  collectionName: 'components_blocks_pricings';
  info: {
    displayName: 'Pricing';
    description: 'Pricing plans section';
  };
  attributes: {
    title: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Choose Your Plan'>;
    subtitle: Attribute.Text;
    plans: Attribute.Component<'elements.pricing-plan', true>;
  };
}

export interface BlocksTestimonial extends Schema.Component {
  collectionName: 'components_blocks_testimonials';
  info: {
    displayName: 'Testimonial';
    description: 'Customer testimonials section';
  };
  attributes: {
    title: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'What Our Customers Say'>;
    subtitle: Attribute.Text;
    testimonials: Attribute.Component<'elements.testimonial-item', true>;
  };
}

export interface ElementsFeatureItem extends Schema.Component {
  collectionName: 'components_elements_feature_items';
  info: {
    displayName: 'Feature Item';
    description: 'Individual feature with icon, title, description and customization options';
  };
  attributes: {
    icon: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'\uD83D\uDE80'>;
    title: Attribute.String & Attribute.Required;
    description: Attribute.Text & Attribute.Required;
    badge: Attribute.String;
    badgeStyle: Attribute.Enumeration<
      ['primary', 'secondary', 'accent', 'success', 'warning', 'info']
    > &
      Attribute.DefaultTo<'primary'>;
    link: Attribute.String;
    iconStyle: Attribute.Enumeration<['emoji', 'circle', 'square', 'none']> &
      Attribute.DefaultTo<'emoji'>;
    size: Attribute.Enumeration<['sm', 'md', 'lg']> & Attribute.DefaultTo<'md'>;
  };
}

export interface ElementsPricingPlan extends Schema.Component {
  collectionName: 'components_elements_pricing_plans';
  info: {
    displayName: 'Pricing Plan';
    description: 'Individual pricing plan with features, customization options and call-to-action';
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.DefaultTo<'Starter Plan'>;
    price: Attribute.Decimal & Attribute.Required & Attribute.DefaultTo<99>;
    interval: Attribute.Enumeration<['one-time', 'month', 'year']> &
      Attribute.DefaultTo<'one-time'>;
    features: Attribute.JSON &
      Attribute.Required &
      Attribute.DefaultTo<
        ['Complete source code', 'Basic documentation', 'Email support']
      >;
    buttonText: Attribute.String & Attribute.DefaultTo<'Get Started'>;
    featured: Attribute.Boolean & Attribute.DefaultTo<false>;
    description: Attribute.Text;
    badge: Attribute.String;
    badgeStyle: Attribute.Enumeration<
      ['primary', 'secondary', 'accent', 'success', 'warning', 'error']
    > &
      Attribute.DefaultTo<'primary'>;
  };
}

export interface ElementsTestimonialItem extends Schema.Component {
  collectionName: 'components_elements_testimonial_items';
  info: {
    displayName: 'Testimonial Item';
    description: 'Individual testimonial with quote, author and role';
  };
  attributes: {
    quote: Attribute.Text & Attribute.Required;
    author: Attribute.String & Attribute.Required;
    role: Attribute.String;
    company: Attribute.String;
    avatar: Attribute.Media<'images'>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'blocks.content': BlocksContent;
      'blocks.cta': BlocksCta;
      'blocks.feature-grid': BlocksFeatureGrid;
      'blocks.hero': BlocksHero;
      'blocks.pricing': BlocksPricing;
      'blocks.testimonial': BlocksTestimonial;
      'elements.feature-item': ElementsFeatureItem;
      'elements.pricing-plan': ElementsPricingPlan;
      'elements.testimonial-item': ElementsTestimonialItem;
    }
  }
}
