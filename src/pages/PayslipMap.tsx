import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Loader2, Upload, Trash2, Pencil, X, ArrowLeft, AlertCircle, Image,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  getPayslipZones,
  getPayslipSettings,
  createPayslipZone,
  updatePayslipZone,
  deletePayslipZone,
  uploadPayslipImage,
  getData,
} from '@/config/apiConfig';

interface Zone {
  id: string;
  document_id: string;
  document_title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Doc {
  id: string;
  title: string;
}

export function PayslipMap() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data state
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drawing state
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<DrawRect | null>(null);
  const [pendingRect, setPendingRect] = useState<DrawRect | null>(null);

  // Zone dialog state
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    const fetchData = async () => {
      try {
        const [settingsData, zonesData, documentsData] = await Promise.all([
          getPayslipSettings(),
          getPayslipZones(),
          getData(),
        ]);
        if (settingsData?.model_image_path) setModelImage(settingsData.model_image_path);
        if (zonesData?.zones) setZones(zonesData.zones);
        if (documentsData?.items) setDocuments(documentsData.items);
      } catch {
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, isAdmin]);

  // ---- Drawing helpers ----

  const getPercentCoords = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!modelImage) return;
    if ((e.target as HTMLElement).closest('[data-zone]')) return;
    e.preventDefault();
    const coords = getPercentCoords(e);
    setDrawStart(coords);
    setCurrentRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawStart) return;
    e.preventDefault();
    const coords = getPercentCoords(e);
    setCurrentRect({
      x: Math.min(drawStart.x, coords.x),
      y: Math.min(drawStart.y, coords.y),
      w: Math.abs(coords.x - drawStart.x),
      h: Math.abs(coords.y - drawStart.y),
    });
  };

  const handlePointerUp = () => {
    if (currentRect && currentRect.w > 2 && currentRect.h > 2) {
      setPendingRect(currentRect);
      setSelectedDocId(documents[0]?.id || '');
      setEditingZone(null);
      setShowZoneDialog(true);
    }
    setDrawStart(null);
    setCurrentRect(null);
  };

  // ---- Image upload ----

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const data = await uploadPayslipImage(file);
      setModelImage(data.model_image_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- Zone CRUD ----

  const handleSaveZone = async () => {
    if (!selectedDocId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingZone) {
        const updated = await updatePayslipZone(editingZone.id, { document_id: selectedDocId });
        setZones(prev => prev.map(z => z.id === editingZone.id ? { ...z, ...updated } : z));
      } else if (pendingRect) {
        const created = await createPayslipZone({
          document_id: selectedDocId,
          x: pendingRect.x,
          y: pendingRect.y,
          width: pendingRect.w,
          height: pendingRect.h,
        });
        setZones(prev => [...prev, created]);
      }
      setPendingRect(null);
      setEditingZone(null);
      setShowZoneDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!deletingZoneId) return;
    setSaving(true);
    try {
      await deletePayslipZone(deletingZoneId);
      setZones(prev => prev.filter(z => z.id !== deletingZoneId));
      setDeletingZoneId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const startEditZone = (zone: Zone) => {
    setEditingZone(zone);
    setSelectedDocId(zone.document_id);
    setPendingRect(null);
    setShowZoneDialog(true);
  };

  const closeZoneDialog = () => {
    setShowZoneDialog(false);
    setPendingRect(null);
    setEditingZone(null);
  };

  // ---- Guards ----

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img
                  src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png"
                  alt="ClearDoc"
                  className="h-6 w-6 object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Fiche de paie interactive
                </h1>
                <p className="text-xs text-muted-foreground">Administration des zones</p>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-8 max-w-7xl mx-auto">
        {/* Error display */}
        {error && (
          <div className="mb-6 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Upload button */}
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            {modelImage ? "Changer l'image" : 'Uploader une image de fiche de paie'}
          </Button>
          {modelImage && (
            <p className="text-sm text-muted-foreground">
              Cliquez et glissez sur l'image pour dessiner une zone cliquable
            </p>
          )}
        </div>

        {/* No image state */}
        {!modelImage ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-2 border-dashed border-slate-300 dark:border-slate-700">
            <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="text-xl font-semibold mb-2 dark:text-gray-100">
              Aucune image configurée
            </h3>
            <p className="text-muted-foreground mb-6">
              Uploadez une image de fiche de paie pour commencer à définir des zones cliquables
            </p>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Choisir une image
            </Button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Image drawing area */}
            <div className="flex-1 min-w-0">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden">
                <div
                  ref={containerRef}
                  className="relative"
                  style={{ cursor: 'crosshair', userSelect: 'none' }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <img
                    src={modelImage}
                    alt="Fiche de paie"
                    className="w-full h-auto block pointer-events-none"
                    draggable={false}
                  />

                  {/* Existing zones */}
                  {zones.map(zone => (
                    <div
                      key={zone.id}
                      data-zone="true"
                      style={{
                        position: 'absolute',
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                      }}
                      className="border-2 border-blue-500 bg-blue-500/20 group hover:bg-blue-500/30 transition-colors"
                    >
                      <div className="absolute top-0 left-0 right-0 bg-blue-500/80 text-white text-xs px-1 py-0.5 truncate leading-tight pointer-events-none">
                        {zone.document_title}
                      </div>
                      <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                        <button
                          data-zone="true"
                          className="bg-white/90 dark:bg-slate-800/90 rounded p-0.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                          onClick={e => { e.stopPropagation(); startEditZone(zone); }}
                          title="Modifier"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          data-zone="true"
                          className="bg-white/90 dark:bg-slate-800/90 rounded p-0.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500"
                          onClick={e => { e.stopPropagation(); setDeletingZoneId(zone.id); }}
                          title="Supprimer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Currently drawing rectangle */}
                  {currentRect && currentRect.w > 0 && currentRect.h > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${currentRect.x}%`,
                        top: `${currentRect.y}%`,
                        width: `${currentRect.w}%`,
                        height: `${currentRect.h}%`,
                        pointerEvents: 'none',
                      }}
                      className="border-2 border-dashed border-blue-500 bg-blue-500/10"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Zones list */}
            <div className="w-full lg:w-72 shrink-0">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Zones ({zones.length})
                </h2>
                {zones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune zone. Dessinez un rectangle sur l'image pour en créer une.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {zones.map(zone => (
                      <li
                        key={zone.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800"
                      >
                        <span className="text-sm truncate flex-1 dark:text-gray-200">
                          {zone.document_title}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => startEditZone(zone)}
                            title="Modifier"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setDeletingZoneId(zone.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Zone form dialog */}
      <Dialog open={showZoneDialog} onOpenChange={open => { if (!open) closeZoneDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingZone ? 'Modifier la zone' : 'Nouvelle zone cliquable'}
            </DialogTitle>
            <DialogDescription>
              {editingZone
                ? "Modifiez l'entrée ClearDoc liée à cette zone."
                : "Sélectionnez l'entrée ClearDoc à associer à cette zone."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez une entrée" />
              </SelectTrigger>
              <SelectContent>
                {documents.map(doc => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeZoneDialog} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSaveZone} disabled={saving || !selectedDocId}>
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : editingZone ? 'Mettre à jour' : 'Créer la zone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deletingZoneId} onOpenChange={open => { if (!open) setDeletingZoneId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la zone</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette zone ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingZoneId(null)} disabled={saving}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteZone} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
