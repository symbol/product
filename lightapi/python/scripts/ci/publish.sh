#!/bin/bash

set -ex

export TWINE_PASSWORD="${PYPI_TOKEN}"
if [ -z "${USERNAME}" ]; then
  export TWINE_USERNAME='__token__'
  python3 -m twine upload dist/*
else
  export TWINE_USERNAME="${USERNAME}"
  python3 -m twine upload --repository-url="${PYPI_URL}" dist/*
fi
