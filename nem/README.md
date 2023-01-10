# :potable_water: Faucet Frontend

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Installation](#installation)
    - [Test](#test)
    - [lint check](#lint)

# Overview

NEM faucet frontend is a simple web application build on react. It allows a user to enter an address and an amount in order to request XEM tokens from the faucet.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /src/__mocks__ | Unit test config setup. |
| /src/assets | Static artifacts including fonts, images and icons. |
| /src/components | React components, including the faucet form. |
| /src/config | Collection of settings. |
| /src/locales | Language files. |
| /src/pages | Faucet web page. |
| /src/styles | Global SCSS stylesheets used in NEM projects. |
| /src/utils | Collection of utility functions. |

## Installation

1. Clone the project.

```
git clone https://github.com/symbol/faucet.git
```

2. Install the required dependencies.

```
cd nem
npm install
```

3. Create `.env` in [nem/](/nem/) root directory, all balance and amount in absolute units.

```env
REACT_APP_FAUCET_ADDRESS=<Address>
REACT_APP_REQ_FAUCET_BALANCE=10000000 // 10 xem
REACT_APP_MAX_SEND_AMOUNT=500000000 // 500 xem
REACT_APP_BACKEND_URL=http://127.0.0.1:5001
REACT_APP_AUTH_URL=http://127.0.0.1:5002
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

lint comment use for all file in [src](/nem/src/).
```
npm run lint
npm run lint:fix
```
