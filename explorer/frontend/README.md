# NEM Block Explorer

This project is a NEM blockchain explorer built using the Next.js framework. It provides a user-friendly interface to explore and interact with the NEM blockchain, including features such as transaction searches, block exploration, and statistic data visualization.

## Folder Structure

```plaintext
frontend/
├── api/              # Functions for interacting with internal and external APIs
├── components/       # Reusable React components
├── config/           # Configuration for the project
├── constants/        # Global constants used throughout the application
├── pages/            # Website pages .
├── public/           # Images, fonts and other static assets
├── styles/           # Global SCSS files
└── utils/            # Utility functions and helpers
```

## Environment Variables

All environment variables listed below are required for both development and production modes.

### Public Environment Variables

These variables are prefixed with `NEXT_PUBLIC_` and are exposed to the browser, meaning they can be accessed both on the server and in the client-side code.

- **`NEXT_PUBLIC_NATIVE_MOSAIC_ID`**: Native mosaic ID. Example: `nem.xem`.

- **`NEXT_PUBLIC_NATIVE_MOSAIC_TICKER`**: Native mosaic ticker. Example: `XEM`.

- **`NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY`**: Native mosaic divisibility. Example: `6`.

- **`NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT`**: Blockchain unwind limit. Example: `360`.

- **`NEXT_PUBLIC_REQUEST_TIMEOUT`**: The timeout duration (in milliseconds) for network requests made by the application. Example: `15000` (15 seconds).

- **`NEXT_PUBLIC_API_BASE_URL`**: Explorer REST API endpoint. Example: `http://explorer-backend.com:4000/api/nem`.

- **`NEXT_PUBLIC_SUPERNODE_API_URL`**: Supernodes API endpoint. Example: `https://nem.io/supernode/api`.

- **`NEXT_PUBLIC_NODELIST_URL`**: Node list endpoint. Example: `https://nodewatch.symbol.tools/api/nem/nodes`.

- **`NEXT_PUBLIC_MARKET_DATA_URL`**: Market data endpoint. Example: `https://marketdata.com/data/data?sym1=XEM&sym2=USD`.

- **`NEXT_PUBLIC_HISTORICAL_PRICE_URL`**: Historical coin price endpoint. Example: `https://marketdata.com/history/data?sym1=XEM`.

- **`NEXT_PUBLIC_SOCIAL_URL_TWITTER`**: The URL for the company's Twitter/X social profile. This can be used to display social media links in the application. Example: `https://twitter.com/company`.

- **`NEXT_PUBLIC_SOCIAL_URL_GITHUB`**: The URL for the company's GitHub organization. This can be used to display social media links in the application. Example: `https://github.com/company`.

- **`NEXT_PUBLIC_SOCIAL_URL_DISCORD`**: The URL for the company's Discord server. This can be used to display social media links in the application. Example: `https://discord.com/company`.

- **`NEXT_PUBLIC_FOOTER_URL_DOCS`**: The URL for the NEM documentation. Example: `https://website.com`.

- **`NEXT_PUBLIC_FOOTER_URL_TECHNICAL_REFERENCE`**: The URL for the NEM technical reference. Example: `https://website.com`.

- **`NEXT_PUBLIC_FOOTER_URL_FAUCET`**: The URL for the XEM Faucet. Example: `https://website.com`.

- **`NEXT_PUBLIC_FOOTER_URL_SUPERNODE_PROGRAM`**: The URL for the NEM Supernode Program. Example: `https://website.com`.

### Known Accounts

To add information about known accounts to the application, follow these steps:

1. **Edit `known-accounts.json`**:

Add information about the account to the `known-accounts.json` file located in the `public/accounts` directory. This file maps account addresses to their corresponding metadata, such as name, description, and image.

Example of an entry in `known-accounts.json`:
```json
{
    "NDHEJKXY6YK7JGRFQT2L7P3O5VMUGR4BWKQNVXXQ": {
        "name": "Binance",
        "description": "Binance cold wallet",
        "image": "/accounts/images/binance.png"
    }
}
```

2. **Add Images**:

Place the corresponding image (e.g., company logo) in the `public/accounts/images` directory. The image file path must match the path specified in the image property of the `known-accounts.json` entry.

For example, for the entry above, the image file should be located at: `public/accounts/images/binance.png`.

## Requirements

- Node.js v20.11.0

## Installation

This project is part of a Product monorepo. Follow the steps below to set up and run the project.

1. Clone the repository from GitHub:
   ```bash
   git clone https://github.com/symbol/product.git
   ```

2. Initialize:
   ```bash
   bash init.sh
   ```

3. Navigate to the project folder:
   ```bash
   cd explorer/frontend
   ```

4. Install Node.js dependencies:
   ```bash
   npm install
   ```

5. Setup environment variables (or create `.env` file in `frontend/` root directory).

6. Add the known

## Building the Project

To build the project, run:
```bash
npm run build
```

## Running the Project

To run the built project, use:
```bash
npm run start
```

## Development Server

To run the development server, use:
```bash
npm run dev
```

## Running Tests

To run tests, use:
```bash
npm run test
```

## Linting

To run lint checks, use:
```bash
npm run lint
```

To fix lint issues, use:
```bash
npm run lint:fix
```

## Building the Docker Image

1. Make sure you are in the explorer/frontend directory.

2. Build the Docker image:
```bash
docker build -t symbolplatform/explorer-frontend .
```

## Running the Docker Container

Run the Docker container:
```bash
docker run -p 3000:3000 -v $(pwd)/accounts:/app/public/accounts symbolplatform/explorer-frontend
```

This command will start the container and expose the application on port 3000.

### Using Docker Compose

```bash
docker-compose up
```
