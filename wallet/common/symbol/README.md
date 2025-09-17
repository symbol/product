# Wallet Common Symbol

Protocol-specific layer for Symbol (XYM) used by Wallet Common Core. It provides:
- HTTP API services for Symbol nodes and ecosystem endpoints.
- SDK helpers for signing, cosigning, and message encryption.
- Feature modules.
- Utilities for transaction mapping, fees, and conversions.

## Project Structure

```
src/
├── api/            # Network service clients (Account, Namespace, Mosaic, Transaction, Harvesting, etc.)
├── constants/      # Symbol enums and constants
├── modules/        # Feature modules (HarvestingModule, TransferModule, ...)
├── sdk/            # Thin SDK facade (signing, cosigning, encrypt/decrypt, key utilities)
├── types/          # Local JSDoc typedefs
└── utils/          # Symbol-specific utilities (transactions, mapping, convert helpers)
```

## Requirements

- Node.js v20.11.0

## Installation

This package lives inside the Product monorepo.

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
cd wallet/common/symbol
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

- Protocol network API
- Protocol wallet SDK
- Utilities for transaction mapping, fees, and conversions
- Constants

## Usage

### WalletController

```js
import { WalletController } from 'wallet-common-core';
import { 
   Api as SymbolNetworkApi, 
   sdk as symbolWalletSdk, 
   TransferModule, 
   HarvestingModule 
} from 'wallet-common-symbol';

const symbolNetworkApi = new SymbolNetworkApi({
    makeRequest: async (url, options) => fetch(url, options),
    config: {
        marketDataURL: 'https://fetch-symbol-price.com/api',
        marketCurrencies: ['USD', 'EUR', 'JPY'],
        nodewatchURL: {
            testnet: 'https://nodewatch.symbol.tools/testnet',
            mainnet: 'https://nodewatch.symbol.tools'
        }
    }
});

const modules = [
    new TransferModule(),
    new HarvestingModule()
];

const controller = new WalletController({
    api: symbolNetworkApi,
    sdk: symbolWalletSdk,
    modules
});
```

### Calling API services directly

```js
import { Api as SymbolNetworkApi } from 'wallet-common-symbol';

const api = new SymbolNetworkApi({ makeRequest, config });

// Fetch confirmed transactions page
const transactionPage = await api.transaction.fetchAccountTransactions(
    networkProperties,
    currentAccount,
    { group: 'confirmed', pageNumber: 1, pageSize: 15, order: 'desc' }
);

// Announce a signed transaction payload
await api.transaction.announceTransaction(networkProperties, signedTransaction);
```

### Using SDK helpers

```js
import { sdk } from 'wallet-common-symbol';

// Sign a transaction object (already mapped)
const signedTransaction = sdk.signTransaction(networkIdentifier, transaction, 'PRIVATE_KEY');

// Cosign an aggregate transaction
const cosigned = sdk.cosignTransaction(aggregateTransaction, 'PRIVATE_KEY');

// Encrypt message payloads
const encryptedMessage = await sdk.encryptMessage('hello', 'RECIPIENT_PUBLIC_KEY', 'CURRENT_ACCOUNT_PRIVATE_KEY');

// Decrypt message payloads
const decryptedMessage = await sdk.decryptMessage(encryptedMessage, 'SENDER_PUBLIC_KEY', 'CURRENT_ACCOUNT_PRIVATE_KEY');
```

