#!/bin/bash

set -ex

if [ "$1" = "api" ]; then
	gunicorn --workers ${NUMBER_OF_WORKERS} --bind 0.0.0.0:5000 "bridge.api:create_app()"
elif [ -f "$1" ]; then
	echo "executing script file '$1' with interval ${INTERVAL_TIME_IN_SECONDS} seconds"
	while true; do ${1}; sleep ${INTERVAL_TIME_IN_SECONDS}; done
else
	echo "[$0] unknown argument '$1'"
fi
