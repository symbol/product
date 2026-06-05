#!/bin/bash

set -ex

export NEXT_PUBLIC_PLATFORM="${NEXT_PUBLIC_PLATFORM:-${PLATFORM:-nem}}"
export PLATFORM="${PLATFORM:-$NEXT_PUBLIC_PLATFORM}"

npm run build
