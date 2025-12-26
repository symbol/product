# Symbol Mobile Wallet

Symbol Mobile Wallet is a React Native application for managing Symbol blockchain accounts on mobile devices. It supports creating and securely storing keypairs, preparing and announcing transactions (including multisig cosigning), browsing transaction history, and managing Delegated Harvesting. The app runs on both Android and iOS.

## Project Structure

```
src/
├── assets/        # Images, fonts, and other static assets
├── components/    # Reusable UI components
├── config/        # App configuration (config.json, knownAccounts.json, ...)
├── constants/     # Shared constants
├── hooks/         # Custom React hooks
├── lib/           # Core application logic
│   ├── bip39/     # Mnemonic helpers
│   ├── controller/# Wallet controller wiring for mobile
│   ├── passcode/  # PIN / biometrics helpers
│   ├── platform/  # Platform-specific adapters
│   └── storage/   # Persistent / secure storage adapters and migrations
├── localization/  # Localization module
├── screens/       # React Native screens (views)
├── styles/        # App-wide styles and theme
├── types/         # Type definitions
├── utils/         # Utility helpers
├── App.js         # Root application component
└── Router.js      # Navigation and routing

index.js           # Application entry point
android/           # Android native project
ios/               # iOS native project
```

## Requirements

- [Node.js](https://nodejs.org) (v24.11.1 or later)
- [React Native development environment](https://reactnative.dev/docs/set-up-your-environment)

## Installation

This project is part of the Product monorepo.

1. Clone the repository.
2. Initialize the monorepo:
   ```sh
   bash init.sh
   ```
3. Navigate to the project folder:
   ```sh
   cd wallet/symbol/mobile
   ```
4. Install JavaScript dependencies:
   ```sh
   npm install
   ```
5. Configure the application in `src/config/config.json`.

## Building for Release

### Android

1. Place the signing key (`release.keystore`) in `android/app`.
2. Define the key properties in `android/app/key.properties`:
   ```properties
   storeFile=release.keystore
   storePassword=***
   keyAlias=***
   keyPassword=***
   ```
3. Build the production APK using:
   ```sh
   npm run build:android:prod
   ```
4. The generated APK can be found at:
   ```sh
   android/app/build/generated/outputs/apk/release/app-release.apk
   ```
5. Distribute the app as needed.

### iOS

1. Navigate to the `ios` folder and install dependencies:
   ```sh
   cd ios
   bundle install
   bundle exec pod install
   ```
2. Open Xcode and set up signing certificates.
3. Use Xcode to build, archive, and distribute the app.

## Running in Debug Mode

### Android

1. Start an emulator or connect a physical device via USB.

2. Run the app:

   a. For the first time install the app using:
   ```sh
   npm run connect:android
   npm run build:android:dev
   ```

   b. If the app is already installed, you can start it using:
   ```sh
   npm run connect:android
   npm run dev
   ```

   **Note:** If there are changes in `/android` or new dependencies are added, reinstall using step **a** instead.

3. Launch the app from the emulator or connected device.

### iOS

1. Start an emulator or connect a physical device via USB.

2. Run the app:

   a. Open Xcode, select the run destination, and click **Start the active scheme** (the play button).

   b. Alternatively, install and run the app using:
   ```sh
   npm run build:ios:dev
   ```

   c. If the app is already installed, start it using:
   ```sh
   npm run dev
   ```

   **Note:** If there are changes in `/ios` or new dependencies are added, reinstall using step **a** or **b** instead.

3. Launch the app from the emulator or connected device.

## Linting

Run the linter:
```sh
npm run lint
```
Fix linting errors:
```sh
npm run lint:fix
```

## Testing

Run tests:
```sh
npm run test
```
Generate a test coverage report:
```sh
npm run test:cov
```
