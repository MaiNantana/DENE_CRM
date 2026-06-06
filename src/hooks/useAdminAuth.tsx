import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api';
import type { StaffRole, StaffUser } from '../types';

interface AdminAuthContextValue {
  user: StaffUser | null;
  hasStaff: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<StaffUser>;
  bootstrap: (data: { displayName: string; username: string; password: string }) => Promise<StaffUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<StaffUser | null>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function normalizeUser(payload: any): StaffUser {
  return {
    id: payload.id,
    companyId: payload.companyId || null,
    username: payload.username,
    displayName: payload.displayName,
    role: payload.role as StaffRole,
    isActive: Boolean(payload.isActive),
    lastLoginAt: payload.lastLoginAt || null,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [hasStaff, setHasStaff] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      const nextUser = normalizeUser(data.user);
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const status = await authApi.status();
        if (alive) setHasStaff(status.hasStaff);
      } catch {
        if (alive) setHasStaff(true);
      }

      await refresh();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    const nextUser = normalizeUser(data.user);
    setUser(nextUser);
    setHasStaff(true);
    return nextUser;
  }, []);

  const bootstrap = useCallback(async (data: { displayName: string; username: string; password: string }) => {
    const result = await authApi.bootstrap(data);
    const nextUser = normalizeUser(result.user);
    setUser(nextUser);
    setHasStaff(true);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, hasStaff, loading, login, bootstrap, logout, refresh }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
