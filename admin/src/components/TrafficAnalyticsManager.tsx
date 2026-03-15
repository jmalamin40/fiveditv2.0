import { useState, useEffect } from 'react';
import { BarChart3, Globe, Link2, Search, Share2, Mail, Calendar, TrendingUp, ExternalLink } from 'lucide-react';
import { getTrafficAnalytics, type TrafficAnalytics } from '../api';

interface Props {
  token: string;
  toast?: { success: (msg: string) => void; error: (msg: string) => void };
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Globe; color: string }> = {
  direct: { label: 'Direct', icon: Link2, color: '#6366f1' },
  referral: { label: 'Referral', icon: ExternalLink, color: '#8b5cf6' },
  search: { label: 'Search', icon: Search, color: '#0ea5e9' },
  social: { label: 'Social', icon: Share2, color: '#ec4899' },
  email: { label: 'Email', icon: Mail, color: '#10b981' },
};

export default function TrafficAnalyticsManager({ token }: Props) {
  const [data, setData] = useState<TrafficAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTrafficAnalytics(token, from, to)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, from, to]);

  const total = data?.totalVisits ?? 0;
  const maxDay = Math.max(1, ...(data?.visitsByDay?.map((d) => d.count) ?? [0]));

  return (
    <div className="traffic-analytics-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={24} />
          Traffic Analytics
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <Calendar size={18} style={{ color: '#64748b' }} />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
          />
          <span style={{ color: '#64748b' }}>to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
          />
        </div>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.9375rem', marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
        See where your website traffic comes from: direct, search, social, referral, and email.
      </p>

      {loading && (
        <div className="card-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#64748b' }}>Loading analytics…</p>
        </div>
      )}

      {!loading && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <TrendingUp size={28} style={{ color: '#0ea5e9', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b' }}>{total.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total visits</div>
            </div>
            {Object.entries(SOURCE_LABELS).map(([key, { label, icon: Icon, color }]) => (
              <div key={key} className="card-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <Icon size={28} style={{ color, marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                  {(data.bySource[key as keyof typeof data.bySource] ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            <div className="card-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Traffic by source</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(SOURCE_LABELS).map(([key, { label, color }]) => {
                  const count = data.bySource[key as keyof typeof data.bySource] ?? 0;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 500 }}>{label}</span>
                        <span style={{ color: '#64748b' }}>{count.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Visits over time</h2>
              {data.visitsByDay.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No data for this range.</p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                  {data.visitsByDay.map((d) => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      style={{
                        flex: 1,
                        minWidth: '8px',
                        background: '#0ea5e9',
                        borderRadius: '4px 4px 0 0',
                        height: `${Math.max(4, (d.count / maxDay) * 100)}%`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div className="card-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Top referrers</h2>
              {data.topReferrers.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No referrers in this period.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.topReferrers.map((r, i) => (
                    <li key={r.domain} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < data.topReferrers.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.domain}</span>
                      <span style={{ color: '#64748b', flexShrink: 0 }}>{r.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Top pages</h2>
              {data.topPaths.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No pages in this period.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data.topPaths.map((p, i) => (
                    <li key={p.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < data.topPaths.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path || '/'}</span>
                      <span style={{ color: '#64748b', flexShrink: 0 }}>{p.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !data && (
        <div className="card-panel" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#64748b' }}>Could not load traffic data.</p>
        </div>
      )}
    </div>
  );
}
