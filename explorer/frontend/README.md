# Explorer Frontend

This Next.js application powers the multi-variant explorer frontend for NEM and Symbol. Shared pages, components, and routing live at the top level, while protocol-specific behavior lives under `variants/<variant>/`.

## Folder Structure

```plaintext
frontend/
├── api/              # Stable API interface; each module delegates to the active variant
├── components/       # Reusable React components
├── config/           # Configuration for the project
├── constants/        # Global constants used throughout the application
├── pages/            # Website pages
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

Configuration is provided via environment variables (see `.env.nem.example` and `.env.symbol.example`). A consistent prefix
encodes **visibility** (build-time vs runtime, client vs server) and **scope** (common vs variant):

| Prefix | Reaches the browser? | Mutable without rebuild? |
| --- | --- | --- |
| `NEXT_PUBLIC_NAME` | ✅ | ❌ |
| `PUBLIC_NAME` | ✅ | ✅ |
| `NAME` | ❌ | ✅ |
| `PUBLIC_<VARIANT>_NAME` | ✅ | ✅ |
| `<VARIANT>_NAME` | ❌ | ✅ |

`NEXT_PUBLIC_*` values are baked into the build. `PUBLIC_*` values stay runtime-configurable and are exposed through `window.appConfig`. Variant-scoped keys should be read only inside `variants/<variant>/`.


### Known Accounts

1. Add or update entries in `public/accounts/known-accounts.json`.

Example:
```json
{
    "NDHEJKXY6YK7JGRFQT2L7P3O5VMUGR4BWKQNVXXQ": {
        "name": "Binance",
        "description": "Binance cold wallet",
        "image": "/accounts/images/binance.png"
    }
}
```

2. Add matching images to `public/accounts/images/`.

For the example above, the image path must resolve to `public/accounts/images/binance.png`.

## Requirements

- Node.js v22

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

5. Copy `.env.nem.example` or `.env.symbol.example` to `.env` and adjust the values for your deployment.

6. Add the known accounts config if your deployment needs it.

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
docker run -p 3000:3000 --env-file .env -v $(pwd)/public/accounts:/app/public/accounts symbolplatform/explorer-frontend
```

This command will start the container and expose the application on port 3000.

### Using Docker Compose

```bash
docker compose up
```
