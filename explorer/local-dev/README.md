# Explorer local development

This directory contains local-only configuration for running the NEM explorer stack:

- NEM node: `http://localhost:7890`
- PostgreSQL: `localhost:5432`
- REST API: `http://localhost:4000/api/nem`
- Nodewatch: `http://localhost:5001`
- Frontend: `http://localhost:3000`

In the commands below, `<project-root>` means the root of this repository.

```sh
cd <project-root>
PROJECT_ROOT=$(git rev-parse --show-toplevel)
```

## 1. Start PostgreSQL

```sh
docker run --name explorer-postgres \
  -e POSTGRES_DB=explorer \
  -e POSTGRES_USER=explorer \
  -e POSTGRES_PASSWORD=explorer \
  -p 5432:5432 \
  -d postgres:16-alpine
```

If the container already exists:

```sh
docker start explorer-postgres
```

## 2. Create Python virtual environments

Use Python 3.11 or 3.12. Python 3.14 can be too new for some pinned dependencies.

```sh
cd <project-root>

python3.12 -m venv .venv-explorer
. .venv-explorer/bin/activate

pip install -r explorer/puller/requirements.txt
pip install -r explorer/rest/requirements.txt
pip install -r explorer/nodewatch/requirements.txt
```

The three service requirements currently pin different `psycopg2-binary` patch versions. For one shared local venv, use the combined file instead:

```sh
pip install -r explorer/local-dev/requirements.txt
```

## 3. Sync blocks from the local NEM node

Your Docker NEM node is exposed on `localhost:7890`. The current local node reports testnet (`networkId = -104`), so use `--network testnet`.

```sh
cd "$PROJECT_ROOT/explorer/puller"
PYTHONPATH=. python -m puller.workflows.sync_nem_block \
  --nem-node http://localhost:7890 \
  --network testnet \
  --db-config ../local-dev/db_config.ini
```

Run this command again whenever you want to catch the DB up to the node height.

## 4. Start REST API

```sh
cd "$PROJECT_ROOT/explorer/rest"
EXPLORER_REST_SETTINGS="$PROJECT_ROOT/explorer/local-dev/rest.config" \
PYTHONPATH=. flask --app 'rest:create_app()' run --host 0.0.0.0 --port 4000
```

Health check:

```sh
curl http://localhost:4000/api/nem/health
```

## 5. Start nodewatch

The checked-in `resources` here are a minimal local snapshot. They point NEM nodewatch at `localhost:7890`.

```sh
cd "$PROJECT_ROOT/explorer/nodewatch"
NODEWATCH_SETTINGS="$PROJECT_ROOT/explorer/local-dev/nodewatch.config" \
PYTHONPATH=. flask --app 'nodewatch:create_app()' run --host 0.0.0.0 --port 5001
```

NEM node list:

```sh
curl http://localhost:5001/api/nem/nodes
```

## 6. Start frontend

Create `explorer/frontend/.env.local` with the same values as `frontend.env.local.example`, then:

```sh
cd "$PROJECT_ROOT/explorer/frontend"
npm run dev
```

Open `http://localhost:3000`.
