#!/bin/bash

set -ex

# Function to run the workflow
run_workflow() {
  local workflow_to_run="$*"
  while true; do
    echo "Running command: ${workflow_to_run} at $(date)"
    eval "${workflow_to_run}"
    sleep "${INTERVAL_TIME_IN_SECONDS}"
  done
}

case "$1" in

  "nativeflow")
    echo -n "Running native flow"
    run_workflow /app/bridge/scripts/nativeflow.sh "${CONFIG_PATH}"
    ;;

   "wrappedflow")
    echo -n "Running wrapped flow"
    run_workflow /app/bridge/scripts/wrappedflow.sh "${CONFIG_PATH}"
    ;;

  "api")
    echo -n "Running API"
    gunicorn --workers "${NUMBER_OF_WORKERS}" --bind 0.0.0.0:5000 "bridge.api:create_app()"
    ;;

  *)
    echo "[$0] unknown argument '$1'"
    exit 1
    ;;
esac
