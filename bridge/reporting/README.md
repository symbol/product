# Bridge Reporting

Standalone Next.js monitoring console for bridge wrap, unwrap, payout, and error records.

- XYM → bXYM requests and errors
- bXYM → XYM requests and errors
- XYM → ETH requests and errors

The table loads 100 rows at a time as you scroll toward the end. Each report supports:

- Symbol or Ethereum address and transaction hash filters, submitted with Enter
- Payout status filters for request reports: All, Unprocessed, Sent, Completed, and Failed
- Sorting by request transaction height
- CSV export of every row matching the report, filters, and sort order, including rows not yet loaded in the table

Amounts are displayed in relative asset units and timestamps in UTC. Address and transaction links use the explorer URLs provided by the bridge APIs.

## Requirements

- Node.js 20 or above (the Docker image uses `node:lts-alpine`)
- NPM
- Access to existing wrapped and native bridge API endpoints
- Docker and the Docker Compose plugin for container deployment (optional for local development)

Run the commands below from `bridge/reporting`.

## Local development

```sh
cp .env.example .env
# Edit .env with your bridge API URLs.
npm ci
npm run dev
```

Open <http://localhost:3000>.

To run a production build locally:

```sh
npm run build
npm start
```

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `PUBLIC_BRIDGE_WRAPPED_URL` | Base URL for the bidirectional XYM/bXYM bridge | Empty; configure before use |
| `PUBLIC_BRIDGE_NATIVE_URL` | Base URL for the XYM/ETH native bridge | Empty; configure before use |
| `PUBLIC_REQUEST_TIMEOUT` | HTTP timeout in milliseconds; use a positive number | `15000` |

The example environment file points to the Symbol testnet bridge APIs. Set both URLs to the API base paths, without adding `/wrap/requests` or other report endpoints.

These settings are read from the server environment at startup and passed to the browser through `window.appConfig`. They are public configuration, so do not put secrets in them. Changing them requires restarting the local Next.js process or recreating the container, but no image rebuild or version change.

The Next.js server fetches bridge metadata from each base URL when rendering the page. The browser fetches report and CSV data directly from the bridge APIs.

Bridge API URLs must be reachable from both the server and browser. If hosted on a different origin, the APIs must allow CORS requests from the reporting site. Use HTTPS API URLs when the reporting site uses HTTPS.

## Tests and linting

```sh
npm test
npm run lint
```

For the coverage report used by Jenkins:

```sh
npm run test:jenkins
```

Jenkins requires a minimum code coverage of 95%.

## Docker

Build from this directory:

```sh
docker build -t symbol-bridge-reporting .
cp .env.example .env
# Edit .env with your bridge URLs.
docker run --rm --env-file .env -p 3000:3000 symbol-bridge-reporting
```

The `.env` and `.env.*` files are excluded from the Docker build context.

The Docker build stage installs locked dependencies with `npm ci` and runs `npm run build`. The final image contains only the Next.js standalone output, its runtime dependencies, and static/public assets. It runs `node server.js` as the unprivileged `node` user and listens on `0.0.0.0:3000`.

## Jenkins and deployment

The Jenkinsfile configures the shared Docker publisher for `symbolplatform/bridge-reporting`. Bridge URLs are not needed in Jenkins. Publishing requires a manual build with `SHOULD_PUBLISH_IMAGE` enabled and the shared pipeline's release/build conditions satisfied. Public releases publish to Docker Hub; private/RC builds use the internal registry.

To deploy a public release, copy `.env.example` to `.env` and edit the URLs. Create a `docker-compose.yaml` alongside `.env` using this example:

```yaml
services:
  report:
    image: symbolplatform/bridge-reporting:${REPORT_VERSION:-latest}
    restart: always
    ports:
      - "3000:3000"
    env_file: .env
```

The Compose file is a deployment example kept in this guide; create it on the deployment host when needed. Then start the service:

```sh
docker compose pull
docker compose up -d
```

Open <http://localhost:3000>, or use the deployment host's address. Compose uses `latest` by default.

To check the running service and its logs:

```sh
docker compose ps
docker compose logs --tail=100 -f report
```

When only a URL changes, edit `.env` and recreate the container using the existing image:

```sh
docker compose up -d --force-recreate --pull never report
```

No Jenkins build, image push, or version bump is needed for this configuration change. A plain `docker compose restart` does not load changes from `.env`.

## Troubleshooting

- If the header shows `UNKNOWN` or fewer bridges online, check the configured base URLs, server connectivity, and whether the bridge APIs report themselves as enabled. Reload the page to fetch updated metadata.
- If reports fail to load or export, check the browser's network requests for API errors, timeouts, CORS failures, or blocked HTTP requests from an HTTPS page. After resolving a report request failure, use **Retry**.
- If the table shows **No records found**, clear the search and select **All** payout statuses to check whether filters excluded the records.
- If a configuration change has no effect, recreate the container and reload the page.
