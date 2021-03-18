#!/bin/ash
# shellcheck shell=dash

while [ ! -f "/data/startup/broker-initialized" ];
do
      sleep 0.1
done

rm /data/startup/broker-initialized

if [ ! -d /data/rest ]; then
	mkdir /data/rest
fi

echo " [+] delaying node startup"
sleep 4
exec npm start /userconfig/startup/rest.json
 
