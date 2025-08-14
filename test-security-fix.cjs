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

async function testSecurity() {
  try {
    console.log('🔒 Testing Activation Code Security');
    console.log('=====================================');

    // Login
    const loginResponse = await fetch(`${BASE_URL}/api/customers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CUSTOMER)
    });

    const { token } = await loginResponse.json();

    // Get licenses
    const licenseResponse = await fetch(`${BASE_URL}/api/license-keys`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const { licenseKeys } = await licenseResponse.json();
    
    console.log('\n📋 Available licenses:');
    licenseKeys.forEach(license => {
      console.log(`   • ${license.key} (${license.status})`);
    });

    // Find two different license keys
    const license1 = licenseKeys.find(l => l.key.includes('STARTER'));
    const license2 = licenseKeys.find(l => l.key.includes('ENTERPRISE'));

    if (!license1 || !license2) {
      console.log('❌ Need both STARTER and ENTERPRISE licenses for test');
      return;
    }

    console.log(`\n🔑 License 1: ${license1.key}`);
    console.log(`🔑 License 2: ${license2.key}`);

    // Generate activation code for License 1
    console.log(`\n⚡ Generating activation code for License 1...`);
    const activationResponse = await fetch(`${BASE_URL}/api/license-keys/${license1.id}/generate-activation-code`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await activationResponse.json();
    console.log('Response:', JSON.stringify(result, null, 2));
    const activationCode = result.activationCode;
    
    if (!activationCode) {
      console.log('❌ No activation code in response');
      return;
    }
    
    console.log(`✅ Generated code: ${activationCode} (${activationCode.length} chars)`);

    // Now test if we can use this code with License 2 (should fail)
    console.log(`\n🧪 Testing if code from License 1 works with License 2...`);
    
    // Simulate the frontend validation
    const CryptoJS = require('crypto-js');
    const bs58 = require('bs58');

    try {
      // Try to decode with License 2's key
      const encryptedPayload = bs58.decode(activationCode);
      const licenseKeyHash = CryptoJS.SHA256(license2.key);
      
      // XOR decrypt using License 2's hash
      const xorKeyBytes = [];
      for (let i = 4; i < 12; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        xorKeyBytes.push((licenseKeyHash.words[wordIndex] >>> (8 * (3 - byteIndex))) & 0xff);
      }

      const decryptedPayload = new Uint8Array(8);
      for (let i = 0; i < 8; i++) {
        decryptedPayload[i] = encryptedPayload[i] ^ xorKeyBytes[i];
      }

      // Check if first 4 bytes match License 2's hash
      const expectedKeyHashBytes = [];
      for (let i = 0; i < 4; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        expectedKeyHashBytes.push((licenseKeyHash.words[wordIndex] >>> (8 * (3 - byteIndex))) & 0xff);
      }

      let keyHashValid = true;
      for (let i = 0; i < 4; i++) {
        if (decryptedPayload[i] !== expectedKeyHashBytes[i]) {
          keyHashValid = false;
          break;
        }
      }

      if (!keyHashValid) {
        console.log('✅ SECURITY TEST PASSED: Code from License 1 cannot be used with License 2');
        console.log('   The activation code is properly bound to the original license key');
      } else {
        console.log('❌ SECURITY TEST FAILED: Code from License 1 worked with License 2');
        console.log('   This is a security vulnerability!');
      }

    } catch (error) {
      console.log('✅ SECURITY TEST PASSED: Decryption failed with wrong license key');
      console.log(`   Error: ${error.message}`);
    }

    // Test with correct license key
    console.log(`\n🧪 Testing if code from License 1 works with License 1 (should succeed)...`);
    
    try {
      const encryptedPayload = bs58.decode(activationCode);
      const licenseKeyHash = CryptoJS.SHA256(license1.key);
      
      const xorKeyBytes = [];
      for (let i = 4; i < 12; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        xorKeyBytes.push((licenseKeyHash.words[wordIndex] >>> (8 * (3 - byteIndex))) & 0xff);
      }

      const decryptedPayload = new Uint8Array(8);
      for (let i = 0; i < 8; i++) {
        decryptedPayload[i] = encryptedPayload[i] ^ xorKeyBytes[i];
      }

      const expectedKeyHashBytes = [];
      for (let i = 0; i < 4; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        expectedKeyHashBytes.push((licenseKeyHash.words[wordIndex] >>> (8 * (3 - byteIndex))) & 0xff);
      }

      let keyHashValid = true;
      for (let i = 0; i < 4; i++) {
        if (decryptedPayload[i] !== expectedKeyHashBytes[i]) {
          keyHashValid = false;
          break;
        }
      }

      if (keyHashValid) {
        console.log('✅ VALIDITY TEST PASSED: Code from License 1 works correctly with License 1');
        const nonce = Array.from(decryptedPayload.slice(4, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
        console.log(`   Extracted nonce: ${nonce}`);
      } else {
        console.log('❌ VALIDITY TEST FAILED: Code from License 1 does not work with License 1');
      }

    } catch (error) {
      console.log('❌ VALIDITY TEST FAILED: Decryption failed with correct license key');
      console.log(`   Error: ${error.message}`);
    }

    console.log('\n🎉 Security test completed!');

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testSecurity();
