import { useEffect, useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { KosmyBoardMark } from '@/components/KosmyBoardMark';
import { kosmyErrorMessage } from '@/lib/kosmyBoard';
import { AlertCircle, LogIn } from 'lucide-react';

export function AdminLogin() {
  const { login, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kosmyEnabled, setKosmyEnabled] = useState(false);

  // Erreur renvoyée par le retour de Kosmy Board (?kosmy_error=code)
  const kosmyError = searchParams.get('kosmy_error');

  useEffect(() => {
    fetch('/api/auth/kosmy-board', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setKosmyEnabled(Boolean(data?.enabled)))
      .catch(() => setKosmyEnabled(false));
  }, []);

  // Si déjà connecté, rediriger vers l'accueil
  if (isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const shownError = error || (kosmyError ? kosmyErrorMessage(t, kosmyError) : null);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b dark:border-slate-800">
        <div className="px-4 py-4 max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="bg-white rounded-lg p-2 shadow-sm">
              <img
                src="https://i.postimg.cc/YCNJPVd6/Clear-Doc.png"
                alt="ClearDoc Logo"
                className="h-6 w-6 object-contain"
              />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">ClearDoc</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Formulaire de connexion */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-2xl">{t('login.title')}</CardTitle>
            <CardDescription>{t('login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {shownError && (
              <div role="alert" className="mb-4 flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{shownError}</span>
              </div>
            )}

            {kosmyEnabled && (
              <>
                {/* Simple lien : la route serveur redirige vers le Board */}
                <Button asChild variant="outline" className="w-full">
                  <a href="/auth/kosmy-board/login">
                    <KosmyBoardMark className="h-4 w-4 mr-2" />
                    {t('kosmy.signIn')}
                  </a>
                </Button>
                <div className="my-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  {t('login.or')}
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('login.username')}</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {t('login.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    {t('login.submit')}
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
