import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from 'react-router-dom';

import { supabase } from './lib/supabase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Transfers from './pages/Transfers';
import HistoricalEntry from './pages/HistoricalEntry';
import LandingPage from './pages/LandingPage';
import Admin from './pages/Admin';
import CompanyPage from './pages/CompanyPage';
import Users from './pages/Users';

import AppShell from './components/layout/AppShell';

/* =========================================================
   PROTECTED ROUTE
   ========================================================= */

function Protected({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] =
    useState(false);

  const navigate =
    useNavigate();

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        navigate(
          '/login',
          { replace: true }
        );

        return;
      }

      setReady(true);
    }

    checkSession();

    /*
     * Keep the application synchronized with
     * Supabase authentication changes.
     *
     * This means that if the user signs out
     * from another part of the application,
     * protected pages will not remain active.
     */
    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active) return;

          if (
            event === 'SIGNED_OUT' ||
            !session
          ) {
            setReady(false);

            navigate(
              '/login',
              { replace: true }
            );
          } else {
            setReady(true);
          }
        }
      );

    return () => {
      active = false;

      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="app-loading">
        <div className="loading-brand">

          <div className="loading-brand-mark">
            A
          </div>

          <strong>
            ASOMAC
          </strong>

          <span>
            Loading platform...
          </span>

        </div>
      </div>
    );
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}

/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

function ForgotPassword() {
  const [email, setEmail] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  async function submit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setMessage('');
    setError('');

    if (!email.trim()) {
      setError(
        'Please enter your email address.'
      );

      return;
    }

    setLoading(true);

    const {
      error: resetError,
    } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            `${window.location.origin}/security`,
        }
      );

    if (resetError) {
      setError(
        resetError.message
      );
    } else {
      setMessage(
        'If an account exists for this email, a password reset link has been sent.'
      );
    }

    setLoading(false);
  }

  return (
    <div className="simple-page">

      <div className="simple-page-card">

        <div className="brand-mark large">
          A
        </div>

        <div className="eyebrow">
          ASOMAC ACCOUNT
        </div>

        <h1>
          Forgot Password
        </h1>

        <p>
          Enter your email address and
          we will send you instructions
          to reset your password.
        </p>

        {message && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background:
                '#edf8f0',
              color: '#23743d',
              fontSize: '13px',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background:
                '#fff0ee',
              color: '#b83429',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={submit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="Email address"
            autoComplete="email"
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: '46px',
              padding:
                '0 14px',
              border:
                '1px solid #e0e6ee',
              borderRadius:
                '12px',
              outline: 'none',
              fontSize: '14px',
            }}
          />

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? 'Sending...'
              : 'Send Reset Link'}
          </button>

        </form>

        <div
          style={{
            marginTop: '18px',
            textAlign: 'center',
          }}
        >
          <Link
            to="/login"
            style={{
              color: '#00194C',
              fontWeight: 700,
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            ← Back to Login
          </Link>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   PUBLIC REGISTRATION
   ========================================================= */

function Registration() {
  return (
    <div className="simple-page">

      <div className="simple-page-card">

        <div className="brand-mark large">
          A
        </div>

        <div className="eyebrow">
          ASOMAC PLATFORM
        </div>

        <h1>
          Registration
        </h1>

        <p>
          ASOMAC registration is controlled
          through the official onboarding
          workflow. Role selection is not
          available during public registration.
        </p>

        <Link
          className="primary-button"
          to="/login"
        >
          Go to Login
        </Link>

      </div>
    </div>
  );
}

/* =========================================================
   PLACEHOLDER MODULE
   ========================================================= */

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="page-container">

      <div className="page-heading">

        <div>

          <div className="eyebrow">
            ASOMAC PLATFORM
          </div>

          <h1>
            {title}
          </h1>

          <p>
            {description ||
              'This workspace is being prepared for the ASOMAC platform.'}
          </p>

        </div>

      </div>

      <div className="content-card placeholder-card">

        <div className="placeholder-icon">
          ◈
        </div>

        <h2>
          {title}
        </h2>

        <p>
          The foundation is ready.
          This module will be connected
          to the secure Supabase architecture
          as we continue building ASOMAC.
        </p>

      </div>

    </div>
  );
}

