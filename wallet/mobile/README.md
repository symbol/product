# Symbol Mobile Wallet

## Getting Started
- [Install Node.js](https://nodejs.org) (v12.1.0 or above)
- [Install Yarn package manager](https://yarnpkg.com/getting-started/install)
- [Set up the React Native development environment](https://reactnative.dev/docs/environment-setup) (choose tab **React Native CLI Quickstart**).

## Installation
1. Install dependencies:
```sh
yarn install
```
2. Set up configuration in the `src/config/config.json`.

### Android (development)
To run the development mode, start the emulator or connect your device via USB. For the first time run the following commands (that will install the app on the device):
```sh
yarn run connect
yarn run build:android:dev
```

If the application already installed on your emulator/device, use following commands instead:
```sh
yarn run connect
yarn run dev
```

### Android (production)
1. Set up signing key `release.keystore` to `android/app`.

2. Specify key properties in the `android/app/key.properties`:
```
storeFile=release.keystore
storePassword=***
keyAlias=***
keyPassword=***
```

3. Generate production APK, by running following command:
```sh
yarn run build:android:prod
```

4. Artifact can be found here: `android/app/build/outputs/apk/release/app-release.apk`.

### iOS
https://reactnative.dev/docs/running-on-device

## Folder structure
```
/
│── src/                        # Main source folder
│   ├── assets/                 # Stores images, fonts, and other assets
│   ├── hooks/                  # Custom React hooks
│   ├── components/             # Reusable React components
│   ├── constants/              # Stores constants used across the app
│   ├── config/                 # Configuration files
│   │   ├── config.json         # Main configuration file
│   │   ├── knownAccounts.json  # List of known accounts (exchanges, orgs, etc.)
│   │   ├── optInWhiteList.json # List of public keys for Symbol Pre-launch Opt-in
│   │   ├── termsAndPrivacy.json # Terms & Conditions and Privacy Policy
│   ├── localization/           # Localization module
│   │   ├── locales/            # Stores language files
│   ├── screens/                # React Native screens (views)
│   ├── lib/                    # Core application logic
│   │   ├── services/           # Modules for HTTP communication with API nodes and external API
│   │   ├── storage/            # Persistent & encrypted device storage
│   │   ├── controller/         # WalletController and related modules
│   │   ├── platform/           # Platform-specific utilities
│   ├── styles/                 # Application-wide styling and theming
│   ├── utils/                  # Helper functions
│   ├── App.js                  # Main app component
│   ├── Router.js               # Navigation configuration
│── index.js                    # Application entry point
```
