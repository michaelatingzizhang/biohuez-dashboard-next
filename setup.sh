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
echo "1. Copy .env.example to .env.local if your legacy dashboard is not in ../biohuez-dashboard"
echo "2. Set BIOHUEZ_LEGACY_DASHBOARD_DIR and BIOHUEZ_PYTHON when needed"
echo "3. Set MOTHERDUCK_TOKEN when reading cloud data"
echo "4. Run npm run build before deploying"
