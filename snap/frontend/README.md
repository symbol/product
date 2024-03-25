# Snap Frontend

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Installation](#installation)
    - [Test](#test)
    - [lint](#lint)

## overview

Snap fronted is a Symbol wallet application built on the NextJS framework. It must connect to the Snap backend to interact with the Symbol blockchain.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /app | Contains the primary layout and pages for the application. |
| /scripts | Jenkins ci scripts |

## Installation

1. Clone the project.

```shell
git clone https://github.com/symbol/product.git
```

2. Install the required dependencies.

```shell
cd snap/frontend
npm install
```

3. Start application.

```shell
npm run start
```

4. Visit http://localhost:3000/#/ in your browser.


## Test

```shell
npm test
```

## lint

```shell
npm run lint
npm run lint:fix
```
