// Test data seeder for development
// Run this from the Strapi admin console or create a lifecycle hook

module.exports = {
  async createTestData() {
    console.log('Creating test data...');
    
    try {
      // Create test affiliates
      const testAffiliates = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          code: 'john123',
          commissionRate: 0.1,
          totalEarnings: 150.00,
          isActive: true,
          joinedAt: new Date('2024-01-15'),
          notes: 'Test affiliate for development'
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          code: 'jane456',
          commissionRate: 0.15,
          totalEarnings: 250.00,
          isActive: true,
          joinedAt: new Date('2024-02-01'),
          notes: 'High-performing affiliate'
        }
      ];

      for (const affiliateData of testAffiliates) {
        const existing = await strapi.entityService.findMany('api::affiliate.affiliate', {
          filters: { email: affiliateData.email }
        });

        if (existing.length === 0) {
          await strapi.entityService.create('api::affiliate.affiliate', {
            data: affiliateData
          });
          console.log(`Created affiliate: ${affiliateData.name}`);
        }
      }

      // Create test purchases
      const affiliates = await strapi.entityService.findMany('api::affiliate.affiliate');
      
      if (affiliates.length > 0) {
        const testPurchases = [
          {
            stripeSessionId: 'cs_test_1',
            amount: 99.00,
            customerEmail: 'customer1@example.com',
            priceId: 'price_starter',
            affiliate: affiliates[0].id,
            commissionAmount: 9.90,
            status: 'completed',
            metadata: { test: true }
          },
          {
            stripeSessionId: 'cs_test_2',
            amount: 199.00,
            customerEmail: 'customer2@example.com',
            priceId: 'price_pro',
            affiliate: affiliates[0].id,
            commissionAmount: 19.90,
            status: 'completed',
            metadata: { test: true }
          }
        ];

        for (const purchaseData of testPurchases) {
          const existing = await strapi.entityService.findMany('api::purchase.purchase', {
            filters: { stripeSessionId: purchaseData.stripeSessionId }
          });

          if (existing.length === 0) {
            await strapi.entityService.create('api::purchase.purchase', {
              data: purchaseData 
            });
            console.log(`Created purchase: ${purchaseData.stripeSessionId}`);
          }
        }
      }

      console.log('Test data creation completed!');
      
    } catch (error) {
      console.error('Error creating test data:', error);
    }
  }
};
