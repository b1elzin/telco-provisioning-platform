import type { Order } from './domain.js';

export class InMemoryOrderStore {
  private readonly orders = new Map<string, Order>();
  private readonly idempotencyIndex = new Map<string, string>();

  save(order: Order): void {
    this.orders.set(order.id, order);
    this.idempotencyIndex.set(order.idempotencyKey, order.id);
  }

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  findByIdempotencyKey(key: string): Order | undefined {
    const id = this.idempotencyIndex.get(key);
    return id ? this.orders.get(id) : undefined;
  }

  list(): Order[] {
    return [...this.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
