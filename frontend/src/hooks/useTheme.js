/**
 * useTheme — single global theme store backed by Zustand.
 *
 * Why a store and not local useState:
 *   - Multiple <ThemeSwitch> instances (or any other consumer) all see the
 *     SAME theme — no out-of-sync local state across mounts/HMR.
 *   - The class on <html> is applied via a store subscriber, so it updates
 *     exactly once per state change, regardless of how many components
 *     are rendering.
 *   - persist() handles localStorage automatically.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const STORAGE_KEY = 'vetlink_theme';

function applyToHtml(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  // Visible debug marker — open DevTools console to verify
  console.log('[Theme] applied:', theme, '| html.classList.dark =', root.classList.contains('dark'));
}

function detectInitial() {
  // persist() will overwrite this if there's a stored value, but this is the
  // first-render fallback (and what's used during hydration before persist runs)
  if (typeof window === 'undefined') return 'light';
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (_) {}
  return 'light';
}

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: detectInitial(),
      setTheme: (t) => {
        const next = t === 'dark' ? 'dark' : 'light';
        applyToHtml(next);
        set({ theme: next });
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        applyToHtml(next);
        set({ theme: next });
      },
    }),
    {
      name: STORAGE_KEY,
      // After zustand rehydrates from localStorage, force-apply to <html>.
      // This catches the initial page load when persist() restores the prior choice.
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyToHtml(state.theme);
      },
    }
  )
);

// Apply once at module load too, so first paint isn't wrong while persist hydrates
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const t = parsed?.state?.theme;
      if (t === 'dark' || t === 'light') applyToHtml(t);
      else applyToHtml(detectInitial());
    } else {
      applyToHtml(detectInitial());
    }
  } catch (_) {
    applyToHtml(detectInitial());
  }
}

// Convenience hook with the same API as before — drop-in replacement
export function useTheme() {
  const theme       = useThemeStore((s) => s.theme);
  const setTheme    = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  return { theme, isDark: theme === 'dark', setTheme, toggleTheme };
}
