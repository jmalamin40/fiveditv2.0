import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import CategoriesManager from './CategoriesManager';
import ServicesManager from './ServicesManager';
import ScriptsManager from './ScriptsManager';
import ChatManager from './ChatManager';
import HostingManager from './HostingManager';
import SmmPackagesManager from './SmmPackagesManager';
import SmmPackageEditPage from './SmmPackageEditPage';
import CloudflareConfigManager from './CloudflareConfigManager';
import DomainResellerManager from './DomainResellerManager';
import FacebookConfigManager from './FacebookConfigManager';
import ProfileManager from './ProfileManager';
import InvoiceManager from './InvoiceManager';
import { fetchAdminProfile } from '../api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './ToastContainer';

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
  { id: 'hosting', label: 'Hosting', icon: '🖥️' },
  { id: 'smm-packages', label: 'SMM Packages', icon: '📦' },
  { id: 'cloudflare', label: 'Cloudflare DNS', icon: '☁️' },
  { id: 'domain', label: 'Domain sales', icon: '🌐' },
  { id: 'facebook', label: 'Facebook Pixel', icon: '📘' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'chat', label: 'Support Chat', icon: '💬' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

export default function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const toast = useToast();

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
            <NavLink
              key={tab.id}
              to={`/admin/${tab.id}`}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              end={tab.id !== 'hosting' && tab.id !== 'smm-packages'}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </NavLink>
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
        <Routes>
          <Route path="categories" element={<CategoriesManager token={token} />} />
          <Route path="services" element={<ServicesManager token={token} />} />
          <Route path="scripts" element={<ScriptsManager token={token} />} />
          <Route path="hosting/*" element={<HostingManager token={token} toast={toast} />} />
          <Route path="smm-packages" element={<SmmPackagesManager token={token} toast={toast} />} />
          <Route path="smm-packages/edit/:id" element={<SmmPackageEditPage token={token} toast={toast} />} />
          <Route path="cloudflare" element={<CloudflareConfigManager token={token} toast={toast} />} />
          <Route path="domain" element={<DomainResellerManager token={token} toast={toast} />} />
          <Route path="facebook" element={<FacebookConfigManager token={token} toast={toast} />} />
          <Route path="invoices" element={<InvoiceManager token={token} toast={toast} />} />
          <Route path="chat" element={<ChatManager token={token} />} />
          <Route path="profile" element={<ProfileManager token={token} />} />
          <Route path="" element={<Navigate to="categories" replace />} />
          <Route path="*" element={<Navigate to="categories" replace />} />
        </Routes>
      </main>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
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


