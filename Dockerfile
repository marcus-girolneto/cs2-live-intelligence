# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS parser
WORKDIR /src
COPY apps/demo-parser/go.mod apps/demo-parser/go.sum ./
RUN go mod download
COPY apps/demo-parser/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/demo-parser ./cmd/demo-parser

FROM golang:1.24-alpine AS collector-build
WORKDIR /src
COPY apps/collector/go.mod ./
COPY apps/collector/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/collector ./cmd/collector \
 && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/simulator ./cmd/simulator

# Local collector + match simulator. Both share the API container's network namespace in
# compose.local.yaml so the collector keeps its loopback-only listener and API rules.
FROM alpine:3.20 AS collector
COPY --from=collector-build /out/collector /out/simulator /usr/local/bin/
RUN adduser -D -H collector && mkdir -p /data && chown collector /data
USER collector
CMD ["collector"]

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# One image for the API and the sandboxed demo worker (compose `worker` service runs
# `node --import tsx src/worker.ts` from /app/apps/api with a read-only root filesystem).
FROM build AS api
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000 DEMO_PARSER_BIN=/usr/local/bin/demo-parser
COPY --from=parser /out/demo-parser /usr/local/bin/demo-parser
COPY --chmod=0755 docker/demo-parser-sandbox.sh /usr/local/bin/demo-parser-sandbox
RUN mkdir -p /data/objects && chown -R node:node /data
USER node
EXPOSE 4000
CMD ["pnpm","--filter","@cs2/api","exec","tsx","src/main.ts"]

FROM build AS web
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["pnpm","--filter","@cs2/web","exec","next","start","--hostname","0.0.0.0","--port","3000"]
