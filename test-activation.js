const fetch = require("node-fetch");

async function testActivation() {
  try {
    // Get the customer token (you'll need to replace this with a valid token)
    console.log("Testing activation endpoint...");

    const cmsUrl = "http://localhost:1337";
    const licenseId = 20; // Test license ID

    // First, let's check if the license exists
    const customerToken = "YOUR_TOKEN_HERE"; // Replace with actual token

    console.log(`Testing GET /api/license-keys/${licenseId}`);

    const checkResponse = await fetch(
      `${cmsUrl}/api/license-keys/${licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      },
    );

    if (!checkResponse.ok) {
      console.log(
        "License check failed:",
        checkResponse.status,
        await checkResponse.text(),
      );
      return;
    }

    const licenseData = await checkResponse.json();
    console.log("License data:", JSON.stringify(licenseData, null, 2));

    // Now test the activation endpoint
    console.log(
      `\nTesting POST /api/license-keys/${licenseId}/generate-activation-code`,
    );

    const response = await fetch(
      `${cmsUrl}/api/license-keys/${licenseId}/generate-activation-code`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${customerToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries()),
    );

    const responseText = await response.text();
    console.log("Response body:", responseText);

    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log(
        "Success! Generated activation code:",
        result.activationCode?.substring(0, 50) + "...",
      );
    } else {
      console.log("Failed to generate activation code");
      try {
        const error = JSON.parse(responseText);
        console.log("Error details:", error);
      } catch (e) {
        console.log("Raw error response:", responseText);
      }
    }
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

testActivation();
