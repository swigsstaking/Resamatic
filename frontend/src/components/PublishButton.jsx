import { useState, useEffect, useRef } from 'react';
import { Rocket, Loader, CheckCircle, AlertCircle, X, Copy, Check, Globe, ExternalLink } from 'lucide-react';
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

  const handlePublishClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!siteDomain) {
      toast.error('Configurez un domaine dans les paramètres du site avant de publier');
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
    'bg-accent/10 text-accent hover:bg-accent/20';

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
        title="Copier"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function DnsModal({ domain, serverIp, isRepublish, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
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
                <h3 className="font-semibold text-lg text-gray-900">
                  {isRepublish ? 'Republier le site' : 'Publier le site'}
                </h3>
                <p className="text-sm text-gray-500">{domain}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-5 h-5 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Configuration DNS requise
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Ajoutez ces enregistrements DNS chez votre registrar (OVH, Infomaniak, Gandi, etc.) :
            </p>
            <div className="space-y-2">
              <CopyRow label="Type A — Domaine principal" value={`${domain} → ${serverIp}`} />
              <CopyRow label="Type A — Sous-domaine www" value={`www.${domain} → ${serverIp}`} />
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
            className="px-5 py-2 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors flex items-center gap-2"
          >
            <Rocket size={14} />
            {isRepublish ? 'Republier maintenant' : 'Publier maintenant'}
          </button>
        </div>
      </div>
    </div>
  );
}
