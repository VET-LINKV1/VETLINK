import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { defaultRouteForRole } from '../App';

export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  const login = useCallback(async (email, password) => {
    console.log('[Auth] login.attempt', { email });
    const result = await authService.login(email, password);
    console.log('[Auth] login.success', { userId: result.user?.id, role: result.user?.role });
    if (result.session?.accessToken) {
      try {
        await supabase.auth.setSession({
          access_token: result.session.accessToken,
          refresh_token: result.session.refreshToken || undefined,
        });
      } catch (e) {
        console.warn('[Auth] setSession failed', e?.message);
      }
    }
    store.setAuth(result);
    const dest = defaultRouteForRole(result.user?.role);
    console.log('[Auth] role-based redirect →', dest);
    navigate(dest, { replace: true });
    return result;
  }, [store, navigate]);

  const logout = useCallback(async () => {
    console.log('[Auth] logout');
    try { await authService.logout(); } catch (_) {}
    store.logout();
    navigate('/login', { replace: true });
  }, [store, navigate]);

  return {
    user:            store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading:       store.isLoading,
    role:            store.user?.role,
    isAdmin:         store.user?.role === 'admin',
    isVet:           store.user?.role === 'veterinarian',
    isStaff:         store.user?.role === 'staff',
    isClient:        store.user?.role === 'client',
    login,
    logout,
  };
}
