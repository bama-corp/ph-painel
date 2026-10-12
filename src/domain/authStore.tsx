import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AuthUser = { name: string; email: string };

type AuthApi = {
  ready: boolean;
  configured: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: (login: string, password: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthApi | null>(null);

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";

function authUrl(path: string) {
  return `${API_BASE}${path}`;
}

async function readMe(): Promise<{
  configured: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}> {
  const res = await fetch(authUrl("/api/auth/me"), { credentials: "include" });
  if (!res.ok) {
    return { configured: true, authenticated: false, user: null };
  }
  const data = (await res.json()) as {
    configured?: boolean;
    authenticated?: boolean;
    user?: AuthUser | null;
  };
  return {
    configured: data.configured !== false,
    authenticated: Boolean(data.authenticated),
    user: data.user ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await readMe();
      setConfigured(me.configured);
      setAuthenticated(me.configured ? me.authenticated : true);
      setUser(me.user);
    } catch {
      setConfigured(true);
      setAuthenticated(false);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (loginId: string, password: string) => {
    try {
      const res = await fetch(authUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginId, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: AuthUser;
      };
      if (!res.ok) {
        return { ok: false as const, reason: body.error || "Login falhou." };
      }
      setConfigured(true);
      setAuthenticated(true);
      setUser(body.user ?? null);
      return { ok: true as const };
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Falha de rede",
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(authUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      /* ignore */
    }
    setAuthenticated(false);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ ready, configured, authenticated, user, login, logout, refresh }),
    [ready, configured, authenticated, user, login, logout, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora de AuthProvider");
  return ctx;
}
