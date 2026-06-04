# Validation

Run `scripts/validate.py README.md --repo .` when available.

## Required

- Exactly one H1.
- No placeholders such as TODO, `username/repo`, `package-name`, or `example.com`.
- All code fences have language tags.
- Relative links resolve.
- The first screen states what the project is, who it is for, and the fastest real start path.
- Registry badges match detected ecosystems.
- CI badge exists only when a workflow exists.
- License badge exists only when a license source exists.
- README claims match repository facts from `scripts/inspect.py`.
- Agent skill collections include a skill index sourced from detected `SKILL.md` files.

## Warnings To Review

- API Reference without exported API or route signals.
- Command Reference without CLI signals.
- Deployment without deployment signals.
- Environment section without env source.
- Model card without limitations.
- Dataset card without schema and license.
- Research code without reproduction guidance.
- Agent skill collection without install or trigger guidance.
