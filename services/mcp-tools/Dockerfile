ARG GO_VERSION=1.25

FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /src

# Copy go-common first (dependency)
COPY packages/go-common /packages/go-common

# Copy service go.mod files
COPY services/mcp-tools/go.mod services/mcp-tools/go.sum ./
RUN go mod download

# Copy source code
COPY services/mcp-tools ./
RUN go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /out/mcp-tools ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /app

# Copy the binary from builder
COPY --from=builder /out/mcp-tools .
COPY services/mcp-tools/configs /app/configs

EXPOSE 8091

CMD ["./mcp-tools"]
