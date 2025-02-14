#!/bin/bash

set -e

ulimit -c unlimited
id -a
ls -alh /seed

if [ ! -d /seed/00000 ]; then
	echo "seed directory is empty, exiting"
	exit 1
fi

exec /usr/catapult/bin/catapult.recovery /userconfig
