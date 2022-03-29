# Optin Reporting Backend

- [Overview](#overview)
- [Repository layout](#repository-layout)
- Instructions
    - [Requirement](#requirement)
    - [Installation](#installation)
    - [Docker](#docker)
    - [Test](#test)

## Overview

Optin reporting backend is a simple endpoint backend service build on nodejs it allow frontend to request optin record from database.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /src/client| Frontend web application. |
| /src/controllers| It handle logic and query data from database. |
| /src/data | Storage for sqlite database file, it consume from controller. |
| /src/models | It handle Data models for database. |
| /src/routers | It handle routing endpoint. |

## Requirement

Node.js 12.22.0 or later.

## Installation

1. Clone the project.

```
git clone https://github.com/symbol/product.git
```

2. Install the required dependencies.

```
cd optin/reporting
npm install
```

3. Start server.

```shell
npm run dev // Development
npm run start // Production
```

# docker

Build docker image

```
cd optin/reporting
docker build --platform x86_64 -t <imageName> .
```

# test

```
npm run test
```
