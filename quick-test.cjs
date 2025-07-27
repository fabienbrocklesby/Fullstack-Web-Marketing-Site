#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Simple fetch polyfill
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
const TEST_CUSTOMER = {
  email: 'customer1@example.com',
  password: 'password123'
};

async function quickTest() {
  try {
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/api/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CUSTOMER)
    });

    const { token } = await loginResponse.json();

    console.log('📋 Getting license keys...');
    const licenseResponse = await fetch(`${BASE_URL}/api/license-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const { licenseKeys } = await licenseResponse.json();
    console.log('📋 Available licenses:');
    licenseKeys.forEach(license => {
      console.log(`   ID: ${license.id}, Key: ${license.key}, Status: ${license.status}, Used: ${license.isUsed}`);
    });
    
    const unusedLicense = licenseKeys.find(license => !license.isUsed);
    
    if (!unusedLicense) {
      console.log('❌ No unused licenses found');
      return;
    }

    console.log(`⚡ Generating activation code for license: ${unusedLicense.key}`);
    const activationResponse = await fetch(`${BASE_URL}/api/license-keys/${unusedLicense.id}/generate-activation-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await activationResponse.json();
    console.log('✅ Activation Code Generated!');
    console.log(`🔑 License Key: ${result.licenseKey}`);
    console.log(`📝 Activation Code: ${result.activationCode}`);
    console.log('');
    console.log('🧪 Test these in: http://localhost:4321/test-offline-activation.html');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();
