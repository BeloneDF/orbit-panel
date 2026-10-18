#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL deve apontar para o PostgreSQL externo}"

echo "Aplicando migrations do Prisma..."
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

exec "$@"
