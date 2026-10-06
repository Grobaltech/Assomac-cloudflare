import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Invitation = {
  invitation_id: string;
  email: string;
  role_id: string;
  role_code: string;
  role_name: string;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  expires_at: string;
};

export default function AcceptInvitation() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [password, setPassword] = useState('');

  async function validate() {
    setLoading(true);
    setError('');
    setMessage('');

    if (!token) {
      setError('This invitation link is missing its security token.');
      setLoading(false);
      return;
    }

    const { data, error: validationError } = await supabase.rpc(
      'validate_user_invitation',
      { p_token: token }
    );

    if (validationError) {
      setError(validationError.message || 'This invitation is invalid or expired.');
      setLoading(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      setError('This invitation is no longer available.');
      setLoading(false);
      return;
    }

    setInvitation(result as Invitation);

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session) {
      await acceptInvitation();
    }

    setLoading(false);
  }

  async function acceptInvitation() {
    if (!token) return;

    setProcessing(true);
    setError('');
    setMessage('');

    const { error: acceptError } = await supabase.rpc(
      'accept_user_invitation',
      { p_token: token }
    );

    if (acceptError) {
      setError(acceptError.message || 'Unable to accept this invitation.');
      setProcessing(false);
      return;
    }

    setMessage(
      'Your invitation has been accepted successfully. Your account is now connected to the assigned ASOMAC role.'
    );
    setProcessing(false);
  }

  useEffect(() => {
    validate();
    // Token identifies this one invitation page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invitation) return;

    setProcessing(true);
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.');
      setProcessing(false);
      return;
    }

    if (mode === 'signup') {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
        options: {
          data: {
            full_name: '',
            invitation_id: invitation.invitation_id,
          },
          emailRedirectTo: window.location.origin + '/accept-invitation?token=' + encodeURIComponent(token),
        },
      });

      if (signupError) {
        setError(signupError.message);
        setProcessing(false);
        return;
      }

      if (data.session) {
        await acceptInvitation();
        return;
      }

      setMessage(
        'Your account has been created. Check your email and complete email verification, then return to this invitation link and sign in to finish activation.'
      );
      setProcessing(false);
      return;
    }

    const { data, error: signinError } = await supabase.auth.signInWithPassword({
      email: invitation.email,
      password,
    });

    if (signinError) {
      setError(signinError.message);
      setProcessing(false);
      return;
    }

    if (!data.session) {
      setError('Sign-in did not create an active session.');
      setProcessing(false);
      return;
    }

    await acceptInvitation();
  }

  if (loading) {
    return (
      <div className="simple-page">
        <div className="simple-page-card">
          <div className="brand-mark large">A</div>
          <div className="eyebrow">ASOMAC INVITATION</div>
          <h1>Checking invitation...</h1>
          <p>Please wait while we securely validate your invitation token.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-page">
      <div className="simple-page-card" style={{ maxWidth: 560 }}>
        <div className="brand-mark large">A</div>
        <div className="eyebrow">ASOMAC INVITATION</div>

        <h1>{message && !error ? 'Invitation Accepted' : 'Accept Invitation'}</h1>

        {error ? (
          <div style={{ marginBottom: 18, padding: 13, borderRadius: 12, background: '#fff0ee', color: '#b83429', fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        {message ? (
          <div style={{ marginBottom: 18, padding: 13, borderRadius: 12, background: '#edf8f0', color: '#23743d', fontSize: 13 }}>
            {message}
          </div>
        ) : null}

        {invitation && !message && (
          <>
            <div style={{ padding: 16, marginBottom: 18, borderRadius: 15, background: '#f1f4f8' }}>
              <strong style={{ color: '#00194C' }}>You have been invited to ASOMAC</strong>
              <div style={{ marginTop: 10, display: 'grid', gap: 7, fontSize: 13, color: '#536177' }}>
                <div><b>Email:</b> {invitation.email}</div>
                <div><b>Role:</b> {invitation.role_name}</div>
                {invitation.company_name && <div><b>Company:</b> {invitation.company_name}</div>}
                {invitation.branch_name && <div><b>Branch:</b> {invitation.branch_name}</div>}
                <div><b>Expires:</b> {new Date(invitation.expires_at).toLocaleString()}</div>
              </div>
            </div>

            <form onSubmit={submitAuth} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <button type="button" className={mode === 'signup' ? 'primary-button' : 'secondary-button'} onClick={() => setMode('signup')}>
                  Create Account
                </button>
                <button type="button" className={mode === 'signin' ? 'primary-button' : 'secondary-button'} onClick={() => setMode('signin')}>
                  I Already Have an Account
                </button>
              </div>

              <input
                type="email"
                value={invitation.email}
                readOnly
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '0 14px', border: '1px solid #e0e6ee', borderRadius: 12, background: '#edf1f5' }}
              />

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? 'Create password (minimum 8 characters)' : 'Password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                required
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '0 14px', border: '1px solid #e0e6ee', borderRadius: 12, background: '#fff' }}
              />

              <button type="submit" className="primary-button" disabled={processing}>
                {processing
                  ? 'Processing...'
                  : mode === 'signup'
                    ? 'Create Account & Continue'
                    : 'Sign In & Accept Invitation'}
              </button>
            </form>
          </>
        )}

        {message && (
          <Link className="primary-button" to="/login" style={{ marginTop: 8 }}>
            Go to Login
          </Link>
        )}

        <div style={{ marginTop: 18, textAlign: 'center' }}>
          <Link to="/" style={{ color: '#00194C', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            ← Back to ASOMAC
          </Link>
        </div>
      </div>
    </div>
  );
}
