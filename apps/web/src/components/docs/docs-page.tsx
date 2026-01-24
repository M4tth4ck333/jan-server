import { useEffect, useState } from "react";
import { Loader2, AlertCircle, FileText, ExternalLink } from "lucide-react";
import { Button } from "@janhq/interfaces/button";
import { Streamdown, defaultRehypePlugins } from "streamdown";
import remarkGfm from "remark-gfm";
import type { BundledTheme } from "shiki";

const themes = ["github-light", "github-dark"] as [BundledTheme, BundledTheme];

interface DocsPageProps {
  title: string;
  description?: string;
  content?: string;
  loading?: boolean;
  error?: string | null;
  lastUpdated?: string;
  externalLink?: string;
}

export function DocsPage({
  title,
  description,
  content,
  loading,
  error,
  lastUpdated,
  externalLink,
}: DocsPageProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Error Loading Documentation</h3>
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      {/* Header */}
      <div className="mb-8 pb-6 border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 mt-0">{title}</h1>
            {description && (
              <p className="text-lg text-muted-foreground mt-0">{description}</p>
            )}
          </div>
          {externalLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={externalLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Source
              </a>
            </Button>
          )}
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-4">
            Last updated: {lastUpdated}
          </p>
        )}
      </div>

      {/* Content */}
      {content ? (
        <div className="docs-content">
          <Streamdown
            text={content}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[defaultRehypePlugins.harden]}
            shikiTheme={themes}
          />
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No content available for this page.</p>
        </div>
      )}
    </article>
  );
}

