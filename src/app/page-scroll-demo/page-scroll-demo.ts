import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { add, arrowBack, checkmarkCircle, close, reorderThree } from 'ionicons/icons';
import {
  DraggableDirective,
  DragPreviewComponent,
  DropEvent,
  DroppableDirective,
  DroppableGroupDirective,
  ScrollableDirective,
  VirtualContentComponent,
  VirtualForDirective,
} from 'ngx-virtual-dnd';

interface Task {
  id: string;
  title: string;
  category: 'work' | 'personal' | 'urgent';
  done: boolean;
}

type CategoryFilter = 'all' | 'work' | 'personal' | 'urgent';

/**
 * Demo showing page-level scroll with header/footer and virtual list.
 *
 * Architecture:
 * - ion-content with scrollY=false (disabled native scroll)
 * - Custom scroll container with ion-content-scroll-host class
 * - vdndScrollable directive on the scroll container
 * - OffsetScrollAdapter wrapping the virtual list to account for header height
 */
@Component({
  selector: 'app-page-scroll-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonChip,
    IonCheckbox,
    IonBadge,
    IonIcon,
    ScrollableDirective,
    VirtualForDirective,
    DraggableDirective,
    DroppableDirective,
    DroppableGroupDirective,
    DragPreviewComponent,
    VirtualContentComponent,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    ion-header {
      flex-shrink: 0;
    }

    ion-content {
      --background: var(--ion-background-color, #f4f5f8);
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    ion-content::part(scroll) {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .scroll-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .page-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
    }

    .welcome-banner {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      position: relative;
    }

    .welcome-banner h2 {
      margin: 0 0 8px 0;
      font-size: 1.5rem;
    }

    .welcome-banner p {
      margin: 0;
      opacity: 0.9;
    }

    .welcome-banner .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      --background: transparent;
      --color: white;
    }

    .section-title {
      margin: 16px 0 12px 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .category-chips {
      position: sticky;
      top: 0;
      z-index: 100;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 12px 0;
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }

    .category-chips ion-chip {
      --background: rgba(255, 255, 255, 0.2);
      --color: white;
      flex-shrink: 0;
    }

    .category-chips ion-chip.active {
      --background: white;
      --color: #667eea;
    }

    .virtual-list-wrapper {
      position: relative;
      background: var(--ion-background-color, #f4f5f8);
    }

    .task-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: white;
      border-bottom: 1px solid #e0e0e0;
      height: 72px;
      box-sizing: border-box;
      cursor: grab;
    }

    .task-item:active {
      cursor: grabbing;
    }

    .task-item .drag-handle {
      color: #999;
      font-size: 24px;
    }

    .task-item .task-title {
      flex: 1;
      font-size: 1rem;
    }

    .task-item .task-title.done {
      text-decoration: line-through;
      opacity: 0.6;
    }

    .add-task-footer {
      padding: 16px;
      background: var(--ion-background-color, #f4f5f8);
    }

    .add-task-footer ion-button {
      --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    /* Drag preview styling */
    :host ::ng-deep .vdnd-drag-preview .task-item {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      transform: rotate(2deg);
    }

    .back-button {
      --color: white;
    }
  `,
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-button slot="start" fill="clear" class="back-button" routerLink="/">
          <ion-icon name="arrow-back" slot="icon-only"></ion-icon>
        </ion-button>
        <ion-title>Task Manager</ion-title>
      </ion-toolbar>
    </ion-header>

    <!-- ion-content with scroll disabled - we use our own scroll container -->
    <ion-content [scrollY]="false">
      <!-- Custom scroll container with Ionic's scroll host class -->
      <div #scrollContainer class="scroll-container ion-content-scroll-host" vdndScrollable>
        <!-- Header section that scrolls away -->
        <div class="page-header" #headerElement>
          @if (showBanner()) {
            <div class="welcome-banner">
              <ion-button fill="clear" class="close-btn" (click)="dismissBanner()">
                <ion-icon name="close" slot="icon-only"></ion-icon>
              </ion-button>
              <h2>Welcome Back!</h2>
              <p>You have {{ filteredTasks().length }} tasks to complete</p>
            </div>
          }

          <h3 class="section-title">My Tasks</h3>

          <!-- Sticky category filter -->
          <div class="category-chips">
            @for (cat of categories; track cat.value) {
              <ion-chip [class.active]="category() === cat.value" (click)="setCategory(cat.value)">
                {{ cat.label }}
              </ion-chip>
            }
          </div>
        </div>

        <!-- Virtual list with wrapper-based positioning -->
        <div vdndGroup="tasks">
          <vdnd-virtual-content
            class="virtual-list-wrapper"
            [itemHeight]="itemHeight"
            [totalItems]="filteredTasks().length"
            [contentOffset]="headerHeight()"
            [style.height.px]="filteredTasks().length * itemHeight"
            vdndDroppable="tasks"
            (drop)="onDrop($event)"
          >
            <ng-container
              *vdndVirtualFor="
                let task of filteredTasks();
                itemHeight: itemHeight;
                trackBy: trackById;
                droppableId: 'tasks'
              "
            >
              <div class="task-item" [vdndDraggable]="task.id">
                <ion-icon name="reorder-three" class="drag-handle"></ion-icon>
                <ion-checkbox [checked]="task.done" (ionChange)="toggleTask(task)"></ion-checkbox>
                <span class="task-title" [class.done]="task.done">
                  {{ task.title }}
                </span>
                <ion-badge [color]="getBadgeColor(task.category)">
                  {{ task.category }}
                </ion-badge>
              </div>
            </ng-container>
          </vdnd-virtual-content>
        </div>

        <!-- Footer that appears after list -->
        <div class="add-task-footer">
          <ion-button expand="block" (click)="addTask()">
            <ion-icon name="add" slot="start"></ion-icon>
            Add New Task
          </ion-button>
        </div>
      </div>
    </ion-content>

    <!-- Drag preview portal -->
    <vdnd-drag-preview>
      <ng-template let-item>
        <div
          class="task-item"
          style="width: 300px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2); border-radius: 8px; transform: rotate(2deg);"
        >
          <ion-icon name="reorder-three" class="drag-handle"></ion-icon>
          <span class="task-title">{{ item.title }}</span>
          <ion-badge [color]="getBadgeColor(item.category)">{{ item.category }}</ion-badge>
        </div>
      </ng-template>
    </vdnd-drag-preview>
  `,
})
export class PageScrollDemoComponent implements OnDestroy {
  readonly itemHeight = 72;

  readonly categories: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'work', label: 'Work' },
    { value: 'personal', label: 'Personal' },
    { value: 'urgent', label: 'Urgent' },
  ];

  // View queries
  readonly headerElement = viewChild.required<ElementRef<HTMLElement>>('headerElement');

  // State
  readonly showBanner = signal(true);
  readonly category = signal<CategoryFilter>('all');
  readonly tasks = signal<Task[]>(this.#generateTasks(150));

  // Header height for offset calculation
  readonly headerHeight = signal(0);

  // Filtered tasks based on category
  readonly filteredTasks = computed(() => {
    const cat = this.category();
    const allTasks = this.tasks();
    if (cat === 'all') return allTasks;
    return allTasks.filter((t) => t.category === cat);
  });

  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    addIcons({ add, arrowBack, checkmarkCircle, close, reorderThree });

    // Set up header height tracking after render
    afterNextRender(() => {
      const headerEl = this.headerElement().nativeElement;
      this.headerHeight.set(headerEl.offsetHeight);

      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Use borderBoxSize to avoid layout thrashing in Safari
          const height =
            entry.borderBoxSize?.[0]?.blockSize ?? (entry.target as HTMLElement).offsetHeight;
          this.headerHeight.set(height);
        }
      });
      this.#resizeObserver.observe(headerEl);
    });
  }

  ngOnDestroy(): void {
    this.#resizeObserver?.disconnect();
  }

  trackById = (_index: number, task: Task): string => task.id;

  setCategory(cat: CategoryFilter): void {
    this.category.set(cat);
  }

  dismissBanner(): void {
    this.showBanner.set(false);
  }

  toggleTask(task: Task): void {
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
    );
  }

  addTask(): void {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: `New Task ${this.tasks().length + 1}`,
      category: 'personal',
      done: false,
    };
    this.tasks.update((tasks) => [...tasks, newTask]);
  }

  getBadgeColor(category: Task['category']): string {
    switch (category) {
      case 'work':
        return 'primary';
      case 'personal':
        return 'secondary';
      case 'urgent':
        return 'danger';
    }
  }

  onDrop(event: DropEvent): void {
    const sourceIndex = event.source.index;
    const targetIndex = event.destination.index;
    if (sourceIndex === targetIndex) return;

    this.tasks.update((tasks) => {
      const result = [...tasks];
      const [removed] = result.splice(sourceIndex, 1);
      result.splice(targetIndex, 0, removed);
      return result;
    });
  }

  #generateTasks(count: number): Task[] {
    const categories: Task['category'][] = ['work', 'personal', 'urgent'];
    const taskNames = [
      'Review quarterly report',
      'Schedule team meeting',
      'Update project documentation',
      'Respond to client emails',
      'Prepare presentation slides',
      'Fix critical bug',
      'Code review for PR',
      'Update dependencies',
      'Write unit tests',
      'Deploy to staging',
      'Call with stakeholders',
      'Plan sprint backlog',
      'Research new framework',
      'Optimize database queries',
      'Create API documentation',
      'Set up CI/CD pipeline',
      'Review security audit',
      'Update user guide',
      'Mentor junior developer',
      'Attend standup meeting',
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: `task-${i}`,
      title: `${taskNames[i % taskNames.length]} #${Math.floor(i / taskNames.length) + 1}`,
      category: categories[i % 3],
      done: Math.random() > 0.8,
    }));
  }
}
