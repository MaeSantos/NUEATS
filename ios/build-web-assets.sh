#!/bin/bash

# NUEats iOS Build Script
# This script automatically builds web assets before iOS build

# Navigate to project root
cd "$SRCROOT/../.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build web assets
echo "Building web assets..."
npm run build

# Copy assets to iOS
echo "Copying assets to iOS..."
npx cap copy ios

echo "Web assets built and synced successfully"