# NUEats

NUEats is a full-stack food ordering platform designed for students and staff. It features a React frontend, an Express API, and a Django-backed database. Built with Capacitor, it offers a professional mobile experience on Android and iOS.

**GitHub Repository**: [https://github.com/MaeSantos/NUEATS](https://github.com/MaeSantos/NUEATS)

## Key Features

- **Student Portal**: Browse the menu, search for food, and place orders with real-time tracking.
- **Admin Dashboard**: Manage the live order queue, update the menu, view earnings reports, and track most-ordered items.
- **E-Wallet Integration**: Supports **GCash** and **Maya** via direct app-linking and manual reference verification.
- **Push Notifications**: Real-time alerts (FoodPanda/Grab style) when orders are "Ready for pickup" or "Picked up".
- **Mobile Responsive**: Optimized for both physical phones (Android/iOS) and web browsers.
- **Remote Testing**: Configured to connect via **ngrok** for testing by team members anywhere in the world.

## Recent Improvements

- **Smooth Authentication Flow**: Optimized login experience for both students and admins.
  - Eliminated "login flicker" by implementing an asynchronous verification state.
  - Added a polished "Verifying session..." screen with pulsing logo animations.
  - Intelligent cross-portal redirection (logged-in students are automatically redirected away from admin login and vice-versa).
  - Enhanced form UX with auto-focus, field requirements, and history-safe navigation.
- **Global Auth State**: Centralized session management using React Context API for reliable user tracking across the entire app.
- **Emulator Connectivity**: Pre-configured support for Android Emulators using `10.0.2.2` loopback, ensuring immediate connectivity for developers.
- **Database Resilience**: Improved Django-Express bridge logic for more reliable order persistence and automated bootstrapping.

## Requirements

- **Node.js** (v18+)
- **Python 3.11+**
- **Android Studio** (for generating APKs)
- **Git**

## Quick Start

### 1. Install Dependencies
```powershell
npm install
pip install -r django_db/requirements.txt
```

### 2. Initialize Database
```powershell
npm run db:init
npm run django:check
```

### 3. Start the Server
```powershell
# Open terminal 1
npm run server
```

### 4. Start the Frontend
```powershell
# Open terminal 2
npm run dev
```

## Android Development

To generate a new APK for testing:

1.  **Sync Web Assets**:
    ```powershell
    npm run android:build
    ```
2.  **Generate APK**: Open the `android` folder in Android Studio and run **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3.  **Deployment**: The debug APK will be located at `android/app/build/outputs/apk/debug/app-debug.apk`.

**Note**: When updating the app on a physical phone, always **UNINSTALL** the previous version first to ensure new notification permissions and settings are applied correctly.

## iOS Development

To update the iOS project with the latest NUEats web app:

1.  **Build Web Assets**:
    ```powershell
    npm run build
    ```
2.  **Sync iOS Assets**:
    ```powershell
    npx cap copy ios
    ```
3.  **Open in Xcode**: Open `ios/App/App.xcworkspace` on macOS with Xcode, select a simulator or connected iPhone, then press **Run**.

The copied web files are stored in `ios/App/App/public`. A Mac with Xcode is required to build or run the iOS app.

## Payments & Invoicing

The app supports two methods for E-Wallets:
1.  **Direct App Link**: Students can tap "Open GCash/Maya" to jump directly into their payment apps.
2.  **Manual Verification**: Students provide a Reference Number which the Admin verifies before the order is "Queued" for the kitchen.

To use **Xendit** for automatic invoicing, set your secret key in `server.js` or via environment variables:
```powershell
$env:XENDIT_SECRET_KEY="xnd_live_..."
```

## Connectivity (ngrok)

For your groupmates to test the app remotely:
1.  Run the server on your laptop.
2.  Start ngrok: `npx ngrok http 4000`.
3.  Update the `PUBLIC_BACKEND_URL` in `src/api.js` with your fresh ngrok link.
4.  Build and send the new APK.

## Project Structure

- `/src`: React frontend (Vite)
- `/android`: Capacitor Android project
- `/django_db`: Python bridge and local database logic
- `server.js`: Express API gateway
- `src/api.js`: Universal connectivity logic

---
**NUEats** - Making campus dining faster and smarter.
