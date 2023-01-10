# Twitter Authenticator

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Requirement](#requirement)
    - [Installation](#installation)
    - [Test](#test)
    - [lint check](#lint)

## Overview

Twitter authenticator is independent microservices built with NodeJS and Restify. It issue jwt auth token, and use the token to request testnet tokens.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /src/config | Collection of settings. |
| /src/controllers| Handle authentication logic. |
| /src/routers | Defines all the endpoint routes. |
| /src/utils | Collection of utility functions. |

## Requirement

Node.js LTS

## Installation

1. Clone the project.

```
git clone https://github.com/symbol/faucet.git
```

2. Install the required dependencies.

```
cd authenticator
npm install
```

3. Create `.env` in [authenticator/](/authenticator/) root directory
```env
PORT=5002
TWITTER_APP_KEY=appkey
TWITTER_APP_SECRET=secret
TWITTER_CALLBACK_URL=http://127.0.0.1:3000
JWT_SECRET=secret
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

lint comment use for all file in [src](/authenticator/src/) and [test/](/authenticator/test/).
```
npm run lint
npm run lint:fix
```
