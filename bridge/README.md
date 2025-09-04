# bridge

Two-way bridge between NEM/Symbol and Ethereum blockchains.

# Overview

This repository contains the implementation of a two-way bridge designed to facilitate asset transfers between NEM/Symbol and Ethereum blockchains.
The bridge supports both two-way (wrap/unwrap) and one-way transfers, enabling users to move assets like XYM or XEM onto Ethereum as wrapped tokens (e.g., wXYM) and vice versa.

The bridge operates through four core workflows that run periodically to maintain state and process transactions:
1. **download_balance_changes**: Downloads balance changes from a Rosetta endpoint to calculate historical balances at any height.
2. **download_wrap_requests**: Downloads wrap/unwrap requests, validates them, and stores them for processing.
3. **send_payouts**: Sends wrapped or native tokens to addresses specified in request messages.
4. **check_finalized_transactions**: Monitors sent transactions and marks them as complete once finalized.

Workflows 2-4 support an `--unwrap` flag for unwrap operations (wrap is the default). 
All workflows require a `--config` parameter pointing to a bridge configuration file.

The bridge supports:
- Wrapping native tokens from Symbol and NEM blockchains to wrapped tokens on Symbol, NEM, and Ethereum
- One-way conversion from native tokens on NEM and Symbol to native Ethereum tokens

**Note:** The bridge does not dynamically adjust token supply to avoid high gas costs on Ethereum. Supply must be managed manually.

# Setup

## Prerequisites:

```sh
apt-get update
apt-get install python3 python3-pip libssl-dev
```

## Creating Virtual Environment (Optional)

```sh
apt-get install python3-venv

cd symbol-product-directory/bridge
python3 -m venv venv
. venv/bin/activate
```

## Installation:

```sh
cd symbol-product-directory/bridge
python3 -m pip install -r requirements.txt
```

# Running

## Running Scripts

The bridge operates through a series of workflow scripts that should be run periodically in specific order:

```
. ../venv/bin/activate
PYTHONPATH=../. python3 -m workflows.download_balance_changes --config configuration.ini
PYTHONPATH=../. python3 -m workflows.download_wrap_requests --config configuration.ini
PYTHONPATH=../. python3 -m workflows.download_wrap_requests --config configuration.ini --unwrap
PYTHONPATH=../. python3 -m workflows.send_payouts --config configuration.ini
PYTHONPATH=../. python3 -m workflows.send_payouts --config configuration.ini --unwrap
PYTHONPATH=../. python3 -m workflows.check_finalized_transactions --config configuration.ini
PYTHONPATH=../. python3 -m workflows.check_finalized_transactions --config configuration.ini --unwrap
```

If the bridge is operating in one direction (e.g. exchanging native XYM to native ETH) unwrap commands should be skipped.

## Running API

The bridge provides a Flask API for integration.

```
. ../venv/bin/activate
export FLASK_RUN_PORT=5000
export BRIDGE_API_SETTINGS=/location/to/api_configuration.ini
FLASK_APP=bridge.api:create_app FLASK_ENV=development PYTHONPATH=../. python3 -m flask run
```

api_configuration.ini:
```
CONFIG_PATH="<path_to_bridge_configuration.ini>"
```

# Running using Docker

As an alternative to manually installing dependencies, you can use Docker:

## Running Scripts

```
docker run -d -it --name xym_wxym_bridge --restart always -v $(pwd):$(pwd) symbolplatform/bridge:1.0 /home/ubuntu/product/bridge/xym_wxym_bridge/run-bridge-docker.sh

$(pwd):$(pwd) - mounts the current working directory from the host into the same path in the container
```

## Running API

```
docker run -d -it --name xym_wxym_bridge_api --restart always -e BRIDGE_API_SETTINGS=$(pwd)/api_configuration.ini -p 5000:5000 -v $(pwd):$(pwd) symbolplatform/bridge:1.0
```

# Workflows

## Download Balance Changes

This workflow only supports wrap mode. It downloads all native chain blocks after the last processed block in the `block_changes` 
table up to the last finalized block. For initial setup, use the `balanceChangeScanStartHeight` 
configuration property to skip blocks prior to bridge account creation.

Each block is parsed and balance changes are stored in the block_changes database with:
- Height
- Currency (or mosaic ID)
- Amount (positive or negative)

A dummy entry is added with an empty currency and amount at the height of the last finalized (processed) block.
This ensures the next execution will not need to reprocess any blocks.

## Download Wrap Requests

This workflow operates in two modes:
- **wrap** (default): Processes request transactions on the native chain → `wrap_request` database
- **unwrap** - Processes request transactions on the wrapped chain → `unwrap_request` database

