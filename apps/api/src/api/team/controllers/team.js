const bcrypt = require("bcrypt");

module.exports = {
  async register(ctx) {
    try {
      const { username, email, password } = ctx.request.body;

      if (!username || !email || !password) {
        return ctx.badRequest("Username, email, and password are required");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest("Invalid email format");
      }

      // Validate password strength
      if (password.length < 6) {
        return ctx.badRequest("Password must be at least 6 characters long");
      }

      // Check if user already exists
      const existingUser = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            $or: [
              { email: email.toLowerCase() },
              { username: username.toLowerCase() },
            ],
          },
        });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          return ctx.badRequest("Email already taken");
        }
        if (existingUser.username === username.toLowerCase()) {
          return ctx.badRequest("Username already taken");
        }
      }

      // Get the authenticated role
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } });

      if (!authenticatedRole) {
        return ctx.internalServerError("Authenticated role not found");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user with blocked: true (requires admin approval)
      const user = await strapi.entityService.create(
        "plugin::users-permissions.user",
        {
          data: {
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
            confirmed: true,
            blocked: true, // User is blocked by default until admin approval
            role: authenticatedRole.id,
          },
        },
      );

      console.log(
        `🔒 New team registration: ${email} (blocked, awaiting approval)`,
      );

      // Return success without sensitive data
      ctx.body = {
        message:
          "Registration successful. Your account is pending admin approval.",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          blocked: user.blocked,
        },
      };
    } catch (error) {
      console.error("Team registration error:", error);
      ctx.status = 500;
      ctx.body = { error: "Registration failed" };
    }
  },

  async login(ctx) {
    try {
      const { identifier, password } = ctx.request.body;

      if (!identifier || !password) {
        return ctx.badRequest("Email/username and password are required");
      }

      // Find user by email or username
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: {
            $or: [
              { email: identifier.toLowerCase() },
              { username: identifier.toLowerCase() },
            ],
          },
          populate: ["role"],
        });

      if (!user) {
        return ctx.badRequest("Invalid credentials");
      }

      // Check if user is blocked
      if (user.blocked) {
        return ctx.badRequest(
          "Account is pending admin approval. Please contact an administrator.",
        );
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return ctx.badRequest("Invalid credentials");
      }

      // Generate JWT token using Strapi's built-in method
      const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
        id: user.id,
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      ctx.body = {
        jwt,
        user: userWithoutPassword,
      };
    } catch (error) {
      console.error("Team login error:", error);
      ctx.status = 500;
      ctx.body = { error: "Login failed" };
    }
  },
};
