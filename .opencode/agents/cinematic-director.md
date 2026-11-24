---
description: Archived cinematic role. Read-only historical reference; no active assignments.
mode: subagent
disabled: true
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: read
    resource: "*"
    effect: allow
  - action: glob
    resource: "*"
    effect: allow
  - action: grep
    resource: "*"
    effect: allow
---

This role is retained to identify historical artifacts under `video/` and `docs/shots/`. It has no write paths or jobs in the Močire apartment selector. Do not plan or start filming, walkthroughs, renders or video generation.
