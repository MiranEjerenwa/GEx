import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AdminOnboardingApplication } from '../sdk/api-client';

export function OnboardingPage() {
  const [apps, setApps] = useState<AdminOnboardingApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listOnboardingApplications()
      .then(setApps)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    await api.approveApplication(id);
    setApps(prev => prev.filter(a => a.id !== id));
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await api.rejectApplication(id, reason);
    setApps(prev => prev.filter(a => a.id !== id));
  };

  if (loading) return <div className="loading">Loading applications...</div>;

  return (
    <div>
      <h1 className="page-title">Onboarding Queue</h1>
      {apps.length === 0 ? (
        <div className="empty-state">No pending applications.</div>
      ) : (
        <div>
          {apps.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{a.businessName}</h3>
                  <p>{a.contactEmail}</p>
                  <p style={{ marginTop: '0.5rem' }}>{a.description}</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                    Categories: {a.categories.join(', ')} | Submitted: {new Date(a.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-success" onClick={() => handleApprove(a.id)}>Approve</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleReject(a.id)}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}