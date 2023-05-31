# symbol-node-configurator


## Prerequisites:

    apt-get install python3 python3-pip openssl
    python3 -m pip install -r requirements.txt

## Temporarily (until lightapi package fix):

```
cd product/lightapi/python
./scripts/ci/setup_lint.sh
./scripts/ci/lint.sh
./scripts/ci/test.sh

# to run shoestring

PYTHONPATH=}full path here{/product/lightapi/python python3 -m shoestring
```
