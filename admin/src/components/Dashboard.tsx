import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
import SmtpConfigManager from './SmtpConfigManager';
import SmmWebsiteConfigManager from './SmmWebsiteConfigManager';
import TrafficAnalyticsManager from './TrafficAnalyticsManager';
import ProfileManager from './ProfileManager';
import InvoiceManager from './InvoiceManager';
import CoursesManager from './CoursesManager';
import CourseOrdersManager from './CourseOrdersManager';
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

type NavItem = {
  id: string;
  label: string;
  icon: string;
  end?: boolean;
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    id: 'store',
    title: 'Store & Services',
    items: [
      { id: 'categories', label: 'Categories', icon: '📁' },
      { id: 'services', label: 'Services', icon: '⚙️' },
      { id: 'courses', label: 'Courses', icon: '🎓' },
      { id: 'course-orders', label: 'Course Sales', icon: '💳' },
      { id: 'scripts', label: 'CodeCanyon Scripts', icon: '💻' },
      { id: 'invoices', label: 'Invoices', icon: '🧾' },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Hosting & Automation',
    items: [
      { id: 'hosting', label: 'Hosting', icon: '🖥️', end: false },
      { id: 'smm-packages', label: 'SMM Packages', icon: '📦', end: false },
      { id: 'smm-website-config', label: 'SMM Website Config', icon: '🔧' },
      { id: 'cloudflare', label: 'Cloudflare DNS', icon: '☁️' },
      { id: 'domain', label: 'Domain Sales', icon: '🌐' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations & Messaging',
    items: [
      { id: 'facebook', label: 'Facebook Pixel', icon: '📘' },
      { id: 'smtp', label: 'SMTP / Email', icon: '📧' },
      { id: 'chat', label: 'Support Chat', icon: '💬' },
    ],
  },
  {
    id: 'insights',
    title: 'Insights',
    items: [{ id: 'analytics', label: 'Traffic Analytics', icon: '📊' }],
  },
  {
    id: 'account',
    title: 'Account',
    items: [{ id: 'profile', label: 'Profile', icon: '👤' }],
  },
];

export default function Dashboard({ token, user, onLogout }: DashboardProps) {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const toast = useToast();

  useEffect(() => {
    loadProfile();
  }, [token]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

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
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      <div
        className="sidebar-overlay"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
          {navSections.map((section) => (
            <div key={section.id} className="nav-section">
              <div className="nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/admin/${item.id}`}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  end={item.end !== false}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
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
          <Route path="courses" element={<CoursesManager token={token} />} />
          <Route path="course-orders" element={<CourseOrdersManager token={token} toast={toast} />} />
          <Route path="scripts" element={<ScriptsManager token={token} />} />
          <Route path="hosting/*" element={<HostingManager token={token} toast={toast} />} />
          <Route path="smm-packages" element={<SmmPackagesManager token={token} toast={toast} />} />
          <Route path="smm-packages/edit/:id" element={<SmmPackageEditPage token={token} toast={toast} />} />
          <Route path="smm-website-config" element={<SmmWebsiteConfigManager token={token} toast={toast} />} />
          <Route path="cloudflare" element={<CloudflareConfigManager token={token} toast={toast} />} />
          <Route path="domain" element={<DomainResellerManager token={token} toast={toast} />} />
          <Route path="facebook" element={<FacebookConfigManager token={token} toast={toast} />} />
          <Route path="smtp" element={<SmtpConfigManager token={token} toast={toast} />} />
          <Route path="analytics" element={<TrafficAnalyticsManager token={token} toast={toast} />} />
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


