# :potable_water: Faucet Backend

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Requirement](#requirement)
    - [Usage](#usage)
    - [Installation](#installation)
    - [Test](#test)
    - [lint check](#lint)

## Overview

Faucet backend service built with NodeJS and Restify. It allows users to request testnet [XEM](https://testnet-explorer.nemtool.com) and [XYM](https://testnet.symbol.fyi) for development.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /src/controllers| It consumes data from service layers, and processes the data used by the backend. |
| /src/services | Service layer that mainly manages interactions with the NEM nodes. |
| /src/utils | Collection of utility functions. |

## Requirement

Node.js LTS

## Usage

Request tokens

``` bash
curl -X POST -H "Content-Type: application/json" \
    -d '{"address": "TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3", "amount": 10}' \
    http://localhost:8080/claim/xem
```

Response

```json
{
    "code":1,
    "type":1,
    "transactionHash":"9e7aefca8ad81ff37a2e8549539d922ccd821719a97e824a58814c3032f4dd85",
    "amount":10,
    "receiptAddress":"TCKH5L543TQKUPHIUAWMNYL7GNQYEY2UGMECB4D3"
}
```

## Installation

1. Clone the project.

```
git clone https://github.com/symbol/faucet-repo.git
```

2. Install the required dependencies.

```
cd backend
npm install
```

3. Create `.env` in [backend/](/backend/) root directory, containing all balance and amount in absolute units.
```env
NEM_FAUCET_ADDRESS=<Address>
NEM_FAUCET_PRIVATE_KEY=<private key>
NEM_ENDPOINT=http://hugetestalice.nem.ninja:7890
RECEIPT_MAX_BALANCE=200000000
SEND_OUT_MAX_AMOUNT=500000000
MOSAIC_DIVISIBILITY=6
PORT=8080
```

4. Start server.

```shell
npm run dev # Development
npm run start # Production
```

# test

```
npm run test
```

# lint

lint comment use for all file in [src](/backend/src/).
```
npm run lint
npm run lint:fix
```