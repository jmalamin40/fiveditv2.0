import { useState } from 'react';
import CategoriesManager from './CategoriesManager';
import ServicesManager from './ServicesManager';
import ScriptsManager from './ScriptsManager';

interface DashboardProps {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

const tabs = [
  { id: 'categories', label: 'Categories', icon: '📁' },
  { id: 'services', label: 'Services', icon: '⚙️' },
  { id: 'scripts', label: 'CodeCanyon Scripts', icon: '💻' },
];

export default function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-icon">🚀</div>
            <div>
              <h2>FivedIT</h2>
              <p className="brand-subtitle">Admin Portal</p>
            </div>
          </div>
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
        </div>

        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            <span className="logout-icon">🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="content">
        {activeTab === 'categories' && <CategoriesManager token={token} />}
        {activeTab === 'services' && <ServicesManager token={token} />}
        {activeTab === 'scripts' && <ScriptsManager token={token} />}
      </main>
    </div>
  );
}


