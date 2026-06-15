import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Video, Settings, Sparkles, Download, Trash2, Loader2,
  AlertCircle, CheckCircle2, XCircle, Save, PackagePlus, PackageMinus, X, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import {
  API_CONFIG, getData, getAdminSettings, saveAdminSettings,
  getRemotionStatus, uninstallRemotion, getGeneratedVideos, deleteVideo,
  publishVideo, discardVideo, streamSSE,
  type RemotionStatus, type GeneratedVideo,
} from '@/config/apiConfig';
import { PayslipItem } from '@/types/payslip';
import { VIDEO_THEMES, DEFAULT_THEME, ACCENT_PRESETS, type VideoTheme } from '@/lib/videoThemes';

const SETTINGS_FIELDS: { key: string; label: string; placeholder: string; isKey: boolean }[] = [
  { key: 'AI_API_KEY', label: 'Clé API IA', placeholder: 'sk-...', isKey: true },
  { key: 'AI_API_BASE_URL', label: 'URL API IA', placeholder: 'https://api.deepseek.com/v1', isKey: false },
  { key: 'AI_MODEL', label: 'Modèle IA', placeholder: 'deepseek-chat', isKey: false },
  { key: 'ELEVENLABS_API_KEY', label: 'Clé API ElevenLabs', placeholder: 'xi-...', isKey: true },
  { key: 'ELEVENLABS_VOICE_ID', label: 'ID Voix ElevenLabs', placeholder: 'O31r762Gb3WFygrEOGh0', isKey: false },
];

function ThemeCard({ theme, accent, selected, onClick }: {
  theme: VideoTheme; accent: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg overflow-hidden border-2 transition-all text-left ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="h-16 p-2 flex flex-col justify-end" style={{ background: theme.bgGradient || theme.bg }}>
        <div
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full w-fit mb-1"
          style={{ background: theme.badgeBg(accent), color: theme.badgeText(accent) }}
        >
          Section
        </div>
        <div className="text-[9px] font-bold" style={{ color: theme.textPrimary }}>Titre exemple</div>
        <div className="h-0.5 w-1/3 rounded mt-1" style={{ background: accent }} />
      </div>
      <div className="px-2 py-1.5 bg-card">
        <p className="text-[11px] font-medium">{theme.emoji} {theme.name}</p>
      </div>
    </button>
  );
}

