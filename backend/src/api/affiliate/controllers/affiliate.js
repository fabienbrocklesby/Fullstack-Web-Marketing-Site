const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::affiliate.affiliate', ({ strapi }) => ({
  async find(ctx) {
    try {
      // Get the user from the request (auth middleware should handle this)
      const user = ctx.state.user;
      
      if (!user) {
        return ctx.unauthorized('You must be logged in to access affiliate data');
      }

      console.log('User requesting affiliates:', user.id, user.email);

      // Find affiliate by user ID or email
      const affiliates = await strapi.entityService.findMany('api::affiliate.affiliate', {
        filters: {
          $or: [
            { user: user.id },
            { email: user.email }
          ]
        },
        populate: ['purchases', 'user']
      });

      console.log('Found affiliates:', affiliates.length);

      ctx.body = {
        data: affiliates,
        meta: {
          pagination: {
            page: 1,
            pageSize: affiliates.length,
            pageCount: 1,
            total: affiliates.length
          }
        }
      };
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: 'InternalServerError',
          message: 'Failed to fetch affiliate data',
          details: process.env.NODE_ENV === 'development' ? error.stack : {}
        }
      };
    }
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const affiliate = await strapi.entityService.findOne('api::affiliate.affiliate', id, {
      populate: ['purchases', 'user']
    });

    if (!affiliate) {
      return ctx.notFound('Affiliate not found');
    }

    // Check if user owns this affiliate record
    if (affiliate.user?.id !== user.id && affiliate.email !== user.email) {
      return ctx.forbidden('You can only access your own affiliate data');
    }

    ctx.body = {
      data: affiliate,
      meta: {}
    };
  },

  async create(ctx) {
    try {
      // Get the user from the request (auth middleware should handle this)
      const user = ctx.state.user;
      
      if (!user) {
        return ctx.unauthorized('You must be logged in to create an affiliate record');
      }

      console.log('User creating affiliate:', user.id, user.email);

      // Check if user already has an affiliate record
      const existingAffiliates = await strapi.entityService.findMany('api::affiliate.affiliate', {
        filters: {
          $or: [
            { user: user.id },
            { email: user.email }
          ]
        }
      });

      if (existingAffiliates.length > 0) {
        return ctx.badRequest('User already has an affiliate record');
      }

      // Create affiliate record
      const affiliate = await strapi.entityService.create('api::affiliate.affiliate', {
        data: {
          ...ctx.request.body.data,
          user: user.id,
          email: user.email,
          name: user.username || user.email,
          code: `${user.username || user.id}${Date.now()}`,
          joinedAt: new Date(),
          isActive: true,
          totalEarnings: 0,
          commissionRate: 0.1
        },
        populate: ['purchases', 'user']
      });

      ctx.body = {
        data: affiliate,
        meta: {}
      };
    } catch (error) {
      console.error('Error creating affiliate:', error);
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: 'InternalServerError',
          message: 'Failed to create affiliate record',
          details: process.env.NODE_ENV === 'development' ? error.stack : {}
        }
      };
    }
  },

  async update(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const affiliate = await strapi.entityService.findOne('api::affiliate.affiliate', id, {
      populate: ['user']
    });

    if (!affiliate) {
      return ctx.notFound('Affiliate not found');
    }

    // Check if user owns this affiliate record
    if (affiliate.user?.id !== user.id && affiliate.email !== user.email) {
      return ctx.forbidden('You can only update your own affiliate data');
    }

    const updatedAffiliate = await strapi.entityService.update('api::affiliate.affiliate', id, {
      data: ctx.request.body.data,
      populate: ['purchases', 'user']
    });

    ctx.body = {
      data: updatedAffiliate,
      meta: {}
    };
  },

  async delete(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    const affiliate = await strapi.entityService.findOne('api::affiliate.affiliate', id, {
      populate: ['user']
    });

    if (!affiliate) {
      return ctx.notFound('Affiliate not found');
    }

    // Check if user owns this affiliate record
    if (affiliate.user?.id !== user.id && affiliate.email !== user.email) {
      return ctx.forbidden('You can only delete your own affiliate data');
    }

    const deletedAffiliate = await strapi.entityService.delete('api::affiliate.affiliate', id);

    ctx.body = {
      data: deletedAffiliate,
      meta: {}
    };
  }
}));
