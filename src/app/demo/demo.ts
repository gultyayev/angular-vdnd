import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  DraggableDirective,
  DragPreviewComponent,
  DragStateService,
  DropEvent,
  DroppableDirective,
  DroppableGroupDirective,
  moveItem,
  VirtualScrollContainerComponent,
  VirtualSortableListComponent,
} from 'ngx-virtual-dnd';

interface Item {
  id: string;
  name: string;
  color: string;
}

/**
 * Demo component showcasing the ngx-virtual-dnd library.
 */
@Component({
  selector: 'app-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JsonPipe,
    RouterLink,
    DragPreviewComponent,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    VirtualScrollContainerComponent,
    VirtualSortableListComponent,
  ],
  template: `
    <div class="demo-page">
      <!-- Header -->
      <header class="header">
        <div class="header-content">
          <div class="logo">
            <svg
              class="logo-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <path d="M10 7h4M7 10v4M17 10v4M10 17h4" stroke-dasharray="2 2" />
            </svg>
            <span class="logo-text">ngx-virtual-dnd</span>
          </div>
          <p class="tagline">High-performance drag & drop with virtual scrolling</p>
          <a routerLink="/page-scroll" class="demo-link"> View Page-Level Scroll Demo → </a>
        </div>
      </header>

      <!-- Main Content -->
      <main class="main">
        <!-- Settings Panel -->
        <section class="settings-panel">
          <button
            type="button"
            class="settings-header"
            (click)="toggleSettings()"
            [attr.aria-expanded]="settingsExpanded()"
            aria-controls="settings-content"
          >
            <h2 class="settings-title">
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                />
              </svg>
              Settings
            </h2>
            <span class="settings-toggle" [class.collapsed]="!settingsExpanded()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>

          @if (settingsExpanded()) {
            <div class="settings-content">
              <div class="settings-grid">
                <!-- Data Settings -->
                <div class="setting-group">
                  <h3 class="setting-group-title">Data</h3>
                  <div class="setting-item">
                    <label class="setting-label" for="itemCount">Item count</label>
                    <input
                      id="itemCount"
                      type="number"
                      class="input"
                      [value]="itemCount()"
                      (input)="updateItemCount($event)"
                    />
                  </div>
                  <button class="btn btn-secondary" (click)="regenerateItems()">
                    <svg
                      class="icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path
                        d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
                      />
                    </svg>
                    Regenerate
                  </button>
                </div>

                <!-- Drag Behavior -->
                <div class="setting-group">
                  <h3 class="setting-group-title">Drag Behavior</h3>
                  <div class="setting-item">
                    <label class="setting-label" for="lockAxis">Lock axis</label>
                    <select
                      id="lockAxis"
                      class="select"
                      [value]="lockAxis() ?? ''"
                      (change)="updateLockAxis($event)"
                      data-testid="lock-axis-select"
                    >
                      <option value="">Free movement</option>
                      <option value="x">Horizontal only</option>
                      <option value="y">Vertical only</option>
                    </select>
                  </div>
                  <div class="setting-item">
                    <label class="setting-label" for="dragDelay">Delay (ms)</label>
                    <input
                      id="dragDelay"
                      type="number"
                      class="input"
                      min="0"
                      step="50"
                      [value]="dragDelay()"
                      (input)="updateDragDelay($event)"
                      data-testid="drag-delay-input"
                    />
                  </div>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      class="checkbox"
                      [checked]="useDragHandle()"
                      (change)="toggleDragHandle($event)"
                      data-testid="drag-handle-checkbox"
                    />
                    <span class="checkbox-text">Use drag handle</span>
                  </label>
                </div>

                <!-- Display Options -->
                <div class="setting-group">
                  <h3 class="setting-group-title">Display</h3>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      class="checkbox"
                      [checked]="dragEnabled()"
                      (change)="toggleDragEnabled($event)"
                      data-testid="drag-enabled-checkbox"
                    />
                    <span class="checkbox-text">Enable dragging</span>
                  </label>
                </div>

                <!-- API Mode -->
                <div class="setting-group">
                  <h3 class="setting-group-title">API Mode</h3>
                  <div class="toggle-group">
                    <button
                      class="toggle-btn"
                      [class.active]="!useSimplifiedApi()"
                      (click)="useSimplifiedApi.set(false)"
                    >
                      Verbose
                    </button>
                    <button
                      class="toggle-btn"
                      [class.active]="useSimplifiedApi()"
                      (click)="useSimplifiedApi.set(true)"
                      data-testid="simplified-api-checkbox"
                    >
                      Simplified
                    </button>
                  </div>
                  <p class="setting-hint">
                    @if (useSimplifiedApi()) {
                      Using <code>VirtualSortableList</code> + <code>moveItem()</code>
                    } @else {
                      Using individual directives with manual placeholder
                    }
                  </p>
                </div>
              </div>
            </div>
          }
        </section>

        <!-- Lists Section -->
        <section class="lists-section">
          @if (useSimplifiedApi()) {
            <!-- SIMPLIFIED API -->
            <div class="lists-container" vdndGroup="demo">
              <ng-template #simplifiedItemTpl let-item>
                <div
                  class="item"
                  [class.use-handle]="useDragHandle()"
                  [style.--item-color]="item.color"
                  vdndDraggable="{{ item.id }}"
                  [vdndDraggableData]="item"
                  [lockAxis]="lockAxis()"
                  [disabled]="!dragEnabled()"
                  [dragDelay]="dragDelay()"
                  [dragHandle]="useDragHandle() ? '.item-handle' : undefined"
                >
                  <span class="item-handle">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  <span class="item-text">{{ item.name }}</span>
                </div>
              </ng-template>

              <div class="list-card">
                <div class="list-header">
                  <h3 class="list-title">List 1</h3>
                  <span class="list-badge">{{ list1().length }}</span>
                </div>
                <vdnd-sortable-list
                  class="list"
                  droppableId="list-1"
                  group="demo"
                  [items]="list1()"
                  [itemHeight]="50"
                  [containerHeight]="400"
                  [itemIdFn]="getItemId"
                  [itemTemplate]="simplifiedItemTpl"
                  (drop)="onDropSimplified($event)"
                />
              </div>

              <div class="list-card">
                <div class="list-header">
                  <h3 class="list-title">List 2</h3>
                  <span class="list-badge">{{ list2().length }}</span>
                </div>
                <vdnd-sortable-list
                  class="list"
                  droppableId="list-2"
                  group="demo"
                  [items]="list2()"
                  [itemHeight]="50"
                  [containerHeight]="400"
                  [itemIdFn]="getItemId"
                  [itemTemplate]="simplifiedItemTpl"
                  (drop)="onDropSimplified($event)"
                />
              </div>
            </div>
          } @else {
            <!-- VERBOSE API -->
            <div class="lists-container">
              <ng-template #itemTpl let-item let-index="index">
                <div
                  class="item"
                  [class.use-handle]="useDragHandle()"
                  [style.--item-color]="item.color"
                  vdndDraggable="{{ item.id }}"
                  vdndDraggableGroup="demo"
                  [vdndDraggableData]="item"
                  [lockAxis]="lockAxis()"
                  [disabled]="!dragEnabled()"
                  [dragDelay]="dragDelay()"
                  [dragHandle]="useDragHandle() ? '.item-handle' : undefined"
                >
                  <span class="item-handle">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.5" />
                      <circle cx="15" cy="6" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="18" r="1.5" />
                      <circle cx="15" cy="18" r="1.5" />
                    </svg>
                  </span>
                  <span class="item-text">{{ item.name }}</span>
                </div>
              </ng-template>

              <div class="list-card">
                <div class="list-header">
                  <h3 class="list-title">List 1</h3>
                  <span class="list-badge">{{ list1().length }}</span>
                </div>
                <div
                  class="list"
                  vdndDroppable="list-1"
                  vdndDroppableGroup="demo"
                  (drop)="onDrop($event, 'list1')"
                >
                  <vdnd-virtual-scroll
                    class="virtual-scroll-container"
                    droppableId="list-1"
                    [items]="list1()"
                    [itemHeight]="50"
                    [stickyItemIds]="stickyIds()"
                    [itemIdFn]="getItemId"
                    [trackByFn]="trackById"
                    [itemTemplate]="itemTpl"
                  />
                </div>
              </div>

              <div class="list-card">
                <div class="list-header">
                  <h3 class="list-title">List 2</h3>
                  <span class="list-badge">{{ list2().length }}</span>
                </div>
                <div
                  class="list"
                  vdndDroppable="list-2"
                  vdndDroppableGroup="demo"
                  (drop)="onDrop($event, 'list2')"
                >
                  <vdnd-virtual-scroll
                    class="virtual-scroll-container"
                    droppableId="list-2"
                    [items]="list2()"
                    [itemHeight]="50"
                    [stickyItemIds]="stickyIds()"
                    [itemIdFn]="getItemId"
                    [trackByFn]="trackById"
                    [itemTemplate]="itemTpl"
                  />
                </div>
              </div>
            </div>
          }
        </section>

        <!-- Debug Panel -->
        <section class="debug-panel" [class.expanded]="debugExpanded()">
          <button
            type="button"
            class="debug-header"
            (click)="toggleDebug()"
            [attr.aria-expanded]="debugExpanded()"
            aria-controls="debug-content"
          >
            <h3 class="debug-title">
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              Debug State
            </h3>
            <span class="debug-toggle" [class.collapsed]="!debugExpanded()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </button>
          @if (debugExpanded()) {
            <pre class="debug-content drag-state">{{ debugState() | json }}</pre>
          }
        </section>
      </main>

      <!-- Drag Preview -->
      <vdnd-drag-preview />
    </div>
  `,
  styles: `
    /* ========================================
       Design System - CSS Variables
       ======================================== */
    :host {
      /* Colors */
      --color-bg: #f8fafc;
      --color-surface: #ffffff;
      --color-border: #e2e8f0;
      --color-border-hover: #cbd5e1;
      --color-text: #1e293b;
      --color-text-muted: #64748b;
      --color-text-subtle: #94a3b8;
      --color-primary: #6366f1;
      --color-primary-hover: #4f46e5;
      --color-primary-light: #eef2ff;
      --color-success: #10b981;
      --color-success-light: #d1fae5;

      /* Spacing */
      --space-xs: 4px;
      --space-sm: 8px;
      --space-md: 16px;
      --space-lg: 24px;
      --space-xl: 32px;
      --space-2xl: 48px;

      /* Typography */
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
      --text-xs: 0.75rem;
      --text-sm: 0.875rem;
      --text-base: 1rem;
      --text-lg: 1.125rem;
      --text-xl: 1.25rem;
      --text-2xl: 1.5rem;

      /* Effects */
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --radius-sm: 6px;
      --radius: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --transition: 150ms ease;

      display: block;
      font-family: var(--font-sans);
      color: var(--color-text);
      background: var(--color-bg);
      min-height: 100vh;
    }

    /* ========================================
       Layout
       ======================================== */
    .demo-page {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .main {
      flex: 1;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    /* ========================================
       Header
       ======================================== */
    .header {
      background: linear-gradient(135deg, var(--color-primary) 0%, #8b5cf6 100%);
      color: white;
      padding: var(--space-xl) var(--space-lg);
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .logo-icon {
      width: 32px;
      height: 32px;
    }

    .logo-text {
      font-size: var(--text-2xl);
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .tagline {
      margin: 0;
      font-size: var(--text-base);
      opacity: 0.9;
    }

    .demo-link {
      display: inline-block;
      margin-top: var(--space-md);
      padding: var(--space-sm) var(--space-md);
      background: rgba(255, 255, 255, 0.15);
      border-radius: var(--radius);
      color: white;
      text-decoration: none;
      font-size: var(--text-sm);
      transition: background 0.2s;
    }

    .demo-link:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* ========================================
       Settings Panel
       ======================================== */
    .settings-panel {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-md) var(--space-lg);
      background: none;
      border: none;
      cursor: pointer;
      user-select: none;
      transition: background var(--transition);
      font: inherit;
      color: inherit;
      text-align: left;

      &:hover {
        background: var(--color-bg);
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }
    }

    .settings-title {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: 0;
      font-size: var(--text-base);
      font-weight: 600;
    }

    .settings-toggle {
      width: 24px;
      height: 24px;
      color: var(--color-text-muted);
      transition: transform var(--transition);

      &.collapsed {
        transform: rotate(-90deg);
      }

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .settings-content {
      padding: 0 var(--space-lg) var(--space-lg);
      border-top: 1px solid var(--color-border);
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-lg);
      padding-top: var(--space-md);
    }

    .setting-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .setting-group-title {
      font-size: var(--text-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      margin: 0 0 var(--space-xs) 0;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .setting-label {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .setting-hint {
      font-size: var(--text-xs);
      color: var(--color-text-subtle);
      margin: var(--space-xs) 0 0;

      code {
        background: var(--color-bg);
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 0.7rem;
      }
    }

    /* ========================================
       Form Controls
       ======================================== */
    .input,
    .select {
      height: 36px;
      padding: 0 var(--space-sm);
      font-size: var(--text-sm);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      transition:
        border-color var(--transition),
        box-shadow var(--transition);

      &:hover {
        border-color: var(--color-border-hover);
      }

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px var(--color-primary-light);
      }
    }

    .input {
      width: 100%;
    }

    .select {
      width: 100%;
      cursor: pointer;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      cursor: pointer;
      padding: var(--space-xs) 0;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      border-radius: var(--radius-sm);
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .checkbox-text {
      font-size: var(--text-sm);
      color: var(--color-text);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-xs);
      height: 36px;
      padding: 0 var(--space-md);
      font-size: var(--text-sm);
      font-weight: 500;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      transition: all var(--transition);

      .icon {
        width: 16px;
        height: 16px;
      }
    }

    .btn-secondary {
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);

      &:hover {
        background: var(--color-border);
      }
    }

    .toggle-group {
      display: flex;
      background: var(--color-bg);
      border-radius: var(--radius);
      padding: 3px;
    }

    .toggle-btn {
      flex: 1;
      height: 32px;
      font-size: var(--text-sm);
      font-weight: 500;
      border: none;
      border-radius: calc(var(--radius) - 2px);
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all var(--transition);

      &:hover:not(.active) {
        color: var(--color-text);
      }

      &.active {
        background: var(--color-surface);
        color: var(--color-text);
        box-shadow: var(--shadow-sm);
      }
    }

    .icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    /* ========================================
       Lists Section
       ======================================== */
    .lists-section {
      flex: 1;
    }

    .lists-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-lg);
    }

    .list-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .list-title {
      margin: 0;
      font-size: var(--text-base);
      font-weight: 600;
    }

    .list-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 var(--space-sm);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-primary);
      background: var(--color-primary-light);
      border-radius: 999px;
    }

    .list {
      border-radius: 0;
      overflow: hidden;
      transition: background var(--transition);

      &.vdnd-droppable-active {
        background: var(--color-success-light);
      }
    }

    .virtual-scroll-container {
      height: 400px;
    }

    /* ========================================
       List Items
       ======================================== */
    .item {
      height: 50px;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 0 var(--space-md);
      background: linear-gradient(
        135deg,
        var(--item-color) 0%,
        color-mix(in srgb, var(--item-color) 80%, white) 100%
      );
      border-bottom: 1px solid rgb(0 0 0 / 0.06);
      cursor: grab;
      user-select: none;
      transition:
        filter var(--transition),
        transform var(--transition);

      &:hover {
        filter: brightness(0.97);
      }

      &:active {
        cursor: grabbing;
      }

      &.vdnd-draggable-disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      /* Ready-to-drag state (delay has passed) */
      &.vdnd-drag-pending {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
        z-index: 1;

        .item-handle {
          color: var(--color-primary);
          transform: scale(1.1);
        }
      }

      /* Handle-only drag mode */
      &.use-handle {
        cursor: default;

        .item-handle {
          cursor: grab;
          transition:
            color var(--transition),
            transform var(--transition);

          &:hover {
            color: var(--color-primary);
            transform: scale(1.1);
          }

          &:active {
            cursor: grabbing;
          }
        }
      }
    }

    .item-handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: rgb(0 0 0 / 0.3);
      flex-shrink: 0;

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .item-text {
      font-size: var(--text-sm);
      font-weight: 500;
      color: rgb(0 0 0 / 0.8);
    }

    /* ========================================
       Debug Panel
       ======================================== */
    .debug-panel {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .debug-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: var(--space-md) var(--space-lg);
      background: none;
      border: none;
      cursor: pointer;
      user-select: none;
      transition: background var(--transition);
      font: inherit;
      color: inherit;
      text-align: left;

      &:hover {
        background: var(--color-bg);
      }

      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: -2px;
      }
    }

    .debug-title {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin: 0;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .debug-toggle {
      width: 20px;
      height: 20px;
      color: var(--color-text-subtle);
      transition: transform var(--transition);

      &.collapsed {
        transform: rotate(-90deg);
      }

      svg {
        width: 100%;
        height: 100%;
      }
    }

    .debug-content {
      margin: 0;
      padding: var(--space-md) var(--space-lg);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      line-height: 1.6;
      color: var(--color-text-muted);
      background: var(--color-bg);
      border-top: 1px solid var(--color-border);
      overflow-x: auto;
    }

    /* ========================================
       Responsive
       ======================================== */
    @media (max-width: 768px) {
      .lists-container {
        grid-template-columns: 1fr;
      }

      .settings-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DemoComponent {
  readonly #dragState = inject(DragStateService);

  /** Number of items to generate */
  readonly itemCount = signal(100);

  /** Axis lock setting for drag operations */
  readonly lockAxis = signal<'x' | 'y' | null>(null);

  /** Whether drag-and-drop is enabled */
  readonly dragEnabled = signal(true);

  /** Delay in milliseconds before drag starts */
  readonly dragDelay = signal(0);

  /** Whether to use drag handle (only handle initiates drag) */
  readonly useDragHandle = signal(false);

  /** Whether to use the simplified API (VirtualSortableListComponent + moveItem) */
  readonly useSimplifiedApi = signal(false);

  /** Whether settings panel is expanded */
  readonly settingsExpanded = signal(true);

  /** Whether debug panel is expanded */
  readonly debugExpanded = signal(true);

  /** List 1 items */
  readonly list1 = signal<Item[]>([]);

  /** List 2 items */
  readonly list2 = signal<Item[]>([]);

  /** IDs of items that should always be rendered (dragged item needs to stay for reference) */
  readonly stickyIds = computed(() => {
    const draggedItem = this.#dragState.draggedItem();
    return draggedItem ? [draggedItem.draggableId] : [];
  });

  /** Debug state for display */
  readonly debugState = computed(() => {
    const state = this.#dragState.state();
    return {
      isDragging: state.isDragging,
      draggedItemId: state.draggedItem?.draggableId ?? null,
      sourceDroppable: state.sourceDroppableId,
      activeDroppable: state.activeDroppableId,
      placeholder: state.placeholderId,
      placeholderIndex: state.placeholderIndex,
    };
  });

  constructor() {
    this.regenerateItems();
  }

  /** Toggle settings panel */
  toggleSettings(): void {
    this.settingsExpanded.update((v) => !v);
  }

  /** Toggle debug panel */
  toggleDebug(): void {
    this.debugExpanded.update((v) => !v);
  }

  /** Generate a random color */
  private randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 85%)`;
  }

  /** Generate items for both lists */
  regenerateItems(): void {
    const count = this.itemCount();
    const half = Math.floor(count / 2);

    const items1: Item[] = [];
    for (let i = 0; i < half; i++) {
      items1.push({
        id: `list1-${i}`,
        name: `Item ${i + 1}`,
        color: this.randomColor(),
      });
    }

    const items2: Item[] = [];
    for (let i = 0; i < count - half; i++) {
      items2.push({
        id: `list2-${i}`,
        name: `Item ${i + 1}`,
        color: this.randomColor(),
      });
    }

    this.list1.set(items1);
    this.list2.set(items2);
  }

  /** Update item count from input */
  updateItemCount(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value > 0) {
      this.itemCount.set(value);
    }
  }

  /** Update axis lock setting from select */
  updateLockAxis(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.lockAxis.set(value === 'x' || value === 'y' ? value : null);
  }

  /** Toggle drag enabled setting */
  toggleDragEnabled(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.dragEnabled.set(checkbox.checked);
  }

  /** Update drag delay from input */
  updateDragDelay(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    if (!isNaN(value) && value >= 0) {
      this.dragDelay.set(value);
    }
  }

  /** Toggle drag handle setting */
  toggleDragHandle(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.useDragHandle.set(checkbox.checked);
  }

  /** Handle drop events (verbose API) */
  onDrop(event: DropEvent, targetList: 'list1' | 'list2'): void {
    const sourceList = event.source.droppableId === 'list-1' ? 'list1' : 'list2';
    const item = event.source.data as Item;

    if (!item) {
      return;
    }

    // Remove from source
    if (sourceList === 'list1') {
      this.list1.update((items) => items.filter((i) => i.id !== item.id));
    } else {
      this.list2.update((items) => items.filter((i) => i.id !== item.id));
    }

    // Add to destination
    const destIndex = event.destination.index;
    if (targetList === 'list1') {
      this.list1.update((items) => {
        const newItems = [...items];
        newItems.splice(destIndex, 0, item);
        return newItems;
      });
    } else {
      this.list2.update((items) => {
        const newItems = [...items];
        newItems.splice(destIndex, 0, item);
        return newItems;
      });
    }
  }

  /**
   * Handle drop events (simplified API).
   * Uses the moveItem utility - just ONE line of code!
   */
  onDropSimplified(event: DropEvent): void {
    moveItem(event, {
      'list-1': this.list1,
      'list-2': this.list2,
    });
  }

  /** Track by function for items */
  readonly trackById = (_index: number, item: Item): string => {
    return item.id;
  };

  /** Get item ID */
  readonly getItemId = (item: Item): string => {
    return item.id;
  };
}
