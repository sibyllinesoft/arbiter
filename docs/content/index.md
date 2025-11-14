---
id: intro
slug: /
title: Welcome to Arbiter
sidebar_position: 1
description: Learn how Arbiter stitches CUE-driven specs, CLI automation, and generation pipelines together.
---

Arbiter pairs a CUE-fluent specification workflow with an automation-focused CLI, shared libraries, and a monitoring-ready backend. These docs gather the foundational concepts, end-to-end guides, APIs, and tutorials you need to ship with Arbiter.

## What you will find here

- **Overview** – why the project exists, the mental model, and how CUE fits into the workflow.
- **Guides** – deep dives on template development, code-generation architecture, GitHub sync, monitoring, and other day-2 operations.
- **Reference** – canonical CLI docs, the Arbiter CUE schema, API surfaces, and generated TypeDoc output pulled straight from the source.
- **Tutorials** – step-by-step walkthroughs (from the `basics` hands-on labs to Kubernetes-focused playbooks).

If you prefer to hack locally, run `bun run docs:site:dev` for a live MkDocs server. To propose navigation changes, update the `nav` section in `mkdocs.yml` and keep folders scoped to a single topic so navigation stays predictable.
