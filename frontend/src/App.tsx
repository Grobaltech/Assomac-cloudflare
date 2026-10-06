import { useEffect, useState, type ReactNode } from 'react';
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

function Protected({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;

      if (!data.session) {
        navigate('/login');
      } else {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="app-loading">
        <div className="loading-brand">
          <div className="loading-brand-mark">
            A
          </div>

          <strong>ASOMAC</strong>

          <span>Loading platform...</span>
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

function Registration() {
  return (
    <div className="simple-page">
      <div className="simple-page-card">
        <div className="brand-mark large">
          A
        </div>

        <h1>Registration</h1>

        <p>
          Registration will be connected to the
          controlled onboarding workflow next.
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

function PlaceholderPage({
  title,
}: {
  title: string;
}) {
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            ASOMAC PLATFORM
          </div>

          <h1>{title}</h1>

          <p>
            This workspace is being prepared for
            the ASOMAC platform.
          </p>
        </div>
      </div>

      <div className="content-card placeholder-card">
        <div className="placeholder-icon">
          ◈
        </div>

        <h2>{title}</h2>

        <p>
          The foundation is ready. This module
          will be connected to the secure
          Supabase architecture next.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Registration />}
      />

      <Route
        path="/company/:slug"
        element={<CompanyPage />}
      />

      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />

      <Route
        path="/users"
        element={
          <Protected>
            <Users />
          </Protected>
        }
      />

      <Route
        path="/companies"
        element={
          <Protected>
            <Companies />
          </Protected>
        }
      />

      <Route
        path="/transfers"
        element={
          <Protected>
            <Transfers />
          </Protected>
        }
      />

      <Route
        path="/historical"
        element={
          <Protected>
            <HistoricalEntry />
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

      <Route
        path="/profile"
        element={
          <Protected>
            <PlaceholderPage title="My Profile" />
          </Protected>
        }
      />

      <Route
        path="/settings"
        element={
          <Protected>
            <PlaceholderPage title="Account Settings" />
          </Protected>
        }
      />

      <Route
        path="/security"
        element={
          <Protected>
            <PlaceholderPage title="Security" />
          </Protected>
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}
