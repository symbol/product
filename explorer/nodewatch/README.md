# nodewatch

Monitors network version upgrades.

For pull to work, certificates must be placed in puller/certs/
To produce certificates follow the instructions for generating keys and certs in the [symbol node guide](https://docs.symbol.dev/guides/network/running-a-symbol-node-manually.html).

```sh
git clone https://github.com/symbol/miscellaneous.git

git clone https://github.com/symbol/symbol.git
cd symbol/explorer/nodewatch/puller

PYTHONPATH=../../../../miscellaneous ./pull.sh <resource folder> <timeout>
cd ..

python -m webapp.app --resources ./resources
```