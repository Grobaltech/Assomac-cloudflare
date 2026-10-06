import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Invitation = {
  invitation_id: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  role_scope: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  invited_by: string;
  invited_by_email: string | null;
  status: string;
  email_sent_at: string | null;
  email_send_count: number;
  expires_at: string;
  accepted_user_id: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
};

function label(value: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function dateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-UG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Kampala',
  });
}

function statusClass(status: string) {
  if (status === 'ACCEPTED') return 'accepted';
  if (status === 'PENDING') return 'pending';
  if (status === 'EXPIRED') return 'expired';
  if (status === 'REVOKED') return 'revoked';
  return '';
}

export default function SentInvitations() {
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load(showRefresh = false) {
    showRefresh ? setRefreshing(true) : setLoading(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('admin_list_user_invitations');

    if (rpcError) {
      setItems([]);
      setError(rpcError.message || 'Unable to load invitations.');
    } else {
      setItems((data || []) as Invitation[]);
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter(item => {
      const matchesSearch =
        !q ||
        [
          item.email,
          item.role_code,
          item.role_name,
          item.company_name,
          item.branch_name,
          item.invited_by_email,
        ].filter(Boolean).some(value => String(value).toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'PENDING').length,
    accepted: items.filter(i => i.status === 'ACCEPTED').length,
    expired: items.filter(i => i.status === 'EXPIRED').length,
    revoked: items.filter(i => i.status === 'REVOKED').length,
    sent: items.filter(i => i.email_sent_at).length,
  };

  async function revoke(invitation: Invitation) {
    if (invitation.status !== 'PENDING') return;

    const confirmed = window.confirm(
      `Revoke the invitation sent to ${invitation.email}?`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: revokeError } = await supabase.rpc(
      'revoke_user_invitation',
      { p_invitation_id: invitation.invitation_id }
    );

    if (revokeError) {
      setError(revokeError.message || 'Unable to revoke invitation.');
      return;
    }

    setMessage('Invitation revoked successfully.');
    await load(true);
  }

  async function resend(invitation: Invitation) {
    if (invitation.status !== 'PENDING') return;

    setError('');
    setMessage('');

    const { data, error: resendError } = await supabase.rpc(
      'resend_user_invitation',
      {
        p_invitation_id: invitation.invitation_id,
        p_expires_in_hours: 168,
      }
    );

    if (resendError) {
      setError(resendError.message || 'Unable to regenerate invitation.');
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result?.invitation_token) {
      setError('A new invitation token was not returned.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError('Your session is no longer available. Please sign in again.');
      return;
    }

    const response = await fetch('/api/invitations/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        invitation_id: result.invitation_id,
        invitation_token: result.invitation_token,
      }),
    });

    if (!response.ok) {
      let detail = 'Invitation email could not be sent.';
      try {
        const body = await response.json();
        if (body?.error) detail = body.error;
      } catch {
        // Keep the safe message.
      }
      setError(detail);
      return;
    }

    setMessage(`Invitation email resent to ${invitation.email}.`);
    await load(true);
  }

  return (
    <div className="page-container sent-invitations-page">
      <div className="page-heading sent-heading">
        <div>
          <div className="eyebrow">SUPER ADMINISTRATION</div>
          <h1>Sent Invitations</h1>
          <p>Monitor invitation delivery, expiry, acceptance and revocation.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {message && <div className="invite-history-message success">✓ {message}</div>}
      {error && <div className="invite-history-message error">! {error}</div>}

      <div className="invite-history-stats">
        <div><span>Total</span><strong>{counts.total}</strong></div>
        <div><span>Email Sent</span><strong>{counts.sent}</strong></div>
        <div><span>Pending</span><strong>{counts.pending}</strong></div>
        <div><span>Accepted</span><strong>{counts.accepted}</strong></div>
        <div><span>Expired</span><strong>{counts.expired}</strong></div>
        <div><span>Revoked</span><strong>{counts.revoked}</strong></div>
      </div>

      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>Invitation History</h2>
            <p>Only Super Administrators can access this information.</p>
          </div>
        </div>

        <div className="invite-history-filters">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search email, role, company..."
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>

        {loading ? (
          <div className="invite-history-empty"><div className="loading-spinner" /><span>Loading invitations...</span></div>
        ) : filtered.length === 0 ? (
          <div className="invite-history-empty">
            <div className="invite-history-icon">✉</div>
            <h3>No invitations found</h3>
            <p>{items.length ? 'Try changing your search or filter.' : 'No invitations have been recorded yet.'}</p>
          </div>
        ) : (
          <div className="invite-table-wrap">
            <table className="invite-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.invitation_id}>
                    <td>
                      <strong>{inv.email}</strong>
                      {inv.company_name && <small>{inv.company_name}{inv.branch_name ? ` • ${inv.branch_name}` : ''}</small>}
                    </td>
                    <td><span className="role-pill">{inv.role_name || label(inv.role_code)}</span></td>
                    <td>{label(inv.role_scope)}</td>
                    <td>
                      <span className={`delivery-pill ${inv.email_sent_at ? 'sent' : 'not-sent'}`}>
                        {inv.email_sent_at ? 'Sent' : 'Not sent'}
                      </span>
                      <small>{inv.email_send_count} attempt{inv.email_send_count === 1 ? '' : 's'}</small>
                    </td>
                    <td><span className={`history-status ${statusClass(inv.status)}`}>{label(inv.status)}</span></td>
                    <td>{dateTime(inv.expires_at)}</td>
                    <td>{dateTime(inv.created_at)}</td>
                    <td>
                      <button className="table-action" type="button" onClick={() => setSelected(inv)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="modal-overlay" onMouseDown={() => setSelected(null)}>
          <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">INVITATION DETAILS</span>
                <h2>{selected.email}</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="invite-detail-grid">
              <div><span>Status</span><strong>{label(selected.status)}</strong></div>
              <div><span>Role</span><strong>{selected.role_name || label(selected.role_code)}</strong></div>
              <div><span>Scope</span><strong>{label(selected.role_scope)}</strong></div>
              <div><span>Email delivery</span><strong>{selected.email_sent_at ? 'Sent' : 'Not sent'}</strong></div>
              <div><span>Send count</span><strong>{selected.email_send_count}</strong></div>
              <div><span>Expires</span><strong>{dateTime(selected.expires_at)}</strong></div>
              <div><span>Created</span><strong>{dateTime(selected.created_at)}</strong></div>
              <div><span>Last updated</span><strong>{dateTime(selected.updated_at)}</strong></div>
              <div><span>Sent at</span><strong>{dateTime(selected.email_sent_at)}</strong></div>
              <div><span>Accepted at</span><strong>{dateTime(selected.accepted_at)}</strong></div>
              <div><span>Company</span><strong>{selected.company_name || 'Platform'}</strong></div>
              <div><span>Branch</span><strong>{selected.branch_name || '—'}</strong></div>
              <div><span>Invited by</span><strong>{selected.invited_by_email || selected.invited_by}</strong></div>
              <div><span>Revoked at</span><strong>{dateTime(selected.revoked_at)}</strong></div>
            </div>

            <div className="modal-actions">
              {selected.status === 'PENDING' && (
                <>
                  <button className="secondary-button" type="button" onClick={() => resend(selected)}>
                    Resend Email
                  </button>
                  <button className="danger-button" type="button" onClick={() => revoke(selected)}>
                    Revoke Invitation
                  </button>
                </>
              )}
              <button className="primary-button" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sent-heading { align-items: center; }
        .invite-history-message { margin-bottom: 18px; padding: 13px 15px; border-radius: 12px; font-size: 13px; font-weight: 600; }
        .invite-history-message.success { background: #edf8f1; color: #176b35; }
        .invite-history-message.error { background: #fff0ee; color: #b83429; }
        .invite-history-stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
        .invite-history-stats > div { padding: 16px; border-radius: 15px; background: #f4f7fb; box-shadow: 4px 4px 12px rgba(0,25,76,.07), -4px -4px 12px rgba(255,255,255,.9); }
        .invite-history-stats span { display:block; color:#7c8799; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
        .invite-history-stats strong { display:block; margin-top:6px; color:#00194c; font-size:22px; }
        .invite-history-filters { display:grid; grid-template-columns: 1fr 190px; gap:10px; margin-bottom:18px; }
        .invite-history-filters input, .invite-history-filters select { min-height:44px; border:1px solid #e0e6ee; border-radius:11px; background:#fff; padding:0 12px; outline:none; color:#26344a; }
        .invite-table-wrap { overflow:auto; }
        .invite-table { width:100%; border-collapse:collapse; min-width:980px; }
        .invite-table th { padding:12px; text-align:left; color:#8a95a6; font-size:10px; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid #e5eaf0; }
        .invite-table td { padding:13px 12px; color:#526078; font-size:12px; border-bottom:1px solid #eef1f5; vertical-align:middle; }
        .invite-table td strong { display:block; color:#26344a; font-size:12px; }
        .invite-table td small { display:block; margin-top:4px; color:#8b96a7; font-size:10px; }
        .role-pill, .history-status, .delivery-pill { display:inline-flex; padding:6px 9px; border-radius:8px; font-size:10px; font-weight:800; white-space:nowrap; }
        .role-pill { background:#eef2f7; color:#44516a; }
        .delivery-pill.sent { background:#edf8f1; color:#23743d; }
        .delivery-pill.not-sent { background:#f1f3f6; color:#707b8b; }
        .history-status.pending { background:#fff5df; color:#9b6800; }
        .history-status.accepted { background:#edf8f1; color:#23743d; }
        .history-status.expired { background:#f0f2f5; color:#6e7785; }
        .history-status.revoked { background:#fff0ee; color:#b83429; }
        .invite-history-empty { min-height:260px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#7c8799; gap:7px; }
        .invite-history-empty h3 { margin:4px 0 0; color:#26344a; }
        .invite-history-empty p { margin:0; font-size:12px; }
        .invite-history-icon { width:58px; height:58px; border-radius:18px; display:flex; align-items:center; justify-content:center; background:#eef2f7; color:#00194c; font-size:25px; }
        .invite-detail-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .invite-detail-grid > div { padding:13px; border:1px solid #e8edf3; border-radius:12px; background:#fff; }
        .invite-detail-grid span { display:block; color:#8a95a6; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; margin-bottom:5px; }
        .invite-detail-grid strong { display:block; color:#26344a; font-size:12px; word-break:break-word; }
        @media(max-width:900px){ .invite-history-stats{grid-template-columns:repeat(3,minmax(0,1fr));} }
        @media(max-width:600px){ .invite-history-stats{grid-template-columns:repeat(2,minmax(0,1fr));} .invite-history-filters{grid-template-columns:1fr;} .invite-detail-grid{grid-template-columns:1fr;} .sent-heading{align-items:flex-start;} }
      `}</style>
    </div>
  );
}
