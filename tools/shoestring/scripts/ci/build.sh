#!/bin/bash

set -ex

TZ="Etc/UTC" bash scripts/extract_resource_strings.sh
TZ="Etc/UTC" bash scripts/compile_resource_strings.sh
