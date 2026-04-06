import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { OrderResponse } from '../sdk/api-client';

export function AccountPage() {
  const navigate = useNavigate();
  const [sentOrders, setSentOrders] = useState<OrderResponse[]>([]);
  const [receivedOrders, setReceivedOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('gex_user');
    if (!stored) { navigate('/login'); return; }
    const u = JSON.parse(stored);
    setUser(u);
    Promise.all([
      api.getMyOrders(u.email).catch(() => []),
      api.getReceivedOrders(u.email).catch(() => []),
    ]).then(([sent, received]) => {
      setSentOrders(sent);
      setReceivedOrders(received);
    }).finally(() => setLoading(false));
  }, [navigate]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    setRedeemStatus('');
    try {
      const result = await api.validateRedemptionCode(redeemCode.trim());
      setRedeemStatus(`Valid! Experience: ${result.experienceName} at ${result.location}`);
      // Navigate to full redeem page for booking
      setTimeout(() => navigate(`/redeem?code=${encodeURIComponent(redeemCode.trim())}`), 1500);
    } catch (err: any) {
      setRedeemStatus(err.message ?? 'Invalid or expired redemption code');
    } finally {
      setRedeeming(false);
    }
  };

  const activeOrders = tab === 'sent' ? sentOrders : receivedOrders;

  return (
    <>
      <div className="page-header">
        <h1>My Account</h1>
        <p>{user?.name || user?.email}</p>
      </div>
      <section className="section">
        <div className="tab-bar">
          <button className={`tab-btn${tab === 'sent' ? ' active' : ''}`} onClick={() => setTab('sent')}>
            Gifts I Sent ({sentOrders.length})
          </button>
          <button className={`tab-btn${tab === 'received' ? ' active' : ''}`} onClick={() => setTab('received')}>
            Gifts I Received ({receivedOrders.length})
          </button>
        </div>

        {tab === 'received' && (
          <div className="redeem-section">
            <h3>Have a redemption code?</h3>
            <form onSubmit={handleRedeem} className="redeem-form">
              <input
                type="text"
                value={redeemCode}
                onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="Enter your gift code (e.g., GEX-ABCD1234)"
                className="redeem-input"
              />
              <button type="submit" className="btn btn-primary" disabled={redeeming}>
                {redeeming ? 'Validating...' : 'Redeem'}
              </button>
            </form>
            {redeemStatus && (
              <p className={`redeem-status ${redeemStatus.startsWith('Valid') ? 'success' : 'error'}`}>
                {redeemStatus}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading your gifts</div>
        ) : activeOrders.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>{tab === 'sent' ? '🎁' : '🎉'}</p>
            <p>{tab === 'sent' ? "You haven't sent any experience gifts yet." : "No gifts received yet. Enter a redemption code above or check back later!"}</p>
            {tab === 'sent' && <Link to="/experiences" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Experiences</Link>}
          </div>
        ) : (
          <div className="orders-list">
            {activeOrders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <span className="order-ref">{order.referenceNumber}</span>
                  <span className={`order-status status-${order.status}`}>{order.status}</span>
                </div>
                <div className="order-card-body">
                  {tab === 'sent' ? (
                    <>
                      <div className="order-detail-row">
                        <span className="order-label">To</span>
                        <span>{order.recipientName}</span>
                      </div>
                      <div className="order-detail-row">
                        <span className="order-label">Sent to</span>
                        <span>{order.recipientEmail}</span>
                      </div>
                    </>
                  ) : (
                    <div className="order-detail-row">
                      <span className="order-label">From</span>
                      <span>{order.purchaserEmail}</span>
                    </div>
                  )}
                  <div className="order-detail-row">
                    <span className="order-label">Occasion</span>
                    <span>{order.occasion}</span>
                  </div>
                  <div className="order-detail-row">
                    <span className="order-label">Amount</span>
                    <span className="order-amount">${(order.amountCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="order-detail-row">
                    <span className="order-label">Date</span>
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  {tab === 'received' && order.status === 'completed' && (
                    <div style={{ marginTop: '0.8rem' }}>
                      <Link to="/redeem" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                        Book This Experience
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}