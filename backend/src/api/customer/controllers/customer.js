const { createCoreController } = require("@strapi/strapi").factories;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
        const { password: _, ...customerData } = customer;

        ctx.body = {
          customer: customerData,
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
        const { password: _, ...customerData } = customer;

        ctx.body = {
          customer: customerData,
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

        // Remove password from response
        const { password: _, ...customerData } = updatedCustomer;

        ctx.body = { customer: customerData };
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
  }),
);
