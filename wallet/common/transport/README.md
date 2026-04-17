# Wallet Common Transport

A cross-application communication protocol for Symbol wallet. Provides structured, typed URI strings for sharing account addresses, requesting transactions, and other inter-application actions.

**URI Format:** `web+symbol://{version}/{actionType}/{method}?{params}`

## Project Structure

```
src/
├── TransportUri.js              # Main entry point for URI parsing
├── TransportActionRegistry.js   # Registry for action class lookup
├── constants.js                 # Protocol constants
├── errors.js                    # Custom error classes
├── index.js                     # Public API exports
├── actions                      # Action classes
├── schema/
│   ├── index.js                 # Schema exports
│   ├── handlers.js              # Type handlers (parse/validate)
│   └── parameters.js            # Reusable parameter definitions
├── types                        # JSDoc type definitions          
└── utils/
    ├── index.js                 # Utils exports
    ├── parse.js                 # Raw parameter parsing
    ├── transport.js             # URI creation utility
    ├── url.js                   # URL parsing/encoding
    └── validate.js              # Parameter validation
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
   cd wallet/common/transport
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

This module provides:

- `TransportUri` - Main entry point for parsing URI strings
- Action classes for different URI types
- Schema definitions and type handlers
- Custom error classes for validation and parsing failures

## Main Components

### TransportUri

The main entry point for parsing transport URI strings into action instances.

**Example usage:**

```js
import { TransportUri, ShareAccountAddressUri } from 'wallet-common-transport';

// Parse a URI string into an action instance
const action = TransportUri.createFromString(
  'web+symbol://v1/share/accountAddress?chainId=abc&networkId=mainnet&address=xyz'
);

// Access parsed parameters
console.log(action.chainId);     // 'abc'
console.log(action.networkId);   // 'mainnet'
console.log(action.address);     // 'xyz'

// Convert back to URI string
const uriString = action.toTransportString();

// Serialize to JSON
const json = action.toJSON();
```

### Action Classes

Each action class represents a specific URI action type:

- `ShareAccountAddressUri` - Share an account address
- `ShareTransferTransactionUri` - Share a pre-filled transfer transaction
- `RequestSendTransactionUri` - Request wallet to sign and announce a transaction

**Creating action instances directly:**

```js
import { ShareAccountAddressUri } from 'wallet-common-transport';

// Create from parameters
const action = new ShareAccountAddressUri({
  chainId: 'abc',
  networkId: 'mainnet',
  address: 'xyz',
  name: 'My Account' // optional
});

// Create from JSON
const actionFromJson = ShareAccountAddressUri.fromJSON({
  parameters: {
    chainId: 'abc',
    networkId: 'mainnet',
    address: 'xyz'
  }
});

// Generate URI string
const uri = action.toTransportString();
// Result: 'web+symbol://v1/share/accountAddress?chainId=abc&networkId=mainnet&address=xyz'
```

### Error Handling

The module provides custom error classes:

- `ValidationError` - Parameter validation failures
- `ParseError` - URI parsing failures
- `UnsupportedActionError` - Unknown action type or method

```js
import { TransportUri, ParseError, ValidationError, UnsupportedActionError } from 'wallet-common-transport';

try {
  const action = TransportUri.createFromString(uriString);
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Invalid URI format:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Invalid parameters:', error.getFullMessage());
  } else if (error instanceof UnsupportedActionError) {
    console.error('Unknown action:', error.actionType, error.method);
  }
}
```
