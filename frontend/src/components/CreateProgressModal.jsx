import { CheckCircle, Loader, AlertCircle, X, FolderPlus, ImageIcon, FileText, Star, Sparkles, Phone, Search, Hammer, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

const ICON_MAP = {
  FolderPlus, ImageIcon, FileText, Star, Sparkles, Phone, Search, Hammer, Globe, CheckCircle,
};

function StepRow({ step, index, currentIndex, status }) {
  const state = status === 'error' ? (index <= currentIndex ? 'error' : 'pending')
    : status === 'done' ? 'done'
    : index < currentIndex ? 'done'
    : index === currentIndex ? 'active'
    : 'pending';

  const Icon = ICON_MAP[step.icon] || Globe;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
        state === 'done' ? 'bg-green-100 text-green-600' :
        state === 'active' ? 'bg-accent/15 text-accent-text ring-2 ring-accent/30' :
        state === 'error' ? 'bg-red-100 text-red-500' :
        'bg-gray-100 text-gray-300'
      }`}>
        {state === 'done' ? <CheckCircle size={14} /> :
         state === 'active' ? <Loader size={14} className="animate-spin" /> :
         state === 'error' ? <AlertCircle size={14} /> :
         <Icon size={14} />}
      </div>
      <span className={`text-sm font-medium transition-colors duration-300 ${
        state === 'done' ? 'text-green-700' :
        state === 'active' ? 'text-gray-900' :
        state === 'error' ? 'text-red-600' :
        'text-gray-400'
      }`}>
        {step.label}
      </span>
    </div>
  );
}

export default function CreateProgressModal({ steps, currentIndex, status, error, siteId, onClose }) {
  const isDone = status === 'done';
  const isError = status === 'error';
  const progress = isDone ? 100 : steps.length > 1 ? Math.round((currentIndex / (steps.length - 1)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDone ? 'bg-green-100' : isError ? 'bg-red-100' : 'bg-accent/10'
              }`}>
                {isDone ? <CheckCircle size={20} className="text-green-600" /> :
                 isError ? <AlertCircle size={20} className="text-red-500" /> :
                 <Loader size={20} className="text-accent animate-spin" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {isDone ? 'Site créé avec succès' : isError ? 'Erreur de création' : 'Création en cours'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isDone ? 'Votre site est prêt' : isError ? 'Une erreur est survenue' : steps[currentIndex]?.label || '...'}
                </p>
              </div>
            </div>
            {(isDone || isError) && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Steps — scrollable if many */}
        <div className="px-6 py-4">
          <div className="space-y-0">
            {steps.map((step, i) => (
              <StepRow key={step.key} step={step} index={i} currentIndex={currentIndex} status={status} />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">Progression</span>
            <span className="text-xs font-mono text-gray-500">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isError ? 'bg-red-400' : isDone ? 'bg-green-500' : 'bg-accent'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {isError && error && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 font-mono break-all">{error.substring(0, 200)}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        {(isDone || isError) && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
            {isDone && siteId && (
              <Link
                to={`/sites/${siteId}/pages`}
                className="px-5 py-2 rounded-lg font-medium text-sm bg-accent text-primary hover:bg-accent/90 transition-colors"
              >
                Voir le site
              </Link>
            )}
            {isError && (
              <button onClick={onClose} className="px-5 py-2 rounded-lg font-medium text-sm bg-accent text-primary hover:bg-accent/90 transition-colors">
                Fermer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
