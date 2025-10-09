# Wallet Common Ethereum

Protocol-specific layer for Ethereum used by Wallet Common Core. It provides:
- HTTP API services for Ethereum nodes and ecosystem endpoints.
- SDK helpers for signing.
- Utilities mapping, fees, and conversions.

## Project Structure

```
src/
├── api/        # Network service clients (Account, Block, Listener, Network, Token, Transaction)
├── bridge/     # BridgeHelper for cross-chain bridge workflows
├── constants/  # Ethereum enums and constants (internal)
├── modules/    # Transaction modules (e.g., TransferModule)
├── sdk/        # Thin SDK facade (re-exports sign/account helpers)
├── types/      # Local JSDoc typedefs
└── utils/      # Utilities
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
cd wallet/common/ethereum
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
- Utilities
- Constants

## Usage

### WalletController

```js
import { WalletController } from 'wallet-common-core';
import { 
   Api as EthereumNetworkApi, 
   sdk as ethereumWalletSdk
} from 'wallet-common-ethereum';

const ethereumNetworkApi = new EthereumNetworkApi({
    makeRequest: async (url, options) => fetch(url, options),
    config: {
        erc20TokensAddresses: {
            testnet: ['0xTokenAddress1', '0xTokenAddress2']
        }
    },
    nodeList: {
        testnet: ['https://rpc.sepolia.org']
    }
});

const controller = new WalletController({
    api: ethereumNetworkApi,
    sdk: ethereumWalletSdk
});
```

### Calling API services directly

```js
import { Api as EthereumNetworkApi } from 'wallet-common-ethereum';

const api = new EthereumNetworkApi({ makeRequest, config });

// Announce a signed transaction payload
await api.transaction.announceTransaction(networkProperties, signedTransaction);
```

### Using SDK helpers

```js
import { sdk } from 'wallet-common-ethereum';

// Sign a transaction object (already mapped)
const signedTransaction = sdk.signTransaction(networkIdentifier, transaction, 'PRIVATE_KEY');

```

