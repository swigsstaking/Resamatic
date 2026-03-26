import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import Layout from './components/Layout';
import { identifyUser, trackPageView } from './lib/posthog';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SiteCreatePage = lazy(() => import('./pages/SiteCreatePage'));
const SiteSettingsPage = lazy(() => import('./pages/SiteSettingsPage'));
const PagesListPage = lazy(() => import('./pages/PagesListPage'));
const PageEditorPage = lazy(() => import('./pages/PageEditorPage'));
const MediaLibraryPage = lazy(() => import('./pages/MediaLibraryPage'));
const SeoPage = lazy(() => import('./pages/SeoPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));

function Loader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading, token } = useAuthStore();
  // Still loading OR have a token but user not yet fetched — show loader
  if (loading || (token && !user)) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuthStore();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { token, fetchUser, loading, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (token) fetchUser();
    else useAuthStore.setState({ loading: false });
  }, []);

  // Identify user in PostHog once loaded
  useEffect(() => {
    if (user?.email) identifyUser(user.email);
  }, [user]);

  // Track page views on route change
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  if (loading) return <Loader />;

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Editor is full-screen, outside of Layout */}
        <Route path="/sites/:siteId/pages/:pageId" element={<ProtectedRoute><PageEditorPage /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="sites/new" element={<AdminRoute><SiteCreatePage /></AdminRoute>} />
          <Route path="sites/:siteId/settings" element={<SiteSettingsPage />} />
          <Route path="sites/:siteId/pages" element={<PagesListPage />} />
          <Route path="sites/:siteId/media" element={<MediaLibraryPage />} />
          <Route path="sites/:siteId/seo" element={<SeoPage />} />
          <Route path="users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
