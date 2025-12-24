#!/bin/bash

echo "Running post install hook..."
node scripts/fix-qr-code-workaround.js
node scripts/fix-local-dependencies.js
exit 0
