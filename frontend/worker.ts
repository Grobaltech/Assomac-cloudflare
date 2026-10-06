interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/email/check' && request.method === 'POST') {
      return checkEmailAddress(request, env);
    }

    if (url.pathname === '/api/invitations/send' && request.method === 'POST') {
      return sendInvitationEmail(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

async function checkEmailAddress(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get('authorization');

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return json({ error: 'Authentication required.' }, 401);
  }

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userResponse.ok) {
    return json({ error: 'Your session is invalid or expired.' }, 401);
  }

  let body: { email?: string };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const email = body.email?.trim().toLowerCase();

  if (!email || email.length > 254) {
    return json({
      valid: false,
      reason: 'Please enter a valid email address.',
    });
  }

  const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!formatOk) {
    return json({
      valid: false,
      reason: 'The email address format is not valid.',
    });
  }

  const at = email.lastIndexOf('@');
  const domain = email.slice(at + 1).replace(/^@+/, '').replace(/\.+$/, '');

  if (!domain || domain.length > 253 || !domain.includes('.')) {
    return json({
      valid: false,
      reason: 'The email domain is not valid.',
    });
  }

  const dnsHeaders = {
    accept: 'application/dns-json',
  };

  try {
    const [mxResponse, aResponse, aaaaResponse] = await Promise.all([
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
        { headers: dnsHeaders }
      ),
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
        { headers: dnsHeaders }
      ),
      fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=AAAA`,
        { headers: dnsHeaders }
      ),
    ]);

    const mx = await mxResponse.json() as { Answer?: unknown[] };
    const a = await aResponse.json() as { Answer?: unknown[] };
    const aaaa = await aaaaResponse.json() as { Answer?: unknown[] };

    const hasMx = Array.isArray(mx.Answer) && mx.Answer.length > 0;
    const hasA = Array.isArray(a.Answer) && a.Answer.length > 0;
    const hasAaaa = Array.isArray(aaaa.Answer) && aaaa.Answer.length > 0;

    if (!hasMx && !hasA && !hasAaaa) {
      return json({
        valid: false,
        reason: 'This email domain does not appear to accept email. Check the address and try again.',
        email,
        domain,
      });
    }

    return json({
      valid: true,
      email,
      domain,
      checks: {
        format: true,
        domain: true,
        mailServer: hasMx,
      },
      message: hasMx
        ? 'Email format and mail server verified.'
        : 'Email domain is reachable, but no MX record was found. The invitation may still be deliverable through the domain fallback.',
    });
  } catch (error) {
    console.error('Email DNS check failed:', error);

    return json({
      valid: false,
      reason: 'We could not verify this email domain right now. Please try again.',
    }, 502);
  }
}

async function sendInvitationEmail(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return json({ error: 'Authentication required.' }, 401);

  const accessToken = authorization.slice(7).trim();
  if (!accessToken) return json({ error: 'Authentication required.' }, 401);

  let body: { invitation_id?: string; invitation_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request.' }, 400);
  }

  const invitationId = body.invitation_id?.trim();
  const invitationToken = body.invitation_token?.trim();
  if (!invitationId || !invitationToken) {
    return json({ error: 'Invitation ID and invitation token are required.' }, 400);
  }

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) return json({ error: 'Your session is invalid or expired.' }, 401);

  const rpcResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/prepare_user_invitation_email`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_invitation_id: invitationId, p_invitation_token: invitationToken }),
  });

  if (!rpcResponse.ok) {
    return json({ error: 'The invitation could not be prepared for email delivery.', details: await rpcResponse.text() }, 400);
  }

  const rows = await rpcResponse.json() as Array<{
    invitation_id: string; email: string; role_name: string | null; role_code: string | null;
    company_name: string | null; branch_name: string | null; expires_at: string;
  }>;
  const invitation = rows[0];
  if (!invitation) return json({ error: 'Invitation details were not found.' }, 404);

  const origin = request.headers.get('origin') || new URL(request.url).origin;
  const invitationUrl = `${origin}/accept-invitation?token=${encodeURIComponent(invitationToken)}`;
  const roleText = invitation.role_name || invitation.role_code || 'ASOMAC user';

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#26344a;">
<div style="max-width:620px;margin:0 auto;padding:36px 18px;"><div style="background:#fff;border-radius:20px;padding:34px;box-shadow:0 10px 30px rgba(0,25,76,.10);">
<div style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#f35a02;margin-bottom:8px;">ASOMAC PLATFORM</div>
<h1 style="margin:0 0 14px;color:#00194c;font-size:28px;">You have been invited</h1>
<p style="font-size:15px;line-height:1.65;">You have been invited to join ASOMAC as <strong>${escapeHtml(roleText)}</strong>.</p>
${invitation.company_name ? `<p><strong>Company:</strong> ${escapeHtml(invitation.company_name)}</p>` : ''}
${invitation.branch_name ? `<p><strong>Branch:</strong> ${escapeHtml(invitation.branch_name)}</p>` : ''}
<p><strong>Invitation expires:</strong> ${escapeHtml(formatExpiry(invitation.expires_at))} (Uganda time)</p>
<div style="margin:28px 0;"><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#f35a02;color:#fff;text-decoration:none;font-weight:700;">Accept Invitation</a></div>
<p style="font-size:12px;line-height:1.6;color:#748096;">This private invitation can only be used for the invited email address. If you were not expecting it, you can ignore this message.</p>
</div></div></body></html>`;

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [invitation.email],
      subject: 'You have been invited to ASOMAC',
      html,
    }),
  });

  if (!resendResponse.ok) {
    return json({ error: 'Invitation email could not be sent.', details: await resendResponse.text() }, 502);
  }

  const markResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/mark_user_invitation_email_sent`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_invitation_id: invitationId }),
  });

  if (!markResponse.ok) {
    return json({ success: true, warning: 'Email was sent, but delivery logging could not be completed.' });
  }

  return json({ success: true });
}
