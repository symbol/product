#!/bin/bash

echo "Running post install hook..."
node scripts/fix-qr-code-workaround.js
exit 0
