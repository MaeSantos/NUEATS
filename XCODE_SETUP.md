# iOS Xcode Launcher Setup

This guide shows how to set up automatic web asset building in Xcode so you can just press Run without manual commands.

## Step-by-Step Setup

### 1. Open Xcode Project
```bash
# On macOS, navigate to project and run:
npm run ios:open
```

### 2. Add Build Phase Script

1. In Xcode, select your **App** target in the project navigator
2. Click on **Build Phases** tab
3. Click **+** to add a new build phase
4. Select **New Run Script Phase**
5. Name it: "Build Web Assets"

### 3. Add the Script

In the script area, paste this exact script:

```bash
#!/bin/bash

# NUEats iOS Build Script
# Automatically builds web assets before iOS build

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
```

### 4. Configure Build Phase

1. **Move the build phase**: Drag the "Build Web Assets" phase to the top, before "Compile Sources"
2. **Set input files** (optional): Add any files that should trigger a rebuild

### 5. Make Script Executable

In Terminal (on Mac):
```bash
chmod +x ios/build-web-assets.sh
```

## Usage

Once set up:
1. Open the project in Xcode
2. Select your simulator or device
3. Press **Cmd+R** or click the **Run** button
4. The script will automatically:
   - Build your React app
   - Copy assets to iOS
   - Build and launch the iOS app

## Benefits

- **No manual commands**: Just press Run in Xcode
- **Automatic updates**: Web assets are always up-to-date
- **Faster workflow**: One-click development
- **Team-friendly**: Works for anyone with the project

## Troubleshooting

If the build fails:
1. Check that Node.js is installed on your Mac
2. Verify the script path is correct
3. Check Xcode build logs for specific errors
4. Ensure npm dependencies are installed

## Alternative: Manual Command

If you prefer manual commands, you can still use:
```bash
npm run ios:build
```

Then build and run in Xcode normally.