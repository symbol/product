#!/bin/bash

set -ex


export TWINE_USERNAME='__token__'
export TWINE_PASSWORD="${PYPI_TOKEN}"
export TWINE_REPOSITORY="${PYPI_URL}"

python3 -m twine upload dist/*
