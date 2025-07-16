// Comprehensive test data seeder for development
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

module.exports = {
  async createTestData() {
    console.log("🚀 Creating comprehensive test data...");

    try {
      // First, create test customers
      const testCustomers = await this.createTestCustomers();

      // Create test affiliates
      const testAffiliates = await this.createTestAffiliates();

      // Create Strapi users and link to affiliates
      await this.createStrapiUsers(testAffiliates);

      // Create test pages with site editor components
      await this.createTestPages();
      await this.createSiteEditorPages();

      // Create test purchases with license keys
      await this.createTestPurchases(testCustomers, testAffiliates);

      console.log("✅ Test data creation completed successfully!");
    } catch (error) {
      console.error("❌ Error creating test data:", error);
      throw error;
    }
  },

  async createTestCustomers() {
    console.log("👤 Creating test customers...");

    const testCustomers = [
      {
        email: "customer1@example.com",
        firstName: "Alice",
        lastName: "Johnson",
        password: await bcrypt.hash("password123", 12),
        isActive: true,
        emailVerified: true,
        stripeCustomerId: "cus_test_alice",
      },
      {
        email: "customer2@example.com",
        firstName: "Bob",
        lastName: "Smith",
        password: await bcrypt.hash("password123", 12),
        isActive: true,
        emailVerified: true,
        stripeCustomerId: "cus_test_bob",
      },
      {
        email: "customer3@example.com",
        firstName: "Carol",
        lastName: "Davis",
        password: await bcrypt.hash("password123", 12),
        isActive: true,
        emailVerified: false,
        stripeCustomerId: "cus_test_carol",
      },
    ];

    const createdCustomers = [];
    for (const customerData of testCustomers) {
      const existing = await strapi.entityService.findMany(
        "api::customer.customer",
        {
          filters: { email: customerData.email },
        },
      );

      if (existing.length === 0) {
        const customer = await strapi.entityService.create(
          "api::customer.customer",
          {
            data: customerData,
          },
        );
        createdCustomers.push(customer);
        console.log(
          `   ✓ Created customer: ${customerData.firstName} ${customerData.lastName}`,
        );
      } else {
        createdCustomers.push(existing[0]);
        console.log(
          `   ⚠ Customer already exists: ${customerData.firstName} ${customerData.lastName}`,
        );
      }
    }

    return createdCustomers;
  },

  async createTestAffiliates() {
    console.log("🤝 Creating test affiliates...");

    const testAffiliates = [
      {
        name: "John Marketing",
        email: "john@marketingpro.com",
        code: "john-marketing",
        commissionRate: 0.15,
        totalEarnings: 1250.5,
        isActive: true,
        joinedAt: new Date("2024-01-15"),
        notes: "High-performing affiliate specializing in tech products",
        payoutDetails: {
          method: "paypal",
          email: "john.payouts@marketingpro.com",
        },
      },
      {
        name: "Sarah Influence",
        email: "sarah@socialinfluence.com",
        code: "sarah-influence",
        commissionRate: 0.12,
        totalEarnings: 850.75,
        isActive: true,
        joinedAt: new Date("2024-02-01"),
        notes: "Social media influencer with 50K+ followers",
        payoutDetails: {
          method: "bank_transfer",
          account: "****1234",
        },
      },
      {
        name: "Tech Review Hub",
        email: "contact@techreviewhub.com",
        code: "tech-review-hub",
        commissionRate: 0.1,
        totalEarnings: 650.25,
        isActive: true,
        joinedAt: new Date("2024-03-10"),
        notes: "Popular tech review website",
        payoutDetails: {
          method: "stripe",
          account_id: "acct_test123",
        },
      },
      {
        name: "Inactive Partner",
        email: "inactive@example.com",
        code: "inactive-partner",
        commissionRate: 0.08,
        totalEarnings: 150.0,
        isActive: false,
        joinedAt: new Date("2023-12-01"),
        notes: "Former partner - account deactivated",
        payoutDetails: {
          method: "paypal",
          email: "inactive@example.com",
        },
      },
      {
        name: "Johns Test Affiliate",
        email: "johns@test.com",
        code: "johnscode",
        commissionRate: 0.15,
        totalEarnings: 0,
        isActive: true,
        joinedAt: new Date("2024-01-01"),
        notes: "Test affiliate for journey tracking",
        payoutDetails: {
          method: "paypal",
          email: "johns@test.com",
        },
      },
    ];

    const createdAffiliates = [];
    for (const affiliateData of testAffiliates) {
      const existing = await strapi.entityService.findMany(
        "api::affiliate.affiliate",
        {
          filters: { email: affiliateData.email },
        },
      );

      if (existing.length === 0) {
        const affiliate = await strapi.entityService.create(
          "api::affiliate.affiliate",
          {
            data: affiliateData,
          },
        );
        createdAffiliates.push(affiliate);
        console.log(`   ✓ Created affiliate: ${affiliateData.name}`);
      } else {
        createdAffiliates.push(existing[0]);
        console.log(`   ⚠ Affiliate already exists: ${affiliateData.name}`);
      }
    }

    console.log(`📊 Total affiliates: ${createdAffiliates.length}`);
    return createdAffiliates;
  },

  async createStrapiUsers(testAffiliates) {
    console.log("👥 Creating Strapi users and linking to affiliates...");

    try {
      // Find the Authenticated role
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } });

      if (!authenticatedRole) {
        throw new Error("Authenticated role not found");
      }

      // Create user for John Marketing
      const johnAffiliate = testAffiliates.find(
        (a) => a.email === "john@marketingpro.com",
      );

      if (johnAffiliate) {
        const existingUser = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: "john@marketingpro.com" } });

        if (!existingUser) {
          const hashedPassword = await bcrypt.hash("password123", 12);

          const user = await strapi.entityService.create(
            "plugin::users-permissions.user",
            {
              data: {
                username: "john_marketing",
                email: "john@marketingpro.com",
                password: hashedPassword,
                confirmed: true,
                blocked: false,
                role: authenticatedRole.id,
              },
            },
          );

          console.log(
            `   ✓ Created Strapi user: john@marketingpro.com (password: password123)`,
          );
        } else {
          console.log(`   ⚠ User already exists: john@marketingpro.com`);
        }
      }

      // Create additional demo users
      const demoUsers = [
        {
          username: "sarah_influence",
          email: "sarah@socialinfluence.com",
          password: "password123",
        },
        {
          username: "demo_affiliate",
          email: "demo@affiliate.com",
          password: "password123",
        },
      ];

      for (const userData of demoUsers) {
        const existing = await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email: userData.email } });

        if (!existing) {
          const hashedPassword = await bcrypt.hash(userData.password, 12);

          await strapi.entityService.create("plugin::users-permissions.user", {
            data: {
              username: userData.username,
              email: userData.email,
              password: hashedPassword,
              confirmed: true,
              blocked: false,
              role: authenticatedRole.id,
            },
          });

          console.log(
            `   ✓ Created Strapi user: ${userData.email} (password: password123)`,
          );
        } else {
          console.log(`   ⚠ User already exists: ${userData.email}`);
        }
      }
    } catch (error) {
      console.error("❌ Error creating Strapi users:", error);
      throw error;
    }
  },

  async createTestPages() {
    console.log("📄 Creating test pages...");

    const testPages = [
      {
        title: "About Us",
        slug: "about-us",
        content: `# About Our SaaS Platform

We are a cutting-edge SaaS platform dedicated to providing innovative solutions for modern businesses.

## Our Mission
To empower businesses with powerful, easy-to-use software that drives growth and efficiency.

## Our Team
We're a team of passionate developers and business experts committed to delivering exceptional value.`,
        seoTitle: "About Us - Leading SaaS Platform",
        seoDescription:
          "Learn about our mission, team, and commitment to providing innovative SaaS solutions for modern businesses.",
        seoKeywords: "saas, about us, team, mission, software solutions",
        publishedAt: new Date(),
      },
      {
        title: "Terms of Service",
        slug: "terms-of-service",
        content: `# Terms of Service

Last updated: ${new Date().toLocaleDateString()}

## Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement.

## Use License
Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only.

## Disclaimer
The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied.`,
        seoTitle: "Terms of Service - SaaS Platform",
        seoDescription:
          "Read our terms of service and usage policies for our SaaS platform.",
        seoKeywords: "terms of service, legal, policies, usage terms",
        publishedAt: new Date(),
      },
      {
        title: "Privacy Policy",
        slug: "privacy-policy",
        content: `# Privacy Policy

Last updated: ${new Date().toLocaleDateString()}

## Information We Collect
We collect information you provide directly to us, such as when you create an account or contact us.

## How We Use Your Information
We use the information we collect to provide, maintain, and improve our services.

## Information Sharing
We do not share your personal information with third parties except as described in this policy.

## Data Security
We implement appropriate technical and organizational measures to protect your personal data.`,
        seoTitle: "Privacy Policy - SaaS Platform",
        seoDescription:
          "Our privacy policy explaining how we collect, use, and protect your personal information.",
        seoKeywords:
          "privacy policy, data protection, personal information, security",
        publishedAt: new Date(),
      },
    ];

    for (const pageData of testPages) {
      const existing = await strapi.entityService.findMany("api::page.page", {
        filters: { slug: pageData.slug },
      });

      if (existing.length === 0) {
        await strapi.entityService.create("api::page.page", {
          data: pageData,
        });
        console.log(`   ✓ Created page: ${pageData.title}`);
      } else {
        console.log(`   ⚠ Page already exists: ${pageData.title}`);
      }
    }
  },

  async createSiteEditorPages() {
    console.log("🎨 Creating Site Editor demo pages with components...");

    const demoPages = [
      {
        title: "Landing Page Demo",
        slug: "landing-demo",
        seoTitle: "Marketing Landing Page - Built with Site Editor",
        seoDescription:
          "A demo marketing landing page showcasing the power of our visual site editor",
        seoKeywords: "landing page, marketing, site editor, demo",
        publishedAt: new Date(),
        sections: [
          {
            __component: "blocks.hero",
            title: "Transform Your Business Today",
            subtitle:
              "Our revolutionary SaaS platform helps you grow faster, work smarter, and achieve more than ever before.",
            buttonText: "Start Free Trial",
            buttonLink: "/signup",
            buttonVariant: "primary",
          },
          {
            __component: "blocks.feature-grid",
            title: "Why Choose Our Platform?",
            subtitle: "Everything you need to scale your business efficiently",
            features: [
              {
                title: "Lightning Fast",
                description: "Optimized for speed with cutting-edge technology",
                icon: "⚡",
              },
              {
                title: "Secure & Reliable",
                description: "Enterprise-grade security with 99.9% uptime",
                icon: "🔒",
              },
              {
                title: "Easy Integration",
                description: "Connect with your existing tools seamlessly",
                icon: "🔗",
              },
              {
                title: "24/7 Support",
                description:
                  "Get help whenever you need it from our expert team",
                icon: "💬",
              },
              {
                title: "Analytics Dashboard",
                description: "Track performance with detailed insights",
                icon: "📊",
              },
              {
                title: "Mobile Ready",
                description: "Works perfectly on all devices and platforms",
                icon: "📱",
              },
            ],
          },
          {
            __component: "blocks.cta",
            title: "Ready to Get Started?",
            subtitle:
              "Join thousands of satisfied customers who trust our platform",
            buttonText: "Start Your Free Trial",
            buttonLink: "/signup",
            buttonVariant: "accent",
            backgroundColor: "primary",
          },
        ],
      },
      {
        title: "About Our Company",
        slug: "about-company",
        seoTitle: "About Us - Leading SaaS Innovation",
        seoDescription:
          "Learn about our mission, values, and the team behind our innovative SaaS solutions",
        seoKeywords: "about us, company, team, mission, values",
        publishedAt: new Date(),
        sections: [
          {
            __component: "blocks.hero",
            title: "Building the Future of Business",
            subtitle:
              "We're passionate about creating tools that empower businesses to reach their full potential.",
            buttonText: "Meet Our Team",
            buttonLink: "#team",
            buttonVariant: "ghost",
          },
          {
            __component: "blocks.content",
            title: "Our Story",
            content: `Founded in 2020, we started with a simple mission: make powerful business tools accessible to everyone. 

What began as a small team of developers has grown into a thriving company serving thousands of businesses worldwide.

We believe that great software should be intuitive, reliable, and designed with the user in mind. Every feature we build is crafted with care and tested rigorously to ensure it meets the highest standards.`,
            layout: "centered",
          },
          {
            __component: "blocks.testimonial",
            title: "What Our Customers Say",
            subtitle: "Don't just take our word for it",
            testimonials: [
              {
                quote:
                  "This platform has completely transformed how we operate. The ease of use and powerful features have made our team more productive than ever.",
                author: "Sarah Johnson",
                position: "CEO, TechStart Inc.",
                company: "TechStart Inc.",
              },
            ],
          },
        ],
      },
      {
        title: "Pricing Plans",
        slug: "pricing-demo",
        seoTitle: "Pricing Plans - Choose Your Perfect Plan",
        seoDescription:
          "Flexible pricing plans designed to grow with your business needs",
        seoKeywords: "pricing, plans, subscription, business plans",
        publishedAt: new Date(),
        sections: [
          {
            __component: "blocks.hero",
            title: "Simple, Transparent Pricing",
            subtitle:
              "Choose the plan that's right for your business. No hidden fees, no surprises.",
          },
          {
            __component: "blocks.cta",
            title: "Questions About Pricing?",
            subtitle:
              "Our sales team is ready to help you find the perfect plan for your needs",
            buttonText: "Contact Sales",
            buttonLink: "/contact",
            buttonVariant: "ghost",
            backgroundColor: "base-200",
          },
        ],
      },
    ];

    for (const pageData of demoPages) {
      const existing = await strapi.entityService.findMany("api::page.page", {
        filters: { slug: pageData.slug },
      });

      if (existing.length === 0) {
        await strapi.entityService.create("api::page.page", {
          data: pageData,
        });
        console.log(`   ✓ Created site editor page: ${pageData.title}`);
      } else {
        console.log(`   ⚠ Site editor page already exists: ${pageData.title}`);
      }
    }
  },

  async createTestPurchases(customers, affiliates) {
    console.log("💳 Creating test purchases and license keys...");

    const productConfigs = [
      {
        name: "Starter Plan",
        priceId: "price_starter",
        amount: 29.0,
        maxActivations: 1,
      },
      {
        name: "Pro Plan",
        priceId: "price_pro",
        amount: 99.0,
        maxActivations: 3,
      },
      {
        name: "Enterprise Plan",
        priceId: "price_enterprise",
        amount: 299.0,
        maxActivations: 10,
      },
    ];

    let purchaseCounter = 1;
    const now = new Date();

    // Create various purchase scenarios
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const numPurchases = Math.floor(Math.random() * 3) + 1; // 1-3 purchases per customer

      for (let j = 0; j < numPurchases; j++) {
        const product =
          productConfigs[Math.floor(Math.random() * productConfigs.length)];
        const affiliate =
          Math.random() > 0.3
            ? affiliates[Math.floor(Math.random() * affiliates.length)]
            : null;
        const commissionAmount = affiliate
          ? product.amount * affiliate.commissionRate
          : 0;

        const purchaseData = {
          stripeSessionId: `cs_test_${purchaseCounter}`,
          amount: product.amount,
          currency: "usd",
          customerEmail: customer.email,
          priceId: product.priceId,
          customer: customer.id,
          affiliate: affiliate?.id || null,
          commissionAmount,
          commissionPaid: Math.random() > 0.5,
          metadata: {
            test: true,
            customerName: `${customer.firstName} ${customer.lastName}`,
            product: product.name,
          },
          createdAt: new Date(
            now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000,
          ), // Random date within last 90 days
        };

        const existing = await strapi.entityService.findMany(
          "api::purchase.purchase",
          {
            filters: { stripeSessionId: purchaseData.stripeSessionId },
          },
        );

        if (existing.length === 0) {
          const purchase = await strapi.entityService.create(
            "api::purchase.purchase",
            {
              data: purchaseData,
            },
          );

          // Create corresponding license key
          const licenseKey = `${product.priceId.toUpperCase()}-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;

          const isUsed = Math.random() > 0.4; // 60% chance of being used
          const isTrialLicense = Math.random() > 0.8; // 20% chance of being trial

          // Map product priceId to proper license type
          let licenseType;
          if (isTrialLicense) {
            licenseType = "trial";
          } else {
            switch (product.priceId) {
              case "price_starter":
                licenseType = "starter";
                break;
              case "price_pro":
                licenseType = "pro";
                break;
              case "price_enterprise":
                licenseType = "enterprise";
                break;
              default:
                licenseType = "paid";
            }
          }

          const licenseData = {
            key: licenseKey,
            productName: product.name,
            priceId: product.priceId,
            customer: customer.id,
            purchase: purchase.id,
            isActive: true,
            isUsed: isUsed,
            status: isUsed ? "active" : "unused",
            typ: licenseType,
            jti: isUsed ? require("uuid").v4() : null,
            machineId: isUsed
              ? require("crypto")
                  .createHash("sha256")
                  .update(`machine-${customer.id}-${Math.random()}`)
                  .digest("hex")
              : null,
            trialStart:
              isTrialLicense && isUsed
                ? new Date(
                    purchaseData.createdAt.getTime() +
                      Math.random() * 7 * 24 * 60 * 60 * 1000,
                  )
                : null,
            maxActivations: product.maxActivations,
            currentActivations: isUsed
              ? Math.floor(Math.random() * product.maxActivations)
              : 0,
            activatedAt: isUsed
              ? new Date(
                  purchaseData.createdAt.getTime() +
                    Math.random() * 7 * 24 * 60 * 60 * 1000,
                )
              : null,
            expiresAt: new Date(
              purchaseData.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000,
            ), // 1 year from purchase
            deviceInfo: isUsed
              ? {
                  os: ["Windows 11", "macOS Ventura", "Ubuntu 22.04"][
                    Math.floor(Math.random() * 3)
                  ],
                  browser: ["Chrome", "Firefox", "Safari", "Edge"][
                    Math.floor(Math.random() * 4)
                  ],
                  ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
                  userAgent: "Mozilla/5.0 (Test Device) TestBrowser/1.0",
                }
              : null,
          };

          await strapi.entityService.create("api::license-key.license-key", {
            data: licenseData,
          });

          console.log(
            `   ✓ Created purchase ${purchaseData.stripeSessionId} for ${customer.firstName} (${product.name})`,
          );
          console.log(`   ✓ Created license key: ${licenseKey}`);
        }

        purchaseCounter++;
      }
    }

    console.log("💡 Demo credentials:");
    console.log("   Customer Login: customer1@example.com / password123");
    console.log("   Customer Login: customer2@example.com / password123");
    console.log("   Customer Login: customer3@example.com / password123");

    // Create some standalone license keys for JWT portal testing
    await this.createStandaloneLicenseKeys();
  },

  async createStandaloneLicenseKeys() {
    console.log(
      "🔑 Creating standalone license keys for JWT portal testing...",
    );

    const testLicenseKeys = [
      {
        key: "TRIAL-CNC-001-DEMO",
        productName: "CNC Pro Trial",
        priceId: "trial_cnc_pro",
        typ: "trial",
        status: "unused",
        maxActivations: 1,
      },
      {
        key: "PAID-CNC-002-DEMO",
        productName: "CNC Pro License",
        priceId: "price_cnc_pro",
        typ: "paid",
        status: "unused",
        maxActivations: 3,
      },
      {
        key: "PAID-CNC-003-ACTIVE",
        productName: "CNC Standard",
        priceId: "price_cnc_standard",
        typ: "paid",
        status: "active",
        maxActivations: 1,
        jti: require("uuid").v4(),
        machineId: require("crypto")
          .createHash("sha256")
          .update("demo-machine-001")
          .digest("hex"),
        activatedAt: new Date(),
      },
    ];

    for (const licenseData of testLicenseKeys) {
      // Check if license key already exists
      const existing = await strapi.entityService.findMany(
        "api::license-key.license-key",
        {
          filters: { key: licenseData.key },
        },
      );

      if (existing.length === 0) {
        await strapi.entityService.create("api::license-key.license-key", {
          data: {
            ...licenseData,
            isActive: true,
            isUsed: licenseData.status === "active",
            currentActivations: licenseData.status === "active" ? 1 : 0,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          },
        });
        console.log(
          `   ✓ Created test license: ${licenseData.key} (${licenseData.typ})`,
        );
      } else {
        console.log(`   ⚠ License already exists: ${licenseData.key}`);
      }
    }

    console.log("🔑 Test license keys for JWT portal:");
    console.log("   Trial License: TRIAL-CNC-001-DEMO (unused, 7-day trial)");
    console.log("   Paid License: PAID-CNC-002-DEMO (unused, 3 activations)");
    console.log(
      "   Active License: PAID-CNC-003-ACTIVE (active on demo-machine-001)",
    );
  },

  async clearAllData() {
    console.log("🧹 Clearing all existing data...");

    const entities = [
      "api::license-key.license-key",
      "api::purchase.purchase",
      "api::customer.customer",
      "api::affiliate.affiliate",
      "api::page.page",
    ];

    for (const entity of entities) {
      try {
        const items = await strapi.entityService.findMany(entity);
        for (const item of items) {
          await strapi.entityService.delete(entity, item.id);
        }
        console.log(`   ✓ Cleared ${entity}`);
      } catch (error) {
        console.log(`   ⚠ Could not clear ${entity}:`, error.message);
      }
    }
  },
};
