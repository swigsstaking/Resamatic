import { useState, useEffect, useCallback } from 'react';
import { X, Upload, Check } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { mediaApi } from '../services/api';

export default function MediaPicker({ siteId, onSelect, onClose }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchMedia = async () => {
    try {
      const { media } = await mediaApi.getBySite(siteId);
      setMedia(media);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchMedia(); }, [siteId]);

  const onDrop = useCallback(async (files) => {
    setUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await mediaApi.upload(siteId, formData);
      } catch { toast.error(`Erreur: ${file.name}`); }
    }
    setUploading(false);
    fetchMedia();
    toast.success('Upload terminé');
  }, [siteId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-primary">Bibliothèque média</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Upload zone */}
        <div {...getRootProps()} className={`m-4 p-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${isDragActive ? 'border-accent bg-accent/5' : 'border-gray-300 hover:border-accent'}`}>
          <input {...getInputProps()} />
          <Upload className="mx-auto w-8 h-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            {uploading ? 'Upload en cours...' : isDragActive ? 'Déposez ici' : 'Glissez des images ou cliquez pour uploader'}
          </p>
        </div>

        {/* Media grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-gray-400">Chargement...</p>
          ) : media.length === 0 ? (
            <p className="text-center text-gray-400">Aucun média</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {media.map(m => (
                <div
                  key={m._id}
                  onClick={() => setSelected(m)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    selected?._id === m._id ? 'border-accent ring-2 ring-accent/30' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img
                    src={`/uploads/${m.variants?.[0]?.storagePath || m.storagePath}`}
                    alt={m.alt || m.filename}
                    className="w-full h-full object-cover"
                  />
                  {selected?._id === m._id && (
                    <div className="absolute top-1 right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          {selected && (
            <div className="flex items-center gap-3">
              <input
                value={selected.alt}
                onChange={e => setSelected({ ...selected, alt: e.target.value })}
                onBlur={() => mediaApi.update(selected._id, { alt: selected.alt })}
                className="px-3 py-1.5 border rounded-lg text-sm"
                placeholder="Texte alternatif (alt)"
              />
              <span className="text-xs text-gray-400">{selected.width}x{selected.height}</span>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Annuler</button>
            <button
              onClick={() => selected && onSelect(selected)}
              disabled={!selected}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg disabled:opacity-50"
            >
              Sélectionner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
