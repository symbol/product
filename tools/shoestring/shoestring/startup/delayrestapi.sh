#!/bin/bash

while [ ! -f "/data/startup/broker-initialized" ];
do
	sleep 0.1
done

rm /data/startup/broker-initialized

if [ ! -d /data/rest ]; then
	mkdir /data/rest
fi

echo " [+] delaying rest API startup"
sleep 4
exec npm start --prefix /app /userconfig/rest.json

