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

# Sync assets and plugins to iOS
echo "Syncing assets and plugins to iOS..."
npx cap sync ios

echo "Web assets built and synced successfully"