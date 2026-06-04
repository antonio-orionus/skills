# Monorepo

## Primary reader

Developer navigating a multi-package workspace.

## First successful action

Find the relevant package and run its local setup command.

## First screen

Show the workspace purpose, package count or map when known, root setup, and package index link.

## Required sections

Workspace map, package index, root setup, per-package commands, development/test, license.

## Conditional sections

Release process, dependency graph, apps vs packages, contribution workflow, CI.

## Source-of-truth files

Workspace manifests, package directories, root scripts, docs, CI workflows.

## Do not invent

Package ownership, release cadence, workspace relationships, unsupported root commands.

## Mini example

````markdown
Example:

| Package | Purpose |
|---|---|
| `packages/core` | Core library |
````
