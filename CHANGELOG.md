# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-07-05

### Added

- `create_note`, `update_note`, `add_project_step`, and `update_project_step` now accept a plain
  Markdown/text string for `content`, which is converted to TipTap JSON automatically. Raw TipTap
  JSON is still accepted as-is for edge cases the converter can't express.
- `add_project_step` now accepts `content`/`content_text` at creation time, removing the need for
  a separate `update_project_step` call just to add a description.
- `content_text` is now derived automatically from `content` on project steps when omitted, so
  callers don't have to write the same text twice. An explicit `content_text` is still respected
  if provided.

### Fixed

- The Markdown-to-TipTap converter no longer silently drops inline images or raw HTML blocks —
  both now degrade to plain text instead of disappearing. Tables, strikethrough, and task-list
  checkboxes were already safe and are covered by regression tests.

### Documentation

- Tool descriptions and the README now document the supported Markdown syntax and the raw TipTap
  JSON escape hatch for `content` fields.

## [1.0.0] - 2026-07-04

### Added

- Initial MCP server implementation with full coverage of the Task-Tracker REST API: trackers,
  tasks, notes, checklists, and projects/steps/references.
