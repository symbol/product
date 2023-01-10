# Faucet

- [Overview](#overview)
- [Repository Layout](#repository-layout)
- [Getting Help](#getting-help)
- [License](#license)

## Overview

Faucet is a simple application that allows the user to request testnet network currency to do development. it supports NEM and SYMBOL. In order to request a tokens, the user is required to sign on with a Twitter account with a minimum **10 followers** and registered **at least 31 days**.

![SYSTEM ARCHITECTURE DESIGN](https://symbolblog.com/wp-content/uploads/2022/12/Picture-1.png)

## Repository layout

| Folder name | Description |
| -------------|--------------|
| [`/backend`](backend/) | Rest API service that uses Twitter OAuth login, requests tokens and sends it out. |
| [`/nem`](nem/) | Frontend application for NEM. |
| [`/symbol`](symbol/) | Fronted application for SYMBOL. |
| [`/tests`](tests/) | Collection of tests. |

## Getting Help

- [Symbol Developer Documentation][developer documentation]
- [Symbol Technical Reference][technical reference]
- Join the community [discord][discord]
- If you found a bug, [open a new issue][issues]

## License

Copyright (c) 2022 NEM & Symbol Contributors, licensed under the [MIT license](LICENSE).

[developer documentation]: https://docs.symbolplatform.com/
[discord]: https://discord.gg/fjkWXyf
[issues]: https://github.com/symbol/faucet/issues
[technical reference]: https://symbol.github.io/symbol-technicalref/main.pdf