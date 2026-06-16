#!/bin/bash

set -ex

if [ -n "${NEXT_PUBLIC_PLATFORM:-}" ] || [ -n "${PLATFORM:-}" ]; then
	BUILD_PLATFORMS="${NEXT_PUBLIC_PLATFORM:-$PLATFORM}"
elif [ -n "${FRONTEND_BUILD_PLATFORMS:-}" ]; then
	BUILD_PLATFORMS="$FRONTEND_BUILD_PLATFORMS"
else
	echo "NEXT_PUBLIC_PLATFORM, PLATFORM, or FRONTEND_BUILD_PLATFORMS must specify nem or symbol" >&2
	exit 1
fi

IFS=',' read -r -a BUILD_PLATFORM_LIST <<< "$BUILD_PLATFORMS"
for BUILD_PLATFORM in "${BUILD_PLATFORM_LIST[@]}"; do
	if [ "$BUILD_PLATFORM" != 'nem' ] && [ "$BUILD_PLATFORM" != 'symbol' ]; then
		echo "Unsupported frontend platform: $BUILD_PLATFORM" >&2
		exit 1
	fi

	export NEXT_PUBLIC_PLATFORM="$BUILD_PLATFORM"
	export PLATFORM="$BUILD_PLATFORM"

	npm run build
done
