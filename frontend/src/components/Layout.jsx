import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Settings, FileText, Image, Search, LogOut, Plus, Rocket } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useSiteStore from '../stores/siteStore';
import { useEffect } from 'react';

export default function Layout() {
  const { siteId } = useParams();
  const { user, logout } = useAuthStore();
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
      isActive ? 'bg-accent/10 text-accent' : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary">
            <Rocket className="inline w-5 h-5 mr-2" />
            Resamatic
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink to="/" end className={linkClass}>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/sites/new" className={linkClass}>
            <Plus size={18} /> Nouveau site
          </NavLink>

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
            <span className="text-sm text-gray-600 truncate">{user?.name}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-danger transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