function ThemePreview({ theme, accent }: { theme: VideoTheme; accent: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="text-xs text-muted-foreground px-3 py-1.5 border-b border-border bg-muted">
        Aperçu — thème {theme.name}
      </div>
      <div className="p-6 flex flex-col items-start" style={{ background: theme.bgGradient || theme.bg, minHeight: 140 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-6 rounded" style={{ background: accent }} />
          <span
            className="text-xs font-bold px-3 py-1 rounded-full border"
            style={{ background: theme.badgeBg(accent), color: theme.badgeText(accent), borderColor: `${accent}40` }}
          >
            TITRE DE LA SECTION
          </span>
        </div>
        <div className="w-full rounded-xl p-4 border" style={{ background: theme.surface, borderColor: theme.surfaceBorder }}>
          <p className="text-sm font-bold mb-1" style={{ color: theme.textPrimary }}>
            Explication du terme de fiche de paie
          </p>
          <p className="text-xs" style={{ color: theme.textSecondary }}>
            Le texte explicatif apparaît ici, généré automatiquement par l'IA à partir de la description.
          </p>
        </div>
        <div className="w-full h-0.5 bg-black/10 rounded mt-4">
          <div className="h-full w-1/3 rounded" style={{ background: accent }} />
        </div>
      </div>
    </div>
  );
}

export function VideoGenerator() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Section paramètres ---
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [fromEnv, setFromEnv] = useState<Record<string, boolean>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // --- Section Remotion ---
  const [remotion, setRemotion] = useState<RemotionStatus>({ installed: false, version: null });
  const [installing, setInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // --- Section apparence ---
  const [selectedTheme, setSelectedTheme] = useState<string>(DEFAULT_THEME.id);
  const [accentColor, setAccentColor] = useState<string>(DEFAULT_THEME.defaultAccent);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  // --- Section génération ---
  const [documents, setDocuments] = useState<PayslipItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);

  useEffect(() => {
    if (!isAdmin) { navigate('/admin/login'); return; }
    Promise.all([
      getAdminSettings().catch(() => ({} as Record<string, string | boolean>)),
      getRemotionStatus().catch((): RemotionStatus => ({ installed: false, version: null })),
      getData().catch(() => ({ items: [] as PayslipItem[] })),
      getGeneratedVideos().catch(() => ({ videos: [] as GeneratedVideo[] })),
    ])
      .then(([settingsData, remotionData, docsData, videosData]) => {
        const vals: Record<string, string> = {};
        const env: Record<string, boolean> = {};
        for (const f of SETTINGS_FIELDS) {
          const raw = settingsData[f.key];
          vals[f.key] = typeof raw === 'string' ? raw : '';
          env[f.key] = Boolean(settingsData[`${f.key}__fromEnv`]);
        }
        setSettings(vals);
        setFromEnv(env);
        // Apparence persistée
        const themeVal = settingsData['VIDEO_THEME'];
        const accentVal = settingsData['VIDEO_ACCENT_COLOR'];
        if (typeof themeVal === 'string' && VIDEO_THEMES[themeVal]) setSelectedTheme(themeVal);
        if (typeof accentVal === 'string' && accentVal) setAccentColor(accentVal);
        setRemotion(remotionData);
        setDocuments((docsData.items ?? []) as PayslipItem[]);
        setVideos((videosData.videos ?? []) as GeneratedVideo[]);
      })
      .finally(() => setLoading(false));
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [installLogs]);

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSettingsSaved(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError(null);
    try {
      // N'envoyer que les champs modifiés (non masqués, non vides)
      const payload: Record<string, string> = {};
      for (const f of SETTINGS_FIELDS) {
        const val = settings[f.key];
        if (val && !val.startsWith('***')) payload[f.key] = val;
      }
      await saveAdminSettings(payload);
      setSettingsSaved(true);
      // Recharger les valeurs masquées
      const refreshed = await getAdminSettings();
      const vals: Record<string, string> = {};
      for (const f of SETTINGS_FIELDS) {
        const raw = refreshed[f.key];
        vals[f.key] = typeof raw === 'string' ? raw : '';
      }
      setSettings(vals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setInstallLogs([]);
    setError(null);
    try {
      await streamSSE(API_CONFIG.remotionInstallUrl, (data) => {
        if (data.log) setInstallLogs(prev => [...prev, String(data.log).replace(/\n+$/, '')]);
        if (data.error) setError(data.error);
        if (data.done) setInstallLogs(prev => [...prev, '✓ Installation terminée.']);
      });
      const status = await getRemotionStatus();
      setRemotion(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'installation');
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!window.confirm('Désinstaller Remotion ? Les vidéos déjà générées restent disponibles.')) return;
    setError(null);
    try {
      await uninstallRemotion();
      setRemotion({ installed: false, version: null });
      setInstallLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la désinstallation');
    }
  };

  const handleSaveAppearance = async () => {
    setSavingAppearance(true);
    setError(null);
    try {
      await saveAdminSettings({ VIDEO_THEME: selectedTheme, VIDEO_ACCENT_COLOR: accentColor });
      setAppearanceSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    setProgress(0);
    setProgressMsg('Initialisation...');
    setResultVideoUrl(null);
    setPublished(false);
    setError(null);
    try {
      await streamSSE(`${API_CONFIG.adminVideosUrl}/generate/${selectedDoc}`, (data) => {
        if (typeof data.progress === 'number') setProgress(data.progress);
        if (data.message) setProgressMsg(data.message);
        if (data.error) setError(data.error);
        if (data.done && data.videoUrl) {
          setResultVideoUrl(data.videoUrl);
          setProgress(100);
        }
      }, { body: JSON.stringify({ theme: selectedTheme, accentColor }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!resultVideoUrl || !selectedDoc) return;
    setPublishing(true);
    setError(null);
    try {
      await publishVideo(selectedDoc, resultVideoUrl);
      setPublished(true);
      const refreshed = await getGeneratedVideos();
      setVideos(refreshed.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication');
    } finally {
      setPublishing(false);
    }
  };

  const handleReject = async () => {
    if (!resultVideoUrl) return;
    try {
      await discardVideo(resultVideoUrl);
    } catch {
      // Fichier déjà absent : on ignore
    }
    setResultVideoUrl(null);
    setPublished(false);
    setProgress(0);
    setProgressMsg('');
  };

  const handleDeleteVideo = async (documentId: string) => {
    if (!window.confirm('Supprimer cette vidéo ? Cette action est irréversible.')) return;
    try {
      await deleteVideo(documentId);
      setVideos(prev => prev.filter(v => v.documentId !== documentId));
      if (videos.find(v => v.documentId === documentId)?.videoUrl === resultVideoUrl) {
        setResultVideoUrl(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canGenerate = remotion.installed && selectedDoc && !generating;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Retour">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png" alt="ClearDoc Logo" className="h-6 w-6 object-contain" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ClearDoc</span>
            </button>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 py-8 max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2.5">
            <Video className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Génération vidéo</h1>
            <p className="text-muted-foreground">Créez automatiquement des vidéos explicatives pour vos documents.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
            <button onClick={() => setError(null)} className="shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="space-y-6">
          {/* Section 1 — Paramètres API */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Paramètres API
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Les clés sont stockées en base de données. Pour une sécurité maximale, configurez-les dans les
              variables d'environnement Coolify.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SETTINGS_FIELDS.map(field => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key} className="text-sm flex items-center gap-2">
                    {field.label}
                    {fromEnv[field.key] && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">env</Badge>
                    )}
                  </Label>
                  <Input
                    id={field.key}
                    type={field.isKey ? 'text' : 'text'}
                    value={settings[field.key] ?? ''}
                    placeholder={field.placeholder}
                    disabled={fromEnv[field.key]}
                    onChange={e => handleSettingChange(field.key, e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder
              </Button>
              {settingsSaved && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Enregistré
                </span>
              )}
            </div>
          </section>

          {/* Section 2 — Remotion */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Video className="h-5 w-5 text-muted-foreground" />
                Remotion
              </h2>
              {remotion.installed ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Installé{remotion.version ? ` (v${remotion.version})` : ''}
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" /> Non installé
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Remotion et Chromium (~150 Mo) sont installés dans <code className="text-xs px-1 py-0.5 bg-muted rounded">node_modules/</code>.
              Ils devront être réinstallés après un redémarrage du conteneur.
            </p>

            <div className="flex gap-3">
              <Button onClick={handleInstall} disabled={installing || remotion.installed} className="gap-2">
                {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {installing ? 'Installation...' : 'Installer Remotion'}
              </Button>
              <Button onClick={handleUninstall} disabled={installing || !remotion.installed} variant="outline" className="gap-2">
                <PackageMinus className="h-4 w-4" />
                Désinstaller
              </Button>
            </div>

            {(installing || installLogs.length > 0) && (
              <div
                ref={logRef}
                className="mt-4 h-48 overflow-y-auto rounded-lg bg-slate-950 text-slate-200 font-mono text-xs p-3 whitespace-pre-wrap"
              >
                {installLogs.map((line, i) => <div key={i}>{line}</div>)}
                {installing && <div className="animate-pulse">…</div>}
              </div>
            )}
          </section>

          {/* Section — Apparence des vidéos */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <Palette className="h-5 w-5 text-muted-foreground" />
              Apparence des vidéos
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Choisissez un thème et une couleur d'accentuation pour toutes vos vidéos générées.
            </p>

            {/* Grille des thèmes */}
            <div className="mb-6">
              <Label className="text-sm mb-3 block">Thème</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {Object.values(VIDEO_THEMES).map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    accent={accentColor}
                    selected={selectedTheme === theme.id}
                    onClick={() => { setSelectedTheme(theme.id); setAppearanceSaved(false); }}
                  />
                ))}
              </div>
            </div>

            {/* Couleur d'accentuation */}
            <div className="mb-6">
              <Label className="text-sm mb-3 block">Couleur d'accentuation</Label>
              <div className="flex gap-2 flex-wrap mb-3">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.name}
                    onClick={() => { setAccentColor(color.value); setAppearanceSaved(false); }}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      accentColor === color.value ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => { setAccentColor(e.target.value); setAppearanceSaved(false); }}
                  className="w-10 h-10 rounded cursor-pointer border border-border bg-transparent"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => { setAccentColor(e.target.value); setAppearanceSaved(false); }}
                  placeholder="#dc2626"
                  className="w-32 font-mono text-sm"
                />
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  ou choisissez n'importe quelle couleur
                </span>
              </div>
            </div>

            {/* Aperçu */}
            <div className="mb-4">
              <ThemePreview theme={VIDEO_THEMES[selectedTheme] ?? DEFAULT_THEME} accent={accentColor} />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSaveAppearance} disabled={savingAppearance} variant="outline" size="sm" className="gap-2">
                {savingAppearance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder l'apparence
              </Button>
              {appearanceSaved && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Enregistré
                </span>
              )}
            </div>
          </section>

          {/* Section 3 — Générer une vidéo */}
          <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              Générer une vidéo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Sélectionnez un document. La vidéo est générée à partir de son titre et de sa description.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Select value={selectedDoc} onValueChange={setSelectedDoc} disabled={generating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.map(doc => (
                      <SelectItem key={doc.id} value={doc.id}>{doc.title || '(sans titre)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2 shrink-0">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Générer la vidéo
              </Button>
            </div>

            {!remotion.installed && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Installez Remotion (section ci-dessus) avant de générer une vidéo.
              </p>
            )}

            {generating && (
              <div className="mt-4 space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">{progress}% — {progressMsg}</p>
              </div>
            )}

            {resultVideoUrl && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Aperçu — validez pour publier la vidéo sur la fiche (sous le titre, au-dessus de la description).
                </p>
                <video controls className="w-full rounded-xl border border-slate-200 dark:border-slate-800">
                  <source src={resultVideoUrl} type="video/mp4" />
                </video>

                <div className="flex flex-wrap items-center gap-3">
                  {published ? (
                    <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Vidéo publiée sur la fiche
                    </span>
                  ) : (
                    <>
                      <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                        {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Valider et publier
                      </Button>
                      <Button onClick={handleReject} disabled={publishing} variant="outline" className="gap-2">
                        <XCircle className="h-4 w-4" /> Rejeter
                      </Button>
                    </>
                  )}
                  <a
                    href={resultVideoUrl}
                    download
                    className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Download className="h-4 w-4" /> Télécharger
                  </a>
                </div>
              </div>
            )}
          </section>

          {/* Vidéos existantes */}
          {videos.length > 0 && (
            <section className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vidéos générées</h2>
              <div className="space-y-2">
                {videos.map(v => (
                  <div key={v.documentId} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group">
                    <Video className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate">{v.title || '(sans titre)'}</span>
                    <a href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-blue-500">
                      Ouvrir ↗
                    </a>
                    <button
                      onClick={() => handleDeleteVideo(v.documentId)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
