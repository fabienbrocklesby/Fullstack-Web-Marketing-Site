module.exports = async ({ strapi }) => {
  // Check if strapi is properly initialized
  if (!strapi || !strapi.query) {
    console.log('Strapi not fully initialized, skipping bootstrap');
    return;
  }

  try {
    // Set up permissions for authenticated users
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    
    // Get the authenticated role
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (authenticatedRole) {
      // Enable custom affiliate routes for authenticated users
      const permissions = await strapi
        .query('plugin::users-permissions.permission')
        .findMany({
          where: {
            role: authenticatedRole.id,
            action: {
              $in: [
                'api::affiliate.affiliate.find',
                'api::affiliate.affiliate.findOne',
                'api::affiliate.affiliate.create',
                'api::affiliate.affiliate.update',
                'api::affiliate.affiliate.delete'
              ]
            }
          }
        });

      // Enable all affiliate permissions for authenticated users
      const actionsToEnable = [
        'api::affiliate.affiliate.find',
        'api::affiliate.affiliate.findOne', 
        'api::affiliate.affiliate.create',
        'api::affiliate.affiliate.update',
        'api::affiliate.affiliate.delete'
      ];

      for (const action of actionsToEnable) {
        const existingPermission = permissions.find(p => p.action === action);
        if (existingPermission) {
          await strapi.query('plugin::users-permissions.permission').update({
            where: { id: existingPermission.id },
            data: { enabled: true }
          });
        } else {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action,
              subject: null,
              properties: {},
              conditions: [],
              role: authenticatedRole.id,
              enabled: true
            }
          });
        }
      }

      console.log('✅ Affiliate permissions enabled for authenticated users');
    }
  } catch (error) {
    console.error('Error in bootstrap:', error);
  }
};
