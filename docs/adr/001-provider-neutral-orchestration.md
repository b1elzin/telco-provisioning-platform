# ADR 001: Provider-neutral orchestration

- Status: accepted
- Date: 2026-08-17

## Context

Direct integrations make channels aware of provider-specific rules and make operational status difficult to aggregate.

## Decision

The API accepts a provider-neutral order, creates one execution per target and delegates provider behavior through adapters. Public contracts use fictional names and synthetic payloads.

Idempotency is enforced before order creation. A correlation ID links the order and all executions. Provider failures are isolated, so one target can fail without erasing successful work performed by another.

## Consequences

- Adding a provider does not change channel contracts.
- Operators get a single status model.
- Partial success is explicit and recoverable.
- The orchestrator owns routing and workflow state, but adapters own provider protocols.
