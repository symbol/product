#!/bin/bash

set -ex

# generate version.txt to be used in publishing
npm run version --silent > version.txt
