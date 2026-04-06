import { useEffect, useState } from 'react';
import { api } from '../api';
import type { PartnerDashboard, PartnerExperience } from '../sdk/api-client';

export function ExperiencesPage() {
  const [experiences, setExperiences] = useState<PartnerExperience[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(d => setExperiences(d.experiences ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const formatPrice = (cents: number) => '$' + (cents / 100).toFixed(2);
  const badgeClass = (status: string) => {
    if (status === 'ACTIVE') return 'badge badge-active';
    if (status === 'DRAFT') return 'badge badge-draft';
    return 'badge badge-pending';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>My Experiences</h1>
        <button className="btn btn-primary">+ New Experience</button>
      </div>
      {experiences.length === 0 ? (
        <div className="empty-state">
          <p>You haven't created any experiences yet.</p>
          <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Your First Experience</button>
        </div>
      ) : (
        <div>
          {experiences.map(exp => (
            <div key={exp.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>{exp.name}</h3>
                <p>{exp.category} &middot; {exp.location} &middot; {formatPrice(exp.price)}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={badgeClass(exp.status)}>{exp.status}</span>
                <button className="btn btn-primary">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}