'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Scale,
  LayoutDashboard,
  Users,
  FolderOpen,
  LogOut,
  Menu,
  X,
  Calendar,
  Building2,
  ChartBar as BarChart3,
  Settings,
  Bell,
  Search,
  FileText,
  MessagesSquare,
} from 'lucide-react';
import { getRoleLabel } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  const mainNav = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Calendar', href: profile.role === 'admin' ? '/dashboard/schedule' : '/dashboard/my-schedule', icon: Calendar },
    { name: 'Cases', href: '/dashboard/cases', icon: FolderOpen },
    { name: 'Documents', href: '/dashboard/documents', icon: FileText },
    { name: 'My Team', href: '/dashboard/my-department', icon: MessagesSquare },
    { name: 'Teams', href: '/dashboard/departments', icon: Building2, adminOnly: true },
    { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, adminOnly: true },
  ];

  const managementNav = [
    { name: 'Users', href: '/dashboard/users', icon: Users, adminOnly: true },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: typeof mainNav[0]) => {
    if (item.adminOnly && profile.role !== 'admin') return null;
    const active = isActive(item.href);
    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        <item.icon className={`w-[18px] h-[18px] ${active ? 'text-blue-600' : 'text-slate-400'}`} />
        <span>{item.name}</span>
      </Link>
    );
  };

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between h-16 px-5">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="text-[15px] font-bold text-slate-900 tracking-tight">LegalCMS</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
            <div>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Account
              </p>
              <div className="space-y-0.5">
                {mainNav.map(renderNavItem)}
              </div>
            </div>

            <div>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Management
              </p>
              <div className="space-y-0.5">
                {managementNav.map(renderNavItem)}
              </div>
            </div>
          </nav>

          <div className="p-3 border-t border-slate-100">
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{profile.full_name}</p>
                <p className="text-[11px] text-slate-400">{getRoleLabel(profile.role)}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-4 lg:px-8 gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center gap-4">
              <div className="relative hidden md:block w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full h-9 pl-9 pr-4 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">{profile.full_name}</p>
                  <p className="text-[11px] text-slate-400">{getRoleLabel(profile.role)}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-semibold">
                  {initials}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
