#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Simple fetch polyfill using Node.js built-ins
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: new Map(Object.entries(res.headers)),
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

const BASE_URL = 'http://localhost:1337';

// Demo customer credentials from the seeder
const TEST_CUSTOMER = {
  email: 'customer1@example.com',
  password: 'password123'
};

async function testActivationEndpoint() {
  try {
    console.log('🔐 Testing Customer Login...');
    
    // Step 1: Login to get token
    const loginResponse = await fetch(`${BASE_URL}/api/customers/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_CUSTOMER.email,
        password: TEST_CUSTOMER.password
      })
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${error}`);
    }

    const loginData = await loginResponse.json();
    const { token } = loginData;
    console.log('✅ Login successful');

    // Step 2: Get customer's license keys
    console.log('📋 Fetching license keys...');
    const licenseResponse = await fetch(`${BASE_URL}/api/license-keys`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!licenseResponse.ok) {
      const error = await licenseResponse.text();
      throw new Error(`License fetch failed: ${licenseResponse.status} - ${error}`);
    }

    const licenseData = await licenseResponse.json();
    const { licenseKeys } = licenseData;
    console.log(`✅ Found ${licenseKeys.length} license keys`);

    // Find an unused license
    const unusedLicense = licenseKeys.find(license => !license.isUsed);
    if (!unusedLicense) {
      console.log('❌ No unused licenses found. Creating test license...');
      // You might want to create a test license here if needed
      return;
    }

    console.log(`🔑 Using license: ${unusedLicense.key} (ID: ${unusedLicense.id})`);
    console.log(`📊 License status: ${unusedLicense.isUsed ? 'Used' : 'Unused'}, Active: ${unusedLicense.isActive}`);

    // Step 3: Test activation code generation
    console.log('⚡ Testing activation code generation...');
    const activationResponse = await fetch(`${BASE_URL}/api/license-keys/${unusedLicense.id}/generate-activation-code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${activationResponse.status}`);
    console.log(`Response headers:`, Object.fromEntries(activationResponse.headers.entries()));

    if (!activationResponse.ok) {
      const errorText = await activationResponse.text();
      console.log(`❌ Activation failed: ${activationResponse.status}`);
      console.log(`Error response:`, errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`Parsed error:`, errorJson);
      } catch (e) {
        console.log('Raw error text:', errorText);
      }
      return;
    }

    const activationData = await activationResponse.json();
    console.log('✅ Activation code generated successfully!');
    console.log(`🔑 License Key: ${activationData.licenseKey}`);
    console.log(`📝 Activation Code: ${activationData.activationCode}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testActivationEndpoint();
