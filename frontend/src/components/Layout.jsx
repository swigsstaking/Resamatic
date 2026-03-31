import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Settings, FileText, Image, Search, LogOut, Plus, Rocket, ArrowLeft, Users } from 'lucide-react';
import useAuthStore, { useIsAdmin } from '../stores/authStore';
import useSiteStore from '../stores/siteStore';
import { useEffect } from 'react';

export default function Layout() {
  const { siteId } = useParams();
  const { user, logout } = useAuthStore();
  const isAdmin = useIsAdmin();
  const { currentSite, fetchSite } = useSiteStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (siteId) fetchSite(siteId);
  }, [siteId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-accent/10 text-accent-text' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex h-screen">
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3 focus:bg-accent focus:text-white focus:rounded-lg focus:m-2">
        Aller au contenu principal
      </a>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary">
            <Rocket className="inline w-5 h-5 mr-2" />
            Resamatic
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Navigation principale">
          {siteId ? (
            <NavLink to="/" end className={linkClass}>
              <ArrowLeft size={18} /> Retourner au dashboard
            </NavLink>
          ) : (
            <>
              <NavLink to="/" end className={linkClass}>
                <LayoutDashboard size={18} /> Dashboard
              </NavLink>
              {isAdmin && (
                <NavLink to="/sites/new" className={linkClass}>
                  <Plus size={18} /> Nouveau site
                </NavLink>
              )}
              {isAdmin && (
                <NavLink to="/users" className={linkClass}>
                  <Users size={18} /> Utilisateurs
                </NavLink>
              )}
            </>
          )}

          {siteId && currentSite && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {currentSite.name}
                </p>
              </div>
              <NavLink to={`/sites/${siteId}/pages`} className={linkClass}>
                <FileText size={18} /> Pages
              </NavLink>
              <NavLink to={`/sites/${siteId}/media`} className={linkClass}>
                <Image size={18} /> Médias
              </NavLink>
              <NavLink to={`/sites/${siteId}/seo`} className={linkClass}>
                <Search size={18} /> SEO
              </NavLink>
              <NavLink to={`/sites/${siteId}/settings`} className={linkClass}>
                <Settings size={18} /> Paramètres
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-600 truncate" title={user?.name}>{user?.name}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${user?.role === 'admin' ? 'bg-accent/10 text-accent-text' : 'bg-gray-100 text-gray-500'}`}>
                {user?.role === 'admin' ? 'Admin' : 'Client'}
              </span>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-danger transition-colors" aria-label="Se déconnecter">
              <LogOut size={18} />
            </button>
          </div>
          <span className="text-xs text-gray-400 mt-1 block">v0.2.5</span>
        </div>
      </aside>

      {/* Main content */}
      <main id="main-content" className="flex-1 overflow-y-auto bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
