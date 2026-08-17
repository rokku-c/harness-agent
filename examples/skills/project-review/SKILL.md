---
name: project-review
description: Review a TypeScript agent framework using evidence-first analysis.
---

# Project review

1. Read package metadata and the public exports first.
2. Trace one complete business path from Agent definition to adapter execution.
3. Compare declared capabilities with behavior actually implemented by each adapter.
4. Check Effect error, environment, scope and resource-lifecycle semantics.
5. Check filesystem paths, subprocess environment, tool authorization and temporary-resource cleanup.
6. Read relevant tests before reporting missing coverage.
7. Report only findings supported by a concrete file and code evidence.

Prioritize correctness and unsafe capability claims over formatting preferences.
