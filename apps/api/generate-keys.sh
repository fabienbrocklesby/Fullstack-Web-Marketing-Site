#!/bin/bash

# Generate RSA key pair for JWT signing
echo "Generating RSA key pair for JWT license portal..."

# Create keys directory if it doesn't exist
mkdir -p ./keys

# Generate private key
openssl genrsa -out ./keys/private.pem 2048

# Generate public key
openssl rsa -in ./keys/private.pem -pubout -out ./keys/public.pem

echo "✅ Keys generated successfully!"
echo ""
echo "🔑 Private key saved to: ./keys/private.pem"
echo "🔓 Public key saved to: ./keys/public.pem"
echo ""
echo "📝 Next steps:"
echo "1. Copy the private key content to your .env file as JWT_PRIVATE_KEY"
echo "2. Distribute the public key to your CNC applications for token verification"
echo ""
echo "💡 To copy the private key:"
echo "cat ./keys/private.pem | tr '\n' '\\n'"
