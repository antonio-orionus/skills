# Model Card

## Primary reader

Researcher or developer evaluating or using a model.

## First successful action

Load the model and run one inference or evaluation.

## First screen

Show model purpose, task, load command or code, and key limitations.

## Required sections

Intended use, load/run, model details, evaluation, limitations, license/citation.

## Conditional sections

Training data, metrics, architecture, safety, bias, deployment, fine-tuning.

## Source-of-truth files

Model files, config, tokenizer, evaluation scripts, papers, existing metadata.

## Do not invent

Metrics, datasets, safety claims, license, intended use, benchmark results.

## Mini example

````markdown
Example:

```python
from transformers import AutoModel
model = AutoModel.from_pretrained(".")
```
````
