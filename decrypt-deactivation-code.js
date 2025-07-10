#!/usr/bin/env node

const crypto = require("crypto");

// Decrypt deactivation code using the same logic as the backend
function decryptDeactivationCode(encryptedCode, licenseKey) {
  try {
    const algorithm = "aes-256-cbc";
    const key = crypto.createHash("sha256").update(licenseKey).digest();
    const parts = encryptedCode.split(":");
    if (parts.length !== 2) {
      throw new Error(
        "Invalid encrypted code format. Expected format: {iv}:{encrypted}",
      );
    }
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log("🔓 Deactivation Code Decryptor");
  console.log("");
  console.log(
    "Usage: node decrypt-deactivation-code.js <license-key> <encrypted-deactivation-code>",
  );
  console.log("");
  console.log("Example:");
  console.log(
    '  node decrypt-deactivation-code.js "ENTERPRISE-F4S8-8Y22-R88U" "a37587c13a0aff3a55fc5f2f291014a5:ff76d053e814da0644beb39431db4e93"',
  );
  console.log("");
  console.log(
    "The encrypted deactivation code should be in format: {iv}:{encrypted}",
  );
  process.exit(1);
}

const [licenseKey, encryptedCode] = args;

try {
  console.log("🔓 Decrypting deactivation code...");
  console.log("");
  console.log(`📝 License Key: ${licenseKey}`);
  console.log(`🔐 Encrypted Code: ${encryptedCode}`);
  console.log("");

  const decryptedCode = decryptDeactivationCode(encryptedCode, licenseKey);

  console.log("✅ Decryption successful!");
  console.log("");
  console.log(`🔑 Decrypted Deactivation Code: ${decryptedCode}`);
  console.log("");
  console.log(
    "💡 You can now use this deactivation code with the license key to deactivate the license.",
  );
} catch (error) {
  console.error("❌ Decryption failed:");
  console.error(`   ${error.message}`);
  console.log("");
  console.log("💡 Make sure:");
  console.log("   - The license key is correct");
  console.log("   - The encrypted code is in format: {iv}:{encrypted}");
  console.log("   - Both values are from the same license activation");
  process.exit(1);
}
