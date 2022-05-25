# nodewatch

Monitors network version upgrades.

For pull to work, certificates must be placed in puller/certs/
To produce certificates follow the instructions for generating keys and certs in the [symbol node guide](https://docs.symbol.dev/guides/network/running-a-symbol-node-manually.html).

```sh
git clone https://github.com/symbol/miscellaneous.git

git clone https://github.com/symbol/symbol.git
cd explorer/nodewatch/puller

PYTHONPATH=../../../../miscellaneous ./pull.sh <resource folder> <timeout>
cd ..
```

Create an app.config with the RESOURCES_PATH="<resource folder>"

```sh
NODEWATCH_SETTINGS=<path>/app.config FLASK_APP=nodewatch flask run
```
