## :potable_water: Faucet Backend

Faucet backend is a simple endpoint backend service build on nodejs it allow user to request testnet [XEM](https://testnet-explorer.nemtool.com) and [XYM](https://testnet.symbol.fyi)(WIP) for development, it build on [Restify](http://restify.com/).

## Requirement

Node.js 12.22.0 or later

## Structure

- `services/nemRequest`: It's service layers, mainly doing API request from the nem nodes.
- `controllers/nem`: it consume data from service layers, and process the data use for backend.

## Usage

Request XEM faucet

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
git clone https://github.com/NemProject/backend-faucet.git
```

2. Install the required dependencies.

```
cd backend-faucet
npm install
```

## Development

1. Create `.env` in root directory.
```env
NEM_FAUCET_ADDRESS=<Address>
NEM_FAUCET_PRIVATE_KEY=<private key>
NEM_ENDPOINT=http://hugetestalice.nem.ninja:7890
RECEIPT_MAX_BALANCE=200000000 // 200
SEND_OUT_MAX_AMOUNT=500000000 // 500
MOSAIC_DIVISIBILITY=6
PORT=8080
```

2. running in development
```
npm run dev
```

3. Open [http://localhost:8080](http://localhost:8080) with your browser to see the result.

## Building instructions

```
npm run build
```