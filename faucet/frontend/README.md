# :potable_water: Faucet Frontend

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Installation](#installation)
    - [Test](#test)
    - [lint check](#lint)

# Overview

NEM and Symbol faucet frontend is a simple web application build on NextJS framework. It allows a user to enter an address and an amount in order to request XEM or XYM tokens from the faucet.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /app | Contains the primary layout and pages for the application. |
| /components/common | Contains shared components utilized across both the NEM and Symbol faucet of the application. |
| /components/nem | Contains the components specifically designed for the NEM faucet web page. |
| /components/symbol | Contains the components specifically designed for the Symbol faucet web page. |
| /scripts | Jenkins ci scripts |
| /utils | Collection of utility functions. |

## Installation

1. Clone the project.

```
git clone https://github.com/symbol/product.git
```

2. Install the required dependencies.

```
cd faucet/frontend
npm install
```

3. Create `.env` in [frontend/](/frontend/) root directory, all balance and amount in absolute units.

```env
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:5001
NEXT_PUBLIC_AUTH_URL=http://127.0.0.1:5002
```

For NEM Faucet set:
```env
NEXT_PUBLIC_BUILD_TARGET=nem
```

For Symbol Faucet set:
```env
NEXT_PUBLIC_BUILD_TARGET=symbol
```

4. Start application.

```shell
npm start
```

5. Visit http://localhost:3000/#/ in your browser.

# test

```
npm run test
```

# lint

lint comment use for all file in [src](/frontend/src/).
```
npm run lint
npm run lint:fix
```
