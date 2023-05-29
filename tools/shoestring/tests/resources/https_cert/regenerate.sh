#!/bin/bash

set -ex

openssl req -newkey ed448 \
	-x509 \
	-sha256 \
	-days 3650 \
	-nodes \
	-out localhost.crt \
	-keyout localhost.key
