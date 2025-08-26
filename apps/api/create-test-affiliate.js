const { execSync } = require("child_process");

async function createTestAffiliate() {
  try {
    // Use curl to create affiliate via Strapi's REST API
    const curlCommand = `curl -X POST "http://localhost:1337/api/affiliates" \\
      -H "Content-Type: application/json" \\
      -d '{
        "data": {
          "name": "Johns Test Affiliate",
          "email": "johns@test.com", 
          "code": "johnscode",
          "commissionRate": 0.15,
          "totalEarnings": 0,
          "isActive": true,
          "joinedAt": "2024-01-01T00:00:00.000Z",
          "notes": "Test affiliate for journey tracking",
          "payoutDetails": {
            "method": "paypal",
            "email": "johns@test.com"
          }
        }
      }'`;

    console.log("Creating test affiliate...");
    const result = execSync(curlCommand, { encoding: "utf-8" });
    console.log("Result:", result);
  } catch (error) {
    console.error("Error creating affiliate:", error.message);

    // Try creating directly through content manager endpoint
    try {
      const altCommand = `curl -X POST "http://localhost:1337/content-manager/collection-types/api::affiliate.affiliate" \\
        -H "Content-Type: application/json" \\
        -d '{
          "name": "Johns Test Affiliate",
          "email": "johns@test.com", 
          "code": "johnscode",
          "commissionRate": 0.15,
          "totalEarnings": 0,
          "isActive": true,
          "joinedAt": "2024-01-01T00:00:00.000Z",
          "notes": "Test affiliate for journey tracking",
          "payoutDetails": {
            "method": "paypal",
            "email": "johns@test.com"
          }
        }'`;

      console.log("Trying content manager endpoint...");
      const altResult = execSync(altCommand, { encoding: "utf-8" });
      console.log("Alt Result:", altResult);
    } catch (altError) {
      console.error("Alt error:", altError.message);
    }
  }
}

createTestAffiliate();
