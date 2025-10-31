import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ContainerId } from './types';

export interface SortableItemProps {
  id: string;
  label: string;
  category: string;
  containerId: ContainerId;
  onClick?: (id: string) => void;
}

export function SortableItem({ id, label, category, containerId, onClick }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: 'unit', containerId } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : undefined,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      onClick={() => onClick?.(id)}
      className="w-full text-left"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 shadow-sm transition hover:bg-slate-700">
        <span className="font-semibold text-slate-100">{label}</span>
        <span className="rounded-full bg-slate-900/70 px-2 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
          {category}
        </span>
      </div>
    </button>
  );
}
