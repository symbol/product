# nodewatch

Monitors network version upgrades.

For pull to work, certificates must be placed in puller/certs/
To produce certificates follow the instructions for generating keys and certs in the [symbol node guide](https://docs.symbolplatform.com/guides/network/running-a-symbol-node-manually.html).

```sh
git clone https://github.com/symbol/miscellaneous.git

cd puller
PYTHONPATH=../miscellaneous ./pull.sh
cd ..

python -m webapp.app --resources ./resources
```
