import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Upload, Trash2, Image } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { mediaApi } from '../services/api';

export default function MediaLibraryPage() {
  const { siteId } = useParams();
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
    toast.success(`${files.length} fichier(s) uploadé(s)`);
  }, [siteId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: true,
  });

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette image ?')) return;
    await mediaApi.delete(id);
    setMedia(m => m.filter(x => x._id !== id));
    if (selected?._id === id) setSelected(null);
    toast.success('Image supprimée');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-primary mb-6">Bibliothèque média</h1>

      {/* Upload zone */}
      <div {...getRootProps()} className={`p-8 mb-6 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${isDragActive ? 'border-accent bg-accent/5' : 'border-gray-300 hover:border-accent'}`}>
        <input {...getInputProps()} />
        <Upload className="mx-auto w-10 h-10 text-gray-400 mb-3" />
        <p className="text-gray-500">{uploading ? 'Upload en cours...' : 'Glissez des images ou cliquez pour uploader'}</p>
        <p className="text-xs text-gray-400 mt-1">Images converties automatiquement en WebP optimisé</p>
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {loading ? (
            <p className="text-center text-gray-400 py-10">Chargement...</p>
          ) : media.length === 0 ? (
            <div className="text-center py-20">
              <Image className="mx-auto w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun média</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map(m => (
                <div
                  key={m._id}
                  onClick={() => setSelected(m)}
                  className={`relative group aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    selected?._id === m._id ? 'border-accent ring-2 ring-accent/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img
                    src={`/uploads/${m.variants?.[0]?.storagePath || m.storagePath}`}
                    alt={m.alt || m.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(m._id); }}
                    className="absolute top-2 right-2 p-1.5 bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-danger hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 bg-white rounded-xl border p-4 space-y-4 h-fit sticky top-4">
            <img
              src={`/uploads/${selected.variants?.[selected.variants.length - 1]?.storagePath || selected.storagePath}`}
              alt={selected.alt}
              className="w-full rounded-lg"
            />
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fichier</label>
              <p className="text-sm text-gray-500 truncate">{selected.originalName}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Dimensions</label>
              <p className="text-sm text-gray-500">{selected.width} x {selected.height}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Variantes WebP</label>
              <div className="space-y-1">
                {selected.variants?.map(v => (
                  <p key={v.suffix} className="text-xs text-gray-400">{v.width}w - {Math.round(v.size / 1024)}KB</p>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Texte alternatif</label>
              <input
                value={selected.alt || ''}
                onChange={e => setSelected({ ...selected, alt: e.target.value })}
                onBlur={() => mediaApi.update(selected._id, { alt: selected.alt })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Description de l'image"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
