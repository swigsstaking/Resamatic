import { useState, useEffect, useRef } from 'react';
import { Rocket, Loader, CheckCircle, AlertCircle, X, Copy, Check, Globe, ExternalLink, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { deployApi } from '../services/api';
import useSiteStore from '../stores/siteStore';

const SERVER_IP = '213.221.149.157';

export default function PublishButton({ siteId, status, domain, compact = false }) {
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState(status);
  const [showDnsModal, setShowDnsModal] = useState(false);
  const pollRef = useRef(null);
  const { fetchSites, currentSite } = useSiteStore();

  const siteDomain = domain || currentSite?.domain || '';

  useEffect(() => { setPublishStatus(status); }, [status]);
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleDomainChange = async (newDomain) => {
    try {
      const { updateSite, fetchSites: refetch } = useSiteStore.getState();
      await updateSite(siteId, { domain: newDomain });
      refetch();
      toast.success('Domaine mis à jour');
    } catch { toast.error('Erreur lors de la mise à jour du domaine'); }
  };

  const handlePublishClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!siteDomain) {
      setShowDnsModal(true);
      return;
    }
    setShowDnsModal(true);
  };

  const handleConfirmPublish = async () => {
    setShowDnsModal(false);
    setPublishing(true);
    setPublishStatus('building');

    try {
      await deployApi.publish(siteId);
      toast.success('Build et déploiement en cours...');

      pollRef.current = setInterval(async () => {
        try {
          const data = await deployApi.status(siteId);
          setPublishStatus(data.status);
          if (data.status === 'published') {
            clearInterval(pollRef.current);
            setPublishing(false);
            toast.success(`Site publié sur ${siteDomain}`);
            fetchSites();
          } else if (data.status === 'error') {
            clearInterval(pollRef.current);
            setPublishing(false);
            toast.error(`Erreur: ${data.buildError || 'Inconnue'}`);
            fetchSites();
          }
        } catch {
          clearInterval(pollRef.current);
          setPublishing(false);
        }
      }, 3000);
    } catch (err) {
      setPublishing(false);
      setPublishStatus('error');
      toast.error(err?.error || 'Erreur lors du déploiement');
    }
  };

  const icon = publishing ? <Loader size={compact ? 14 : 16} className="animate-spin" /> :
    publishStatus === 'published' ? <CheckCircle size={compact ? 14 : 16} /> :
    publishStatus === 'error' ? <AlertCircle size={compact ? 14 : 16} /> :
    <Rocket size={compact ? 14 : 16} />;

  const colors = publishing ? 'bg-yellow-100 text-yellow-700' :
    publishStatus === 'published' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
    publishStatus === 'error' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
    'bg-accent/10 text-accent-text hover:bg-accent/20';

  return (
    <>
      <button
        onClick={handlePublishClick}
        disabled={publishing}
        className={`flex items-center gap-1.5 ${compact ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5'} rounded-lg font-medium transition-colors ${colors}`}
      >
        {icon}
        {compact ? (publishing ? '...' : 'Publier') : (publishing ? 'Déploiement...' : publishStatus === 'published' ? 'Republier' : 'Publier')}
      </button>

      {showDnsModal && (
        <DnsModal
          domain={siteDomain}
          serverIp={SERVER_IP}
          isRepublish={publishStatus === 'published'}
          onConfirm={handleConfirmPublish}
          onClose={() => setShowDnsModal(false)}
          onDomainChange={handleDomainChange}
        />
      )}
    </>
  );
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier');
    }
  };

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider block">{label}</span>
        <span className="text-sm font-mono text-gray-800 block truncate">{value}</span>
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 p-1.5 rounded-md transition-all ${copied ? 'bg-green-100 text-green-600' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'}`}
        aria-label={copied ? 'Copié' : `Copier ${label}`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function DnsModal({ domain, serverIp, isRepublish, onConfirm, onClose, onDomainChange }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(domain || '');
  const [saving, setSaving] = useState(false);
  const currentDomain = editValue || domain;

  const handleSaveDomain = async () => {
    const trimmed = editValue.trim().toLowerCase();
    if (!trimmed) { toast.error('Le domaine ne peut pas être vide'); return; }
    if (trimmed === domain) { setEditing(false); return; }
    setSaving(true);
    await onDomainChange(trimmed);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dns-modal-title" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                <Globe size={20} className="text-accent" />
              </div>
              <div>
                <h3 id="dns-modal-title" className="font-semibold text-lg text-gray-900">
                  {isRepublish ? 'Republier le site' : 'Publier le site'}
                </h3>
                {editing ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveDomain()}
                      className="text-sm px-2 py-1 border border-gray-300 rounded-md font-mono outline-none focus:ring-2 focus:ring-accent w-56"
                      placeholder="monsite.fr"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveDomain}
                      disabled={saving}
                      className="text-xs px-2 py-1 bg-accent text-primary rounded-md hover:bg-accent/90"
                    >
                      {saving ? '...' : 'OK'}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setEditValue(domain || ''); }}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-gray-500">{currentDomain || <span className="italic text-gray-400">Aucun domaine</span>}</p>
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Modifier le domaine"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {!currentDomain ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Configurez un domaine pour continuer.</p>
              <button onClick={() => setEditing(true)} className="mt-2 text-sm text-accent hover:underline">Ajouter un domaine</button>
            </div>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Configuration DNS requise
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Ajoutez ces enregistrements DNS chez votre registrar (OVH, Infomaniak, Gandi, etc.) :
                </p>
                <div className="space-y-2">
                  <CopyRow label="Type A — Domaine principal" value={`${currentDomain} → ${serverIp}`} />
                  <CopyRow label="Type A — Sous-domaine www" value={`www.${currentDomain} → ${serverIp}`} />
                  <CopyRow label="Type (pour les formulaires DNS)" value="A" />
                  <CopyRow label="Valeur / Cible" value={serverIp} />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">
                  <strong>Note :</strong> La propagation DNS peut prendre de 5 minutes à 48 heures.
                  Le site sera accessible dès que le DNS pointe vers notre serveur.
                  Un certificat SSL (HTTPS) sera automatiquement configuré.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  Lancer le déploiement
                </h4>
                <p className="text-xs text-gray-500">
                  Le site sera buildé puis déployé sur le serveur. Nginx sera configuré automatiquement.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!currentDomain || editing}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${!currentDomain || editing ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-accent text-primary hover:bg-accent/90'}`}
          >
            <Rocket size={14} />
            {isRepublish ? 'Republier maintenant' : 'Publier maintenant'}
          </button>
        </div>
      </div>
    </div>
  );
}
