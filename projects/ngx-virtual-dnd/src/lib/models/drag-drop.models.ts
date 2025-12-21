/**
 * Represents the item currently being dragged.
 */
export interface DraggedItem {
  /** Unique identifier for the draggable item */
  draggableId: string;
  /** ID of the droppable container the item originated from */
  droppableId: string;
  /** Reference to the dragged element */
  element: HTMLElement;
  /** Height of the dragged element in pixels */
  height: number;
  /** Width of the dragged element in pixels */
  width: number;
  /** Optional user-provided data associated with the item */
  data?: unknown;
}

/**
 * Current position of the cursor during drag.
 */
export interface CursorPosition {
  x: number;
  y: number;
}

/**
 * Complete state of the drag-and-drop system.
 */
export interface DragState {
  /** Whether a drag operation is currently in progress */
  isDragging: boolean;
  /** Information about the item being dragged */
  draggedItem: DraggedItem | null;
  /** ID of the droppable where the drag started */
  sourceDroppableId: string | null;
  /** ID of the droppable currently being hovered over */
  activeDroppableId: string | null;
  /** ID of the item the placeholder should appear before, or 'END_OF_LIST' */
  placeholderId: string | null;
  /** Current cursor position */
  cursorPosition: CursorPosition | null;
}

/**
 * Event emitted when a drag operation starts.
 */
export interface DragStartEvent {
  /** Unique identifier for the draggable item */
  draggableId: string;
  /** ID of the droppable container the item originated from */
  droppableId: string;
  /** Optional user-provided data associated with the item */
  data?: unknown;
  /** Position where the drag started */
  position: CursorPosition;
}

/**
 * Event emitted during drag movement.
 */
export interface DragMoveEvent {
  /** Unique identifier for the draggable item */
  draggableId: string;
  /** ID of the droppable container the item originated from */
  sourceDroppableId: string;
  /** ID of the droppable currently being hovered, or null */
  targetDroppableId: string | null;
  /** ID of the item to insert before, or null */
  placeholderId: string | null;
  /** Current cursor position */
  position: CursorPosition;
}

/**
 * Event emitted when an item enters a droppable container.
 */
export interface DragEnterEvent {
  /** ID of the droppable being entered */
  droppableId: string;
  /** Information about the dragged item */
  draggedItem: DraggedItem;
}

/**
 * Event emitted when an item leaves a droppable container.
 */
export interface DragLeaveEvent {
  /** ID of the droppable being left */
  droppableId: string;
  /** Information about the dragged item */
  draggedItem: DraggedItem;
}

/**
 * Event emitted while hovering over a droppable container.
 */
export interface DragOverEvent {
  /** ID of the droppable being hovered */
  droppableId: string;
  /** Information about the dragged item */
  draggedItem: DraggedItem;
  /** ID of the item the placeholder should appear before */
  placeholderId: string | null;
  /** Current cursor position */
  position: CursorPosition;
}

/**
 * Source information for a drop event.
 */
export interface DropSource {
  /** Unique identifier for the draggable item */
  draggableId: string;
  /** ID of the droppable container the item originated from */
  droppableId: string;
  /** Original index in the source list */
  index: number;
  /** Optional user-provided data associated with the item */
  data?: unknown;
}

/**
 * Destination information for a drop event.
 */
export interface DropDestination {
  /** ID of the droppable container receiving the item */
  droppableId: string;
  /** ID of the item to insert before, or 'END_OF_LIST' */
  placeholderId: string;
  /** Target index in the destination list */
  index: number;
  /** Optional user-provided data associated with the droppable */
  data?: unknown;
}

/**
 * Event emitted when an item is dropped.
 */
export interface DropEvent {
  /** Information about where the item came from */
  source: DropSource;
  /** Information about where the item is going */
  destination: DropDestination;
}

/**
 * Event emitted when a drag operation ends (including cancel).
 */
export interface DragEndEvent {
  /** Unique identifier for the draggable item */
  draggableId: string;
  /** ID of the droppable container the item originated from */
  droppableId: string;
  /** Whether the drag was cancelled (escaped, dropped outside) */
  cancelled: boolean;
  /** Optional user-provided data associated with the item */
  data?: unknown;
}

/**
 * Initial state for the drag state service.
 */
export const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  draggedItem: null,
  sourceDroppableId: null,
  activeDroppableId: null,
  placeholderId: null,
  cursorPosition: null,
};

/**
 * Placeholder ID used when dropping at the end of a list.
 */
export const END_OF_LIST = 'END_OF_LIST';
