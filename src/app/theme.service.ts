import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'vdnd-theme';
const FIXED_SCHEME = 'porcelain';
const FIXED_DENSITY = 'comfortable';

/**
 * Manages the demo app's light/dark theme.
 *
 * Applies `data-theme` / `data-scheme` / `data-density` to the document root so the
 * shared design tokens in `styles.scss` resolve. The accent (teal), light scheme
 * (porcelain) and density (comfortable) are fixed — only the light/dark mode is
 * user-toggleable via the top bar.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** The user's selected mode: auto follows the OS preference. */
  readonly mode = signal<ThemeMode>('auto');

  readonly #media =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  constructor() {
    const stored = this.#read();
    if (stored) {
      this.mode.set(stored);
    }

    this.#media?.addEventListener('change', () => {
      if (this.mode() === 'auto') {
        this.#apply();
      }
    });

    const root = document.documentElement;
    root.setAttribute('data-scheme', FIXED_SCHEME);
    root.setAttribute('data-density', FIXED_DENSITY);
    this.#apply();
  }

  /** The concrete theme currently rendered (auto resolved to light/dark). */
  resolved(): 'light' | 'dark' {
    const mode = this.mode();
    if (mode === 'auto') {
      return this.#media?.matches ? 'dark' : 'light';
    }
    return mode;
  }

  /** Cycle auto → light → dark → auto. */
  cycle(): void {
    const next: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' };
    this.mode.set(next[this.mode()]);
    this.#write(this.mode());
    this.#apply();
  }

  #apply(): void {
    document.documentElement.setAttribute('data-theme', this.resolved());
  }

  #read(): ThemeMode | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' || value === 'auto' ? value : null;
    } catch {
      return null;
    }
  }

  #write(value: ThemeMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Ignore storage failures (private mode, etc.) — theme still applies in-memory.
    }
  }
}
