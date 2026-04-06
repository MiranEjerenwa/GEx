import { Link } from 'react-router-dom';

export function MissionPage() {
  return (
    <>
      <section className="mission-hero">
        <div className="hero-logo">GEx</div>
        <h1>Our <em>Mission</em></h1>
        <p style={{ color: '#A09A90', maxWidth: 600, margin: '0 auto', fontWeight: 300, fontSize: '1.1rem', lineHeight: 1.8 }}>
          We are building a world where the most meaningful gifts are not things
          &mdash; but experiences that spark curiosity, learning, and connection.
        </p>
      </section>

      <section className="mission-section">
        <h2>Why This Matters</h2>
        <p>
          Every year, billions of dollars are spent on gifts that are quickly forgotten. But the moments that
          truly shape a person &mdash; the first time they see marine life up close, walk through a
          garden in bloom, or explore how the world works &mdash; those stay forever.
        </p>
        <p>
          We don't remember most of what we're given. But we remember the first time
          we stood face to face with something that took our breath away. The texture of something
          wild and unfamiliar beneath our fingertips. The moment curiosity cracked open into wonder
          &mdash; and the world suddenly felt bigger than we knew.
        </p>
        <div className="highlight">
          We are not just creating a platform. We are shifting how people think about giving.
        </div>
      </section>

      <section className="mission-section">
        <div className="mission-values">
          <div className="mission-value">
            <div className="mv-icon">&#x1F504;</div>
            <div className="mv-from">Consumption</div>
            <div className="mv-to">Connection</div>
          </div>
          <div className="mission-value">
            <div className="mv-icon">&#x2728;</div>
            <div className="mv-from">Clutter</div>
            <div className="mv-to">Curiosity</div>
          </div>
          <div className="mission-value">
            <div className="mv-icon">&#x1F31F;</div>
            <div className="mv-from">Temporary</div>
            <div className="mv-to">Transformative</div>
          </div>
        </div>
      </section>

      <section className="mission-section">
        <h2>For Everyone</h2>
        <p>
          This is about giving the people you love something that grows with them. Not more distractions
          &mdash; but discovery. Not more noise &mdash; but meaningful time together. Because the
          experiences you share today become the stories you carry for life.
        </p>
        <p>
          Whether it's a parent gifting a child their first science museum visit, a partner surprising
          their loved one with a sunset sail, or friends sharing a cooking class &mdash; we make it
          simple to gift moments that matter.
        </p>
        <div className="highlight">
          The best gifts aren't things &mdash; they're moments you carry for life.
        </div>
      </section>

      <section className="mission-section">
        <h2>For Investors &amp; Partners</h2>
        <p>
          This is more than a marketplace &mdash; it's a behavioral shift. We are building the
          infrastructure for a new category: experience-based gifting for everyone.
        </p>
        <p>
          A platform that unlocks new demand for cultural and educational institutions, creates
          predictable prepaid revenue streams, and aligns with a global movement toward meaningful
          consumption.
        </p>
        <p>
          This is a scalable, mission-driven business positioned at the intersection of relationships,
          experiences, and purpose. A fast-growing alternative to traditional gifting &mdash;
          a category that is still largely undefined and ready to be owned.
        </p>
        <div className="highlight">
          An opportunity to lead a movement where purpose and profit align.
        </div>
      </section>

      <section className="mission-section">
        <h2>For the World</h2>
        <p>
          If we change how we gift, we change how people experience the world. We cultivate
          more curious minds. More engaged learners. More connected relationships. And ultimately, a
          culture that values experiences, knowledge, and connection over excess.
        </p>
        <p>
          We envision a future where birthdays spark curiosity, holidays create memories, and gifts
          inspire exploration. Where instead of asking "what did you get?" we ask &mdash;
        </p>
        <div className="highlight">
          "What did you experience?"
        </div>
      </section>

      <section className="mission-closing">
        <p>
          Less clutter. More wonder.<br />
          Less distraction. More discovery.<br />
          <span className="closing-gold">More experiences that shape a lifetime.</span>
        </p>
        <div style={{ marginTop: '2.5rem' }}>
          <Link to="/experiences" className="hero-btn">Explore Experiences</Link>
        </div>
      </section>
    </>
  );
}