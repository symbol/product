# shoestring

# CLI Commands

## Setup Commands

### init

Extracts a template shoestring configuration file from a package that the user can then customize.

```
init [--package PACKAGE] config

  config             path to shoestring configuration file
  --package PACKAGE  Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)
```

### min-cosignatures-count

Automatically detects the minimum cosignatures required for an account and optionally updates the shoestring configuration file.

```
min-cosignatures-count --config CONFIG --ca-key-path CA_KEY_PATH [--update]

  --config CONFIG           path to shoestring configuration file
  --ca-key-path CA_KEY_PATH path to main private key PEM file
  --update                  update the shoestring configuration file
```

### import-bootstrap

Imports settings from a symbol-bootstap installation.


```
import-bootstrap --config CONFIG --bootstrap BOOTSTRAP

  --config CONFIG       path to shoestring configuration file
  --bootstrap BOOTSTRAP path to bootstrap target directory
```

### pemtool

Generates a main private key PEM file that can be used by shoestring.

```
pemtool --output OUTPUT [--input INPUT] [--ask-pass] [--force]

  --output OUTPUT  output PEM key file
  --input INPUT    input private key file (optional)
  --ask-pass       encrypt PEM with a password (password prompt will be shown)
  --force          overwrite output file if it already exists
```

### setup

Sets up a Symbol node from scratch

```
setup \
    --config CONFIG \
    [--package PACKAGE] \
    [--directory DIRECTORY] \
    [--overrides OVERRIDES] \
    [--metadata METADATA] \
    [--security {default,paranoid,insecure}] \
    --ca-key-path CA_KEY_PATH

  --config CONFIG           path to shoestring configuration file
  --package PACKAGE         Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)
  --directory DIRECTORY     installation directory (default: $HOME)
  --overrides OVERRIDES     path to custom user settings
  --metadata METADATA       custom node metadata (this is only valid for API roles)
  --security                security mode (default: default)
  --ca-key-path CA_KEY_PATH path to main private key PEM file
```

Please note that only security mode "default" is supported at this time.

This command will generate a transaction that will need to be sent to the network using `announce-transaction` to update the network state.

## Operational Commands

### signer

Signs a transaction that can then be announced to the network

```
signer --config CONFIG --ca-key-path CA_KEY_PATH [--save] filename

  filename                  transaction binary payload
  --config CONFIG           path to shoestring configuration file
  --ca-key-path CA_KEY_PATH path to main private key PEM file
  --save                    save signed payload into same file as input
```

### announce-transaction

Announces a transaction to the network.

```
announce-transaction --config CONFIG --transaction TRANSACTION

  --config CONFIG           path to shoestring configuration file
  --transaction TRANSACTION file containing serialized transaction to send
```

### health

Checks the health of the local Symbol node.


```
health [-h] --config CONFIG [--directory DIRECTORY]

  --config CONFIG       path to shoestring configuration file
  --directory DIRECTORY installation directory (default: $HOME)
```

## Upgrade Commands

### upgrade

Upgrades a node to the latest client version.

```
upgrade \
    --config CONFIG \
    [--package PACKAGE] \
    [--directory DIRECTORY] \
    [--overrides OVERRIDES] \
    [--metadata METADATA]

  --config CONFIG           path to shoestring configuration file
  --package PACKAGE         Network configuration package. Possible values: (name | file:///filename | http(s)://uri) (default: mainnet)
  --directory DIRECTORY     installation directory (default: $HOME)
  --overrides OVERRIDES     path to custom user settings
  --metadata METADATA       custom node metadata (this is only valid for API roles)
```

### renew-certificates

Renews peer certificates.

```
renew-certificates --config CONFIG [--directory DIRECTORY] --ca-key-path CA_KEY_PATH [--renew-ca]

  --config CONFIG           path to shoestring configuration file
  --directory DIRECTORY     installation directory (default: $HOME)
  --ca-key-path CA_KEY_PATH path to main private key PEM file
  --renew-ca                renews CA certificate too
```

When `--renew-ca` is set, both CA and node certificates will be regenerated. Otherwise, only node certificate will be.

### renew-voting-keys

Renews voting keys.

```
renew-voting-keys --config CONFIG [--directory DIRECTORY]

  --config CONFIG           path to shoestring configuration file
  --directory DIRECTORY     installation directory (default: $HOME)
```

