#!/bin/bash

set -e

ulimit -c unlimited
cd /usr/catapult
id -a
ls -alh /seed

if [ ! -d /seed/00000 ]; then
  echo "seed directory is empty, exiting"
  exit 1
fi

cd /data
rm /data/startup/mongo-initialized
touch /data/startup/datadir-initialized

exec /usr/catapult/bin/catapult.server /userconfig
 
