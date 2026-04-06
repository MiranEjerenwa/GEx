import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getToken } from '../api';
import type { ExperienceDetail, Occasion, OrderResponse } from '../sdk/api-client';

type Step = 'details' | 'personalize' | 'payment' | 'confirmation';

export function ExperienceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [exp, setExp] = useState<ExperienceDetail | null>(null);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [step, setStep] = useState<Step>('details');
  const [occasion, setOccasion] = useState('');
  const [recipientFirstName, setRecipientFirstName] = useState('');
  const [recipientLastName, setRecipientLastName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState(() => {
    try { const u = JSON.parse(localStorage.getItem('gex_user') ?? '{}'); return u.email ?? ''; } catch { return ''; }
  });
  const [message, setMessage] = useState('');
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getExperience(id),
      api.getOccasions().catch(() => []),
    ])
      .then(([experience, occ]) => {
        setExp(experience);
        setOccasions(occ);
      })
      .catch(e => setError(e.message ?? 'Failed to load experience'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGiftClick = () => {
    setStep('personalize');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exp) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const fullName = `${recipientFirstName} ${recipientLastName}`.trim();
      const orderRes = await api.createOrder({
        experienceId: exp.id,
        purchaserEmail,
        recipientName: fullName,
        recipientEmail,
        occasion,
        amountCents: exp.priceCents,
        personalizedMessage: message || undefined,
      });
      setOrder(orderRes);
      setStep('payment');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async () => {
    if (!order || !exp) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.payOrder(order.id, { paymentMethodId: 'pm_demo_card', partnerId: exp.partnerId });
      setStep('confirmation');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading" style={{ padding: '4rem' }}>Loading</div>;
  if (error || !exp) return (
    <div className="empty-state">
      <p>{error || 'Experience not found'}</p>
      <Link to="/experiences" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Browse</Link>
    </div>
  );

  const recipientDisplay = `${recipientFirstName} ${recipientLastName}`.trim();

  return (
    <div className="detail-container">
      {exp.imageUrl && <img className="detail-hero-img" src={exp.imageUrl} alt={exp.name} />}
      <div className="detail-info">
        <h1>{exp.name}</h1>
        <div className="price">${(exp.priceCents / 100).toFixed(2)}</div>
        <p>{exp.fullDescription || exp.description}</p>
        <p><strong>Location:</strong> {exp.location}</p>
        <p><strong>Category:</strong> {exp.category}</p>
        {exp.occasions?.length > 0 && <p><strong>Great for:</strong> {exp.occasions.join(', ')}</p>}

        {step === 'details' && (
          <div className="detail-actions">
            <button className="btn btn-primary" onClick={handleGiftClick}>Gift This Experience</button>
            <Link to="/experiences" className="btn btn-outline">Back</Link>
          </div>
        )}
      </div>

      {step === 'personalize' && (
        <div className="checkout-card fade-in" ref={formRef}>
          <div className="checkout-step-indicator">
            <div className="step-dot active">1</div>
            <div className="step-line active"></div>
            <div className="step-dot">2</div>
            <div className="step-line"></div>
            <div className="step-dot">3</div>
          </div>
          <h2>Personalize Your Gift</h2>
          <form onSubmit={handleCreateOrder}>
            <div className="form-group">
              <label htmlFor="occasion">Occasion</label>
              <select id="occasion" value={occasion} onChange={e => setOccasion(e.target.value)} className="form-select" required>
                <option value="">Select an occasion</option>
                {occasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="birthday">Birthday</option>
                <option value="holiday">Holiday</option>
                <option value="just-because">Just Because</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="recipientFirst">Recipient First Name</label>
                <input id="recipientFirst" type="text" value={recipientFirstName} onChange={e => setRecipientFirstName(e.target.value)} placeholder="First name" required />
              </div>
              <div className="form-group">
                <label htmlFor="recipientLast">Recipient Last Name</label>
                <input id="recipientLast" type="text" value={recipientLastName} onChange={e => setRecipientLastName(e.target.value)} placeholder="Last name" required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="recipientEmail">Recipient Email</label>
              <input id="recipientEmail" type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="recipient@example.com" required />
            </div>

            <div className="form-group">
              <label htmlFor="message">Personal Message (optional)</label>
              <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a heartfelt message..." rows={3} className="form-textarea" />
            </div>
            {submitError && <p className="form-error">{submitError}</p>}
            <div className="checkout-actions">
              <button type="button" className="btn btn-outline" onClick={() => setStep('details')}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating Order...' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'payment' && order && (
        <div className="checkout-card fade-in">
          <div className="checkout-step-indicator">
            <div className="step-dot completed"></div>
            <div className="step-line active"></div>
            <div className="step-dot active">2</div>
            <div className="step-line"></div>
            <div className="step-dot">3</div>
          </div>
          <h2>Review &amp; Pay</h2>
          <div className="order-summary">
            <div className="summary-row"><span>Experience</span><span>{exp.name}</span></div>
            <div className="summary-row"><span>For</span><span>{recipientDisplay}</span></div>
            <div className="summary-row"><span>Occasion</span><span>{occasion}</span></div>
            <div className="summary-row"><span>Reference</span><span className="ref-number">{order.referenceNumber}</span></div>
            <div className="summary-divider"></div>
            <div className="summary-row summary-total"><span>Total</span><span>${(order.amountCents / 100).toFixed(2)}</span></div>
          </div>
          <div className="card-form">
            <h3 style={{ marginBottom: '0.8rem', fontSize: '1rem' }}>Payment Details</h3>
            <div className="form-group">
              <label>Card Number</label>
              <input type="text" placeholder="4242 4242 4242 4242" maxLength={19} className="card-input" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry</label>
                <input type="text" placeholder="MM/YY" maxLength={5} className="card-input" />
              </div>
              <div className="form-group">
                <label>CVC</label>
                <input type="text" placeholder="123" maxLength={4} className="card-input" />
              </div>
            </div>
          </div>
          {submitError && <p className="form-error">{submitError}</p>}
          <div className="checkout-actions">
            <button className="btn btn-outline" onClick={() => setStep('personalize')}>Back</button>
            <button className="btn btn-primary" onClick={handlePay} disabled={submitting}>
              {submitting ? 'Processing...' : `Pay $${(order.amountCents / 100).toFixed(2)}`}
            </button>
          </div>
        </div>
      )}

      {step === 'confirmation' && order && (
        <div className="checkout-card fade-in confirmation-card">
          <div className="checkout-step-indicator">
            <div className="step-dot completed"></div>
            <div className="step-line active"></div>
            <div className="step-dot completed"></div>
            <div className="step-line active"></div>
            <div className="step-dot completed"></div>
          </div>
          <div className="confirmation-icon"></div>
          <h2>Gift Sent!</h2>
          <p className="confirmation-text">
            Your experience gift for <strong>{recipientDisplay}</strong> has been sent to <strong>{recipientEmail}</strong>.
          </p>
          <div className="confirmation-ref">
            <span>Reference Number</span>
            <strong>{order.referenceNumber}</strong>
          </div>
          <p className="confirmation-sub">They will receive an email with a redemption code to book their experience.</p>
          <div className="checkout-actions">
            <Link to="/experiences" className="btn btn-outline">Browse More</Link>
            <Link to="/account" className="btn btn-primary">View My Orders</Link>
          </div>
        </div>
      )}
    </div>
  );
}