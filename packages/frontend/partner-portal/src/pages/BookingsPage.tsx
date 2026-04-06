import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PartnerBooking } from '../sdk/api-client';

export function BookingsPage() {
  const [bookings, setBookings] = useState<PartnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBookings(1, 20)
      .then(r => setBookings(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading bookings...</div>;

  return (
    <div>
      <h1 className="page-title">Bookings</h1>
      {bookings.length === 0 ? (
        <div className="empty-state">No bookings yet.</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr><th>Experience</th><th>Date</th><th>Time</th><th>Recipient</th><th>Status</th></tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td>{b.experienceName}</td>
                  <td>{b.date}</td>
                  <td>{b.time}</td>
                  <td>{b.recipientEmail}</td>
                  <td><span className="badge badge-active">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}