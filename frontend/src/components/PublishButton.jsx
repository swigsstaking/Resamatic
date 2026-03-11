import { useState, useEffect, useRef } from 'react';
import { Rocket, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { deployApi } from '../services/api';
import useSiteStore from '../stores/siteStore';

export default function PublishButton({ siteId, status, compact = false }) {
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState(status);
  const pollRef = useRef(null);
  const { fetchSites } = useSiteStore();

  useEffect(() => { setPublishStatus(status); }, [status]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handlePublish = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setPublishing(true);
    setPublishStatus('building');

    try {
      await deployApi.publish(siteId);
      toast.success('Build et déploiement en cours...');

      // Poll status
      pollRef.current = setInterval(async () => {
        try {
          const data = await deployApi.status(siteId);
          setPublishStatus(data.status);
          if (data.status === 'published') {
            clearInterval(pollRef.current);
            setPublishing(false);
            toast.success(`Site publié ! ${data.url || ''}`);
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
    } catch {
      setPublishing(false);
      setPublishStatus('error');
      toast.error('Erreur lors du déploiement');
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
    <button
      onClick={handlePublish}
      disabled={publishing}
      className={`flex items-center gap-1.5 ${compact ? 'px-3 py-1.5 text-sm' : 'px-5 py-2.5'} rounded-lg font-medium transition-colors ${colors}`}
    >
      {icon}
      {compact ? (publishing ? '...' : 'Publier') : (publishing ? 'Déploiement...' : publishStatus === 'published' ? 'Republier' : 'Publier')}
    </button>
  );
}
