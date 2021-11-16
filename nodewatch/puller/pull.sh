#!/bin/bash

echo "$0: generating files in \"$1\" with timeout \"$2\""

echo "[$(date)] crawling Symbol network"

python3 -m network.nodes \
	--resources ./networks/symbol.yaml \
	--thread-count 64 \
	--certs ./cert \
	--output "$1/symbol_nodes.json" \
	--timeout "$2"

echo "[$(date)] downloading Symbol richlist"

python3 -m network.richlist_symbol \
	--resources ./networks/symbol.yaml \
	--min-balance 250000 \
	--nodes "$1/symbol_nodes.json" \
	--output "$1/symbol_richlist.csv"

echo "[$(date)] downloading Symbol harvesters"

python3 -m network.harvester \
	--resources ./networks/symbol.yaml \
	--thread-count 64 \
	--nodes "$1/symbol_nodes.json" \
	--days 3.5 \
	--output "$1/symbol_harvesters.csv"

echo "[$(date)] crawling NEM network"

python3 -m network.nodes \
	--resources ./networks/nem.yaml \
	--thread-count 64 \
	--output "$1/nem_nodes.json" \
	--timeout "$2"

echo "[$(date)] downloading NEM harvesters"

python3 -m network.harvester \
	--resources ./networks/nem.yaml \
	--thread-count 64 \
	--nodes "$1/nem_nodes.json" \
	--days 3.5 \
	--output "$1/nem_harvesters.csv"
