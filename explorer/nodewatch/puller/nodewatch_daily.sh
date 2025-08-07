#!/bin/bash

echo "$0: generating files in \"$1\""

python3 -m network.geolocation \
	--input "$1/symbol_nodes.json" \
	--output "$1/symbol_geo_location.json"

echo "[$(date)] downloading geo location for Symbol nodes"

python3 -m network.geolocation \
	--input "$1/nem_nodes.json" \
	--output "$1/nem_geo_location.json"

echo "[$(date)] downloading geo location for Nem nodes"

python3 -m network.nodeTracker \
	--input "$1/symbol_nodes.json" \
	--output "$1/node_counts_symbol.json"

echo "[$(date)] downloading node counts for Symbol nodes"
