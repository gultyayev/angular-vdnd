import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class App {
  // Injected eagerly so the theme (data-theme/scheme/density) is applied on boot.
  protected readonly theme = inject(ThemeService);
}
