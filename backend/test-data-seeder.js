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

      // Create test pages
      await this.createTestPages();

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

    return createdAffiliates;
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
