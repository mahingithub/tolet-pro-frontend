import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Building, Users, MessageSquare, 
  BellRing, LogOut, Search, ChevronDown, Menu, X, Home, Flag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell';
import { toast } from 'sonner';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleExit = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const menuItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Overview' },
    { path: '/admin/properties', icon: Building, label: 'Property Moderation' },
    { path: '/admin/users', icon: Users, label: 'User Management' },
    { path: '/admin/reports', icon: Flag, label: 'User Reports' },
    { path: '/admin/support', icon: MessageSquare, label: 'Support & AI' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex relative font-sans text-gray-900 selection:bg-[#ba0036] selection:text-white overflow-hidden">
      
      {/* ── Mobile Sidebar Overlay ── */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 
        flex flex-col transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ba0036] to-[#d11147] flex items-center justify-center shadow-sm">
              <Home size={18} strokeWidth={2.5} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight leading-none">
                TO-LET <span className="text-[#ba0036]">PRO</span>
              </span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1 leading-none">
                Super Admin Center
              </span>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-lg lg:hidden transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/admin');
            return (
              <Link 
                key={item.path} 
                to={item.path}
                onClick={() => setIsSidebarOpen(false)} // close on mobile navigation
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                  isActive 
                    ? 'bg-[#ba0036]/5 text-[#ba0036] border-l-4 border-[#ba0036]' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                }`}
              >
                <item.icon size={18} className={isActive ? 'text-[#ba0036]' : 'text-gray-400'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Exit */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleExit}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 font-bold hover:bg-red-50 hover:text-[#ba0036] rounded-xl transition-all text-sm"
          >
            <LogOut size={18} />
            Exit Admin
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-gray-200 px-4 sm:px-8 flex items-center justify-between z-10 shrink-0">
          
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg lg:hidden transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Search */}
            <div className="relative w-full max-w-md hidden sm:block">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/admin/users?tab=all&search=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                placeholder="Search users by name, phone, or email..." 
                className="w-full bg-gray-50 py-2.5 pl-11 pr-4 rounded-xl border border-transparent focus:border-gray-200 focus:bg-white outline-none font-bold text-sm text-gray-800 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Search icon (mobile only) */}
            <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg sm:hidden transition-colors">
              <Search size={20} />
            </button>

            {/* Notification */}
            <NotificationBell isAuthed={!!user} />
            
            {/* Admin Profile */}
            <div className="relative">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="flex items-center gap-3 bg-white hover:bg-gray-50 p-1.5 pr-3 rounded-xl border border-gray-200 cursor-pointer transition-colors text-left"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-[#ba0036] to-[#d11147] rounded-lg flex items-center justify-center text-white font-black shadow-sm overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Admin" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={16} />
                  )}
                </div>
                <div className="hidden md:block">
                  <p className="text-[13px] font-black text-gray-900 truncate max-w-[120px] leading-tight">
                    {user?.name ?? 'Admin Control'}
                  </p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none mt-0.5">
                    {user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'moderator' ? 'Moderator' : user?.role === 'support_agent' ? 'Support Agent' : 'Head of Ops'}
                  </p>
                </div>
                <ChevronDown size={14} className="text-gray-400 ml-1 hidden sm:block" />
              </button>

              {/* Dropdown */}
              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <div className="p-2">
                      <button
                        onClick={() => { setIsProfileOpen(false); toast('Account Settings coming soon.', { icon: '🛠️' }); }}
                        className="w-full text-left px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                      >
                        Account Settings
                      </button>
                      <button
                        onClick={() => { setIsProfileOpen(false); handleExit(); }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                      >
                        <LogOut size={16} /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Dynamic Page Area (Scrollable) ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#f8fafc]">
          <div className="p-4 sm:p-8 min-h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Global Scrollbar Styling */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AdminLayout;