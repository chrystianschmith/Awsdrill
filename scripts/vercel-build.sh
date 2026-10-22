#!/usr/bin/env sh
# Build na Vercel: aplica as migrations e o seed (idempotente) no banco do ambiente antes do build.
# Em desenvolvimento local, use `npm run build` direto.
set -e
if [ "$VERCEL_ENV" = "production" ] || [ "$VERCEL_ENV" = "preview" ]; then
  npx prisma migrate deploy
  SEED_ALLOW_PRODUCTION=1 npx tsx prisma/seed.ts
fi
npm run build
