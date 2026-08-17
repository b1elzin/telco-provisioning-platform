import { deriveOrderStatus, newOrder, type CreateOrderInput, type Order, type Target } from './domain.js';
import { InMemoryOrderStore } from './store.js';

export class ProvisioningOrchestrator {
  constructor(private readonly store: InMemoryOrderStore) {}

  create(input: CreateOrderInput, idempotencyKey: string): { order: Order; replayed: boolean } {
    const existing = this.store.findByIdempotencyKey(idempotencyKey);
    if (existing) return { order: existing, replayed: true };

    const order = newOrder(input, idempotencyKey);
    this.store.save(order);
    queueMicrotask(() => void this.process(order.id, new Set(input.simulateFailureFor ?? [])));
    return { order, replayed: false };
  }

  retry(orderId: string, target: Target): Order | undefined {
    const order = this.store.findById(orderId);
    const execution = order?.executions.find((item) => item.target === target);
    if (!order || !execution || execution.status !== 'FAILED') return undefined;
    execution.status = 'PENDING';
    execution.error = undefined;
    order.status = deriveOrderStatus(order.executions);
    order.updatedAt = new Date().toISOString();
    queueMicrotask(() => void this.process(order.id, new Set()));
    return order;
  }

  private async process(orderId: string, failures: Set<Target>): Promise<void> {
    const order = this.store.findById(orderId);
    if (!order) return;

    for (const execution of order.executions.filter((item) => item.status === 'PENDING')) {
      execution.status = 'PROCESSING';
      execution.attempts += 1;
      execution.updatedAt = new Date().toISOString();
      order.status = deriveOrderStatus(order.executions);
      await new Promise((resolve) => setTimeout(resolve, 25));

      if (failures.has(execution.target)) {
        execution.status = 'FAILED';
        execution.error = 'Synthetic downstream timeout';
      } else {
        execution.status = 'SUCCEEDED';
      }
      execution.updatedAt = new Date().toISOString();
    }

    order.status = deriveOrderStatus(order.executions);
    order.updatedAt = new Date().toISOString();
    this.store.save(order);
  }
}
