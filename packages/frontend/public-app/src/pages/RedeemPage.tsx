import { useState } from 'react';
import { api } from '../api';
import type { ValidateCodeResponse } from '../sdk/api-client';

export function RedeemPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ValidateCodeResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [booked, setBooked] = useState(false);
  const [bookError, setBookError] = useState('');
  const [booking, setBooking] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setBooked(false);
    try {
      const res = await api.validateRedemptionCode(code.trim());
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleBook = async () => {
    if (!bookingDate || !bookingTime) {
      setBookError('Please select a date and time');
      return;
    }
    setBooking(true);
    setBookError('');
    try {
      await api.redeemGiftCard({ redemptionCode: code.trim(), bookingDate, bookingTime });
      setBooked(true);
    } catch (err: any) {
      setBookError(err.message ?? 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Redeem Your Gift</h1>
        <p>Enter the code from your gift card to book your experience</p>
      </div>
      <div className="form-card">
        <form onSubmit={handleValidate}>
          <div className="form-group">
            <label htmlFor="code">Redemption Code</label>
            <input id="code" type="text" placeholder="Enter your gift code" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Validating...' : 'Validate Code'}
          </button>
        </form>

        {error && <p className="form-error">{error}</p>}

        {result && !booked && (
          <div className="redeem-result fade-in">
            <h3>{result.experienceName}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{result.experienceDescription}</p>
            {result.personalizedMessage && (
              <p className="redeem-message">&ldquo;{result.personalizedMessage}&rdquo;</p>
            )}
            <p><strong>Location:</strong> {result.location}</p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label htmlFor="bdate">Date</label>
                <select id="bdate" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="form-select">
                  <option value="">Select date</option>
                  {result.availableDates?.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="btime">Time</label>
                <select id="btime" value={bookingTime} onChange={e => setBookingTime(e.target.value)} className="form-select">
                  <option value="">Select time</option>
                  {result.availableTimes?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {bookError && <p className="form-error">{bookError}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleBook} disabled={booking}>
              {booking ? 'Booking...' : 'Book This Experience'}
            </button>
          </div>
        )}

        {booked && (
          <div className="confirmation-card fade-in" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div className="confirmation-icon"></div>
            <h3>Experience Booked!</h3>
            <p style={{ color: 'var(--text-muted)' }}>Your experience has been confirmed. Check your email for details.</p>
          </div>
        )}
      </div>
    </>
  );
}