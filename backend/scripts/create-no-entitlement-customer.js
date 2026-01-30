/**
 * Create a test customer without any entitlements
 * Used to test the "no active entitlement" error case
 */

async function main() {
  const strapi = require('@strapi/strapi');
  const bcrypt = require('bcrypt');
  const strapiInstance = await strapi().start();
  
  try {
    const email = 'no-entitlement@test.local';
    
    // Check if customer already exists
    const existing = await strapiInstance.entityService.findMany('api::customer.customer', { 
      filters: { email } 
    });
    
    if (existing && existing.length > 0) {
      // Update password
      const hashedPassword = await bcrypt.hash('test123!', 12);
      await strapiInstance.entityService.update('api::customer.customer', existing[0].id, {
        data: { password: hashedPassword }
      });
      console.log('Customer updated with hashed password:', existing[0].id);
      process.exit(0);
    }
    
    // Create customer - hash password first
    const hashedPassword = await bcrypt.hash('test123!', 12);
    
    const customer = await strapiInstance.entityService.create('api::customer.customer', { 
      data: { 
        email, 
        password: hashedPassword, 
        isActive: true,
        firstName: 'No',
        lastName: 'Entitlement'
      } 
    });
    
    console.log('Created customer without entitlement:', customer.id);
    console.log('Email:', email);
    console.log('Password: test123!');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

main();
