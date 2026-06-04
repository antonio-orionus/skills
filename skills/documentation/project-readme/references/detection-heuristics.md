# Detection Heuristics

README type is selected by primary reader plus first successful action.

## Priority

1. monorepo
2. agent-skill
3. github-action
4. mcp-server
5. terraform-module
6. helm-chart
7. docs-site
8. model-card
9. dataset-card
10. research-code
11. spec-protocol
12. template-starter
13. example-demo
14. extension-plugin
15. desktop-mobile-app
16. webapp
17. api-service
18. container-image
19. cli
20. lib-or-sdk
21. unknown

## Docker

Dockerfile alone does not make a container README. Treat Docker as deployment unless no stronger app, service, library, CLI, action, chart, module, MCP, skill, or docs signal exists.

## Agent Skills

Use `readme_type = agent-skill` for both one skill and a collection of skills. When `artifact_type = agent-skill-collection`, compose for a reader choosing from multiple skills:

- Use `agent_skills.skills` for the skill index.
- Use `signals.plugin_manifest` and `agent_skills.plugin_manifests` for plugin install/manifest sections.
- Use nested tests and scripts as validation facts when `signals.has_tests` is true.

## Ambiguity

If candidates disagree, ask one question that contrasts first actions. Example: "Is this README primarily for running the web UI, or for calling and operating the backend API?"
