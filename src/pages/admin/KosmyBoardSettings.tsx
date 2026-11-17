import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, AlertCircle, CheckCircle2, Copy, Check, Loader2, Save, Link2, Unlink, Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { KosmyBoardMark } from '@/components/KosmyBoardMark';
import { kosmyErrorMessage } from '@/lib/kosmyBoard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface KosmyBoardConfig {
  issuer: string;
  clientId: string;
  hasSecret: boolean;
  fromEnv: { issuer: boolean; clientId: boolean; clientSecret: boolean };
  enabled: boolean;
  redirectUri: string;
  initiateLoginUri: string;
  linked: boolean;
  linkedToCurrentIssuer: boolean;
}

const SECTION = 'bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5';

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      (document.getElementById(id) as HTMLInputElement | null)?.select();
    }
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} readOnly className="h-9 text-sm font-mono" onFocus={e => e.target.select()} />
        <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5 h-9">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t('kosmy.settings.copied') : t('kosmy.settings.copy')}
        </Button>
      </div>
    </div>
  );
}

export function KosmyBoardSettings() {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [config, setConfig] = useState<KosmyBoardConfig | null>(null);
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Messages du retour de liaison (?kosmy=linked ou ?kosmy_error=code), affichés une fois.
  useEffect(() => {
    const code = searchParams.get('kosmy_error');
    if (code) setError(kosmyErrorMessage(t, code));
    if (searchParams.get('kosmy') === 'linked') setNotice(t('kosmy.link.done'));
    if (code || searchParams.get('kosmy')) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/kosmy-board', { credentials: 'include' });
    if (res.status === 401) { navigate('/admin/login'); return; }
    const data: KosmyBoardConfig = await res.json();
    setConfig(data);
    setIssuer(data.issuer);
    setClientId(data.clientId);
    setClientSecret('');
  }, [navigate]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { navigate('/admin/login'); return; }
    load().catch(() => setError(t('kosmy.error.unreachable')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/kosmy-board', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuer, clientId, clientSecret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === 'invalid_issuer' ? t('kosmy.settings.invalidIssuer') : t('kosmy.settings.error'));
        return;
      }
      await load();
      setNotice(t('kosmy.settings.saved'));
    } catch {
      setError(t('kosmy.settings.error'));
    } finally {
      setSaving(false);
    }
  };

  const disable = async () => {
    if (!window.confirm(t('kosmy.settings.disableConfirm'))) return;
    setError(null);
    setNotice(null);
    await fetch('/api/admin/kosmy-board', { method: 'DELETE', credentials: 'include' });
    await load();
  };

  const unlink = async () => {
    if (!window.confirm(t('kosmy.link.unlinkConfirm'))) return;
    setError(null);
    setNotice(null);
    await fetch('/api/admin/kosmy-board/unlink', { method: 'POST', credentials: 'include' });
    await load();
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800 sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title={t('kosmy.settings.back')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-white rounded-lg p-2 shadow-sm">
                <img src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png" alt="ClearDoc Logo" className="h-6 w-6 object-contain" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ClearDoc</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="px-4 py-8 max-w-3xl mx-auto">
        <div className="mb-8 flex items-start gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2.5">
            <KosmyBoardMark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-3">
              {t('kosmy.settings.title')}
              <Badge variant={config.enabled ? 'default' : 'secondary'}>
                {config.enabled ? t('kosmy.settings.status.on') : t('kosmy.settings.status.off')}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1">{t('kosmy.settings.intro')}</p>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            {notice}
          </div>
        )}

        <div className="space-y-6">
          {/* 1 — Adresses à donner au Board */}
          <section className={SECTION}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('kosmy.settings.board')}</h2>
            <div className="space-y-4">
              <CopyField id="kosmy-redirect-uri" label={t('kosmy.settings.redirectUri')} value={config.redirectUri} />
              <CopyField id="kosmy-initiate-uri" label={t('kosmy.settings.initiateUri')} value={config.initiateLoginUri} />
            </div>
          </section>

          {/* 2 — Réglages donnés par le Board */}
          <section className={SECTION}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{t('kosmy.settings.app')}</h2>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="kosmy-issuer" className="text-sm flex items-center gap-2">
                  {t('kosmy.settings.issuer')}
                  {config.fromEnv.issuer && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">env</Badge>}
                </Label>
                <Input
                  id="kosmy-issuer"
                  type="url"
                  value={issuer}
                  placeholder="https://board.mondomaine.fr/oidc"
                  disabled={config.fromEnv.issuer}
                  title={config.fromEnv.issuer ? t('kosmy.settings.fromEnv') : undefined}
                  onChange={e => setIssuer(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kosmy-client-id" className="text-sm flex items-center gap-2">
                  {t('kosmy.settings.clientId')}
                  {config.fromEnv.clientId && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">env</Badge>}
                </Label>
                <Input
                  id="kosmy-client-id"
                  value={clientId}
                  autoComplete="off"
                  disabled={config.fromEnv.clientId}
                  title={config.fromEnv.clientId ? t('kosmy.settings.fromEnv') : undefined}
                  onChange={e => setClientId(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kosmy-client-secret" className="text-sm flex items-center gap-2">
                  {t('kosmy.settings.clientSecret')}
                  {config.fromEnv.clientSecret && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">env</Badge>}
                </Label>
                <Input
                  id="kosmy-client-secret"
                  type="password"
                  value={clientSecret}
                  autoComplete="new-password"
                  placeholder={config.hasSecret ? t('kosmy.settings.secretSaved') : ''}
                  disabled={config.fromEnv.clientSecret}
                  title={config.fromEnv.clientSecret ? t('kosmy.settings.fromEnv') : undefined}
                  onChange={e => setClientSecret(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">{t('kosmy.settings.secretHint')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t('kosmy.settings.save')}
                </Button>
                {(config.issuer || config.clientId || config.hasSecret) && (
                  <Button type="button" variant="ghost" onClick={disable} className="gap-2 text-muted-foreground">
                    <Power className="h-4 w-4" />
                    {t('kosmy.settings.disable')}
                  </Button>
                )}
              </div>
            </form>
          </section>

          {/* 3 — Liaison du compte admin */}
          <section className={SECTION}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{t('kosmy.link.title')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('kosmy.link.intro')}</p>
            <p className="text-sm mb-4 flex items-center gap-2">
              {config.linkedToCurrentIssuer ? (
                <><CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />{t('kosmy.link.linked')}</>
              ) : config.linked ? (
                <><AlertCircle className="h-4 w-4 text-amber-600" />{config.enabled ? t('kosmy.link.linkedOtherIssuer') : t('kosmy.link.linked')}</>
              ) : (
                <><AlertCircle className="h-4 w-4 text-muted-foreground" />{t('kosmy.link.notLinked')}</>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {config.enabled ? (
                // Formulaire classique : le serveur redirige vers le Board, puis revient ici.
                <form method="post" action="/auth/kosmy-board/link">
                  <Button type="submit" variant={config.linkedToCurrentIssuer ? 'outline' : 'default'} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    {config.linkedToCurrentIssuer ? t('kosmy.link.relink') : t('kosmy.link.link')}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">{t('kosmy.link.needSettings')}</p>
              )}
              {config.linked && (
                <Button type="button" variant="ghost" onClick={unlink} className="gap-2 text-muted-foreground">
                  <Unlink className="h-4 w-4" />
                  {t('kosmy.link.unlink')}
                </Button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
