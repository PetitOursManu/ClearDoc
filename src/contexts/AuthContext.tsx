import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthState {
  isAdmin: boolean;
  username: string | null;
  /** Restriction du compte (réglée depuis les utilisateurs de Kosmy Board). */
  canGenerateVideos: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SIGNED_OUT: AuthState = { isAdmin: false, username: null, canGenerateVideos: false, loading: false };

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [state, setState] = useState<AuthState>({
    isAdmin: false,
    username: null,
    canGenerateVideos: false,
    loading: true,
  });

  // Vérification initiale du token au démarrage
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.ok) {
          setState({ isAdmin: true, username: data.username, canGenerateVideos: data.canGenerateVideos !== false, loading: false });
        } else {
          setState(SIGNED_OUT);
        }
      })
      .catch(() => setState(SIGNED_OUT));
  }, []);

  // Vérification périodique de l'expiration du token (toutes les minutes)
  useEffect(() => {
    if (!state.isAdmin) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          setState(SIGNED_OUT);
          navigate('/admin/login');
        }
      } catch {
        // Réseau indisponible — ne pas déconnecter
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAdmin, navigate]);

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

    // Les droits du compte viennent de /api/auth/me.
    const me = await fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
    setState({ isAdmin: true, username: data.username, canGenerateVideos: me?.canGenerateVideos !== false, loading: false });
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState(SIGNED_OUT);
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
