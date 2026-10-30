# API Service

## Primary reader

Developer integrating with or operating the API.

## First successful action

Start the service locally and make one successful request.

## First screen

Show what the API serves, local start command, and a verified request.

## Required sections

Run locally, request example, API reference or docs link, configuration, development/test, license.

## Conditional sections

OpenAPI/GraphQL docs, auth, deployment, database setup, Docker, rate limits, troubleshooting.

## Source-of-truth files

Routes/controllers, OpenAPI or GraphQL schemas, server dependencies, env examples, tests.

## Do not invent

Endpoints, auth schemes, response bodies, ports, deploy targets, uptime or SLA claims.

## Mini example

````markdown
Example:

```bash
curl http://localhost:8000/health
```
````
