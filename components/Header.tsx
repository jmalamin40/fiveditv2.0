'use client'

import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  const navItems = [
    { label: 'About', href: isHomePage ? '#about' : '/#about' },
    { label: 'Services', href: '/services' },
    { label: 'Technologies', href: isHomePage ? '#technologies' : '/#technologies' },
    { label: 'Why Us', href: isHomePage ? '#why-us' : '/#why-us' },
    { label: 'Industries', href: isHomePage ? '#industries' : '/#industries' },
    { label: 'Contact', href: isHomePage ? '#contact' : '/#contact' },
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

          <div className="hidden md:flex items-center space-x-8">
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
            <Link
              href={isHomePage ? '#contact' : '/#contact'}
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
            <Link
              href={isHomePage ? '#contact' : '/#contact'}
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

