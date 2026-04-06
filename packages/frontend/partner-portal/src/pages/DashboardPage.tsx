import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PartnerDashboard } from '../sdk/api-client';

export function DashboardPage() {
  const [dash, setDash] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setDash)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{dash?.experiences?.length ?? 0}</div>
          <div className="stat-label">Active Experiences</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dash?.totalBookings ?? 0}</div>
          <div className="stat-label">Total Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dash?.upcomingBookings?.length ?? 0}</div>
          <div className="stat-label">Upcoming Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{dash?.stripeConnectStatus ?? 'N/A'}</div>
          <div className="stat-label">Stripe Status</div>
        </div>
      </div>

      <div className="card">
        <h3>Recent Bookings</h3>
        {(!dash?.upcomingBookings || dash.upcomingBookings.length === 0) ? (
          <p>No upcoming bookings yet.</p>
        ) : (
          <table>
            <thead><tr><th>Experience</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              {dash.upcomingBookings.slice(0, 5).map(b => (
                <tr key={b.id}>
                  <td>{b.experienceName}</td>
                  <td>{b.date}</td>
                  <td>{b.time}</td>
                  <td><span className="badge badge-active">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}