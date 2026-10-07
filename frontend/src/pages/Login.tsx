import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [otp, setOtp] = useState('');
  const [phone, setPhone] = useState('');
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const nav = useNavigate();

  async function sendPhoneVerification(phoneNumber: string) {
    setPhone(phoneNumber);
    const { error: updateError } = await supabase.auth.updateUser({
      phone: phoneNumber,
    });

    if (updateError) {
      throw updateError;
    }

    setNeedsPhoneVerification(true);
    setMessage(`A verification code has been sent to ${phoneNumber}.`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setProcessing(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: pw,
        });

      if (signInError) throw signInError;

      const userId = data.user?.id;
      if (!userId) throw new Error('Sign-in did not return a user account.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, phone_verified_at')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (profile?.phone && !profile.phone_verified_at) {
        await sendPhoneVerification(profile.phone);
        return;
      }

      nav('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in.'
      );
    } finally {
      setProcessing(false);
    }
  }

  async function verifyPhone(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setProcessing(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp.trim(),
        type: 'phone_change',
      });

      if (verifyError) throw verifyError;

      const { error: markError } = await supabase.rpc(
        'mark_my_phone_verified'
      );

      if (markError) throw markError;

      setMessage('Phone number verified successfully.');
      setNeedsPhoneVerification(false);
      nav('/dashboard');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify the phone number.'
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-5">
      <form
        onSubmit={needsPhoneVerification ? verifyPhone : submit}
        className="card w-full max-w-md p-7"
      >
        <h1 className="text-3xl font-bold text-[#00194C]">ASSOMAC</h1>
        <p className="text-gray-500 mt-1 mb-6">
          {needsPhoneVerification
            ? 'Phone verification required'
            : 'Secure management platform'}
        </p>

        {!needsPhoneVerification ? (
          <>
            <label className="block text-sm mb-2">Email</label>
            <input
              className="w-full border rounded-lg p-3 mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
            />

            <label className="block text-sm mb-2">Password</label>
            <input
              className="w-full border rounded-lg p-3 mb-4"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </>
        ) : (
          <>
            <div className="rounded-lg bg-orange-50 border border-orange-100 p-4 mb-4 text-sm text-gray-700">
              <strong className="text-[#00194C]">Verify your phone</strong>
              <p className="mt-1">
                Enter the six-digit code sent to <b>{phone}</b>.
              </p>
            </div>

            <label className="block text-sm mb-2">Verification code</label>
            <input
              className="w-full border rounded-lg p-3 mb-4 tracking-[0.35em] text-center"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />

            <button
              type="button"
              className="w-full rounded-lg border border-gray-300 text-gray-700 p-3 mb-3"
              disabled={processing}
              onClick={async () => {
                setError('');
                setMessage('');
                setProcessing(true);
                try {
                  await sendPhoneVerification(phone);
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Unable to resend the phone verification code.'
                  );
                } finally {
                  setProcessing(false);
                }
              }}
            >
              Resend code
            </button>
          </>
        )}

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        {message && (
          <p className="text-green-700 text-sm mb-4">{message}</p>
        )}

        <button
          className="w-full rounded-lg bg-[#f35a02] text-white p-3 font-semibold disabled:opacity-60"
          disabled={processing}
        >
          {processing
            ? 'Please wait...'
            : needsPhoneVerification
              ? 'Verify Phone & Continue'
              : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
