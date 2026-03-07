'use client'

import { Menu, X, User, LogOut, Package, Server } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === '/';

  useEffect(() => {
    // Check if customer is logged in
    const token = localStorage.getItem('customer_token');
    const userStr = localStorage.getItem('customer_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setIsLoggedIn(true);
        setCustomerName(user.name || user.email);
      } catch {
        setIsLoggedIn(false);
        setCustomerName(null);
      }
    } else {
      setIsLoggedIn(false);
      setCustomerName(null);
    }

    // Listen for storage changes (e.g., logout from another tab)
    const handleStorageChange = () => {
      const newToken = localStorage.getItem('customer_token');
      const newUserStr = localStorage.getItem('customer_user');
      if (newToken && newUserStr) {
        try {
          const user = JSON.parse(newUserStr);
          setIsLoggedIn(true);
          setCustomerName(user.name || user.email);
        } catch {
          setIsLoggedIn(false);
          setCustomerName(null);
        }
      } else {
        setIsLoggedIn(false);
        setCustomerName(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Close customer menu when route changes
  useEffect(() => {
    setIsCustomerMenuOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    setIsLoggedIn(false);
    setCustomerName(null);
    setIsCustomerMenuOpen(false);
    router.push('/');
  };

  const navItems = [
    { label: 'About', href: isHomePage ? '#about' : '/#about' },
    { label: 'Services', href: '/services' },
    { label: 'Hosting', href: '/hosting' },
    { label: 'Domains', href: '/domains' },
    { label: 'Technologies', href: isHomePage ? '#technologies' : '/#technologies' },
    { label: 'Why Us', href: isHomePage ? '#why-us' : '/#why-us' },
    { label: 'Industries', href: isHomePage ? '#industries' : '/#industries' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">F</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              FivedIT
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => {
              const isExternal = item.href.startsWith('#');
              const Component = isExternal ? 'a' : Link;
              const props = isExternal ? { href: item.href } : { href: item.href };
              
              return (
                <Component
                  key={item.href}
                  {...props}
                  className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
                >
                  {item.label}
                </Component>
              );
            })}
            
            {/* Customer Portal Access */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  onClick={() => setIsCustomerMenuOpen(!isCustomerMenuOpen)}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                >
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate">{customerName || 'My Account'}</span>
                </button>
                
                {isCustomerMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsCustomerMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <Link
                        href="/customer"
                        onClick={() => setIsCustomerMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Package className="w-4 h-4" />
                        <span>My Orders</span>
                      </Link>
                      <Link
                        href="/customer"
                        onClick={() => setIsCustomerMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Server className="w-4 h-4" />
                        <span>My Hosting</span>
                      </Link>
                      <div className="border-t my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/customer/login"
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </Link>
            )}
            
            <Link
              href="/contact"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          </div>

          <button
            className="md:hidden text-gray-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden mt-4 py-4 border-t">
            {navItems.map((item) => {
              const isExternal = item.href.startsWith('#');
              const Component = isExternal ? 'a' : Link;
              const props = isExternal ? { href: item.href } : { href: item.href };
              
              return (
                <Component
                  key={item.href}
                  {...props}
                  className="block py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Component>
              );
            })}
            
            {/* Customer Portal Access - Mobile */}
            <div className="border-t my-4 pt-4">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/customer"
                    className="flex items-center gap-2 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    <span>My Account</span>
                  </Link>
                  <Link
                    href="/customer"
                    className="flex items-center gap-2 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Package className="w-4 h-4" />
                    <span>My Orders</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center gap-2 py-2 text-red-600 hover:text-red-700 transition-colors w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <Link
                  href="/customer/login"
                  className="flex items-center gap-2 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-4 h-4" />
                  <span>Login</span>
                </Link>
              )}
            </div>
            
            <Link
              href="/contact"
              className="block mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center"
              onClick={() => setIsMenuOpen(false)}
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

