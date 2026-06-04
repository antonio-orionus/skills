# Container Image

## Primary reader

Operator running a packaged container image.

## First successful action

Run the image with minimal required configuration.

## First screen

Show image purpose, image name when real, run command, ports/volumes if required.

## Required sections

Image/run command, configuration, ports/volumes, build locally, license.

## Conditional sections

Compose, Kubernetes, health checks, tags, registry, environment variables, troubleshooting.

## Source-of-truth files

Dockerfile, Containerfile, compose files, entrypoint scripts, docs, registry metadata.

## Do not invent

Registry image names, tags, exposed ports, volumes, health checks, deployment targets.

## Mini example

````markdown
Example:

```bash
docker build -t local/image .
docker run --rm local/image
```
````
