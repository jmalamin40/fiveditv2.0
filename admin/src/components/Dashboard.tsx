import { useState, useEffect } from 'react';
import CategoriesManager from './CategoriesManager';
import ServicesManager from './ServicesManager';
import ScriptsManager from './ScriptsManager';
import ChatManager from './ChatManager';
import ProfileManager from './ProfileManager';
import { fetchAdminProfile } from '../api';

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
  { id: 'chat', label: 'Support Chat', icon: '💬' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('categories');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [token]);

  const loadProfile = async () => {
    try {
      const profile = await fetchAdminProfile(token);
      setProfilePicture(profile.profile_picture);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

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
            {profilePicture ? (
              <img src={profilePicture} alt={user.name} className="avatar-image" />
            ) : (
              <span>{user.name.charAt(0).toUpperCase()}</span>
            )}
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
        {activeTab === 'chat' && <ChatManager token={token} />}
        {activeTab === 'profile' && <ProfileManager token={token} />}
      </main>
      <style>{`
        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
      `}</style>
    </div>
  );
}


