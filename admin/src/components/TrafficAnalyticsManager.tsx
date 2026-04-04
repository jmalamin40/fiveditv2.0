import { useState, useEffect } from 'react';
import { BarChart3, Globe, Link2, Search, Share2, Mail, Calendar, TrendingUp, ExternalLink, Clock, Users, MapPin, Download } from 'lucide-react';
import { getTrafficAnalytics, downloadEmailRefTrafficCsv, type TrafficAnalytics } from '../api';

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

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

export default function TrafficAnalyticsManager({ token, toast }: Props) {
  const [data, setData] = useState<TrafficAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
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
  const sessionStats = data?.sessionStats ?? { sessions: 0, avgSessionSeconds: 0, totalPageViews: 0 };
  const byCountry = data?.byCountry ?? [];
  const recentSessions = data?.recentSessions ?? [];
  const byVisitor = data?.byVisitor ?? [];
  const emailRefSummary = data?.emailRefSummary ?? { sessions: 0, avgSessionSeconds: 0, totalDurationSeconds: 0 };
  const emailRefByRecipient = data?.emailRefByRecipient ?? [];
  const emailRefSessions = data?.emailRefSessions ?? [];

  const handleExportEmailRefCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await downloadEmailRefTrafficCsv(token, from, to);
      if (blob.type.includes('json')) {
        const text = await blob.text();
        try {
          const j = JSON.parse(text) as { error?: string };
          toast?.error(j.error || 'Export failed.');
        } catch {
          toast?.error('Export failed.');
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-ref-traffic_${from}_to_${to}.csv`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast?.success('CSV downloaded.');
    } catch {
      toast?.error('Could not export CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

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
        Traffic sources, page views, session length, visitor country, and email links using <code style={{ background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: 4 }}>?ref=</code> (see report below).
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
            <div className="card-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <Users size={28} style={{ color: '#14b8a6', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b' }}>{sessionStats.sessions.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Sessions (visits)</div>
            </div>
            <div className="card-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <Clock size={28} style={{ color: '#f97316', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b' }}>{formatDuration(sessionStats.avgSessionSeconds)}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avg. time on site</div>
            </div>
          </div>

          <div
            className="card-panel"
            style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #10b981' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: '1 1 280px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={22} style={{ color: '#10b981' }} />
                  Email link traffic (<span style={{ fontFamily: 'ui-monospace' }}>?ref=</span> with email)
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 }}>
                  Links like <code style={{ background: '#f1f5f9', padding: '0.12rem 0.4rem', borderRadius: 4 }}>?ref=alaminh2022@gmail.com</code>{' '}
                  are detected as email campaigns. Time on site and page views are stored per browser session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleExportEmailRefCsv()}
                disabled={exportingCsv || emailRefSummary.sessions === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  background: emailRefSummary.sessions === 0 ? '#e2e8f0' : '#10b981',
                  color: emailRefSummary.sessions === 0 ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: emailRefSummary.sessions === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Download size={18} />
                {exportingCsv ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{emailRefSummary.sessions.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Sessions</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{formatDuration(emailRefSummary.avgSessionSeconds)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Avg. time (those sessions)</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{formatDuration(emailRefSummary.totalDurationSeconds)}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total time (sum)</div>
              </div>
            </div>
            {emailRefByRecipient.length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>By recipient (ref email)</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {emailRefByRecipient.map((row, i) => (
                    <li
                      key={`${row.refEmail}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.45rem 0',
                        borderBottom: i < emailRefByRecipient.length - 1 ? '1px solid #f1f5f9' : 'none',
                        fontSize: '0.875rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, wordBreak: 'break-all' }}>{row.refEmail}</span>
                      <span style={{ color: '#64748b', flexShrink: 0, textAlign: 'right' }}>
                        {row.sessions} session{row.sessions !== 1 ? 's' : ''}
                        <br />
                        <span style={{ fontSize: '0.8rem' }}>
                          avg {formatDuration(row.avgDurationSeconds)} · total {formatDuration(row.totalDurationSeconds)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {emailRefSessions.length > 0 && (
              <div style={{ marginTop: '1.25rem', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#334155' }}>Session detail (latest 200)</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.4rem 0.4rem 0.6rem 0' }}>Ref email</th>
                      <th style={{ padding: '0.4rem' }}>Visitor</th>
                      <th style={{ padding: '0.4rem' }}>Time on site</th>
                      <th style={{ padding: '0.4rem' }}>Pages</th>
                      <th style={{ padding: '0.4rem' }}>Country</th>
                      <th style={{ padding: '0.4rem' }}>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailRefSessions.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.4rem 0.5rem 0', wordBreak: 'break-all' }}>{row.refEmail}</td>
                        <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'ui-monospace, monospace' }}>{row.visitorLabel}</td>
                        <td style={{ padding: '0.5rem 0.4rem' }}>{formatDuration(row.durationSeconds)}</td>
                        <td style={{ padding: '0.5rem 0.4rem' }}>{row.pageViews}</td>
                        <td style={{ padding: '0.5rem 0.4rem' }}>{row.countryName}</td>
                        <td style={{ padding: '0.5rem 0.4rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {emailRefSummary.sessions === 0 && (
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '1rem', marginBottom: 0 }}>
                No sessions with an email-shaped <code>?ref=</code> in this date range yet.
              </p>
            )}
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
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} />
                Visits by country
              </h2>
              {byCountry.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No country data yet (local dev often has no geo; use Cloudflare or deploy behind a public IP).</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {byCountry.map((c, i) => (
                    <li
                      key={`${c.countryCode}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0',
                        borderBottom: i < byCountry.length - 1 ? '1px solid #f1f5f9' : 'none',
                        fontSize: '0.9rem',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>
                        {c.countryName}
                        <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '0.35rem' }}>({c.countryCode})</span>
                      </span>
                      <span style={{ color: '#64748b', flexShrink: 0 }}>{c.visits.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} />
                Visitors (by session count)
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
                Anonymous IDs; total time is sum of session lengths in this date range.
              </p>
              {byVisitor.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No session data for this period.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {byVisitor.map((v, i) => (
                    <li
                      key={`${v.visitorLabel}-${i}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0',
                        borderBottom: i < byVisitor.length - 1 ? '1px solid #f1f5f9' : 'none',
                        fontSize: '0.9rem',
                      }}
                    >
                      <span style={{ fontWeight: 500, fontFamily: 'ui-monospace, monospace' }}>{v.visitorLabel}</span>
                      <span style={{ color: '#64748b', flexShrink: 0, textAlign: 'right' }}>
                        {v.sessionCount} visit{v.sessionCount !== 1 ? 's' : ''}
                        <br />
                        <span style={{ fontSize: '0.8rem' }}>
                          total {formatDuration(v.totalDurationSeconds)} · longest {formatDuration(v.longestSessionSeconds)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card-panel" style={{ padding: '1.5rem', marginTop: '1.5rem', overflowX: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} />
              Recent sessions
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: '0.75rem' }}>
              Time on site updates as the visitor navigates and when they leave the tab.
            </p>
            {recentSessions.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No sessions in this range.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem 0.5rem 0.75rem 0' }}>Visitor</th>
                    <th style={{ padding: '0.5rem' }}>Country</th>
                    <th style={{ padding: '0.5rem' }}>Time on site</th>
                    <th style={{ padding: '0.5rem' }}>Pages</th>
                    <th style={{ padding: '0.5rem' }}>Landing → last</th>
                    <th style={{ padding: '0.5rem' }}>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.5rem 0.6rem 0', fontFamily: 'ui-monospace, monospace' }}>{row.visitorLabel}</td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>{row.countryName}</td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>{formatDuration(row.durationSeconds)}</td>
                      <td style={{ padding: '0.6rem 0.5rem' }}>{row.pageViews}</td>
                      <td style={{ padding: '0.6rem 0.5rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${row.landingPath} → ${row.lastPath}`}>
                        {row.landingPath} → {row.lastPath}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {row.startedAt ? new Date(row.startedAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
