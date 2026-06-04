# MCP Server

## Primary reader

AI-client user or developer connecting an MCP client.

## First successful action

Configure an MCP client and call one real tool.

## First screen

Show the server purpose, supported transport, install/run command, and client config snippet.

## Required sections

Install/run, MCP client config, tools, examples, development/test, troubleshooting, license.

## Conditional sections

Resources, prompts, env variables, auth, stdio/HTTP transport, client-specific config.

## Source-of-truth files

MCP SDK dependencies, server source, tool definitions, config examples, tests.

## Do not invent

Tools, schemas, client support, transport modes, env variables, auth requirements.

## Mini example

````markdown
Example:

```json
{"mcpServers":{"name":{"command":"node","args":["server.js"]}}}
```
````
