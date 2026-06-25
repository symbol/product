# Wallet Common NEM

Protocol-specific layer for NEM (XEM) used by Wallet Common Core. It provides:
- HTTP API services for NEM NIS nodes and market endpoints.
- SDK helpers for account creation and derivation, signing, cosigning, and message encryption and decryption.
- Feature modules for composing wallet flows, currently centered on transfers.
- Utilities for transaction mapping, fees, normalization, and NEM-specific conversions.

## Project Structure

```
src/
├── api/        # Network service clients (Account, Listener, Market, Mosaic, Namespace, Network, Transaction)
├── constants/  # NEM enums and constants
├── modules/    # Feature modules (currently TransferModule)
├── sdk/        # Thin SDK facade (account, signing, cosigning, message helpers)
├── types/      # Local JSDoc typedefs
└── utils/      # NEM-specific utilities
```

## Requirements

- Node.js v22

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
cd wallet/common/nem
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

This module exports the main NEM package surface:

- Protocol network API
- Protocol wallet SDK
- `TransferModule`
- NEM constants and utilities

## Usage

### WalletController

```js
import { WalletController } from 'wallet-common-core';
import {
   Api as NemNetworkApi,
   sdk as nemWalletSdk,
   TransferModule
} from 'wallet-common-nem';

const nemNetworkApi = new NemNetworkApi({
	makeRequest: async (url, options) => fetch(url, options),
	config: {
		marketDataURL: 'https://min-api.cryptocompare.com/data/price',
		marketCurrencies: ['USD', 'EUR'],
		nodewatchURL: {
			testnet: 'https://nodewatch.symbol.tools/testnet',
			mainnet: 'https://nodewatch.symbol.tools'
		}
	}
});

const controller = new WalletController({
	api: nemNetworkApi,
	sdk: nemWalletSdk,
	modules: [new TransferModule()]
});
```

### Calling API services directly

```js
import { Api as NemNetworkApi } from 'wallet-common-nem';

const api = new NemNetworkApi({ makeRequest, config });

const networkProperties = await api.network.fetchNetworkInfo('https://example-node.net:7890');

const transactionPage = await api.transaction.fetchAccountTransactions(
	networkProperties,
	currentAccount,
	{ group: 'confirmed', pageNumber: 1, pageSize: 15 }
);

await api.transaction.announceTransaction(networkProperties, signedTransaction);
```

### Using SDK helpers

```js
import { sdk } from 'wallet-common-nem';

const privateKeys = sdk.createPrivateKeysFromMnemonic(mnemonic, [0, 1], 'testnet');

const signedTransaction = sdk.signTransaction(networkIdentifier, transaction, 'PRIVATE_KEY');

const encryptedMessage = sdk.encryptMessage('hello', recipientPublicKey, 'PRIVATE_KEY');

const cosignedTransaction = sdk.cosignTransaction(pendingTransaction, 'PRIVATE_KEY');
```
