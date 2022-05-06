#!/bin/bash

set -ex

npm run lint

cd ./client && npm run lint
