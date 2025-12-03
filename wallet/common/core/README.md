# Wallet Common Core

This project provides the common, reusable core for building wallet applications. It defines the shared controller, storage abstraction, keystore modules, and networking layer that wallet apps on different platforms and protocols can share. Core orchestration and infrastructure for multi-chain, multi-device wallets.

## Project Structure

```
src/
├── constants/ # Shared constants
├── error/ # Custom errors
├── lib/
│ ├── controller/
│ │ ├── EventController.js
│ │ ├── NetworkManager.js
│ │ └── WalletController.js
│ ├── keystore/
│ │ ├── BaseSoftwareKeystore.js
│ │ ├── ExternalAccountKeystore.js
│ │ └── MnemonicKeystore.js
│ └── storage/
│ │ ├── PersistentStorageRepository.js
│ │ ├── SecureStorageRepository.js
│ │ └── StorageInterface.js
├── types/ # Type definitions
└── utils/ # Utility functions
```

## Requirements

- Node.js v20.11.0

## Installation

This project is part of a Product monorepo. Follow the steps below to set up and run the project.

1. Clone the repository from GitHub:
   ```bash
   git clone https://github.com/symbol/product.git
   ```

2. Initialize:
   ```bash
   bash init.sh
   ```

3. Navigate to the project folder:
   ```bash
   cd wallet/common/core
   ```

4. Install Node.js dependencies:
   ```bash
   npm install
   ```

## Running Tests

To run tests, use:
```bash
npm run test
```
To run tests with coverage via c8, use:

```bash
npm run test:cov
```

## Linting

To run lint checks, use:
```bash
npm run lint
```

To fix lint issues, use:
```bash
npm run lint:fix
```

## Package Overview

Main entry: `./src/index.js`

This module contains the key building blocks:

- WalletController - the main orchestration engine
- Storage interfaces
- Common keystore implementations
- Protocol API and SDK wrappers
- Utility helpers

## Main Components

### WalletController

**Features**:

- Manages accounts (create, import, rename, reorder, remove)
- Stores wallet data
- Signs and cosigns transactions
- Encrypts and decrypts messages
- Manages network connections and polling
- Fetches data from network and caches retrieved data.

**Dependencies injected**:

- Protocol API module
- Protocol SDK module
- Persistent and secure storage interfaces
- Keystore implementations
- Additional functionality modules
- Network configuration

**Example usage:**

```js
import {
  WalletController,
  MnemonicKeystore,
  ExternalAccountKeystore,
  StorageInterface,
  AddressBookModule
} from 'wallet-common-core';

const controller = new WalletController({
  api: protocolNetworkApi, // ProtocolNetworkApi instance. Wraps network data fetching
  sdk: protocolWalletSdk, // ProtocolWalletSdk instance. Wraps cryptographic operations
  persistentStorageInterface: persistentStorageInterface, // StorageInterface instance. Wraps persistent storage
  secureStorageInterface: secureStorageInterface, // StorageInterface instance. Wraps secure storage
  keystores: [MnemonicKeystore, ExternalAccountKeystore], // Keystores (classes)
  modules: [new AddressBookModule()], // Additional functionality modules
  networkIdentifiers: ['testnet', 'mainnet'], // The list of supported network identifiers
  createDefaultNetworkProperties: createDefaultNetworkProperties, // The network properties factory function. network identifier as an argument
  networkPollingInterval: 5000 // Network polling interval
});

```

### StorageInterface

**Example usage:**

```js
import { StorageInterface } from 'wallet-common-core';

const persistentStorageInterface = new StorageInterface({
  getItem: localStorage.getItem,
  setItem: localStorage.setItem,
  removeItem: localStorage.removeItem
});
```

### Modules

**Example usage:**

```js
import {
   AddressBookModule,
	BridgeModule,
	LocalizationModule,
	MarketModule
} from 'wallet-common-core';

const addressBookModule = new AddressBookModule();
const bridgeModule = new BridgeModule({
   bridgeMode: 'wrap',
   bridgeUrl: {
      mainnet: 'https://bridge.symbol.tools',
      testnet: 'https://bridge.symbol.tools/testnet/
   },
   bridgeHelper: new ProtocolBridgeHelper(),
   makeRequest: (url, options) => fetchFunction(url, options)
});
const localizationModule = new LocalizationModule();
const marketModule = new MarketModule({ 
   marketApi: new MarketDataApi()
});

```
