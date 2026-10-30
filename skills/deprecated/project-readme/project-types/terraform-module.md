# Terraform Module

## Primary reader

Infrastructure engineer consuming a Terraform module.

## First successful action

Copy a module block and run `terraform init` and `terraform plan`.

## First screen

Show what infrastructure the module creates and a minimal module block.

## Required sections

Usage, requirements, inputs, outputs, examples, testing, license.

## Conditional sections

Providers, resources, upgrade notes, security, state considerations, troubleshooting.

## Source-of-truth files

`*.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `examples/`, tests.

## Do not invent

Provider versions, resources, variables, outputs, registry source, cloud costs.

## Mini example

````markdown
Example:

```hcl
module "example" {
  source = "./"
}
```
````
