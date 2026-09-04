#!/bin/sh
# deckconsole + agentdeck one-shot verification: package tests, no-key acceptance, full tsc.
set -e
cd "$(dirname "$0")/.."
echo "== 1/3 unit+e2e (agentdeck + deckconsole) =="
bun test packages/agentdeck apps/deckconsole
echo "== 2/3 no-key acceptance =="
bun apps/deckconsole/scripts/acceptance.ts
echo "== 3/3 full tsc =="
node -e "const f=require('fs');f.writeFileSync('tsconfig.fullscope.json',JSON.stringify({extends:'./tsconfig.json',compilerOptions:{jsx:'react-jsx',lib:['ES2023','DOM','DOM.Iterable']},include:['apps/mantis/src/**/*.ts','apps/mantis/src/**/*.tsx','apps/mantis/test/**/*.ts','apps/deckconsole/src/**/*.ts','apps/deckconsole/test/**/*.ts','packages/core/src/**/*.ts','packages/builtin/src/**/*.ts','packages/gate/src/**/*.ts','packages/logger/src/**/*.ts','packages/memory/src/**/*.ts','packages/schedule/src/**/*.ts','packages/agentdeck/src/**/*.ts']},null,2))"
./node_modules/.bin/tsc -p tsconfig.fullscope.json
rm -f tsconfig.fullscope.json
echo "VERIFY GREEN"
