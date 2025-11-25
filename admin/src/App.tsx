import { useEffect, useState } from 'react';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import { LoginResponse } from './api';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResponse['user'] | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('fivedit_admin_token');
    const storedUser = localStorage.getItem('fivedit_admin_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

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

  if (!token || !user) {
    return <LoginForm onSuccess={handleLoginSuccess} />;
  }

  return <Dashboard token={token} user={user} onLogout={handleLogout} />;
}


