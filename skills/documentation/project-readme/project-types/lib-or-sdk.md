# Library or SDK

## Primary reader

Developer consuming the package or SDK.

## First successful action

Install the package and import or call one minimal real API.

## First screen

Show name, real badges, one-sentence purpose, install command, and the smallest usage example.

## Required sections

Install, quick start, usage examples, API reference or exported surface, development/test, license.

## Conditional sections

TypeScript/types, configuration, examples, framework integrations, migration, troubleshooting.

## Source-of-truth files

Package manifest, exports/entry files, `src/`, `lib/`, examples, tests, generated docs.

## Do not invent

APIs, import paths, registry status, framework support, version compatibility, performance claims.

## Mini example

````markdown
Example:

```js
import { createClient } from "real-package";

const client = createClient();
```
````
