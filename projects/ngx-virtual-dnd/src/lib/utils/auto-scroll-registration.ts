import { DestroyRef, effect, inject, isDevMode } from '@angular/core';
import { type AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';

interface AutoScrollRegistrationOptions {
  autoScrollService: AutoScrollService | null;
  getElement: () => HTMLElement;
  getId: () => string;
  enabled: () => boolean;
  config: () => Partial<AutoScrollConfig>;
  canRegister?: () => boolean;
}

/** Dev-mode "you forgot the provider" warning, emitted at most once. */
let warnedMissingProvider = false;

export function createAutoScrollRegistration(options: AutoScrollRegistrationOptions): void {
  const destroyRef = inject(DestroyRef);
  const service = options.autoScrollService;

  // No provider → autoscroll opted out. Warn once (dev only) if a container
  // actually asks for it, so the missing `provideVdndAutoScroll()` isn't silent.
  if (!service) {
    if (isDevMode()) {
      effect(() => {
        if (!warnedMissingProvider && options.enabled() && (options.canRegister?.() ?? true)) {
          warnedMissingProvider = true;
          console.warn(
            '[ngx-virtual-dnd] Auto-scroll is enabled on a container but ' +
              '`provideVdndAutoScroll()` was not added to your providers. ' +
              'Drag will work without edge auto-scrolling.',
          );
        }
      });
    }
    return;
  }

  let registeredId: string | null = null;

  const unregisterCurrent = (): void => {
    if (registeredId === null) {
      return;
    }

    service.unregisterContainer(registeredId);
    registeredId = null;
  };

  effect(() => {
    const enabled = options.enabled();
    const id = options.getId();
    const config = options.config();
    const canRegister = options.canRegister?.() ?? true;

    if (!enabled || !canRegister) {
      unregisterCurrent();
      return;
    }

    if (registeredId !== null && registeredId !== id) {
      unregisterCurrent();
    }

    service.registerContainer(id, options.getElement(), config);
    registeredId = id;
  });

  destroyRef.onDestroy(unregisterCurrent);
}
