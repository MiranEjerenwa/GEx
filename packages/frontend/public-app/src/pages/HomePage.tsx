import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ExperienceListItem } from '../sdk/api-client';

const EMOJIS = ['', '', '', '', '', '', '', '', '', ''];

const REVIEWS = [
  { stars: 5, text: 'We gifted my mom a sunset sailing trip for her birthday. She still talks about the dolphins she saw. Best gift we ever gave.', author: 'Sarah M., Atlanta' },
  { stars: 5, text: 'Instead of another gadget, we gave our friend a botanical garden photography workshop. He discovered a whole new hobby.', author: 'James T., Denver' },
  { stars: 5, text: 'My partner and I were stuck in a routine until we started gifting each other experiences. Now we have adventures to look forward to every month.', author: 'Priya K., Austin' },
  { stars: 5, text: "The look on my dad's face when he walked into the cooking class was priceless. No store-bought gift has ever made him that happy.", author: 'David L., Chicago' },
];

export function HomePage() {
  const [experiences, setExperiences] = useState<ExperienceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listExperiences({ limit: 6 })
      .then(r => setExperiences(r.items))
      .catch(() => setExperiences([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-logo">GEx</div>
        <div className="hero-tagline">Gift Experiences</div>
        <h1>Give <em>Moments</em>, Not Things</h1>
        <p>We don't remember most of what we're given. But we remember the first time we stood face to face with something that took our breath away &mdash; the moment curiosity cracked open into wonder, and the world suddenly felt bigger than we knew.</p>
        <Link to="/experiences" className="hero-btn">Explore Experiences</Link>
      </section>

      <section className="section">
        <h2>How It Works</h2>
        <hr className="gold-divider" />
        <p className="section-sub">Three simple steps to give the gift of a lifetime</p>
        <div className="features">
          <div className="feature">
            <div className="feature-icon"></div>
            <h3>Choose an Experience</h3>
            <p>Browse curated experiences across categories, cities, and occasions.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <h3>Personalize &amp; Send</h3>
            <p>Add a personal message and choose a beautiful card template for the occasion.</p>
          </div>
          <div className="feature">
            <div className="feature-icon"></div>
            <h3>Redeem &amp; Enjoy</h3>
            <p>Recipients book their experience at a time that works for them.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Featured Experiences</h2>
        <hr className="gold-divider" />
        <p className="section-sub">Hand-picked moments waiting to be gifted</p>
        {loading ? (
          <div className="loading">Loading experiences</div>
        ) : experiences.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '3rem', marginBottom: '1rem' }}></p>
            <p>No experiences available yet. Check back soon.</p>
          </div>
        ) : (
          <div className="card-grid">
            {experiences.map((exp, i) => (
              <Link to={'/experiences/' + exp.id} key={exp.id} className="card" style={{ color: 'inherit' }}>
                {exp.imageUrl ? <img className="card-img-real" src={exp.imageUrl} alt={exp.name} loading="lazy" /> : <div className="card-img">{EMOJIS[i % EMOJIS.length]}</div>}
                <div className="card-body">
                  <h3>{exp.name}</h3>
                  <p>{exp.description}</p>
                  <div className="card-meta">
                    <span className="card-price">{'$' + (exp.priceCents / 100).toFixed(2)}</span>
                    <span>{exp.location}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>What People Are Saying</h2>
        <hr className="gold-divider" />
        <p className="section-sub">Real stories from people who chose experiences over things</p>
        <div className="reviews-grid">
          {REVIEWS.map((r, i) => (
            <div key={i} className="review-card">
              <div className="review-stars">{'\u2605'.repeat(r.stars)}</div>
              <div className="review-text">&ldquo;{r.text}&rdquo;</div>
              <div className="review-author">&mdash; {r.author}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ textAlign: 'center' }}>
        <h2>Our Mission</h2>
        <hr className="gold-divider" />
        <p style={{ color: '#A09A90', maxWidth: 600, margin: '0 auto 2rem', fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.8 }}>
          Every year, billions of dollars are spent on gifts that are quickly forgotten. But the moments that truly shape a person's memory &mdash; those stay forever. We're here to change how the world thinks about giving.
        </p>
        <Link to="/mission" className="btn btn-outline">Read Our Full Mission</Link>
      </section>
    </>
  );
}