# Dataset Card

## Primary reader

Researcher or developer evaluating a dataset.

## First successful action

Load a split or sample and understand schema and license.

## First screen

Show dataset purpose, format, load sample, schema summary, and license.

## Required sections

Dataset summary, load sample, schema, splits, license, provenance, limitations/citation.

## Conditional sections

Collection process, preprocessing, annotations, bias, privacy, benchmarks.

## Source-of-truth files

Dataset metadata, data files, schemas, scripts, papers, licenses.

## Do not invent

Row counts, splits, labels, collection methods, licenses, benchmark results.

## Mini example

````markdown
Example:

```python
import pandas as pd
df = pd.read_parquet("data/train.parquet")
```
````
