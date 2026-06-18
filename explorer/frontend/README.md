# NEM Block Explorer

This project is a NEM blockchain explorer built using the Next.js framework. It provides a user-friendly interface to explore and interact with the NEM blockchain, including features such as transaction searches, block exploration, and statistic data visualization.

## Folder Structure

```plaintext
frontend/
├── api/              # Stable API interface; each module delegates to the active variant
├── components/       # Reusable React components
├── config/           # Configuration for the project
├── constants/        # Global constants used throughout the application
├── pages/            # Website pages .
├── public/           # Static assets, with per-variant subdirectories (public/<variant>/...)
├── styles/           # Global SCSS files
├── utils/            # Utility functions and helpers
└── variants/         # Per-variant overrides (api, styles, config, components, DocumentHead)
```

## Variants (multi-explorer)

This project builds a generic, protocol-agnostic explorer that can be compiled for multiple
blockchain **variants** (currently `nem` and `symbol`) from one codebase. The shared application
(routing, pages, components, hooks) lives at the top level; everything protocol-specific lives
under `variants/<variant>/` (API/data layer, theme tokens, page configuration, branding,
document head, and variant-only sections) and is resolved through `variants/` (the registry).

The active variant is selected at **build time** with the public environment variable
**`NEXT_PUBLIC_EXPLORER_VARIANT`** (`nem` | `symbol`). It is build-time because the
SCSS theme is compiled per variant; all other configuration stays runtime (injected via
`window.appConfig`). Each variant therefore produces its own build/image.

```bash
# Build and run the NEM variant
NEXT_PUBLIC_EXPLORER_VARIANT=nem npm run build && NEXT_PUBLIC_EXPLORER_VARIANT=nem npm run start

# Build and run the Symbol variant
NEXT_PUBLIC_EXPLORER_VARIANT=symbol npm run build && NEXT_PUBLIC_EXPLORER_VARIANT=symbol npm run start

# Per-variant Docker image
docker build --build-arg NEXT_PUBLIC_EXPLORER_VARIANT=symbol -t explorer-frontend-symbol .
```

## Environment Variables

All environment variables listed below are required for both development and production modes.

### Public Environment Variables

These variables are exposed to the browser, meaning they can be accessed both on the server and in the client-side code

- **`NATIVE_MOSAIC_ID`**: Native mosaic ID. Example: `nem.xem`.

- **`NATIVE_MOSAIC_TICKER`**: Native mosaic ticker. Example: `XEM`.

- **`NATIVE_MOSAIC_DIVISIBILITY`**: Native mosaic divisibility. Example: `6`.

- **`BLOCKCHAIN_UNWIND_LIMIT`**: Blockchain unwind limit. Example: `360`.

- **`REQUEST_TIMEOUT`**: The timeout duration (in milliseconds) for network requests made by the application. Example: `15000` (15 seconds).

- **`API_BASE_URL`**: Explorer REST API endpoint. Example: `http://explorer-backend.com:4000/api/nem`.

- **`SUPERNODE_API_URL`**: Supernodes API endpoint. Example: `https://nem.io/supernode/api`. When omitted, the home page hides the supernodes metric.

- **`NODELIST_URL`**: Node list endpoint. Example: `https://nodewatch.symbol.tools/api/nem/nodes`.

- **`MARKET_DATA_URL`**: Market data endpoint. Example: `https://marketdata.com/data/data?sym1=XEM&sym2=USD`.

- **`HISTORICAL_PRICE_URL`**: Historical coin price endpoint. Example: `https://marketdata.com/history/data?sym1=XEM`.

- **`SOCIAL_URL_TWITTER`**: The URL for the company's Twitter/X social profile. This can be used to display social media links in the application. Example: `https://twitter.com/company`.

- **`SOCIAL_URL_GITHUB`**: The URL for the company's GitHub organization. This can be used to display social media links in the application. Example: `https://github.com/company`.

- **`SOCIAL_URL_DISCORD`**: The URL for the company's Discord server. This can be used to display social media links in the application. Example: `https://discord.com/company`.

- **`FOOTER_URL_DOCS`**: The URL for the NEM documentation. Example: `https://website.com`.

- **`FOOTER_URL_TECHNICAL_REFERENCE`**: The URL for the NEM technical reference. Example: `https://website.com`.

- **`FOOTER_URL_FAUCET`**: The URL for the XEM Faucet. Example: `https://website.com`.

- **`FOOTER_URL_SUPERNODE_PROGRAM`**: The URL for the NEM Supernode Program. Example: `https://website.com`.

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

6. Add the known accounts config

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

2. Build the Docker image. The `NEXT_PUBLIC_EXPLORER_VARIANT` build arg is required (the build
   fails fast if it is missing):
```bash
# NEM
docker build --build-arg NEXT_PUBLIC_EXPLORER_VARIANT=nem -t symbolplatform/explorer-frontend .

# Symbol
docker build --build-arg NEXT_PUBLIC_EXPLORER_VARIANT=symbol -t symbolplatform/explorer-frontend-symbol .
```

## Running the Docker Container

Run the Docker container:
```bash
docker run -p 3000:3000 -v $(pwd)/public/accounts:/app/public/accounts symbolplatform/explorer-frontend
```

This command will start the container and expose the application on port 3000.

### Using Docker Compose

```bash
docker-compose up
```
