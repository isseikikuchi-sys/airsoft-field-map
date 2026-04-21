#!/bin/bash
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")/.."
exec node ./node_modules/next/dist/bin/next dev -p 3100
