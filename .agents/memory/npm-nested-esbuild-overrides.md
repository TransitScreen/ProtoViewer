---
name: npm nested esbuild overrides
description: An npm override resolution quirk encountered while removing a transitive vulnerable esbuild.
---

For transitive esbuild fixes, do not assume a parent-scoped npm override has replaced an already-locked nested copy. Check both the lockfile and `npm ls` after a clean install. A global esbuild override with a specific exception for a parent needing a newer compatible version resolved this case.

**Why:** npm accepted the narrower override but retained the old nested package in the lockfile and reported its installed dependency as invalid, even after regenerating the lockfile.

**How to apply:** When resolving esbuild advisories across multiple parents, validate the actual installed dependency tree and audit results; use a broad override plus an exception only if a narrower override fails to remove the vulnerable copy.