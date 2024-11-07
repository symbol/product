#!/bin/bash

echo "light rest API startup"
sleep 4
exec npm run start-light --prefix /app /userconfig/rest-light.json

