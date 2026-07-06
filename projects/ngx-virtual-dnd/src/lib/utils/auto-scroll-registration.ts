import { DestroyRef, effect, inject } from '@angular/core';
import { type AutoScrollConfig, AutoScrollService } from '../services/auto-scroll.service';

interface AutoScrollRegistrationOptions {
  autoScrollService: AutoScrollService;
  getElement: () => HTMLElement;
  getId: () => string;
  enabled: () => boolean;
  config: () => Partial<AutoScrollConfig>;
  canRegister?: () => boolean;
}

export function createAutoScrollRegistration(options: AutoScrollRegistrationOptions): void {
  const destroyRef = inject(DestroyRef);
  let registeredId: string | null = null;

  const unregisterCurrent = (): void => {
    if (registeredId === null) {
      return;
    }

    options.autoScrollService.unregisterContainer(registeredId);
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

    options.autoScrollService.registerContainer(id, options.getElement(), config);
    registeredId = id;
  });

  destroyRef.onDestroy(unregisterCurrent);
}
