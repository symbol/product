# Symbol Mobile Wallet

Symbol Mobile Wallet is a React Native application designed for managing Symbol blockchain accounts. It allows to generate and store keypairs, create, sign, cosign, and announce transactions, browse transaction history, and manage Delegated Harvesting. The app supports both Android and iOS platforms.

## Getting Started

### Prerequisites
- [Install Node.js](https://nodejs.org) (v20.11.0 or later)
- [Set up the React Native development environment](https://reactnative.dev/docs/set-up-your-environment)

## Installation

1. Install JavaScript dependencies:
   ```sh
   npm install
   ```
2. Configure the application in `src/config/config.json`.

## Building the Application

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

## Running the Application

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
   npm run ios
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

## Folder Structure

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
