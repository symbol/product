#!/bin/bash

file=$1
script=$2
while [ ! -f "$file" ];
do
	sleep 0.1
done

exec /bin/bash "${script}"
