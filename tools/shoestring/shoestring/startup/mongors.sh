#!/bin/bash

sleep 1
set -e
state_filename=$1
shift

pwd

while true;
do
	if mongosh --eval "db.runCommand( { serverStatus: 1 } )" db/local > /dev/null 2>&1; then
		break;
	fi
	echo "waiting for mongod start..."
	sleep 1
done

echo " [+] Preparing db5"
cd /mongo
mongosh db/catapult < mongoDbPrepare.js
echo " [.] (exit code: $?)"
cd -

echo " [+] db prepared, checking account indexes"
mongosh --eval 'db.accounts.getIndexes()' db/catapult

trap 'echo "exiting"; exit 0' SIGTERM
mkdir -p "$(dirname "${state_filename}")"
touch "${state_filename}"

sleep infinity & wait
