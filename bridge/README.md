# Bridge

Two-way bridge between NEM/Symbol and Ethereum.

## Overview

This repository contains the implementation of a bridge with two modes of operation:

* In **wrapped** mode, it converts native NEM (`XEM`) and Symbol (`XYM`) tokens into their wrapped counterparts
    (e.g. `wXYM`) on NEM, Symbol, or Ethereum.
    The reverse operation, unwrapping, is also supported.

* In **native** mode, it converts `XEM` and `XYM` into Ethereum's native token, `ETH`,
    using an exchange rate from an online price provider.
    This mode is intended only to supply the target Ethereum account with enough `ETH` to cover gas fees.
    It does not support the reverse operation and the maximum transfer amount is limited by a configuration setting.

Each bridge instance is configured with a specific mode and a defined set of source (NEM or Symbol)
and target (NEM, Symbol, or Ethereum) networks.
The bridge maintains accounts on both the source and target networks and monitors them for incoming requests.
The account on the target network must be manually pre-funded and replenished as needed to ensure
the bridge can continue processing requests.

To use the bridge, a user simply transfers tokens to the bridge account on one network,
including a message that specifies the destination address on the other network where the counterpart should be delivered.

The bridge operates through four core workflows, each implemented as a script that runs periodically
to maintain state and process transactions.
These scripts are executed sequentially, in the order listed below:

