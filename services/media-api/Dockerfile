ARG GO_VERSION=1.25

FROM golang:${GO_VERSION} as build

WORKDIR /src

# Copy go-common package first (for replace directive)
COPY packages/go-common /packages/go-common

# Copy service module files and download dependencies
COPY services/media-api/go.mod services/media-api/go.sum ./
RUN go mod download

# Copy service source code
COPY services/media-api ./

# Ensure dependencies are in sync
RUN go mod tidy

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/media-api ./cmd/server

FROM debian:bookworm-slim
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*
RUN useradd --system --home /app --no-create-home --uid 10002 media
WORKDIR /app
COPY --from=build /out/media-api /app/media-api
EXPOSE 8285
USER media
ENTRYPOINT ["/app/media-api"]
