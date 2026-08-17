import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('provisioning API', () => {
  it('creates an order and replays the same idempotency key', async () => {
    const app = buildApp();
    apps.push(app);
    const payload = { subscriberId: 'sub-demo-1001', operation: 'ACTIVATE', targets: ['provider-alpha'] };

    const first = await app.inject({ method: 'POST', url: '/v1/orders', headers: { 'idempotency-key': 'activation-demo-001' }, payload });
    const second = await app.inject({ method: 'POST', url: '/v1/orders', headers: { 'idempotency-key': 'activation-demo-001' }, payload });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(200);
    expect(second.headers['x-idempotent-replay']).toBe('true');
    expect(second.json().id).toBe(first.json().id);
  });

  it('makes partial provider failure visible', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: { 'idempotency-key': 'partial-failure-001' },
      payload: {
        subscriberId: 'sub-demo-2002',
        operation: 'ACTIVATE',
        targets: ['provider-alpha', 'ims-provider'],
        simulateFailureFor: ['ims-provider'],
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const order = await app.inject({ method: 'GET', url: `/v1/orders/${response.json().id}` });

    expect(order.json().status).toBe('PARTIALLY_SUCCEEDED');
    expect(order.json().executions).toEqual(expect.arrayContaining([expect.objectContaining({ target: 'ims-provider', status: 'FAILED' })]));
  });
});
