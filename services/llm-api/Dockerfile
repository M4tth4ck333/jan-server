ARG GO_VERSION=1.25

FROM golang:${GO_VERSION} AS builder

WORKDIR /src

# Copy go-common first (dependency)
COPY packages/go-common /packages/go-common

# Copy service module files
COPY services/llm-api/go.mod services/llm-api/go.sum ./
RUN go mod download

# Copy service source
COPY services/llm-api ./
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/llm-api ./cmd/server

FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*
RUN useradd --system --home /app --no-create-home --uid 10001 appuser
WORKDIR /app
RUN mkdir -p /app/.cache && chown appuser:appuser /app/.cache
COPY --from=builder /out/llm-api /app/llm-api
COPY services/llm-api/configs /app/configs
COPY services/llm-api/docs /app/docs
COPY services/llm-api/migrations /app/migrations
USER appuser
ENTRYPOINT ["/app/llm-api"]
