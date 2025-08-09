#!/bin/bash

echo "$0: generating files in \"$1\""

echo "[$(date)] downloading geo location for Symbol nodes"

python3 -m network.geolocation \
	--input "$1/symbol_nodes.json" \
	--output "$1/symbol_geo_location.json"

echo "[$(date)] downloading geo location for Nem nodes"

python3 -m network.geolocation \
	--input "$1/nem_nodes.json" \
	--output "$1/nem_geo_location.json"

echo "[$(date)] downloading node counts for Symbol nodes"

python3 -m network.nodeTracker \
	--input "$1/symbol_nodes.json" \
	--output "$1/symbol_time_series_nodes_count.json"

echo "[$(date)] downloading node counts for Nem nodes"

python3 -m network.nodeTracker \
	--input "$1/nem_nodes.json" \
	--output "$1/nem_time_series_nodes_count.json"