# NEM Block Explorer

This project is a NEM blockchain explorer built using the Next.js framework. It provides a user-friendly interface to explore and interact with the NEM blockchain, including features such as transaction searches, block exploration, and statistic data visualization.

## Folder Structure

- **api/**: Contains modules for making requests to APIs to fetch data.
- **components/**: Contains reusable UI components.
- **config/**: Contains app configuration and reexports environment variables.
- **constants/**: Contains constants used across the app.
- **pages/**: Contains the pages of the application.
- **public/**: Contains static files.
- **scripts/**: Contains CI scripts.
- **styles/**: Contains stylesheets.
- **utils/**: Contains commonly used functions.
- **.env**: Contains environment variables.

## Environment Variables

- `NEXT_PUBLIC_NATIVE_MOSAIC_ID`: Native mosaic ID
- `NEXT_PUBLIC_NATIVE_MOSAIC_TICKER`: Native mosaic ticker
- `NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY`: Native mosaic divisibility
- `NEXT_PUBLIC_BLOCKCHAIN_UNWIND_LIMIT`: Blockchain unwind limit
- `NEXT_PUBLIC_REQUEST_TIMEOUT`: Request timeout
- `NEXT_PUBLIC_API_BASE_URL`: Explorer REST API endpoint
- `NEXT_PUBLIC_SUPERNODE_STATS_URL`: Supernodes statistics endpoint
- `NEXT_PUBLIC_NODELIST_URL`: Node list endpoint
- `NEXT_PUBLIC_MARKET_DATA_URL`: Market data endpoint
- `NEXT_PUBLIC_HISTORICAL_PRICE_URL`: Historical coin price endpoint

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
docker run -p 3000:3000 symbolplatform/explorer-frontend
```

This command will start the container and expose the application on port 3000.
