# CLI

## Primary reader

Developer or operator who needs to run a command successfully.

## First successful action

Install or run the command once with a real option or input.

## First screen

Show the command name, what it automates, install/run command, and a tiny invocation.

## Required sections

Quick start, installation, command reference, examples, configuration, development/test, license.

## Conditional sections

Shell completion, environment variables, exit codes, config files, troubleshooting.

## Source-of-truth files

`bin`, console scripts, `src/main.rs`, `cmd/`, CLI source, tests, examples.

## Do not invent

Flags, subcommands, default output, config paths, install methods, shell completions.

## Mini example

````markdown
Example:

```bash
tool-name --help
tool-name input.txt --format json
```
````
