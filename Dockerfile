FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN rm -rf dist && pnpm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "start"]
