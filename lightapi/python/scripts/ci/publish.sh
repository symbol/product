#!/bin/bash

set -ex

export TWINE_USERNAME='__token__'
export TWINE_PASSWORD="${PYPI_TOKEN}"

if [ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]; then
	twine upload dist/*
else
	twine upload --repository testpypi dist/*
fi
