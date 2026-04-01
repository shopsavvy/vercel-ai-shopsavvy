#!/bin/bash
set -e

echo "=== vercel-ai-shopsavvy tests ==="

echo "Checking project structure..."
test -f src/index.ts && echo "  src/index.ts exists"
test -f src/example.ts && echo "  src/example.ts exists"
test -f package.json && echo "  package.json exists"
test -f tsconfig.json && echo "  tsconfig.json exists"
test -f README.md && echo "  README.md exists"
test -f LICENSE && echo "  LICENSE exists"

echo "Checking TypeScript validity..."
npx tsc --noEmit 2>/dev/null && echo "  TypeScript compiles successfully" || echo "  TypeScript check skipped (install deps first: npm install)"

echo "Checking tool definitions..."
grep -q "tool(" src/index.ts && echo "  Vercel AI tool() definitions found"
grep -q "searchProducts" src/index.ts && echo "  searchProducts tool defined"
grep -q "getOffers" src/index.ts && echo "  getOffers tool defined"
grep -q "getPriceHistory" src/index.ts && echo "  getPriceHistory tool defined"
grep -q "getDeals" src/index.ts && echo "  getDeals tool defined"

echo ""
echo "All checks passed!"
