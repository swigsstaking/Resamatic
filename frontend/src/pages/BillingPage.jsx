import { useState, useEffect } from 'react';
import { adminApi } from '../services/api';
import { Receipt, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillingPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  useEffect(() => {
    loadStats();
  }, [month, year]);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await adminApi.getBilling(month, year);
      setStats(data);
    } catch (err) {
      toast.error('Erreur chargement facturation');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReport() {
    setSending(true);
    try {
      await adminApi.sendBillingReport(month, year);
      toast.success('Rapport envoyé par email');
    } catch (err) {
      toast.error(err.error || 'Erreur envoi rapport');
    } finally {
      setSending(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <Receipt size={24} /> Facturation
          </h1>
          <p className="text-gray-500 mt-1">Suivi des déploiements et facturation mensuelle</p>
        </div>
        <button
          onClick={handleSendReport}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <Send size={16} />
          {sending ? 'Envoi...' : 'Envoyer le rapport'}
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <span className="text-lg font-semibold text-primary min-w-[200px] text-center">
          {monthNames[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stats && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Standard ce mois" value={stats.standardCount} color="blue" />
            <StatCard label="PostHog ce mois" value={stats.posthogCount} color="green" />
            <StatCard label="Total Standard" value={stats.totalStandard} color="gray" />
            <StatCard label="Total PostHog" value={stats.totalPosthog} color="gray" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <StatCard label="Sites actifs" value={stats.activeCount} color="emerald" />
            <StatCard label="Sites supprimés" value={stats.deletedCount} color="red" />
          </div>

          {/* Deployments table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-primary">
                Déploiements — {monthNames[month - 1]} {year}
              </h2>
            </div>
            {stats.deployments.length === 0 ? (
              <p className="px-6 py-8 text-gray-400 text-center">Aucun déploiement ce mois</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-6 py-3 font-medium text-gray-500">Nom</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Domaine</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Type</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                    <th className="px-6 py-3 font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.deployments.map((d) => (
                    <tr key={d._id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium">{d.siteName}</td>
                      <td className="px-6 py-3 text-gray-600">{d.domain}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.type === 'posthog' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {d.type === 'posthog' ? 'PostHog' : 'Standard'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(d.firstPublishedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-3">
                        {d.deletedAt ? (
                          <span className="text-red-500 text-xs font-medium">Supprimé</span>
                        ) : (
                          <span className="text-emerald-600 text-xs font-medium">Actif</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-5 ${colors[color] || colors.gray}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
    </div>
  );
}
