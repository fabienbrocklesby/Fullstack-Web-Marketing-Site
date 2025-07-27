const fetch = require('node-fetch');

async function testActivationWithLogin() {
  try {
    const cmsUrl = 'http://localhost:1337';
    
    console.log('Step 1: Testing customer login...');
    
    // Login as a customer first
    const loginResponse = await fetch(`${cmsUrl}/api/auth/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: 'customer@example.com', // This should exist from demo data
        password: 'customer123'
      }),
    });
    
    if (!loginResponse.ok) {
      console.log('Login failed:', loginResponse.status);
      const loginError = await loginResponse.text();
      console.log('Login error:', loginError);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful! Customer ID:', loginData.user.id);
    const customerToken = loginData.jwt;
    
    // Step 2: Get customer's license keys
    console.log('\nStep 2: Getting customer license keys...');
    const licenseResponse = await fetch(`${cmsUrl}/api/license-keys`, {
      headers: {
        'Authorization': `Bearer ${customerToken}`,
      },
    });
    
    if (!licenseResponse.ok) {
      console.log('License fetch failed:', licenseResponse.status);
      const licenseError = await licenseResponse.text();
      console.log('License error:', licenseError);
      return;
    }
    
    const licenseData = await licenseResponse.json();
    console.log('✅ Found', licenseData.licenseKeys.length, 'license keys');
    
    // Find an unused license
    const unusedLicense = licenseData.licenseKeys.find(license => !license.isUsed);
    if (!unusedLicense) {
      console.log('❌ No unused licenses found');
      console.log('Available licenses:', licenseData.licenseKeys.map(l => ({ id: l.id, status: l.status, isUsed: l.isUsed })));
      return;
    }
    
    console.log('✅ Found unused license:', unusedLicense.id);
    
    // Step 3: Test activation
    console.log('\nStep 3: Testing activation code generation...');
    const activationResponse = await fetch(`${cmsUrl}/api/license-keys/${unusedLicense.id}/generate-activation-code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Activation response status:', activationResponse.status);
    
    const activationResponseText = await activationResponse.text();
    console.log('Activation response body:', activationResponseText);
    
    if (activationResponse.ok) {
      const result = JSON.parse(activationResponseText);
      console.log('✅ SUCCESS! Generated activation code');
      console.log('License key:', result.licenseKey);
      console.log('Activation code (first 50 chars):', result.activationCode.substring(0, 50) + '...');
      console.log('Code length:', result.activationCode.length);
    } else {
      console.log('❌ FAILED to generate activation code');
      try {
        const error = JSON.parse(activationResponseText);
        console.log('Error details:', error);
      } catch (e) {
        console.log('Raw error response:', activationResponseText);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testActivationWithLogin();
