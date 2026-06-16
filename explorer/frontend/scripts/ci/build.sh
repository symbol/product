#!/bin/bash

set -ex

if [ -z "${NEXT_PUBLIC_PLATFORM:-}" ] && [ -z "${PLATFORM:-}" ]; then
	echo "NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either nem or symbol" >&2
	exit 1
fi

export NEXT_PUBLIC_PLATFORM="${NEXT_PUBLIC_PLATFORM:-$PLATFORM}"
export PLATFORM="${PLATFORM:-$NEXT_PUBLIC_PLATFORM}"

npm run build
