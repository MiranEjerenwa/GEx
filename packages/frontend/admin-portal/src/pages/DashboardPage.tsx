import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminDashboard } from '../sdk/api-client';

export function DashboardPage() {
  const [dash, setDash] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setDash)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const revenue = dash ? '$' + (dash.totalRevenueCents / 100).toLocaleString() : '$0';

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{dash?.totalOrders ?? 0}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{revenue}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dash?.activePartners ?? 0}</div>
          <div className="stat-label">Active Partners</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dash?.bookingsForPeriod ?? 0}</div>
          <div className="stat-label">Bookings This Period</div>
        </div>
      </div>
      <div className="card">
        <h3>Gift Card Status Breakdown</h3>
        {dash?.giftCardsByStatus ? (
          <table>
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(dash.giftCardsByStatus).map(([status, count]) => (
                <tr key={status}><td>{status}</td><td>{String(count)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ color: 'var(--text-light)' }}>No data available.</p>}
      </div>
    </div>
  );
}