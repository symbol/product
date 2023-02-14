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
To generate production APK, run following command:
```sh
yarn run build:android:prod
```

### iOS
https://reactnative.dev/docs/running-on-device

## Folder structure
- `src`: This folder is the main container of all the code inside the application.
  - `assets`: Asset folder to store all images, fonts, etc.
  - `components`: Folder to store any common component that is used through the app.
  - `config`: 
    - `config.json`: Main configuration file of the app. Contains all endpoints.
    - `constants.js`: Stores any kind of constant.
    - `knownAccounts.json`: Contains the list of known accounts (exchanges, orgs, etc.).
    - `optInWhiteList.json`: Contains the list of public keys generated with the Symbol Pre-launch Opt-in Mobile Wallet.
    - `termsAndPrivacy.json`: Contains the Terms and Conditions and Privacy Policy text.
  - `localization`: Contains localization module.
    - `locales`: Folder to store the languages files.
  - `screens`: Folder that contains all your application screens/features.
  - `services`: Folder that contains modules which communicate with an API.
  - `storage`: Folder that contains the storage interface (the app cache interface).
  - `store`: Folder that contains redux store and logic (in-memory store).
  - `styles`: Folder to store all the styling concerns related to the application theme.
  - `utils`: Folder to store all the helper functions and hooks.
  - `App.js`: Main component that starts the whole app.
  - `Router.js`: Navigation configuration.
- `index.js`: Entry point.
