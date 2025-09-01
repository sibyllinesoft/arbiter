# smith-policy-schema - Assembly Documentation

**Generated:** 2025-09-01T01:29:01.115Z  
**Artifact Type:** policy_bundle  
**Primary Language:** cue  
**Build Tool:** cue

## Project Overview

This document describes the Arbiter assembly configuration for the smith-policy-schema project.

## Artifact Configuration

### Type: policy_bundle

A policy bundle containing security and governance rules.

### Build Configuration

- **Build Tool:** cue
- **Language:** cue
- **Targets:** Defined in assembly

- **Outputs:** Custom output specifications defined

## Profile Configuration

### Policy Profile Configuration

This project uses a policy-specific profile with:
- NATS subject patterns for message routing
- Security derivation rules for sandbox profiles
- Policy compilation and validation requirements

## Quality Gates

The following quality gates are enforced:

- **CUE Evaluation:** All CUE expressions must evaluate successfully
- **Policy Determinism:** Policy compilation must be deterministic
- **Bundle Completeness:** All required policy components must be present

## Schema Definitions

### Policy Schema Definitions

This project defines custom policy schemas:

#### AtomCapability
Defines atomic capabilities with effects, scope, and resource limits.

#### Macro  
Defines reusable macro templates that reference atom capabilities.

#### Playbook
Defines sequences of macro execution steps with guards and conditions.

#### Bundle
Defines complete policy bundles with atoms, macros, playbooks, and derivation rules.

## Validation Rules

- **Determinism:** Required - same inputs produce identical outputs
- **API Compatibility:** No explicit API compatibility rules

## Development Workflow

1. **Validation:** Run `arbiter check` to validate assembly
2. **Surface Analysis:** Run `arbiter surface cue` to extract API surface  
3. **Testing:** Run `arbiter tests generate` to create test scaffolding
4. **Watch Mode:** Run `arbiter watch` for continuous validation

## Generated Files

This assembly configuration generates the following artifacts:

- `build/policy/bundles/policy_bundle.json`
- `build/policy/sandbox_profiles/*.json`
- `build/policy/policy_digest.txt`

---

*This documentation is automatically generated from `arbiter.assembly.cue`.*