This command will generate a transaction that will need to be sent to the network using `announce-transaction` to update the network state.

### reset-data

Resets blockchain state to allow a resync from scratch.

```
reset-data --config CONFIG [--directory DIRECTORY] [--purge-harvesters]

  --config CONFIG           path to shoestring configuration file
  --directory DIRECTORY     installation directory (default: $HOME)
  --purge-harvesters        purge harvesters.dat file
```

When `--purge-harvesters` is set, delegates discovered using old keys will be discarded.


## Files

### Shoestring Configuration INI

INI file used by shoestring to customize a Symbol node deployment.
It is composed of five sections: `network`, `images`, `services`, `transaction`, `imports`, `node`.

#### network

Describes properties of network that deployed node should connect with.
These should match values in `config-network.properties` Symbol configuration file.
If `init` command is used, these values shouldn't be modified

```
name                  Network name
identifier            Network numeric identifier
epochAdjustment       Network epoch adjustment
generationHashSeed    Network generation hash seed
```

#### images

Describes Symbol docker images to use.
If `init` command is used, these values shouldn't be modified
```
client  Catapult client docker image
rest    REST docker image
```

#### services

Describes network services to use during deployment.
If `init` command is used, these values shouldn't be modified

```
nodewatch  URL to nodewatch service.
```

#### transactions

Describes properties of generated transactions.
If `init` command is used, most of these values _generally_ shouldn't be modified.
`min-cosignatures-count` command can be used to automatically update `minCosignaturesCount` setting.

General properties:
```
feeMultiplier             Min fee multiplier of generated transactions
timeoutHours              Timeout of generated transactions (in hours)
minCosignaturesCount      Minimum number of cosignatures generated transactions will require
```

When `signer` command is signing an aggregate bonded transaction, it will additionally generate a hash lock transaction
using the following properties:
```
hashLockDuration          Hash lock duration in blocks
currencyMosaicId          Network currency mosaid id
lockedFundsPerAggregate   Locked funds per aggregate
```

#### imports

Describes keys to import.
These need to be manually set if there are harvesting and/or voting keys that need to be imported.

```
harvester Path to a config-harvesting.properties Symbol configuration file containing harvesting keys to import
voter     Path to a directory containing private_key_tree*.day files to import
```

#### node

Describes settings to customize a node.

`features` supports the following:
* `PEER` - Peer support
* `API` - REST support
* `HARVESTER` - Node will be configured to harvest and accept delegated harvesters
* `VOTER` - Node will be configured to vote

`caPassword` supports all available openssl passphrase options: https://www.openssl.org/docs/man3.0/man1/openssl-passphrase-options.html.

```
features       One or more node features to deploy (| delimited)
userId         User id of node used to set process and file permissons
groupId        Group id of node used to set process and file permissons
caPassword     Password of CA (main) PEM private key file (if applicable)
apiHttps       Set to enable HTTPS REST (only applicable when features include API)

caCommonName   Common name of generated CA certificates
nodeCommonName Common name of generated Node certificates
```

### Overrides

INI file that is used to customize advanced Symbol settings.

Sections should have the format `[<config-short-name>.<config-section>]`.
Section contents will then be applied to the appropriate Symbol configuration file.

For example, in order to set two custom settings:
1. `connectTimeout` - located in the `config-node.properties` file in section `node`
1. `maxUnlockedAccounts` - located in the `config-harvesting.properties` file in section `harvesting`

The following snippet will suffice:

```ini
[node.node]

connectTimeout = 5s

[harvesting.harvesting]

maxUnlockedAccounts = 2
```

Notice that these custom settings are applied *BEFORE* shoestring updates the Symbol configuration files.
In cases of conflicts, the shoestring changes will take precedence.

### Node Metadata

JSON file that is ingested and used to replace the contents of `nodeMetadata` in rest.json.
This data is then accessible via the `node/metadata` REST endpoint.
This file is optional and only used for deployments including API role.

## Prerequisites:

    apt-get install python3 python3-pip openssl
    python3 -m pip install -r requirements.txt

## Temporarily (until lightapi package fix):

```
cd product/lightapi/python
./scripts/ci/setup_lint.sh
./scripts/ci/lint.sh
./scripts/ci/test.sh

# to run shoestring

PYTHONPATH=}full path here{/product/lightapi/python python3 -m shoestring
```
