# Helm Chart

## Primary reader

Kubernetes operator installing a Helm chart.

## First successful action

Run `helm install` with minimal values.

## First screen

Show what the chart deploys, install command, and required values.

## Required sections

Install, values, rendered resources, examples, upgrade/uninstall, chart development, license.

## Conditional sections

Repository setup, dependencies, CRDs, security context, ingress, troubleshooting.

## Source-of-truth files

`Chart.yaml`, `values.yaml`, `templates/`, `charts/`, example values.

## Do not invent

Chart repo URLs, values, Kubernetes resources, CRDs, namespaces, production guarantees.

## Mini example

````markdown
Example:

```bash
helm install release-name .
```
````
