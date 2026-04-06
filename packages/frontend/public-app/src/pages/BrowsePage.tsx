import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { ExperienceListItem } from '../sdk/api-client';

const EMOJIS = ['', '', '', '', '', '', '', '', '', ''];

const LOCATIONS_BY_COUNTRY: Record<string, Record<string, string[]>> = {
  'United States': {
    'Arizona': ['Sedona, AZ'],
    'California': ['Marina del Rey, CA', 'San Francisco, CA', 'Napa Valley, CA'],
    'Illinois': ['Chicago, IL'],
    'New York': ['New York, NY'],
    'Oregon': ['Portland, OR'],
    'Washington': ['Seattle, WA'],
  },
};

const CITY_BACKGROUNDS: Record<string, string> = {
  'Arizona': 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=1920&q=85',
  'California': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=85',
  'Illinois': 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=1920&q=85',
  'New York': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1920&q=85',
  'Oregon': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1920&q=85',
  'Washington': 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362?w=1920&q=85',
};

const STATE_TAGLINES: Record<string, string> = {
  'Arizona': 'Where desert sunsets paint the sky in gold',
  'California': 'From golden coasts to vineyard sunrises',
  'Illinois': 'The city of big shoulders and bigger moments',
  'New York': 'Where every corner holds a new experience',
  'Oregon': 'Where nature meets craft and creativity',
  'Washington': 'Emerald city adventures await',
};

const ALL_COUNTRIES = Object.keys(LOCATIONS_BY_COUNTRY).sort();

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [experiences, setExperiences] = useState<ExperienceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? 'United States');
  const [state, setState] = useState(searchParams.get('state') ?? '');
  const [city, setCity] = useState(searchParams.get('city') ?? '');

  const statesForCountry = country ? Object.keys(LOCATIONS_BY_COUNTRY[country] ?? {}).sort() : [];
  const citiesForState = (country && state) ? (LOCATIONS_BY_COUNTRY[country]?.[state] ?? []) : [];
  const bgImage = state ? CITY_BACKGROUNDS[state] : undefined;

  useEffect(() => {
    setLoading(true);
    api.listExperiences({
      search: searchParams.get('search') ?? undefined,
      category: searchParams.get('category') ?? undefined,
    })
      .then(r => {
        let items = r.items;
        const selectedCity = searchParams.get('city');
        const selectedState = searchParams.get('state');
        if (selectedCity) {
          items = items.filter(e => e.location === selectedCity);
        } else if (selectedState) {
          const countryData = LOCATIONS_BY_COUNTRY[searchParams.get('country') ?? 'United States'] ?? {};
          const stateCities = countryData[selectedState] ?? [];
          items = items.filter(e => stateCities.includes(e.location));
        }
        setExperiences(items);
      })
      .catch(() => setExperiences([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const updateParams = (overrides: Record<string, string>) => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (country) params.country = country;
    if (state) params.state = state;
    if (city) params.city = city;
    Object.assign(params, overrides);
    // Clean empty values
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    setSearchParams(params);
  };

  const handleCountryChange = (c: string) => {
    setCountry(c); setState(''); setCity('');
    updateParams({ country: c, state: '', city: '' });
  };

  const handleStateChange = (s: string) => {
    setState(s); setCity('');
    updateParams({ state: s, city: '' });
  };

  const handleCityChange = (c: string) => {
    setCity(c);
    updateParams({ city: c });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search });
  };

  return (
    <>
      <div className="browse-hero" style={bgImage ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.75)), url(${bgImage})` } : undefined}>
        <h1>Browse Experiences</h1>
        <p>{state && STATE_TAGLINES[state] ? STATE_TAGLINES[state] : state ? `Explore experiences in ${state}` : 'Find the perfect experience gift for any occasion'}</p>
        <div className="browse-filters">
          <select value={country} onChange={e => handleCountryChange(e.target.value)} className="browse-select">
            <option value="">All Countries</option>
            {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={state} onChange={e => handleStateChange(e.target.value)} className="browse-select">
            <option value="">All States</option>
            {statesForCountry.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {citiesForState.length > 1 && (
            <select value={city} onChange={e => handleCityChange(e.target.value)} className="browse-select">
              <option value="">All Cities</option>
              {citiesForState.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="browse-input" />
            <button type="submit" className="btn btn-primary">Go</button>
          </form>
        </div>
      </div>
      <section className="section">
        {loading ? (
          <div className="loading">Loading experiences</div>
        ) : experiences.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '4rem', marginBottom: '1rem' }}></p>
            <p>No experiences found in this area. Try a different location or search.</p>
          </div>
        ) : (
          <div className="card-grid">
            {experiences.map((exp, i) => (
              <Link to={`/experiences/${exp.id}`} key={exp.id} className="card" style={{ color: 'inherit' }}>
                {exp.imageUrl ? <img className="card-img-real" src={exp.imageUrl} alt={exp.name} loading="lazy" /> : <div className="card-img">{EMOJIS[i % EMOJIS.length]}</div>}
                <div className="card-body">
                  <h3>{exp.name}</h3>
                  <p>{exp.description}</p>
                  <div className="card-meta">
                    <span className="card-price">${(exp.priceCents / 100).toFixed(2)}</span>
                    <span>{exp.location}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}