The workflow downloads all transactions sent to the bridge account after the latest request (or error) up to the last finalized block. 
Valid requests must:
- Transfer native tokens (wrap mode) or wrapped tokens (unwrap mode). If other tokens are sent, they are ignored.
- Include a recipient address for exchanged tokens

**Recipient Address Format by Network:**
- NEM/Symbol: Unencrypted address in message field
- Ethereum (unwrap only): Hexadecimal address in input data

Example Ethereum unwrap in ethers.js:

```js
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const ERC20_ABI = [
    'function transfer(address to, uint amount) public returns (bool)',
  ];

  const token = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, ERC20_ABI, wallet);
  const amountInWei = ethers.parseUnits(AMOUNT.toString(), TOKEN_DECIMALS);
  const recipientAddressHexadecimal = // convert base32 Symbol/NEM address to hexadecimal

  // Encode the transfer function
  const iface = new ethers.Interface(ERC20_ABI);
  const transferData = iface.encodeFunctionData('transfer', [BRIDGE_ADDRESS, amountInWei]);

  // Combine transfer data + Symbol/NEM address
  const fullData = transferData + recipientAddressHexadecimal;

  const tx = await wallet.sendTransaction({
    to: TOKEN_CONTRACT_ADDRESS,
    data: fullData,
    gasLimit: // calculate gas estimate,
    gasPrice: // calculate gas price
  });
```

Multisig (NEM) and aggregate (Symbol) transfers are supported. Aggregates can contain multiple inner transfer transactions that are valid requests.
In order to distinguish these, a tuple composed of the aggregate transaction and the inner transaction index is used as the unique identifier.

Valid requests are stored with `UNPROCESSED` status in the `wrap_request` table, while invalid requests are logged as errors (associated tokens are considered donations).
After all requests are processed, the heights of all valid requests are collected and the timestamp of each of them is retrieved. These timestamps are stored in the `block_metadata` table.

## Send Payouts

This workflow operates in two modes:
- `wrap` (default) - Processes requests from wrap_request database.
- `unwrap` - Processes requests from unwrap_request database.

The workflow:

1. Retrieves all UNPROCESSED requests from the `wrap_request` table.
2. Calculates conversion rate at request height using: `(cumulative_wrapped - cumulative_unwrapped) / native_balance` where:
   1. Native balance is the native token balance (e.g. XEM on NEM).
   2. Cumulative Wrapped is the total of wrapped token (e.g. wXEM) issued.
   3. Cumulative Unwrapped is the total of wrapped token returned (to be unwrapped).
3. Deducts network fees from payout amount.
4. Sends tokens to recipient.
5. Updates request status to `SENT` or `FAILED`, depending on status.

For wrap mode, conversion rates between native tokens on both chains are fetched from the price oracle to calculate fee deductions.
In expected deployment, the native balance should exceed the net wrapped balance. This is primarily due to the accrual of harvesting rewards, but can also be affected by other transfers (or donations).
As an example, consider 12000 native, 12000 wrapped and 2000 unwrapped. With these values, a wrapped token is worth [12000 / (12000 - 2000) = 6/5] native tokens. 
A depositor of 1200 native tokens will receive 1000 wrapped tokens. Conversely, a depositor of 1000 wrapped tokens will receive 1200 native tokens.

## Check Finalized Transactions

This workflow monitors unconfirmed payout transactions and updates their status once finalized on the network. 
It operates in both wrap and unwrap modes, processing the respective request databases.

# Simplified Transaction Flow and Fee Handling

Example flow with Symbol (XYM) as native chain and Ethereum (wXYM) as wrapped chain:

1. Deposit
   1. Alice sends 100 XYM to the bridge account on native (Symbol) network in order to convert XYM to wXYM.
   2. She pays the Symbol network transaction fee.
   3. Bridge does not initiate this transaction and pays no fees.
2. Wrapped token payment
   1. Send payouts (wrap) detects Alice's deposit.
   2. Transaction is created sending (δ * 100 - μ) wXYM to a Ethereum account.
   3. δ is the wXYM:XYM conversion rate
   4. μ is the wrapped (Ethereum) network transaction fee
      1. This is paid in ETH but withheld in wXYM.
      2. There is exchange rate risk and price oracle is used.
3. Redeem
   1. Alice sends 99 wXYM to the bridge account on wrapped (Ethereum) network in order to convert wXYM to XYM.
   2. She pays the Ethereum network fee.
   3. Bridge does not initiate this transaction and pays no fees.
4. Native token payment
   1. Send payouts (unwrap) detects Alice’s redemption request.
   2. Transaction is created sending (1/δ * 99 - μ) XYM to a Symbol account.
   3. δ is the wXYM:XYM conversion rate.
   4. μ is the native (Symbol) network transaction fee 
      1. This is paid in XYM and withheld in XYM.
      2. There is no exchange rate risk.

# Configuration