/* =========================================================
   APPLICATION
   ========================================================= */

export default function App() {
  return (
    <Routes>

      {/* =================================================
          PUBLIC
      ================================================= */}

      <Route
        path="/"
        element={
          <LandingPage />
        }
      />

      <Route
        path="/login"
        element={
          <Login />
        }
      />

      <Route
        path="/register"
        element={
          <Registration />
        }
      />

      <Route
        path="/forgot-password"
        element={
          <ForgotPassword />
        }
      />

      {/* =================================================
          PUBLIC COMPANY PAGES

          Company public information does not require
          authentication.
      ================================================= */}

      <Route
        path="/company/:slug"
        element={
          <CompanyPage />
        }
      />

      {/* =================================================
          CORE PLATFORM
      ================================================= */}

      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />

      {/* =================================================
          ADMINISTRATION
      ================================================= */}

      <Route
        path="/users"
        element={
          <Protected>
            <Users />
          </Protected>
        }
      />

      <Route
        path="/admin"
        element={
          <Protected>
            <Admin />
          </Protected>
        }
      />

      {/* =================================================
          COMPANY REGISTRY
      ================================================= */}

      <Route
        path="/companies"
        element={
          <Protected>
            <Companies />
          </Protected>
        }
      />

      {/* =================================================
          BRANCHES

          Placeholder for the company/branch architecture.
          Actual visibility will later be controlled by
          permissions and company authorization.
      ================================================= */}

      <Route
        path="/branches"
        element={
          <Protected>
            <PlaceholderPage
              title="Branches"
              description="Branch information will be available according to company authorization and user permissions."
            />
          </Protected>
        }
      />

      {/* =================================================
          OPERATIVES
      ================================================= */}

      <Route
        path="/operatives"
        element={
          <Protected>
            <PlaceholderPage
              title="Field Operatives"
              description="Field operative management will be connected to company and branch permissions."
            />
          </Protected>
        }
      />

      {/* =================================================
          INVENTORY
      ================================================= */}

      <Route
        path="/inventory"
        element={
          <Protected>
            <PlaceholderPage
              title="Inventory"
              description="Stock and inventory management will operate at branch level."
            />
          </Protected>
        }
      />

      {/* =================================================
          TRANSFERS
      ================================================= */}

      <Route
        path="/transfers"
        element={
          <Protected>
            <Transfers />
          </Protected>
        }
      />

      {/* =================================================
          REPORTS
      ================================================= */}

      <Route
        path="/reports"
        element={
          <Protected>
            <PlaceholderPage
              title="Reports"
              description="Reports will be displayed according to the authenticated user's permissions and organizational scope."
            />
          </Protected>
        }
      />

      {/* =================================================
          HISTORICAL DATA
      ================================================= */}

      <Route
        path="/historical"
        element={
          <Protected>
            <HistoricalEntry />
          </Protected>
        }
      />

      <Route
        path="/history"
        element={
          <Protected>
            <HistoricalEntry />
          </Protected>
        }
      />

      {/* =================================================
          PROFILE
      ================================================= */}

      <Route
        path="/profile"
        element={
          <Protected>
            <PlaceholderPage
              title="My Profile"
              description="Manage your common name and profile picture."
            />
          </Protected>
        }
      />

      {/* =================================================
          ACCOUNT SETTINGS
      ================================================= */}

      <Route
        path="/settings"
        element={
          <Protected>
            <PlaceholderPage
              title="Account Settings"
              description="Manage your account preferences and application settings."
            />
          </Protected>
        }
      />

      {/* =================================================
          SECURITY
      ================================================= */}

      <Route
        path="/security"
        element={
          <Protected>
            <PlaceholderPage
              title="Security"
              description="Manage password, authentication and account security."
            />
          </Protected>
        }
      />

      {/* =================================================
          UNKNOWN ROUTES
      ================================================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}
