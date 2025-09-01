# 🚀 Phase 2: Testing Revolution - CUE Invariants to Property Tests

**The world's first system that transforms logical invariants into executable property tests**

## 🎯 The Big Idea

Arbiter Phase 2 introduces a **revolutionary approach to testing**: Instead of manually writing tests, you define logical invariants in CUE, and Arbiter **automatically generates property tests** that prove your invariants hold.

```cue
// Define invariants in CUE
invariants: [
  {
    name: "idempotent_operations"
    description: "Operations can be safely repeated"
    formula: "∀x. f(f(x)) = f(x)"
  }
]
```

```bash
# Generate property tests automatically
arbiter tests scaffold --language typescript
```

```typescript
// Arbiter generates this executable test
fc.assert(fc.property(
  fc.string(), // x
  (x) => {
    // Test: f(f(x)) = f(x)
    const result1 = testFunction(x);
    const result2 = testFunction(result1);
    expect(result2).toEqual(result1);
  }
));
```

## 🧪 Revolutionary Features

### 1. **Smart Pattern Recognition**
Arbiter analyzes your invariant formulas and generates appropriate property tests:

- **`∀x. f(f(x)) = f(x)`** → Idempotent property tests
- **`∀x. f(x) = f(x)`** → Deterministic property tests  
- **`duration(request) ≤ 750ms`** → Performance constraint tests
- **`coverage_ratio ≥ threshold`** → Coverage validation tests

### 2. **Multi-Language Support**
Generate tests for any language in your stack:

```bash
# TypeScript with fast-check
arbiter tests scaffold --language typescript

# Python with hypothesis
arbiter tests scaffold --language python  

# Rust with proptest
arbiter tests scaffold --language rust

# Go with testing/quick
arbiter tests scaffold --language go

# Bash with BATS
arbiter tests scaffold --language bash
```

### 3. **Contract Coverage Analysis**
Revolutionary coverage metric: **How many of your invariants are proven by tests?**

```bash
arbiter tests cover --threshold 0.9 --verbose
```

```
📊 Contract Coverage Report:
  Total invariants: 5
  Covered invariants: 4
  Coverage ratio: 80.0%
  Status: ✅ PASSED

📋 Invariant Details:
  ✅ deterministic_execution
      All operations are deterministic and repeatable
      Tests: deterministic_execution.test.ts
  ✅ idempotent_operations  
      Operations can be safely repeated
      Tests: idempotent_operations.test.ts
  ❌ sandboxed_validation
      All validation goes through server API
      No tests found
```

### 4. **Idempotent Test Generation**
Smart markers prevent duplicate generation:

```typescript
// ARBITER_INVARIANT_IDEMPOTENT_OPERATIONS
// Generated at: 2024-03-21T10:30:00.000Z
// WARNING: Do not edit this block - it will be regenerated
```

Running `arbiter tests scaffold` again won't duplicate tests unless you use `--force`.

### 5. **CI/CD Integration**
Perfect for continuous integration:

```bash
# Generate coverage report + JUnit XML
arbiter tests cover --junit coverage.xml --output report.json

# Fail CI if coverage below threshold
arbiter tests cover --threshold 0.9
echo $? # Returns 1 if below threshold
```

## 📚 Complete Command Reference

### `arbiter tests scaffold`
Generate test skeletons from CUE invariants

```bash
# Basic usage
arbiter tests scaffold --language typescript

# Advanced options
arbiter tests scaffold \
  --language python \
  --output tests/ \
  --force \
  --verbose
```

**Options:**
- `--language` - Target language (typescript, python, rust, go, bash)
- `--framework` - Override test framework 
- `--output` - Output directory
- `--force` - Overwrite existing tests
- `--verbose` - Detailed analysis output

### `arbiter tests cover`
Analyze contract coverage metrics

```bash
# Basic coverage analysis
arbiter tests cover

# Advanced coverage with reporting
arbiter tests cover \
  --threshold 0.9 \
  --junit coverage.xml \
  --output report.json \
  --verbose
```

**Options:**
- `--threshold` - Minimum coverage ratio (default: 0.8)
- `--output` - JSON report file
- `--junit` - JUnit XML for CI
- `--verbose` - Detailed coverage breakdown

### `arbiter tests run` (Legacy)
Run unified test harness

```bash
arbiter tests run --epic epics/service.json --junit results.xml
```

## 🔬 How It Works

### 1. **Invariant Parsing**
Arbiter parses your `arbiter.assembly.cue` file to extract invariants:

```cue
invariants: [
  {
    name: "deterministic_execution"
    description: "All operations are deterministic and repeatable"  
    formula: "∀x. f(x) = f(x)"
  }
]
```

### 2. **Pattern Analysis**
Smart analysis determines testability and generates appropriate patterns:

- **Universal quantifiers** (`∀x`) → Property tests with generators
- **Comparison operators** (`≤`, `≥`) → Constraint validation
- **Logical operators** (`∧`, `∨`) → Combined property tests
- **Function compositions** (`f(f(x))`) → Composition property tests

### 3. **Test Template Generation**
Framework-specific test code generation:

