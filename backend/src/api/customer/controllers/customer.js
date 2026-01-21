const { createCoreController } = require("@strapi/strapi").factories;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  normalizeEmail,
  linkPendingLicensesToCustomer,
} = require("../../../utils/license-linker");

const getSanitizedCustomer = async (strapi, customerId) => {
  if (!customerId) {
    return null;
  }

  const customer = await strapi.entityService.findOne(
    "api::customer.customer",
    customerId,
    {
      populate: ["purchases", "licenseKeys"],
    },
  );

  if (!customer) {
    return null;
  }

  // eslint-disable-next-line no-unused-vars
  const { password, ...customerData } = customer;
  return customerData;
};

const getCustomerEmail = async (strapi, customerId) => {
  if (!customerId) {
    return null;
  }

  const customer = await strapi.entityService.findOne(
    "api::customer.customer",
    customerId,
    { fields: ["email"] },
  );

  return customer?.email ? normalizeEmail(customer.email) : null;
};

module.exports = createCoreController(
  "api::customer.customer",
  ({ strapi }) => ({
    // Customer registration (public signup)
    async register(ctx) {
      try {
        const { email, password, firstName, lastName } = ctx.request.body;

        if (!email || !password || !firstName || !lastName) {
          return ctx.badRequest(
            "Email, password, first name, and last name are required",
          );
        }

        // Check if customer already exists
        const existingCustomer = await strapi.entityService.findMany(
          "api::customer.customer",
          {
            filters: { email: email.toLowerCase() },
          },
        );

        if (existingCustomer.length > 0) {
          return ctx.badRequest("Customer already exists with this email");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create customer
        const customer = await strapi.entityService.create(
          "api::customer.customer",
          {
            data: {
              email: email.toLowerCase(),
              password: hashedPassword,
              firstName,
              lastName,
              isActive: true,
              emailVerified: false,
            },
          },
        );

        await linkPendingLicensesToCustomer(strapi, customer.id, customer.email);

        // Generate JWT token
        const token = jwt.sign(
          {
            id: customer.id,
            email: customer.email,
            type: "customer",
          },
          process.env.JWT_SECRET || "default-secret",
          { expiresIn: "7d" },
        );

        // Remove password from response
        // eslint-disable-next-line no-unused-vars
        const { password: _, ...customerData } = customer;

        const hydratedCustomer =
          (await getSanitizedCustomer(strapi, customer.id)) || customerData;

        ctx.body = {
          customer: hydratedCustomer,
          token,
        };
      } catch (error) {
        console.error("Customer registration error:", error);
        ctx.status = 500;
        ctx.body = { error: "Registration failed" };
      }
    },

    // Customer login
    async login(ctx) {
      try {
        const { email, password } = ctx.request.body;

        if (!email || !password) {
          return ctx.badRequest("Email and password are required");
        }

        // Find customer
        const customers = await strapi.entityService.findMany(
          "api::customer.customer",
          {
            filters: { email: email.toLowerCase() },
          },
        );

        if (customers.length === 0) {
          return ctx.badRequest("Invalid credentials");
        }

        const customer = customers[0];

        // Check if customer is active
        if (!customer.isActive) {
          return ctx.badRequest("Account is deactivated");
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          password,
          customer.password,
        );

        if (!isPasswordValid) {
          return ctx.badRequest("Invalid credentials");
        }

        await linkPendingLicensesToCustomer(strapi, customer.id, customer.email);

        // eslint-disable-next-line no-unused-vars
        const { password: __, ...customerData } = customer;

        const hydratedCustomer =
          (await getSanitizedCustomer(strapi, customer.id)) || customerData;

        // Generate JWT token
        const token = jwt.sign(
          {
            id: customer.id,
            email: customer.email,
            type: "customer",
          },
          process.env.JWT_SECRET || "default-secret",
          { expiresIn: "7d" },
        );

        ctx.body = {
          customer: hydratedCustomer,
          token,
        };
      } catch (error) {
        console.error("Customer login error:", error);
        ctx.status = 500;
        ctx.body = { error: "Login failed" };
      }
    },

    // Get customer profile
    async me(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const email =
          ctx.state.customer?.email || (await getCustomerEmail(strapi, customerId));

        await linkPendingLicensesToCustomer(strapi, customerId, email);

        const customer = await strapi.entityService.findOne(
          "api::customer.customer",
          customerId,
          {
            populate: ["purchases", "licenseKeys"],
          },
        );

        if (!customer) {
          return ctx.notFound("Customer not found");
        }

        // Remove password from response
        // eslint-disable-next-line no-unused-vars
        const { password: _, ...customerData } = customer;

        ctx.body = { customer: customerData };
      } catch (error) {
        console.error("Get customer profile error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to get profile" };
      }
    },

    // Update customer profile
    async updateProfile(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const { firstName, lastName, email } = ctx.request.body;

        // If email is being updated, check if it's already taken
        if (email && email !== ctx.state.customer.email) {
          const existingCustomer = await strapi.entityService.findMany(
            "api::customer.customer",
            {
              filters: { email: email.toLowerCase() },
            },
          );

          if (existingCustomer.length > 0) {
            return ctx.badRequest("Email already taken");
          }
        }

        const updatedCustomer = await strapi.entityService.update(
          "api::customer.customer",
          customerId,
          {
            data: {
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              email: email ? email.toLowerCase() : undefined,
            },
          },
        );

        await linkPendingLicensesToCustomer(
          strapi,
          customerId,
          updatedCustomer.email,
        );

        // eslint-disable-next-line no-unused-vars
        const { password: __, ...customerData } = updatedCustomer;

        const hydratedCustomer =
          (await getSanitizedCustomer(strapi, customerId)) || customerData;

        ctx.body = { customer: hydratedCustomer };
      } catch (error) {
        console.error("Update customer profile error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to update profile" };
      }
    },

    // Change password
    async changePassword(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const { currentPassword, newPassword } = ctx.request.body;

        if (!currentPassword || !newPassword) {
          return ctx.badRequest(
            "Current password and new password are required",
          );
        }

        const customer = await strapi.entityService.findOne(
          "api::customer.customer",
          customerId,
        );

        // Verify current password
        const isPasswordValid = await bcrypt.compare(
          currentPassword,
          customer.password,
        );

        if (!isPasswordValid) {
          return ctx.badRequest("Current password is incorrect");
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        await strapi.entityService.update(
          "api::customer.customer",
          customerId,
          {
            data: {
              password: hashedNewPassword,
            },
          },
        );

        ctx.body = { message: "Password changed successfully" };
      } catch (error) {
        console.error("Change password error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to change password" };
      }
    },

    // Get customer entitlements
    async entitlements(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        // Fetch entitlements for this customer with linked license-key
        // Exclude archived entitlements from the list
        const entitlements = await strapi.entityService.findMany(
          "api::entitlement.entitlement",
          {
            filters: {
              customer: customerId,
              $or: [
                { isArchived: { $null: true } },
                { isArchived: false },
              ],
            },
            populate: ["licenseKey"],
            // Sort: isLifetime desc, status active first, expiresAt desc, createdAt desc
            sort: { createdAt: "desc" },
          }
        );

        // Apply additional sorting in code for complex sort logic
        // Priority: isLifetime=true first, then active status, then by expiresAt, then createdAt
        const sortedEntitlements = [...entitlements].sort((a, b) => {
          // 1. isLifetime: true comes first
          if (a.isLifetime && !b.isLifetime) return -1;
          if (!a.isLifetime && b.isLifetime) return 1;

          // 2. status: active comes first
          const statusOrder = { active: 0, inactive: 1, expired: 2, canceled: 3 };
          const aStatusOrder = statusOrder[a.status] ?? 99;
          const bStatusOrder = statusOrder[b.status] ?? 99;
          if (aStatusOrder !== bStatusOrder) return aStatusOrder - bStatusOrder;

          // 3. expiresAt: later dates first (null means no expiry, treat as far future)
          const aExpires = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
          const bExpires = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
          if (aExpires !== bExpires) return bExpires - aExpires;

          // 4. createdAt: newer first
          const aCreated = new Date(a.createdAt).getTime();
          const bCreated = new Date(b.createdAt).getTime();
          return bCreated - aCreated;
        });

        // Temporary dedupe pass: keep first occurrence per unique key
        // Key: tier|isLifetime|status|expiresAt
        // This is a safety net - real cleanup should be done via dedupe script
        const seen = new Set();
        const dedupedEntitlements = sortedEntitlements.filter((e) => {
          const key = `${e.tier}|${e.isLifetime}|${e.status}|${e.expiresAt || ""}`;
          if (seen.has(key)) {
            console.log(`[Entitlements] Filtering duplicate: id=${e.id} key=${key}`);
            return false;
          }
          seen.add(key);
          return true;
        });

        // Sanitize output - return only public-facing fields
        // In development, include additional debug fields
        const isDev = process.env.NODE_ENV === "development";
        
        const sanitizedEntitlements = dedupedEntitlements.map((e) => ({
          id: e.id,
          tier: e.tier,
          status: e.status,
          isLifetime: e.isLifetime,
          expiresAt: e.expiresAt,
          maxDevices: e.maxDevices,
          source: e.source,
          createdAt: e.createdAt,
          // Stage 5.5: Compute leaseRequired server-side
          // Lifetime entitlements NEVER require lease refresh
          // Subscriptions always require lease refresh
          leaseRequired: !e.isLifetime,
          // Subscription-specific fields for dashboard display
          currentPeriodEnd: e.currentPeriodEnd || null,
          cancelAtPeriodEnd: e.cancelAtPeriodEnd || false,
          // Include the linked license-key info (1:1 relationship)
          licenseKey: e.licenseKey ? {
            id: e.licenseKey.id,
            key: e.licenseKey.key,
            typ: e.licenseKey.typ,
            isActive: e.licenseKey.isActive,
          } : null,
          // Debug fields (only in development)
          ...(isDev ? {
            stripeSubscriptionId: e.stripeSubscriptionId || null,
            stripeCustomerId: e.stripeCustomerId || null,
            stripePriceId: e.stripePriceId || null,
          } : {}),
          // Note: tier is feature tier (maker/pro/education/enterprise)
          // isLifetime=true means "founders lifetime" billing, leaseRequired=false
        }));

        ctx.body = {
          entitlements: sanitizedEntitlements,
          meta: {
            total: sanitizedEntitlements.length,
            hasActiveEntitlement: sanitizedEntitlements.some(
              (e) => e.status === "active"
            ),
          },
        };
      } catch (error) {
        console.error("Get entitlements error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch entitlements" };
      }
    },

    // Get primary/best entitlement for subscription UI card
    async primaryEntitlement(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        // Fetch all entitlements for this customer (excluding archived)
        const entitlements = await strapi.entityService.findMany(
          "api::entitlement.entitlement",
          {
            filters: {
              customer: customerId,
              $or: [
                { isArchived: { $null: true } },
                { isArchived: false },
              ],
            },
            sort: { createdAt: "desc" },
          }
        );

        if (!entitlements || entitlements.length === 0) {
          ctx.body = {
            hasEntitlement: false,
            tier: null,
            status: null,
            isLifetime: false,
            expiresAt: null,
            currentPeriodEnd: null,
            maxDevices: null,
            cancelAtPeriodEnd: false,
          };
          return;
        }

        // Find the "best" entitlement:
        // 1. Prefer active over inactive/expired/canceled
        // 2. Among active, prefer lifetime
        // 3. Among active non-lifetime, prefer one with furthest expiry
        const activeEntitlements = entitlements.filter((e) => e.status === "active");
        
        let primary = null;
        
        if (activeEntitlements.length > 0) {
          // First check for lifetime
          const lifetime = activeEntitlements.find((e) => e.isLifetime === true);
          if (lifetime) {
            primary = lifetime;
          } else {
            // Sort by currentPeriodEnd or expiresAt (furthest first)
            const sorted = activeEntitlements.sort((a, b) => {
              const dateA = a.currentPeriodEnd || a.expiresAt || "";
              const dateB = b.currentPeriodEnd || b.expiresAt || "";
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });
            primary = sorted[0];
          }
        } else {
          // No active entitlements, return the most recent one
          primary = entitlements[0];
        }

        ctx.body = {
          hasEntitlement: true,
          tier: primary.tier || null,
          status: primary.status || null,
          isLifetime: primary.isLifetime || false,
          expiresAt: primary.expiresAt || null,
          currentPeriodEnd: primary.currentPeriodEnd || null,
          maxDevices: primary.maxDevices || null,
          cancelAtPeriodEnd: primary.cancelAtPeriodEnd || false,
          source: primary.source || null,
        };
      } catch (error) {
        console.error("Get primary entitlement error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch entitlement" };
      }
    },

    // Get customer's registered devices and their entitlement bindings
    // GET /api/customers/me/devices
    async devices(ctx) {
      try {
        const customerId = ctx.state.customer?.id;

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        // Fetch all devices for this customer
        const devices = await strapi.entityService.findMany(
          "api::device.device",
          {
            filters: {
              customer: customerId,
            },
            populate: ["entitlement"],
            sort: { lastSeenAt: "desc" },
          }
        );

        // Sanitize output
        const sanitizedDevices = devices.map((d) => ({
          id: d.id,
          deviceId: d.deviceId,
          name: d.deviceName || null,
          platform: d.platform || null,
          lastSeen: d.lastSeenAt || null,
          createdAt: d.createdAt,
          // Binding info
          entitlement: d.entitlement ? {
            id: d.entitlement.id,
            tier: d.entitlement.tier,
            status: d.entitlement.status,
            isLifetime: d.entitlement.isLifetime || false,
          } : null,
          isActivated: !!d.entitlement,
        }));

        ctx.body = {
          devices: sanitizedDevices,
          meta: {
            total: sanitizedDevices.length,
            activatedCount: sanitizedDevices.filter((d) => d.isActivated).length,
          },
        };
      } catch (error) {
        console.error("Get devices error:", error);
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch devices" };
      }
    },

    // Create Stripe billing portal session
    async billingPortal(ctx) {
      try {
        const customerId = ctx.state.customer?.id;
        const { returnUrl } = ctx.request.body || {};

        if (!customerId) {
          return ctx.unauthorized("Not authenticated");
        }

        const customer = await strapi.entityService.findOne(
          "api::customer.customer",
          customerId,
        );

        if (!customer) {
          return ctx.notFound("Customer not found");
        }

        // Check if customer has a Stripe customer ID
        if (!customer.stripeCustomerId) {
          // Check if they have any entitlements - if lifetime only, no billing portal needed
          const entitlements = await strapi.entityService.findMany(
            "api::entitlement.entitlement",
            {
              filters: {
                customer: customerId,
                status: "active",
                $or: [
                  { isArchived: { $null: true } },
                  { isArchived: false },
                ],
              },
            }
          );

          const hasOnlyLifetime = entitlements.length > 0 && 
            entitlements.every((e) => e.isLifetime === true);

          if (hasOnlyLifetime) {
            ctx.status = 400;
            ctx.body = {
              error: "No billing portal available",
              message: "Lifetime accounts do not have recurring billing to manage.",
            };
            return;
          }

          ctx.status = 400;
          ctx.body = {
            error: "No Stripe customer found",
            message: "You must have an active subscription to access the billing portal.",
          };
          return;
        }

        // Create Stripe billing portal session
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4321";
        
        const session = await stripe.billingPortal.sessions.create({
          customer: customer.stripeCustomerId,
          return_url: returnUrl || `${frontendUrl}/customer/dashboard`,
        });

        ctx.body = {
          url: session.url,
        };
      } catch (error) {
        console.error("Billing portal error:", error);
        ctx.status = 500;
        ctx.body = {
          error: "Failed to create billing portal session",
          message: error.message,
        };
      }
    },
  }),
);
