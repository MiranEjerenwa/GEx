import { useState } from 'react';
import { api } from '../api';
import type { AdminOrder } from '../sdk/api-client';

export function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    try {
      const results = await api.searchOrders({ referenceNumber: search.trim(), purchaserEmail: search.trim() });
      setOrders(results);
    } catch { setOrders([]); }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="page-title">Orders</h1>
      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="Search by reference number or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {orders.length === 0 ? (
        <div className="empty-state">Search for orders by reference number or email.</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr><th>Reference</th><th>Purchaser</th><th>Recipient</th><th>Experience</th><th>Status</th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.referenceNumber}</td>
                  <td>{o.purchaserEmail}</td>
                  <td>{o.recipientName}</td>
                  <td>{o.experienceName}</td>
                  <td><span className="badge badge-active">{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}