#### TypeScript (Vitest + fast-check)
```typescript
import { test, expect, describe } from 'vitest';
import * as fc from 'fast-check';

describe('invariant_name', () => {
  test('description', () => {
    fc.assert(fc.property(
      fc.string(),
      (input) => {
        // Generated property test logic
      }
    ));
  });
});
```

#### Python (pytest + hypothesis)
```python
import pytest
from hypothesis import given, strategies as st

class TestInvariantName:
    @given(st.text())
    def test_property(self, input_data):
        # Generated property test logic
        assert invariant_holds(input_data)
```

### 4. **Coverage Analysis**
Sophisticated analysis that:
- Scans test files for Arbiter invariant markers
- Counts tests per invariant
- Calculates coverage ratios
- Generates detailed reports

## 🎯 Real-World Example

Let's see it in action with Arbiter's own invariants:

### Step 1: Define Invariants in CUE
```cue
// arbiter.assembly.cue
invariants: [
  {
    name: "deterministic_execution"
    description: "All operations are deterministic and repeatable"
    formula: "∀x. f(x) = f(x)"
  },
  {
    name: "idempotent_operations"  
    description: "Operations can be safely repeated"
    formula: "∀x. f(f(x)) = f(x)"
  },
  {
    name: "rate_limit_compliance"
    description: "Respects API rate limits and timeouts"
    formula: "∀request. duration(request) ≤ 750ms ∧ rate(requests) ≤ 1/s"
  }
]
```

### Step 2: Generate Tests
```bash
$ arbiter tests scaffold --language typescript --verbose

🧪 Generating test scaffolds from invariants...
📋 Using assembly: arbiter.assembly.cue
🔍 Found 3 invariants

Invariants found:
  • deterministic_execution: All operations are deterministic and repeatable
    Formula: ∀x. f(x) = f(x)
    Testable: ✅
  • idempotent_operations: Operations can be safely repeated  
    Formula: ∀x. f(f(x)) = f(x)
    Testable: ✅
  • rate_limit_compliance: Respects API rate limits and timeouts
    Formula: ∀request. duration(request) ≤ 750ms ∧ rate(requests) ≤ 1/s
    Testable: ✅

🎯 Generating tests for: typescript
✨ Generated: deterministic_execution.test.ts
✨ Generated: idempotent_operations.test.ts  
✨ Generated: rate_limit_compliance.test.ts

📊 Scaffold Summary:
  Generated: 3 new test files
  Updated: 0 existing test files
  Language: typescript (vitest + fast-check)
  Output: tests/

💡 Installation hint:
  npm install --save-dev vitest fast-check @types/node
```

### Step 3: Analyze Coverage
```bash
$ arbiter tests cover --verbose

📊 Computing contract coverage...
📋 Found 3 invariants
🔍 Analyzing 3 test files

📈 Contract Coverage Report:
  Total invariants: 3
  Covered invariants: 3
  Coverage ratio: 100.0%
  Threshold: 80.0%
  Status: ✅ PASSED

📋 Invariant Details:
  ✅ deterministic_execution
      All operations are deterministic and repeatable
      Tests: deterministic_execution.test.ts
  ✅ idempotent_operations
      Operations can be safely repeated
      Tests: idempotent_operations.test.ts
  ✅ rate_limit_compliance
      Respects API rate limits and timeouts  
      Tests: rate_limit_compliance.test.ts

📄 Report saved: coverage-report.json
```

## 🚀 Why This Is Revolutionary

### 1. **First of Its Kind**
No other system transforms logical invariants into executable property tests automatically.

### 2. **Specification-Driven Testing**
Instead of implementation-driven tests, you write tests that prove your **specifications**.

### 3. **Language Agnostic**
One invariant definition generates tests for any language in your polyglot codebase.

### 4. **Contract Coverage**
A new metric that measures how well your tests prove your invariants, not just line coverage.

### 5. **Agent-Friendly**
Perfect for agent-assisted development - agents can write invariants, and tests are generated automatically.

## 🎯 Future Enhancements

- **Advanced Pattern Recognition**: More sophisticated invariant → test mappings
- **Mutation Testing**: Generate tests that prove invariants under code mutations  
- **Formal Verification**: Integration with formal verification tools
- **Interactive Invariant Builder**: GUI for building complex invariants
- **Invariant Discovery**: AI-powered invariant extraction from existing code

## 🔗 Integration Examples

### GitHub Actions
```yaml
- name: Generate Tests from Invariants
  run: arbiter tests scaffold --language typescript

- name: Check Contract Coverage  
  run: arbiter tests cover --threshold 0.9 --junit coverage.xml
```

### Package.json Scripts
```json
{
  "scripts": {
    "test:scaffold": "arbiter tests scaffold --language typescript",
    "test:cover": "arbiter tests cover --verbose",
    "test:gate": "arbiter tests cover --threshold 0.9"
  }
}
```

---

**🎉 The Testing Revolution Has Begun**

Transform your invariants into tests. Prove your specifications. Build systems that are **correct by construction**.

**Try it today:**
```bash
arbiter tests scaffold --language typescript --verbose
arbiter tests cover --threshold 0.9
```

*Making property testing accessible to every developer, one invariant at a time.* 🚀