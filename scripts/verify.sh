#!/bin/sh
set -e
cd "$(dirname "$0")/.."
echo "== 1/2 no-key acceptance =="
bun apps/deckconsole/scripts/acceptance.ts
echo "== 2/2 full tsc =="
node -e "const f=require('fs');f.writeFileSync('tsconfig.fullscope.json',JSON.stringify({extends:'./tsconfig.json',compilerOptions:{jsx:'react-jsx',lib:['ES2023','DOM','DOM.Iterable']},include:['apps/mantis/src/**/*.ts','apps/mantis/src/**/*.tsx','apps/deckconsole/src/**/*.ts','packages/core/src/**/*.ts','packages/builtin/src/**/*.ts','packages/gate/src/**/*.ts','packages/logger/src/**/*.ts','packages/memory/src/**/*.ts','packages/schedule/src/**/*.ts','packages/agentdeck/src/**/*.ts']},null,2))"
./node_modules/.bin/tsc -p tsconfig.fullscope.json
rm -f tsconfig.fullscope.json
echo "VERIFY GREEN"
