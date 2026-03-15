import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { LoginResponse } from './api';

function readStoredAuth(): { token: string | null; user: LoginResponse['user'] | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  const storedToken = localStorage.getItem('fivedit_admin_token');
  const storedUser = localStorage.getItem('fivedit_admin_user');
  if (!storedToken || !storedUser) return { token: null, user: null };
  try {
    return { token: storedToken, user: JSON.parse(storedUser) as LoginResponse['user'] };
  } catch {
    return { token: null, user: null };
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => readStoredAuth().token);
  const [user, setUser] = useState<LoginResponse['user'] | null>(() => readStoredAuth().user);

  const handleLoginSuccess = (data: LoginResponse) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('fivedit_admin_token', data.token);
    localStorage.setItem('fivedit_admin_user', JSON.stringify(data.user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fivedit_admin_token');
    localStorage.removeItem('fivedit_admin_user');
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token && user ? (
            <Navigate to="/admin/categories" replace />
          ) : (
            <LoginForm onSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          token && user ? (
            <Dashboard token={token} user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/"
        element={
          token && user ? (
            <Navigate to="/admin/categories" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}


