#!/bin/bash

set -e

ulimit -c unlimited

id -a
ls -alh /data
rm /data/startup/datadir-initialized
touch /data/startup/broker-initialized

exec /usr/catapult/bin/catapult.broker /userconfig
