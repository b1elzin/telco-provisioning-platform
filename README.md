# telco-provisioning-platform

Small provisioning lab with an API and an operations UI. I use it to exercise a few problems that show up in multi-provider flows: idempotency, fan-out, partial success and per-target status.

This is currently an in-memory implementation. Restarting the API clears the orders. The next step is [moving order creation and job publication to a transactional outbox](https://github.com/b1elzin/telco-provisioning-platform/issues/1).

## Repository layout

```text
apps/
  api/          Fastify API and orchestration code
  dashboard/    React/Vite operations UI
docs/adr/       decisions that are worth keeping outside the code
```

## Run it

Requires Node.js 22+.

```bash
npm install
npm run dev
```

| Service | Address |
| --- | --- |
| API | http://localhost:3001 |
| OpenAPI UI | http://localhost:3001/docs |
| Dashboard | http://localhost:5173 |

Create an order:

```bash
curl -i -X POST http://localhost:3001/v1/orders \
  -H "content-type: application/json" \
  -H "idempotency-key: local-activation-001" \
  -d '{"subscriberId":"sub-1001","operation":"ACTIVATE","targets":["provider-alpha","ims-provider"]}'
```

Sending the same request again with the same key returns the original order and sets `x-idempotent-replay: true`.

To force a partial failure:

```json
{
  "subscriberId": "sub-1002",
  "operation": "ACTIVATE",
  "targets": ["provider-alpha", "ims-provider"],
  "simulateFailureFor": ["ims-provider"]
}
```

The failed execution can be retried without rerunning the successful target:

```text
POST /v1/orders/:orderId/executions/ims-provider/retry
```

## Useful commands

```bash
npm test
npm run typecheck
npm run build
npm run scan:secrets
```

## Current trade-offs

- State and queueing are in-process; there is no durability across restarts.
- Provider adapters only simulate latency and failures.
- Idempotency is process-local; key reuse with a different subscriber, operation or target set returns HTTP 409.
- The dashboard polls every three seconds; [streaming execution updates](https://github.com/b1elzin/telco-provisioning-platform/issues/2) is still open.

These are intentional constraints for the first cut, not production recommendations. The persistence boundary and transactional outbox are tracked as the next implementation step.

See [ADR 001](docs/adr/001-provider-neutral-orchestration.md) for why provider routing stays behind the orchestration API.
