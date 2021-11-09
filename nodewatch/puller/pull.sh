#!/bin/bash

echo "[$(date)] crawling Symbol network"

python -m network.nodes \
	--resources ./networks/symbol.yaml \
	--thread-count 64 \
	--certs ./cert \
	--output ../resources/symbol_nodes.json

echo "[$(date)] downloading Symbol richlist"

python -m network.richlist_symbol \
	--resources ./networks/symbol.yaml \
	--min-balance 250000 \
	--nodes ../resources/symbol_nodes.json \
	--output ../resources/symbol_richlist.csv

echo "[$(date)] crawling NEM network"

python -m network.nodes \
	--resources ./networks/nem.yaml \
	--thread-count 64 \
	--output ../resources/nem_nodes.json

echo "[$(date)] downloading NEM harvesters"

python -m network.harvester_nem \
	--resources ./networks/nem.yaml \
	--thread-count 64 \
	--nodes ../resources/nem_nodes.json \
	--days 3.5 \
	--output ../resources/nem_harvesters.csv