1. `download_balance_changes`: Retrieves balance updates to the bridge accounts on the source networks.
    It uses a [Mesh](https://docs.cdp.coinbase.com/mesh/product-overview/welcome) endpoint (formerly Rosetta) to compute
    historical balances at any block height.

2. `download_wrap_requests`: Collects wrap and unwrap requests, validates them, and stores them for processing.

3. `send_payouts`: Executes payouts by sending wrapped or native tokens to the addresses specified in request messages.

4. `check_finalized_transactions`: Tracks outgoing transactions and marks them as complete once finalized.

Workflows 2 through 4 are executed twice, once with the `--unwrap` parameter and once without,
to handle both directions of the bridge.

## Setup

### Prerequisites

The bridge is written in Python so it must be available.

```sh
apt-get update
apt-get install python3 python3-pip libssl-dev
```

### Creating Virtual Environment (Optional)

```sh
apt-get install python3-venv

cd symbol-product-directory/bridge
python3 -m venv venv
. venv/bin/activate
```

### Installation

```sh
cd symbol-product-directory/bridge
python3 -m pip install -r requirements.txt
```

## Manual Operation

### Running the Bridge

The following scripts must be executed periodically from `symbol-product-directory/bridge`, in the order shown:

```sh
. ./venv/bin/activate
PYTHONPATH=../. python3 -m workflows.download_balance_changes --config configuration.ini
PYTHONPATH=../. python3 -m workflows.download_wrap_requests --config configuration.ini
PYTHONPATH=../. python3 -m workflows.download_wrap_requests --config configuration.ini --unwrap
PYTHONPATH=../. python3 -m workflows.send_payouts --config configuration.ini
PYTHONPATH=../. python3 -m workflows.send_payouts --config configuration.ini --unwrap
PYTHONPATH=../. python3 -m workflows.check_finalized_transactions --config configuration.ini
PYTHONPATH=../. python3 -m workflows.check_finalized_transactions --config configuration.ini --unwrap
```

If the bridge is configured in **native mode** (exchanging native XYM for native ETH),
all commands with the `--unwrap` parameter must be skipped.
In this mode, the bridge operates only in one direction.

All commands require a configuration file, specified with the `--config` parameter.
The expected contents of this file are described in the [Configuration](#configuration) section.

The more frequently the scripts are run, the faster bridging requests are processed,
but at the cost of higher hardware usage.
Considering the average block times of the supported networks, running the scripts every 15 seconds provides
a good balance.

### Exposing the API

The bridge exposes an HTTP API which allows external systems to query its status.
For example, the API can return the list of pending wrap and unwrap requests for a given account,
or provide details about past errors.
An OpenAPI specification for this API will be provided soon.

The API has been developed using [Flask](https://flask.palletsprojects.com/en/stable/).
To expose it, run:

```sh
. ../venv/bin/activate
export FLASK_RUN_PORT=5000
export BRIDGE_API_SETTINGS=/path/to/api_configuration.ini
FLASK_APP=bridge.api:create_app FLASK_ENV=development PYTHONPATH=../. python3 -m flask run
```

The API requires its own configuration file (`api_configuration.ini` in the command above):

```ini
CONFIG_PATH="<path_to_bridge_configuration.ini>"
```

## Running using Docker

As an alternative to manually installing dependencies and running scripts, you can use Docker.

### Running the Bridge

```sh
docker run -d -it --name xym_wxym_bridge --restart always -v $(pwd):$(pwd) symbolplatform/bridge:1.0 /home/ubuntu/product/bridge/xym_wxym_bridge/run-bridge-docker.sh
```

**Note**: `$(pwd):$(pwd)` mounts the current working directory from the host into the same path in the container.

### Exposing the API

```sh
docker run -d -it --name xym_wxym_bridge_api --restart always -e BRIDGE_API_SETTINGS=$(pwd)/api_configuration.ini -p 5000:5000 -v $(pwd):$(pwd) symbolplatform/bridge:1.0
```

## Workflows

### Download Balance Changes

This workflow retrieves all native chain blocks after the last processed block up to the most recently finalized block.
Each block is parsed, and any balance changes to the bridge's native account are stored in the `block_changes` database
with the following information:

* Block height where the balance change occurred
* Currency (or mosaic ID)
* Change amount (positive or negative)

These records are used to track the amount native tokens in the bridge account at all times,
which in turn determines the exchange rate for wrapped tokens.

For initial setup, use the `balanceChangeScanStartHeight` configuration property to skip blocks that were created
before the bridge account existed.

Finally, a dummy entry is added at the height of the last finalized (processed) block,
with an empty currency and amount, to ensure the next execution does not reprocess already handled blocks.

### Download Wrap Requests

This workflow operates in two modes:

* **wrap** (default): Detects request transactions on the native chain and stores them in the `wrap_request` database.
* **unwrap**: Detects request transactions on the target chain and stores them in the `unwrap_request` database.

To do this, the script retrieves all transactions sent to the relevant bridge account, starting after the last
recorded request (or error) and continuing up to the latest finalized block.

Valid requests are transactions that:

* Transfer native tokens (wrap mode) or wrapped tokens (unwrap mode). Any other tokens are ignored.
* Include the destination address where the exchanged tokens should be delivered:

    * For NEM and Symbol transactions, the address must be provided in an unencrypted message field.
    * For Ethereum transactions (unwrap only), the address must be provided as a hexadecimal value
        in the transaction's input data.

Example Ethereum unwrap using `ethers.js`:

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

Multisig (NEM) and aggregate (Symbol) transfers are supported.
Aggregates can contain multiple inner transfer transactions that are valid requests.
In order to distinguish these, the workflow uses a tuple composed of the aggregate transaction and
the inner transaction index as the unique identifier.

Valid requests are stored with `UNPROCESSED` status in the `wrap_request` table,
while invalid requests are logged as errors (associated tokens are considered donations).
After all requests are processed, the heights of all valid requests are collected and the timestamp of each of them
is retrieved. These timestamps are stored in the `block_metadata` table.

### Send Payouts

This workflow operates in two modes:

* **wrap** (default): Processes requests from the `wrap_request` database.
* **unwrap**: Processes requests from the `unwrap_request` database.

The workflow:

1. Retrieves all `UNPROCESSED` requests from the `wrap_request` table.
2. Calculates conversion rate at request height as `(cumulative_wrapped - cumulative_unwrapped) / native_balance` where:
   * `native_balance` is the native token balance (e.g. `XEM` on NEM).
   * `cumulative_wrapped` is the total amount of existing wrapped tokens (e.g. `wXEM`).
   * `cumulative_unwrapped` is the total amount of wrapped tokens to be unwrapped.
3. Deducts network fees from payout amount.
4. Sends tokens to recipient.
5. Updates request status to `SENT` or `FAILED`, depending on status.

For wrap mode, conversion rates between native tokens on both chains are fetched from the price oracle to calculate fee deductions.
Once a bridge is deployed, the native balance is expected to exceed the net wrapped balance.
This is primarily due to the accrual of harvesting rewards, but can also be affected by other transfers (or donations).

As an example, consider 12000 native, 12000 wrapped and 2000 unwrapped.
With these values, a wrapped token is worth 12000 / (12000 - 2000) = 6/5 native tokens.
A depositor of 1200 native tokens will receive 1000 wrapped tokens.
Conversely, a depositor of 1000 wrapped tokens will receive 1200 native tokens.

### Check Finalized Transactions

This workflow monitors unconfirmed payout transactions and updates their status once finalized on the network.
It operates in both wrap and unwrap modes, processing the respective request databases.

## Simplified Transaction Flow and Fee Handling

Example flow with Symbol (`XYM`) as native chain and Ethereum (`wXYM`) as wrapped chain:

1. Deposit
   * Alice sends 100 `XYM` to the bridge account on the native network (Symbol) in order to convert `XYM` to `wXYM`.
   * She pays the Symbol network transaction fee.
   * Bridge does not initiate this transaction and pays no fees.
2. Wrapped token payment
   * The `send_payouts` script (in wrap mode) detects Alice's deposit.
   * An Ethereum transaction is created sending (δ * 100 - μ) wXYM to the requested account.
   * δ is the `wXYM:XYM` conversion rate.
   * μ is the Ethereum transaction fee.
      * This is paid in `ETH` but withheld in `wXYM`.
      * There is exchange rate risk and a price oracle is used.
3. Redemtion
   * Alice sends 99 `wXYM` to the bridge account on the wrapped network (Ethereum) in order to convert `wXYM` to `XYM`.
   * She pays the Ethereum network fee.
   * Bridge does not initiate this transaction and pays no fees.
4. Native token payment
   * The `send_payouts` script (in unwrap mode) detects Alice's redemption request.
   * A Symbol transaction is created sending (1/δ * 99 - μ) `XYM` to the requested Symbol account.
   * δ is the `wXYM:XYM` conversion rate.
   * μ is the native (Symbol) network transaction fee
      * This is paid in `XYM` and withheld in `XYM`.
      * There is no exchange rate risk.

## Configuration

The bridge uses an INI configuration file with four sections: `machine`, `native_network`, `wrapped_network`, `price_oracle`.

### `machine` section

* `logFilename`: The file path where bridge operational logs will be written.
* `databaseDirectory`: The directory to store the bridge's internal database (e.g., for tracking requests and payout states).

### Properties common to `native_network` and `wrapped_network` sections

These are properties shared by the `native_network` and `wrapped_network` sections,
meaning that they can appear twice in the configuration file.

* `blockchain`: Type of blockchain (`symbol`, `nem`, `ethereum`). Ethereum is only available for `[wrapped_network]`.
* `network`: Network environment (`testnet`, `mainnet`).
* `endpoint`: Network's REST API node endpoint.
* `bridgeAddress`: Address where tokens should be sent to trigger a wrap or unwrap operation.
* `signerPrivateKey`: Private key for signing payout transactions.
* `signerPublicKey`: The public key corresponding to `signerPrivateKey`.
* `mosaicId`: Token identifier format varies by blockchain:
    * On NEM: `{namespace name}:{mosaic name}`
    * On Symbol: `id:{hex mosaic id}`
    * On Ethereum: Address of the ERC-20 contract.
* `explorerEndpoint`: Block explorer URL.
* `finalizationLookahead`: Blocks to advance conceptual finalization (default: 0).
    For example, NEM finalization takes 360 blocks.
    Setting this property to 350, will assume finalization after 10 blocks.
* `percentageConversionFee`: A percentage of every wrap and unwrap operation is kept at the bridge as a fee (default: 0).
    Must be a number between 0 and 1.
* `unconfirmedWaitTimeSeconds`: Time (in seconds) the bridge waits for a transaction to be confirmed on the native network (default: 60).
* `transactionFeeMultiplier`: A multiplier used to calculate transaction fees on the Symbol network.
* `maxTransferAmount`: The maximum amount of tokens allowed per single transfer operation on this network.

### `native_network` section

Properties for the native network.

* `balanceChangeScanStartHeight`: The block height from which the bridge will start scanning for balance changes (deposits to the `bridgeAddress`).
    This is an optimization: for maximum performance, set this to the block before the bridge address is created.
* `rosettaEndpoint`: (NEM only) NEM rosetta endpoint. This is required because NEM serves API and Rosetta requests over different ports.

### `wrapped_network` section

Properties for the wrapped network.

Since Ethereum is supported only as a wrapped network, all Ethereum-specific properties belong to the `wrapped_network` section:

* `chainId`: The numeric Chain ID for the Ethereum network.
* `isFinalizationSupported`: Indicates whether finalization is supported by the Ethereum network (default: false).
* `gasMultiple`: Multiplier for the estimated gas limit (default: 1.15).
* `gasPriceMultiple`: Multiplier for the estimated gas price (legacy transactions) or base fee (default: 1.2).
* `priorityFeeMultiple`: Multiplier for the priority fee (tip) for EIP-1559 transactions (default: 1.05).
* `feeHistoryBlocksCount`: Number of past blocks to consider when fetching fee history for EIP-1559 gas price estimation (default: 10).

### `price_oracle` section

* `url`: The URL of the price oracle API (e.g., CoinGecko) used to fetch real-time token prices
    when percentage conversion fees require cross-chain value lookups.

### Example configuration

```ini
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

## Troubleshooting

* **Ethereum transaction fees are too low or too high**

    Adjust fee multipliers in configuration:

    * `gasMultiple`
    * `gasPriceMultiple`
    * `priorityFeeMultiple`

* **Transactions not being sent**

    Check if the bridge address has enough wrapped and native tokens to cover transaction fees.
