// TypeScript interfaces for the Site Editor
export interface Page {
  id: number;
  title: string;
  slug: string;
  sections: Section<any>[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface Section<T extends Record<string, any> = Record<string, any>> {
  id: string;
  __component: string;
}

// Component-specific interfaces
export interface HeroProps {
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonVariant?: "primary" | "secondary" | "accent" | "ghost";
  backgroundImage?: any;
}

export interface FeatureGridProps {
  title: string;
  subtitle?: string;
  features: FeatureItem[];
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface TestimonialProps {
  title: string;
  subtitle?: string;
  testimonials: TestimonialItem[];
}

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: any;
}

export interface CTAProps {
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  buttonVariant?: "primary" | "secondary" | "accent" | "ghost";
  backgroundColor?:
    | "primary"
    | "secondary"
    | "accent"
    | "base-100"
    | "base-200";
}

export interface ContentProps {
  title?: string;
  content: string;
  layout?: "full-width" | "centered" | "two-column";
}

export interface PricingProps {
  title: string;
  subtitle?: string;
  plans: PricingPlan[];
}

export interface PricingPlan {
  name: string;
  price: number;
  currency?: string;
  interval?: string;
  features: string[];
  buttonText?: string;
  buttonLink?: string;
  popular?: boolean;
}

// Component metadata for editor
export interface ComponentMeta {
  uid: string;
  name: string;
  icon: string;
  description: string;
  defaultProps: any;
}

// API response interfaces
export interface APIResponse<T> {
  data: T;
  meta?: any;
}

export interface APIError {
  error: {
    status: number;
    name: string;
    message: string;
    details?: any;
  };
}

// Editor state interfaces
export interface EditorState {
  page: Page | null;
  selectedSection: string | null;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  draggedSection: string | null;
}
