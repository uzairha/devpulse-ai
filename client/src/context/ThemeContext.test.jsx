import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// jsdom has no matchMedia; default it to "light" (not dark) and let individual
// tests override.
let prefersDark = false;
beforeEach(() => {
  prefersDark = false;
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  vi.stubGlobal('matchMedia', (query) => ({
    matches: query.includes('dark') ? prefersDark : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const { ThemeProvider } = await import('./ThemeContext.jsx');
const { default: useTheme } = await import('../hooks/useTheme.js');

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('useTheme / ThemeProvider', () => {
  it('throws when used outside a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    prefersDark = true;
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('prefers a stored theme over the OS preference', () => {
    prefersDark = true;
    localStorage.setItem('devpulse-theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');
  });

  it('toggles the theme, persisting it and reflecting it on <html data-theme>', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('light');

    act(() => result.current.toggleTheme());

    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('devpulse-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
