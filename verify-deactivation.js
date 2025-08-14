import fetch from "node-fetch";

const LATEST_DEACTIVATION_CODE_FROM_TEST_PAGE =
  "a4822a3163b0e2454a5f8114a63a75d2";
const LICENSE_ID = 20;
const CUSTOMER_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NywiZW1haWwiOiJmYWJpZW5icm9ja2xlc2J5QGljbG91ZC5jb20iLCJ0eXBlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NTMwNjQ3NDYsImV4cCI6MTc1MzY2OTU0Nn0.JT-fCTKM6_thrqIFEcDZqIex1vRZm5X22s9h6asJxzQ";

async function testDeactivation() {
  console.log(`Attempting to deactivate license ID: ${LICENSE_ID}`);
  console.log(
    `Using deactivation code: ${LATEST_DEACTIVATION_CODE_FROM_TEST_PAGE}`,
  );

  try {
    const response = await fetch(
      `http://localhost:1337/api/license-keys/${LICENSE_ID}/deactivate-with-code`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CUSTOMER_TOKEN}`,
        },
        body: JSON.stringify({
          deactivationCode: LATEST_DEACTIVATION_CODE_FROM_TEST_PAGE,
        }),
      },
    );

    const responseBody = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(responseBody, null, 2));

    if (response.ok) {
      console.log("\n✅ DEACTIVATION SUCCEEDED!");
    } else {
      console.error("\n❌ DEACTIVATION FAILED!");
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

testDeactivation();
