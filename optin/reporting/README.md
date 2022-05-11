# Optin Reporting tools

- [Optin Reporting tools](#optin-reporting-tools)
  - [Overview](#overview)
  - [Repository layout](#repository-layout)
  - Instructions
    - [Requirements](#requirements)
    - [Installation](#installation)
    - [Docker](#docker)
    - [Test](#test)

## Overview

Optin reporting tools allow the user to view, export csv or search for specific optin records.

## Repository layout

| Folder Name | Description |
| -------------|--------------|
| /src/client| Frontend web application. |
| /src/controllers| Controllers for handling application logic and querying databases. |
| /src/data | Data storage for sqlite database files, consumed by the backend services. |
| /src/models | Database models where data access logic resides. |
| /src/routers | Routers for REST API endpoints. |
| /src/utils | Utility functions such as validations and conversions. |

## Requirements

Node.js 16.x or later.

## Installation

1. Clone the project.

    ```
    git clone https://github.com/symbol/product.git
    cd ./product
    ```
2. Initialize the git submodules (skip this part if already done)
    ```
    bash ./init.sh
    ```
3.  Navigate to `optin/reporting` folder.
    ```
    cd optin/reporting
    ```
4. Install the required dependencies.
    ```
    npm install
    ```
5. Start server.

    ```
    npm run start
    ```

## Docker

Build docker image

```
# inside the optin/reporting folder
docker build --platform x86_64 -t <imageName> .
```

## Test

```
npm run test
```
