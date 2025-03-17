# Symbol Mobile Wallet

## Getting Started
- [Install Node.js](https://nodejs.org) (v20.11.0 or above)
- [Install Yarn package manager](https://yarnpkg.com/getting-started/install)
- [Set up the React Native development environment](https://reactnative.dev/docs/set-up-your-environment).

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
│── src/                          # Main source folder
│   ├── assets/                   # Stores images, fonts, and other assets
│   ├── hooks/                    # Custom React hooks
│   ├── components/               # Reusable React components
│   ├── constants/                # Stores constants used across the app
│   ├── config/                   # Configuration files
│   │   ├── config.json           # Main app configuration file
│   │   ├── knownAccounts.json    # List of known accounts (exchanges, orgs, etc.)
│   │   ├── optInWhiteList.json   # List of public keys for Symbol Pre-launch Opt-in
│   │   ├── termsAndPrivacy.json  # Terms & Conditions and Privacy Policy
│   ├── localization/             # Localization module
│   │   ├── locales/              # Language files
│   ├── screens/                  # React Native screens (views)
│   ├── styles/                   # Application-wide styles and themes
│   ├── utils/                    # Utility/helper functions
│   ├── lib/                      # Core application logic
│   │   ├── services/             # Modules handling API requests and network communication
│   │   │   ├── AccountService.js      # Fetches account data
│   │   │   ├── ListenerService.js     # WebSocket listener for blockchain events
│   │   │   ├── MosaicService.js       # Fetches mosaics (tokens) data
│   │   │   ├── NetworkService.js      # Fetches blockchain network properties
│   │   │   ├── HarvestingService.js   # Fetches harvesting status, summary and harvested blocks
│   │   │   ├── MarketService.js       # Fetches market data
│   │   │   ├── NamespaceService.js    # Fetches namespace data
│   │   │   ├── TransactionService.js  # Handles transaction preparation and broadcasting
│   │   ├── controller/           # App state management with MobX
│   │   │   ├── WalletController.js        # Main logic class handling wallet operations and caching
│   │   │   ├── MobileWalletController.js  #  Export of the WalletController instance initialized with storage and controller modules
│   │   │   ├── modules/          # Additional controller modules
│   │   │   │   ├── AddressBookModule.js   # Manages address book contacts
│   │   │   │   ├── HarvestingModule.js    # Prepares harvesting start and stop transactions, fetches and cache harvesting status
│   │   │   │   ├── MarketModule.js        # Fetches and stores market data, cache user currency preferences
│   │   │   │   ├── TransferModule.js      # Prepares transfer transactions (multisig and single)
│   │   ├── features/             # Application feature modules
│   │   │   ├── SymbolQR.js       # Symbol QR code handler (create, parse, encode)
│   │   │   ├── SymbolURI.js      # Symbol URI handler (create, parse URIs)
│   │   ├── error/                # Custom application errors
│   │   ├── storage/              # Persistent and secure storage management
│   │   │   ├── PersistentStorage.js   # Device storage for caching non-sensitive data
│   │   │   ├── SecureStorage.js       # Encrypted device storage for sensitive data
│   │   │   ├── StorageMigration.js    # Manages storage versioning and migrations
│   ├── App.js                    # Main application component
│   ├── Router.js                 # Navigation and routing configuration
│── index.js                      # Application entry point
```
