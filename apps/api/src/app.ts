import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { z } from 'zod';
import { operations, targets } from './domain.js';
import { IdempotencyConflictError, ProvisioningOrchestrator } from './orchestrator.js';
import { InMemoryOrderStore } from './store.js';

const createOrderSchema = z.object({
  subscriberId: z.string().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  operation: z.enum(operations),
  targets: z.array(z.enum(targets)).min(1).max(targets.length).refine((items) => new Set(items).size === items.length),
  simulateFailureFor: z.array(z.enum(targets)).optional(),
});

export interface AppOptions {
  logger?: boolean;
  docs?: boolean;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const store = new InMemoryOrderStore();
  const orchestrator = new ProvisioningOrchestrator(store);

  void app.register(cors, { origin: true });
  if (options.docs ?? true) {
    void app.register(swagger, {
      openapi: {
        info: { title: 'Telco Provisioning Platform', version: '0.1.0' },
        tags: [{ name: 'orders' }, { name: 'operations' }],
      },
    });
    void app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/v1/orders', { schema: { tags: ['orders'] } }, async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
      return reply.code(400).send({ error: 'A valid idempotency-key header is required' });
    }
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request', details: parsed.error.issues });

    try {
      const result = orchestrator.create(parsed.data, idempotencyKey);
      reply.header('x-idempotent-replay', String(result.replayed));
      return reply.code(result.replayed ? 200 : 202).send(result.order);
    } catch (error) {
      if (error instanceof IdempotencyConflictError) return reply.code(409).send({ error: error.message });
      throw error;
    }
  });

  app.get('/v1/orders', { schema: { tags: ['orders'] } }, async () => store.list());

  app.get('/v1/orders/:id', { schema: { tags: ['orders'] } }, async (request, reply) => {
    const order = store.findById((request.params as { id: string }).id);
    return order ?? reply.code(404).send({ error: 'Order not found' });
  });

  app.post('/v1/orders/:id/executions/:target/retry', { schema: { tags: ['operations'] } }, async (request, reply) => {
    const params = request.params as { id: string; target: string };
    const target = z.enum(targets).safeParse(params.target);
    if (!target.success) return reply.code(400).send({ error: 'Invalid target' });
    const order = orchestrator.retry(params.id, target.data);
    return order ?? reply.code(409).send({ error: 'Only failed executions can be retried' });
  });

  app.get('/v1/metrics/summary', { schema: { tags: ['operations'] } }, async () => {
    const orders = store.list();
    const executions = orders.flatMap((order) => order.executions);
    return {
      orders: orders.length,
      successfulOrders: orders.filter((order) => order.status === 'SUCCEEDED').length,
      failedExecutions: executions.filter((execution) => execution.status === 'FAILED').length,
      pendingExecutions: executions.filter((execution) => ['PENDING', 'PROCESSING'].includes(execution.status)).length,
    };
  });

  return app;
}
