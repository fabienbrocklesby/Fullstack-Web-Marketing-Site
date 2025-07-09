#!/usr/bin/env node

/**
 * Demo Data Verification Script
 * 
 * This script verifies that demo data was created successfully
 */

const path = require('path');

async function verifyDemoData() {
  console.log('🔍 Verifying Demo Data Setup');
  console.log('=============================');
  
  const backendPath = path.join(__dirname, 'backend');
  
  // Change to backend directory
  process.chdir(backendPath);
  
  try {
    // Import Strapi from the backend directory
    const strapiFactory = require('./backend/node_modules/@strapi/strapi');
    
    // Load Strapi from backend directory
    const app = await strapiFactory().load();
    
    console.log('✅ Strapi connected successfully');
    
    // Make strapi globally available
    global.strapi = app;
    
    // Check customers
    const customers = await strapi.entityService.findMany('api::customer.customer');
    console.log(`👤 Customers: ${customers.length} found`);
    
    // Check affiliates
    const affiliates = await strapi.entityService.findMany('api::affiliate.affiliate');
    console.log(`🤝 Affiliates: ${affiliates.length} found`);
    
    // Check purchases
    const purchases = await strapi.entityService.findMany('api::purchase.purchase');
    console.log(`💳 Purchases: ${purchases.length} found`);
    
    // Check license keys
    const licenseKeys = await strapi.entityService.findMany('api::license-key.license-key');
    console.log(`🔐 License Keys: ${licenseKeys.length} found`);
    
    // Check pages
    const pages = await strapi.entityService.findMany('api::page.page');
    console.log(`📄 Pages: ${pages.length} found`);
    
    console.log('');
    
    if (customers.length >= 3 && affiliates.length >= 4 && purchases.length > 0 && licenseKeys.length > 0) {
      console.log('🎉 Demo data setup is complete and verified!');
      console.log('');
      console.log('🔑 Ready to test with these demo credentials:');
      console.log('   • customer1@example.com / password123');
      console.log('   • customer2@example.com / password123'); 
      console.log('   • customer3@example.com / password123');
      console.log('');
      console.log('🌐 Access your demo at:');
      console.log('   • Frontend: http://localhost:4321');
      console.log('   • Customer Login: http://localhost:4321/customer/login');
      console.log('   • Strapi Admin: http://localhost:1337/admin');
    } else {
      console.log('⚠️ Demo data appears incomplete. Try running: pnpm demo:complete');
    }
    
    await app.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Demo verification failed:', error.message);
    console.error('💡 Try running: pnpm demo:complete');
    process.exit(1);
  }
}

if (require.main === module) {
  verifyDemoData();
}

module.exports = verifyDemoData;
