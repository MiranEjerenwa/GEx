import { useEffect, useState } from 'react';
import { api } from '../api';
import type { CommunityImpact, SharedMoment } from '../sdk/api-client';

export function CommunityPage() {
  const [impact, setImpact] = useState<CommunityImpact | null>(null);
  const [moments, setMoments] = useState<SharedMoment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getCommunityImpact().catch(() => null),
      api.getCommunityFeed(1, 6).then(r => r.items).catch(() => []),
    ]).then(([imp, moms]) => {
      setImpact(imp);
      setMoments(moms);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Community Impact</h1>
        <p>See how experience gifting is creating meaningful connections</p>
      </div>
      <section className="section">
        {loading ? (
          <div className="loading">Loading</div>
        ) : (
          <>
            <div className="impact-grid">
              <div className="impact-card">
                <div className="impact-number">{impact?.totalFamilies?.toLocaleString() ?? ''}</div>
                <div className="impact-label">People Connected</div>
              </div>
              <div className="impact-card">
                <div className="impact-number">{impact?.experiencesGifted?.toLocaleString() ?? ''}</div>
                <div className="impact-label">Experiences Gifted</div>
              </div>
              <div className="impact-card">
                <div className="impact-number">{impact?.estimatedFamilyHours?.toLocaleString() ?? ''}</div>
                <div className="impact-label">Meaningful Hours Created</div>
              </div>
              <div className="impact-card">
                <div className="impact-number">{impact?.materialGiftsReplaced?.toLocaleString() ?? ''}</div>
                <div className="impact-label">Material Gifts Replaced</div>
              </div>
            </div>

            <h2>Shared Moments</h2>
            {moments.length === 0 ? (
              <div className="empty-state">
                <p style={{ fontSize: '4rem', marginBottom: '1rem' }}></p>
                <p>No shared moments yet. Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="card-grid">
                {moments.map(m => (
                  <div key={m.id} className="card">
                    <div className="card-img"></div>
                    <div className="card-body">
                      <h3>{m.experienceName}</h3>
                      <p>{m.caption}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        {new Date(m.publishedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}