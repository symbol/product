#!/bin/bash

set -ex

cd ./client && CI=false && npm run build
