/**
 * ThemeSwitch.jsx
 * Compact, contained dark/light toggle. Track + sliding knob with sun/moon icons.
 * - Self-contained (no overflowing pseudo-elements / shadows that bleed onto siblings)
 * - Pure Tailwind, no styled-components needed
 * - Reliable bidirectional toggle: click anywhere on the track flips the theme
 */
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export default function ThemeSwitch() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center
        w-14 h-7 rounded-full
        transition-colors duration-300 ease-out
        ring-1 ring-inset
        ${isDark
          ? 'bg-slate-800 ring-blue-500/40'
          : 'bg-slate-200 ring-slate-300'}
      `}
    >
      {/* Background icons (faint, signal both poles) */}
      <Sun  className={`absolute left-1.5  w-3.5 h-3.5 transition-opacity duration-300 ${isDark ? 'opacity-40 text-amber-300' : 'opacity-90 text-amber-500'}`} />
      <Moon className={`absolute right-1.5 w-3.5 h-3.5 transition-opacity duration-300 ${isDark ? 'opacity-90 text-blue-200' : 'opacity-40 text-slate-500'}`} />

      {/* Sliding knob */}
      <span
        className={`
          relative z-10 inline-block w-5 h-5 rounded-full
          shadow-md
          transform transition-transform duration-300 ease-out
          ${isDark
            ? 'translate-x-8 bg-gradient-to-br from-blue-400 to-blue-600'
            : 'translate-x-1 bg-white'}
        `}
      />
    </button>
  );
}
