#!/bin/bash

echo "Setting up BioHuez Dashboard Next.js project..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create necessary directories
echo "Creating directory structure..."
mkdir -p src/components/ui
mkdir -p src/lib

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "Open http://localhost:3000 in your browser"
echo ""
echo "Next steps:"
echo "1. Connect to your backend API"
echo "2. Replace placeholder data with real Amazon SP-API data"
echo "3. Add authentication for multi-tenant support"
echo "4. Deploy to Vercel or your preferred hosting"