The bridge uses an INI configuration file with four sections: `machine`, `native_network`, `wrapped_network`, `price_oracle`.

## Example configuration:

```
[machine]
databaseDirectory = /home/ubuntu/product/bridge/xym_wxym_bridge/storage/db
logFilename = /home/ubuntu/product/bridge/xym_wxym_bridge/storage/log.log

[native_network]
blockchain = symbol
network = testnet
endpoint = https://201-sai-dual.symboltest.net:3001
bridgeAddress = TBQAAMLT4R6TPIZVWERYURELILHHMCERDWZ4FCQ
explorerEndpoint = https://testnet.symbol.fyi

mosaicId = id:72C0212E67A08BCE
signerPrivateKey = <removed>
signerPublicKey = BA3E3AD78C1B57604345845F7D8466F3270754B98203D8C72C75994292123AF5
balanceChangeScanStartHeight = 2645824
transactionFeeMultiplier = 100
rosettaEndpoint = http://ocracoke.nemtest.net:4000

[wrapped_network]
blockchain = ethereum
network = testnet
endpoint = https://erigon.symboltest.net:8545
bridgeAddress = 0x9B5b717FEC711af80050986D1306D5c8Fb9FA953
mosaicId = 0x5E8343A455F03109B737B6D8b410e4ECCE998cdA
signerPrivateKey = <removed>
signerPublicKey = 044838021ee42c74bcf411ab008ce01bc89356a61cd6dddc78dfcce9cc97bfe66c6380cc7c6228d7d449d8e28125387d4447e9ba7df6708dccfb6f21cdfeaa2eda
chainId = 3151908
isFinalizationSupported = False
explorerEndpoint = https://otterscan.symboltest.net

[price_oracle]
url=https://api.coingecko.com
```

## Configuration Sections

### [machine]
- logFilename: The file path where bridge operational logs will be written.
- databaseDirectory: The directory to store the bridge's internal database (e.g., for tracking requests and payout states).

### [native_network] and [wrapped_network]

#### Common Properties:
- blockchain: Type of blockchain (symbol, nem, ethereum). Ethereum is only available for `[wrapped_network]`.
- network: Network environment (testnet, mainnet).
- endpoint: Network's REST API node endpoint.
- bridgeAddress: Address for token conversion requests.
- signerPrivateKey: Private key for signing payout transactions.
- signerPublicKey: The public key corresponding to `signerPrivateKey`.
- mosaicId: Token identifier format varies by blockchain. Format {namespace name}:{mosaic name} for NEM; id:<hex mosaic id> for Symbol and contract address for Ethereum.
- explorerEndpoint: Block explorer URL.
- finalizationLookahead: Blocks to advance conceptual finalization (default: 0). For example, NEM finalization takes 360 blocks.
  Setting this property to 350, will assume finalization after 10 confirmations.
- percentageConversionFee: Conversion fee percentage (default: 0).
- unconfirmedWaitTimeSeconds: Time (in seconds) the bridge waits for a transaction to be confirmed on the native network (default: 60).
- transactionFeeMultiplier: A multiplier used to calculate transaction fees on the Symbol network.
- maxTransferAmount: The maximum amount of tokens allowed per single transfer operation on this network.

#### native_network

Properties for the native chain network.

- balanceChangeScanStartHeight: The block height from which the bridge will start scanning for balance changes (deposits to the bridgeAddress).
  This is an optimization; for maximum performance, set this to the block before the bridge address is created.
- rosettaEndpoint: (NEM only) NEM rosetta endpoint. This is required because NEM serves API and rosetta requests over different ports.

#### wrapped_network

Properties for the wrapped chain network. Since Ethereum is supported only as a wrapped network, all Ethereum-related properties belong to the '[wrapped_network]' section:
- chainId: The numeric Chain ID for the Ethereum network.
- isFinalizationSupported: Indicates whether finalization is supported by the Ethereum network (default: false).
- gasMultiple: Multiplier for the estimated gas limit (default: 1.15).
- gasPriceMultiple: Multiplier for the estimated gas price (legacy transactions) or base fee (default: 1.2).
- priorityFeeMultiple: Multiplier for the priority fee (tip) for EIP-1559 transactions (default: 1.05).
- feeHistoryBlocksCount: Number of past blocks to consider when fetching fee history for EIP-1559 gas price estimation (default: 10).

### [price_oracle]
- url: The URL of the price oracle API (e.g., CoinGecko) used to fetch real-time token prices, relevant when percentage conversion fees require cross-chain value lookups.

# Troubleshooting

## Ethereum transaction fees are too low or too high

Adjust fee multipliers in configuration:
- `gasMultiple`
- `gasPriceMultiple`
- `priorityFeeMultiple`

## Transactions Not Being Sent

Check if the bridge address has enough wrapped and native tokens to cover transaction fees.