// Static documentation content for the pages that don't have external sources
export const staticDocs: Record<string, { title: string; description?: string; content: string }> = {
  "/docs": {
    title: "Documentation",
    description: "Welcome to the Jan Server documentation",
    content: `
# Welcome to Jan Server

Jan Server is an enterprise-grade microservices LLM API platform with Model Context Protocol (MCP) tool integration.

## Features

- **OpenAI-Compatible APIs** - Drop-in replacement for OpenAI API
- **Multi-step Tool Orchestration** - Complex workflows with MCP tools
- **Media Management** - S3 storage with intelligent ID resolution
- **Full Observability** - OpenTelemetry, Prometheus, Grafana

## Quick Links

- [Quickstart Guide](/docs/quickstart) - Get up and running in minutes
- [API Reference](/docs/api) - Complete API documentation
- [Architecture](/docs/architecture) - System design and components
- [Guides](/docs/guides) - Development and deployment guides

## Getting Help

If you need help, you can:
- Check the [Guides](/docs/guides) section
- Review the [Architecture](/docs/architecture) documentation
- Look at the API examples in the [API Reference](/docs/api)
    `,
  },
  "/docs/quickstart": {
    title: "Quickstart",
    description: "Get started with Jan Server in minutes",
    content: `
# Quickstart Guide

Get Jan Server running locally in just a few steps.

## Prerequisites

- Docker and Docker Compose
- Git
- Make (optional, but recommended)

## Installation

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/janhq/jan-server.git
cd jan-server
\`\`\`

### 2. Run Setup

Use the interactive setup wizard:

\`\`\`bash
make quickstart
\`\`\`

Or manually configure:

\`\`\`bash
make setup
\`\`\`

### 3. Start Services

\`\`\`bash
make up-full
\`\`\`

### 4. Verify Health

\`\`\`bash
make health-check
\`\`\`

## Next Steps

- Configure your [model providers](/docs/configuration/providers)
- Explore the [API Reference](/docs/api)
- Set up [authentication](/docs/api/authentication)
    `,
  },
  "/docs/api": {
    title: "API Reference",
    description: "Complete API documentation for Jan Server",
    content: `
# API Reference

Jan Server provides OpenAI-compatible APIs along with additional endpoints for extended functionality.

## Base URL

All API requests should be made to:

\`\`\`
http://localhost:8000/api/v1
\`\`\`

## Authentication

Most endpoints require authentication via Bearer token:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  http://localhost:8000/api/v1/models
\`\`\`

## Available APIs

### Core APIs
- [Chat Completions](/docs/api/chat-completions) - Generate chat responses
- [Models](/docs/api/models) - List available models
- [Conversations](/docs/api/conversations) - Manage conversations
- [Messages](/docs/api/messages) - Message history

### Extended APIs
- [Media](/docs/api/media) - File upload and management
- [Authentication](/docs/api/authentication) - Auth endpoints

## Rate Limiting

API requests are rate-limited based on your plan. See the response headers for current limits:

- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests
- \`X-RateLimit-Reset\`: Time until limit resets
    `,
  },
  "/docs/api/authentication": {
    title: "Authentication API",
    description: "Authentication and authorization endpoints",
    content: `
# Authentication API

Jan Server uses OAuth 2.0 / OpenID Connect for authentication, powered by Keycloak.

## API Keys

### Create API Key

\`\`\`bash
POST /api/v1/api-keys
Content-Type: application/json

{
  "name": "My API Key"
}
\`\`\`

Response:
\`\`\`json
{
  "id": "key_123",
  "name": "My API Key",
  "key": "sk-...",
  "created_at": "2024-01-01T00:00:00Z"
}
\`\`\`

### List API Keys

\`\`\`bash
GET /api/v1/api-keys
\`\`\`

### Delete API Key

\`\`\`bash
DELETE /api/v1/api-keys/{id}
\`\`\`

## OAuth Flow

### 1. Initiate Login

Redirect users to:
\`\`\`
GET /api/v1/auth/login
\`\`\`

### 2. Handle Callback

After authentication, users are redirected to your callback URL with an authorization code.

### 3. Exchange Token

The callback handler exchanges the code for tokens automatically.
    `,
  },
  "/docs/api/chat-completions": {
    title: "Chat Completions API",
    description: "Generate AI responses using chat completion endpoints",
    content: `
# Chat Completions API

Create chat completions using various AI models.

## Create Chat Completion

\`\`\`bash
POST /api/v1/chat/completions
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
\`\`\`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model | string | Yes | Model ID to use |
| messages | array | Yes | Array of message objects |
| stream | boolean | No | Enable streaming responses |
| temperature | number | No | Sampling temperature (0-2) |
| max_tokens | number | No | Maximum tokens to generate |

### Response

\`\`\`json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
\`\`\`

## Streaming

Enable streaming for real-time responses:

\`\`\`bash
POST /api/v1/chat/completions
Content-Type: application/json

{
  "model": "gpt-4",
  "messages": [...],
  "stream": true
}
\`\`\`

Streaming responses use Server-Sent Events (SSE).
    `,
  },
  "/docs/architecture": {
    title: "Architecture Overview",
    description: "System architecture and design",
    content: `
# Architecture Overview

Jan Server follows a microservices architecture with clean separation of concerns.

## System Components

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                        Kong Gateway                         │
│                    (API Gateway, Auth)                      │
└─────────────────────────────────────────────────────────────┘
                              │
    ┌─────────────┬──────────┼──────────┬─────────────┐
    │             │          │          │             │
    ▼             ▼          ▼          ▼             ▼
┌───────┐   ┌─────────┐ ┌────────┐ ┌────────┐  ┌──────────┐
│LLM API│   │Response │ │Media   │ │MCP     │  │Realtime  │
│:8080  │   │API :8082│ │API:8285│ │Tools   │  │API :8186 │
└───────┘   └─────────┘ └────────┘ │:8091   │  └──────────┘
    │             │          │     └────────┘        │
    └─────────────┴──────────┼──────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌──────────┐       ┌───────────┐
              │PostgreSQL│       │  Redis    │
              │  :5432   │       │  Cache    │
              └──────────┘       └───────────┘
\`\`\`

## Services

| Service | Port | Description |
|---------|------|-------------|
| Kong Gateway | 8000 | API entry point |
| LLM API | 8080 | Chat completions, conversations |
| Response API | 8082 | Multi-step tool orchestration |
| Media API | 8285 | File storage and management |
| MCP Tools | 8091 | Search, scrape, code execution |
| Realtime API | 8186 | WebRTC session management |

## Data Flow

1. Requests enter through Kong Gateway
2. Kong validates authentication and routes to services
3. Services process requests and interact with PostgreSQL/Redis
4. Responses flow back through Kong
    `,
  },
  "/docs/guides": {
    title: "Guides",
    description: "Development and deployment guides",
    content: `
# Guides

Comprehensive guides for working with Jan Server.

## Development

- [Local Development](/docs/guides/development) - Set up your dev environment
- [Testing](/docs/guides/testing) - Run and write tests
- [Code Conventions](/docs/conventions) - Follow our coding standards

## Deployment

- [Docker Deployment](/docs/guides/deployment) - Deploy with Docker
- [Configuration](/docs/configuration) - Configure your instance

## Advanced Topics

- [MCP Tools](/docs/guides/mcp-tools) - Integrate MCP tools
- [Custom Providers](/docs/configuration/providers) - Add model providers
    `,
  },
};

export function getStaticDoc(path: string) {
  return staticDocs[path] || null;
}
