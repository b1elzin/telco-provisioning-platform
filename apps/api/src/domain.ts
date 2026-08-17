import { randomUUID } from 'node:crypto';

export const operations = ['ACTIVATE', 'DEACTIVATE', 'BLOCK', 'UNBLOCK'] as const;
export const targets = ['provider-alpha', 'provider-beta', 'ims-provider'] as const;

export type Operation = (typeof operations)[number];
export type Target = (typeof targets)[number];
export type ExecutionStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'PARTIALLY_SUCCEEDED' | 'FAILED';

export interface CreateOrderInput {
  subscriberId: string;
  operation: Operation;
  targets: Target[];
  simulateFailureFor?: Target[];
}

export interface Execution {
  id: string;
  target: Target;
  status: ExecutionStatus;
  attempts: number;
  error?: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  correlationId: string;
  idempotencyKey: string;
  subscriberId: string;
  operation: Operation;
  status: OrderStatus;
  executions: Execution[];
  createdAt: string;
  updatedAt: string;
}

export function newOrder(input: CreateOrderInput, idempotencyKey: string): Order {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    correlationId: randomUUID(),
    idempotencyKey,
    subscriberId: input.subscriberId,
    operation: input.operation,
    status: 'PENDING',
    executions: input.targets.map((target) => ({
      id: randomUUID(),
      target,
      status: 'PENDING',
      attempts: 0,
      updatedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveOrderStatus(executions: Execution[]): OrderStatus {
  if (executions.some((item) => item.status === 'PROCESSING')) return 'PROCESSING';
  if (executions.some((item) => item.status === 'PENDING')) return 'PENDING';
  const succeeded = executions.filter((item) => item.status === 'SUCCEEDED').length;
  if (succeeded === executions.length) return 'SUCCEEDED';
  if (succeeded > 0) return 'PARTIALLY_SUCCEEDED';
  return 'FAILED';
}
