import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminPartner } from '../sdk/api-client';

export function PartnersPage() {
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listPartners()
      .then(setPartners)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading partners...</div>;

  return (
    <div>
      <h1 className="page-title">Partners</h1>
      {partners.length === 0 ? (
        <div className="empty-state">No partners registered yet.</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr><th>Business</th><th>Email</th><th>Status</th><th>Experiences</th><th>Bookings</th><th>Commission</th></tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id}>
                  <td>{p.businessName}</td>
                  <td>{p.contactEmail}</td>
                  <td><span className="badge badge-active">{p.status}</span></td>
                  <td>{p.activeExperienceCount}</td>
                  <td>{p.totalBookings}</td>
                  <td>{(p.commissionRate * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}