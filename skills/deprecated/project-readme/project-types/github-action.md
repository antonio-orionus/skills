# GitHub Action

## Primary reader

GitHub Actions user adding the action to a workflow.

## First successful action

Paste a workflow snippet using `uses: owner/repo@vX`.

## First screen

Show what the action does, minimal workflow snippet, and required inputs.

## Required sections

Workflow example, inputs, outputs, permissions, versioning, development/test, license.

## Conditional sections

Composite/docker/node runtime, examples, secrets, troubleshooting, migration.

## Source-of-truth files

`action.yml`, `action.yaml`, source files, tests, example workflows.

## Do not invent

Inputs, outputs, permissions, secrets, version tags, marketplace status.

## Mini example

````markdown
Example:

```yaml
- uses: owner/repo@v1
  with:
    name: value
```
````
