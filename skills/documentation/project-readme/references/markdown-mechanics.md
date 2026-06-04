# Markdown Mechanics

Use when changing Markdown structure, links, anchors, tables, alerts, code fences, images, or multilingual README variants.

## GitHub-Flavored Markdown

- Use fenced code blocks with language tags.
- Preserve table shape and alignment rows when editing table content.
- Use GitHub alerts such as `> [!NOTE]` only when they make a real caveat or warning easier to notice.
- Keep one H1 for the project name.

## Links And Anchors

- Preserve relative file links unless a target actually moved.
- Check same-file anchors such as `#install` after heading edits.
- Check relative-file anchors such as `docs/setup.md#configuration` when changing linked documents.
- Prefer stable explicit anchors only when the README already uses them or generated heading anchors would be confusing.

## Media

- Use detected logos, icons, banners, or screenshots only when they clearly represent the project.
- Do not invent logos or include decorative media for a technical README.
- Keep badge and image URLs unchanged unless the source facts changed.

## Multilingual READMEs

- Treat root `README.md` as the source of truth unless the user says otherwise.
- Preserve code fences, inline code, commands, flags, environment variables, file paths, URLs, badge URLs, and package names.
- Keep exactly one language selector when multiple README variants exist.
- Rewrite same-file anchors in localized variants when translated headings change.
