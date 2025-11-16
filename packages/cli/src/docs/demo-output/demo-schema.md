# Arbiter CUE Schema Documentation (Demo)

*This is a demo documentation generated from the actual Arbiter CUE schema files*

**Package:** `schema`  
**Types:** 38  
**Generated:** 2025-11-12T19:57:04.755Z

---

## Table of Contents

- [Slug](#slug) - constraint
- [Human](#human) - primitive
- [Email](#email) - constraint
- [ISODateTime](#isodatetime) - constraint
- [Percent01](#percent01) - primitive
- [URLPath](#urlpath) - constraint
- [HTTPMethod](#httpmethod) - enum
- [HTTPStatus](#httpstatus) - primitive
- [RouteID](#routeid) - constraint
- [Cap](#cap) - primitive
- [Role](#role) - primitive
- [LocatorToken](#locatortoken) - constraint
- [CssSelector](#cssselector) - constraint
- [FlowID](#flowid) - primitive
- [StateKind](#statekind) - enum
- [TextMatch](#textmatch) - struct
- [ExpectUI](#expectui) - struct
- [ExpectAPI](#expectapi) - struct
- [AssertionSeverity](#assertionseverity) - enum
- [CueAssertion](#cueassertion) - union
- [CueAssertionBlock](#cueassertionblock) - struct
- [FactoryName](#factoryname) - primitive
- [Seed](#seed) - struct
- [KV](#kv) - struct
- [AppSpec](#appspec) - struct
- [Flow](#flow) - struct
- [Step](#step) - struct
- [FSM](#fsm) - struct
- [HttpMediaType](#httpmediatype) - struct
- [HttpContent](#httpcontent) - struct
- [HttpRequestBody](#httprequestbody) - struct
- [HttpResponse](#httpresponse) - struct
- [HttpParameter](#httpparameter) - struct
- [HttpOperation](#httpoperation) - struct
- [CapabilitySpec](#capabilityspec) - struct
- [FeatureSpec](#featurespec) - struct
- [CompletionProfile](#completionprofile) - struct
- [DefaultCompletion](#defaultcompletion) - struct

---

## Type Definitions

### `Slug` {#slug}

---------- Canonical identifiers & primitives ----------

**Category:** `constraint`  
**Definition:** `=~"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"`  
**Source:** `core_types.cue:5`

**Constraints:**
- Pattern: ^[a-z0-9]+(?:[._-][a-z0-9]+)*$

---

### `Human` {#human}

**Category:** `primitive`  
**Definition:** `string & !=""                              // short human label`  
**Source:** `core_types.cue:6`

**Constraints:**
- Non-empty string

---

### `Email` {#email}

**Category:** `constraint`  
**Definition:** `=~"^[^@\s]+@[^@\s]+\.[^@\s]+$"`  
**Source:** `core_types.cue:7`

**Constraints:**
- Pattern: ^[^@\s]+@[^@\s]+\.[^@\s]+$

---

### `ISODateTime` {#isodatetime}

**Category:** `constraint`  
**Definition:** `=~"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"`  
**Source:** `core_types.cue:8`

**Constraints:**
- Pattern: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$

---

### `Percent01` {#percent01}

**Category:** `primitive`  
**Definition:** `number & >=0.0 & <=1.0`  
**Source:** `core_types.cue:9`

**Constraints:**
- Minimum: 0.0
- Maximum: 1.0

---

### `URLPath` {#urlpath}

**Category:** `constraint`  
**Definition:** `=~"^/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$"`  
**Source:** `core_types.cue:10`

**Constraints:**
- Pattern: ^/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$

---

### `HTTPMethod` {#httpmethod}

**Category:** `enum`  
**Definition:** `"GET" | "POST" | "PUT" | "PATCH" | "DELETE"`  
**Source:** `core_types.cue:11`

---

### `HTTPStatus` {#httpstatus}

**Category:** `primitive`  
**Definition:** `int & >=100 & <=599`  
**Source:** `core_types.cue:12`

**Constraints:**
- Minimum: 100
- Maximum: 599

---

### `RouteID` {#routeid}

---------- Domain tokens ----------

**Category:** `constraint`  
**Definition:** `=~"^[a-z0-9]+(?::[a-z0-9_-]+)+$"           // e.g., invoices:detail`  
**Source:** `core_types.cue:15`

**Constraints:**
- Pattern: ^[a-z0-9]+(?::[a-z0-9_-]+)+$

---

### `Cap` {#cap}

**Category:** `primitive`  
**Definition:** `#Slug                                      // capability, e.g., approve`  
**Source:** `core_types.cue:16`

---

### `Role` {#role}

**Category:** `primitive`  
**Definition:** `#Slug                                      // role, e.g., manager`  
**Source:** `core_types.cue:17`

---

### `LocatorToken` {#locatortoken}

---------- Locator contract ----------

**Category:** `constraint`  
**Definition:** `=~"^[a-z]+:[a-z0-9_-]+$"                   // e.g., btn:approve`  
**Source:** `core_types.cue:20`

**Constraints:**
- Pattern: ^[a-z]+:[a-z0-9_-]+$

---

### `CssSelector` {#cssselector}

**Category:** `constraint`  
**Definition:** `string & =~"^[^\n\r]+$" & !=""             // non-empty single-line`  
**Source:** `core_types.cue:21`

**Constraints:**
- Pattern: ^[^\n\r]+$
- Non-empty string

---

### `FlowID` {#flowid}

---------- Flow steps ----------

**Category:** `primitive`  
**Definition:** `#Slug`  
**Source:** `core_types.cue:24`

---

### `StateKind` {#statekind}

**Category:** `enum`  
**Definition:** `"visible" | "hidden" | "enabled" | "disabled" | "attached" | "detached"`  
**Source:** `core_types.cue:25`

---

### `TextMatch` {#textmatch}

**Category:** `struct`  
**Definition:** `{ eq?: string, contains?: string, regex?: string } // one of these`  
**Source:** `core_types.cue:26`

---

### `ExpectUI` {#expectui}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `core_types.cue:28`

---

### `ExpectAPI` {#expectapi}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `core_types.cue:34`

---

### `AssertionSeverity` {#assertionseverity}

---------- Assertion helpers ----------

**Category:** `enum`  
**Definition:** `"error" | "warn" | "info"`  
**Source:** `core_types.cue:43`

---

### `CueAssertion` {#cueassertion}

**Category:** `union`  
**Definition:** `bool | {`  
**Source:** `core_types.cue:45`

---

### `CueAssertionBlock` {#cueassertionblock}

**Category:** `struct`  
**Definition:** `{[#Slug]: #CueAssertion}`  
**Source:** `core_types.cue:52`

---

### `FactoryName` {#factoryname}

---------- Seeds & factories ----------

**Category:** `primitive`  
**Definition:** `#Slug`  
**Source:** `core_types.cue:55`

---

### `Seed` {#seed}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `core_types.cue:56`

---

### `KV` {#kv}

---------- Misc ----------

**Category:** `struct`  
**Definition:** `{ [string]: _ } // loose map where needed`  
**Source:** `core_types.cue:63`

---

### `AppSpec` {#appspec}

Top-level “AppSpec” schema. All fragments unify into this shape under /spec/app.

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:7`

---

### `Flow` {#flow}

---------- Flow grammar ----------

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:87`

---

### `Step` {#step}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:101`

---

### `FSM` {#fsm}

---------- FSM shape (minimal) ----------

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:110`

---

### `HttpMediaType` {#httpmediatype}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:116`

---

### `HttpContent` {#httpcontent}

**Category:** `struct`  
**Definition:** `{ [string]: #HttpMediaType }`  
**Source:** `app_spec.cue:122`

---

### `HttpRequestBody` {#httprequestbody}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:124`

---

### `HttpResponse` {#httpresponse}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:130`

---

### `HttpParameter` {#httpparameter}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:136`

---

### `HttpOperation` {#httpoperation}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:147`

---

### `CapabilitySpec` {#capabilityspec}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `app_spec.cue:159`

---

### `FeatureSpec` {#featurespec}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `feature_spec.cue:4`

---

### `CompletionProfile` {#completionprofile}

**Category:** `struct`  
**Definition:** `{`  
**Source:** `feature_spec.cue:29`

---

### `DefaultCompletion` {#defaultcompletion}

**Category:** `struct`  
**Definition:** `#CompletionProfile & {`  
**Source:** `completion_rules.cue:4`

---

## Summary

This demo documentation was generated from 38 type definitions found in the Arbiter CUE schema files.

### Type Distribution

- **constraint**: 7 types
- **primitive**: 7 types
- **enum**: 3 types
- **struct**: 20 types
- **union**: 1 types

> **Note:** This is a simplified demo. The full documentation system supports advanced features like relationship mapping, HTML output, JSON schema generation, and more sophisticated CUE parsing.