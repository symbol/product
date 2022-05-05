#!/bin/bash

set -ex

npm run test

cd ./client && npm run test
