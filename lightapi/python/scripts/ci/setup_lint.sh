#!/bin/bash

set -ex

python3 -m pip install -r "$(git rev-parse --show-toplevel)/linters/python/lint_requirements.txt"
python3 -m pip install -r requirements.txt
python3 -m pip install -r dev_requirements.txt

# build bindings as part of lint setup to avoid import-error
python3 -m cffi_src.openssl_build
mv _openssl* symbollightapi/bindings
