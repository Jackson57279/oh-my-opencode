---
description: "Test discipline - fires when reading or editing any test file"
trigger: glob
globs:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
  - "**/test_*.py"
  - "**/*_test.go"
---

# Test Discipline (NON-NEGOTIABLE)

**Every test in this project MUST pass with the project's normal test command in one process, in one go — no isolation flags, no retries, no special ordering.** A test that needs `--only`, its own process, or a specific run order to pass is **BROKEN**. Fix the test; do not pamper it.

## FLAKY = FAILING

A test that passes 9 of 10 times is **failing 10% of the time**. Not "occasional." **BROKEN.**

**FORBIDDEN in test bodies** unless time itself is the system under test (real timers, debounce/throttle windows):

- `setTimeout(resolve, N)` / `await new Promise(r => setTimeout(r, N))` / `await sleep(N)` / `time.sleep(N)`
- "wait long enough for X to happen" — "enough" is a guess; CI machines are slower or faster than your laptop and the test WILL fail on someone else's box

The replacement: **subscribe BEFORE the trigger, await the signal with an explicit timeout.**

## EVENT TESTING — SUBSCRIBE-FIRST, TIMEOUT-BOUND

When code under test emits an event, fires a callback, or resolves a promise:

1. **Register the listener / construct the awaitable BEFORE you trigger the action.** Reverse order = lost event = flake.
2. **Race against an explicit timeout.** On timeout, **fail with a useful message** (`"waited 5s for event 'X', never fired"`). NEVER silently retry, NEVER fall through.
3. The timeout is a **circuit breaker**, not a synchronization primitive. If the assertion logic depends on the timeout firing first, the test is wrong.

## NO TEST-THEATER

- A test that cannot fail is not a test — delete it or make it able to fail.
- Pin machine-consumed behavior (exit codes, JSON shapes, emitted events), not prose wording that blocks every legitimate edit.
- Fixtures must be depersonalized and minimal.
