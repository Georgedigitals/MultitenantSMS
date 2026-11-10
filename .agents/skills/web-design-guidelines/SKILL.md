---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to review UI, check accessibility, audit design, review UX, or check a site against best practices.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with the current Web Interface Guidelines.

## Review steps

1. Fetch the latest guidelines from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.
2. Read the specified files.
3. Check against the rules in the fetched guidelines.
4. Report concise findings grouped by file, using `file:line` format.

Check accessibility, visible focus, semantics, keyboard support, responsive layout, touch targets, image dimensions and loading, motion preferences, text wrapping, navigation, and interaction states. Prefer native HTML elements and visible, specific labels. Check keyboard and mobile behavior as well as visual polish.

If no file or pattern is specified for a review, ask which files to inspect.
