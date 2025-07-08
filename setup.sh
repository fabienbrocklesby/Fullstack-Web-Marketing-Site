#!/bin/bash
# Development setup script for SaaS Boilerplate

echo "🚀 Setting up SaaS Boilerplate for development..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is required but not installed. Please install pnpm first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy environment files
echo "🔧 Setting up environment files..."
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Configure your environment variables in frontend/.env and backend/.env"
echo "2. Set up your PostgreSQL database"
echo "3. Configure your Stripe keys"
echo "4. Run 'pnpm dev' to start development servers"
echo ""
echo "🌐 URLs:"
echo "- Frontend: http://localhost:4321"
echo "- Backend: http://localhost:1337"
echo ""
echo "📖 Check the README.md for detailed setup instructions."
