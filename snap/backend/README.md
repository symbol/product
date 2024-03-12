# Snap Backend

- [Overview](#overview)
- Instructions
    - [Installation](#installation)
    - [Test](#test)
    - [Lint](#lint)

# Overview

The Snap backend is Symbol snap wallet build on top of metamask snap. It allows a user to create symbol account using metamask's secret recovery phrase and interact with symbol blockchain, allowing announce different type of transactions.

## Installation

1. Clone the project.

```shell
git clone https://github.com/symbol/product.git
```

2. Install the required dependencies.

```shell
cd snap/backend
npm install
```

3. Start application.

```shell
npm start
```

4. Visit [Snaps Simulator](https://metamask.github.io/snaps/snaps-simulator/latest/#/handler/onRpcRequest) in your browser.

5. Start interacting simulator with snap backend.

# test

```shell
npm run test
```

# lint

lint comment use for all file.

```shell
npm run lint
npm run lint:fix
```
