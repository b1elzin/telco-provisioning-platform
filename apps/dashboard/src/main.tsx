import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Execution = { id: string; target: string; status: string; attempts: number };
type Order = { id: string; correlationId: string; subscriberId: string; operation: string; status: string; executions: Execution[]; createdAt: string };

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const response = await fetch(`${apiUrl}/v1/orders`);
      if (!response.ok) throw new Error('API unavailable');
      setOrders(await response.json());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load data');
    }
  }

  async function createDemoOrder() {
    await fetch(`${apiUrl}/v1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': `dashboard-${crypto.randomUUID()}` },
      body: JSON.stringify({ subscriberId: `sub-demo-${Math.floor(Math.random() * 9000 + 1000)}`, operation: 'ACTIVATE', targets: ['provider-alpha', 'ims-provider'] }),
    });
    setTimeout(refresh, 100);
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  const successful = orders.filter((order) => order.status === 'SUCCEEDED').length;
  const failed = orders.flatMap((order) => order.executions).filter((execution) => execution.status === 'FAILED').length;

  return (
    <main>
      <header>
        <div>
          <span className="eyebrow">NETWORK OPERATIONS</span>
          <h1>Provisioning Control</h1>
          <p>One operational view across provider-neutral subscriber workflows.</p>
        </div>
        <button onClick={createDemoOrder}>Create demo activation</button>
      </header>

      <section className="metrics">
        <article><span>Total orders</span><strong>{orders.length}</strong></article>
        <article><span>Completed</span><strong>{successful}</strong></article>
        <article><span>Failed targets</span><strong>{failed}</strong></article>
        <article><span>Success rate</span><strong>{orders.length ? Math.round((successful / orders.length) * 100) : 0}%</strong></article>
      </section>

      <section className="panel">
        <div className="panelTitle"><h2>Recent workflows</h2><span className="live">LIVE</span></div>
        {error && <p className="error">{error}. Start the API on port 3001.</p>}
        {!error && orders.length === 0 && <p className="empty">No orders yet. Create a synthetic activation to see the flow.</p>}
        {orders.map((order) => (
          <article className="order" key={order.id}>
            <div><strong>{order.subscriberId}</strong><small>{order.operation} · {order.correlationId.slice(0, 8)}</small></div>
            <div className="targets">{order.executions.map((execution) => <span key={execution.id}>{execution.target}</span>)}</div>
            <span className={`status ${order.status.toLowerCase()}`}>{order.status.replace('_', ' ')}</span>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
