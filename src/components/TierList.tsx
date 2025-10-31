import { type ReactNode, useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import data from '../data.json';
import { TIERS, type TierId } from '../tiers';
import { SortableItem } from './SortableItem';
import type { ContainerId } from './types';

const STORAGE_KEY = 'btd6-tier-list';

type UnitCategory = 'Tower' | 'Hero' | 'Paragon';

interface Unit {
  id: string;
  name: string;
  category: UnitCategory;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const createUnit = (name: string, category: UnitCategory): Unit => ({
  id: `${category.toLowerCase().replace(/\s+/g, '-')}-${slugify(name)}`,
  name,
  category,
});

const allUnits: Unit[] = [
  ...data.towers.map((name) => createUnit(name, 'Tower')),
  ...data.heroes.map((name) => createUnit(name, 'Hero')),
  ...data.paragons.map((name) => createUnit(name, 'Paragon')),
];

const unitLookup: Record<string, Unit> = Object.fromEntries(
  allUnits.map((unit) => [unit.id, unit])
);

const initialState = (): Record<ContainerId, string[]> => {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<ContainerId, string[]>;
        const validKeys = new Set<ContainerId>(['unassigned', ...TIERS]);
        const filtered: Record<ContainerId, string[]> = {
          unassigned: [],
          ...Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])),
        } as Record<ContainerId, string[]>;

        for (const key of Object.keys(parsed) as ContainerId[]) {
          if (!validKeys.has(key)) continue;
          filtered[key] = parsed[key].filter((unitId) => unitLookup[unitId]);
        }

        const seen = new Set<string>();
        for (const container of Object.keys(filtered) as ContainerId[]) {
          filtered[container] = filtered[container].filter((unitId) => {
            if (seen.has(unitId)) return false;
            seen.add(unitId);
            return true;
          });
        }

        for (const unit of allUnits) {
          if (!seen.has(unit.id)) {
            filtered.unassigned.push(unit.id);
          }
        }

        return filtered;
      } catch (error) {
        console.warn('Failed to parse saved tier list. Resetting to defaults.', error);
      }
    }
  }

  return {
    unassigned: allUnits.map((unit) => unit.id),
    ...Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])),
  } as Record<ContainerId, string[]>;
};

const tierStyles: Record<TierId, string> = {
  S: 'border-amber-400/60 bg-amber-500/10',
  A: 'border-emerald-400/60 bg-emerald-500/10',
  B: 'border-sky-400/60 bg-sky-500/10',
  C: 'border-violet-400/60 bg-violet-500/10',
  D: 'border-rose-400/60 bg-rose-500/10',
};

export function TierList() {
  const [items, setItems] = useState<Record<ContainerId, string[]>>(initialState);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findContainer = (id: string | ContainerId | undefined): ContainerId | undefined => {
    if (!id) return undefined;
    if (id === 'unassigned') return 'unassigned';
    if (TIERS.includes(id as TierId)) return id as TierId;

    return (['unassigned', ...TIERS] as ContainerId[]).find((containerId) =>
      items[containerId].includes(id as string)
    );
  };

  const moveUnit = (unitId: string, target: ContainerId) => {
    setItems((prev) => {
      const source = (['unassigned', ...TIERS] as ContainerId[]).find((containerId) =>
        prev[containerId].includes(unitId)
      );

      if (source === target) {
        return prev;
      }

      const next: Record<ContainerId, string[]> = {
        ...prev,
        [target]: prev[target].filter((id) => id !== unitId),
      } as Record<ContainerId, string[]>;

      if (source) {
        next[source] = prev[source].filter((id) => id !== unitId);
      }

      next[target] = [...next[target], unitId];

      return next;
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) {
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overId = over.id as string;
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) {
      return;
    }

    const overData = over.data.current as { type?: string } | undefined;

    if (activeContainer === overContainer) {
      if (overData?.type === 'container') {
        return;
      }

      const activeIndex = items[activeContainer].indexOf(active.id as string);
      const overIndex = items[overContainer].indexOf(over.id as string);

      if (activeIndex !== overIndex && activeIndex !== -1 && overIndex !== -1) {
        setItems((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
        }));
      }

      return;
    }

    setItems((prev) => {
      const next: Record<ContainerId, string[]> = {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((id) => id !== active.id),
      } as Record<ContainerId, string[]>;

      const overItems = prev[overContainer];
      const insertAt =
        overData?.type === 'unit'
          ? overItems.indexOf(over.id as string)
          : overItems.length;
      const normalizedIndex = insertAt >= 0 ? insertAt : overItems.length;
      next[overContainer] = [
        ...overItems.slice(0, normalizedIndex),
        active.id as string,
        ...overItems.slice(normalizedIndex),
      ];

      return next;
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const handleFallbackAssign = (unitId: string) => {
    if (typeof window === 'undefined') return;

    const currentContainer = findContainer(unitId);
    const response = window.prompt(
      `Assign "${unitLookup[unitId].name}" to tier (S, A, B, C, D) or "unassigned"`,
      currentContainer && currentContainer !== 'unassigned' ? currentContainer : ''
    );

    if (!response) {
      return;
    }

    const normalized = response.trim().toUpperCase();
    let target: ContainerId | undefined;

    if (!normalized) {
      return;
    }

    if (normalized === 'UNASSIGNED' || normalized === 'NONE' || normalized === 'POOL') {
      target = 'unassigned';
    } else if (TIERS.includes(normalized as TierId)) {
      target = normalized as TierId;
    }

    if (!target) {
      window.alert(`Unknown tier "${response}". Valid options: ${['unassigned', ...TIERS].join(', ')}`);
      return;
    }

    moveUnit(unitId, target);
  };

  const resetTierList = () => {
    setItems({
      unassigned: allUnits.map((unit) => unit.id),
      ...Object.fromEntries(TIERS.map((tier) => [tier, [] as string[]])),
    } as Record<ContainerId, string[]>);
  };

  const exportTierList = async () => {
    const payload = JSON.stringify({
      updatedAt: new Date().toISOString(),
      tiers: Object.fromEntries(
        (['unassigned', ...TIERS] as ContainerId[]).map((key) => [
          key,
          items[key].map((unitId) => unitLookup[unitId]?.name ?? unitId),
        ])
      ),
    }, null, 2);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        window.alert('Tier list copied to clipboard as JSON.');
        return;
      }
    } catch (error) {
      console.warn('Failed to write to clipboard', error);
    }

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'btd6-tier-list.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const totalUnits = allUnits.length;
  const placedCount = totalUnits - items.unassigned.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <header className="space-y-4 text-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Bloons TD 6 Tier Lab</h1>
            <p className="max-w-2xl text-sm text-slate-300">
              Drag heroes, towers, and paragons into each tier or tap to reassign when drag-and-drop
              is not available. Your layout is saved locally so you can iterate and share.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetTierList}
              className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={exportTierList}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Export JSON
            </button>
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          {totalUnits} units loaded • {placedCount} assigned to tiers
        </p>
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          <DroppableColumn
            id="unassigned"
            title="Unassigned Pool"
            description="Everything starts here. Drag or click a unit to place it into a tier."
            itemCount={items.unassigned.length}
          >
            <SortableContext
              id="unassigned"
              items={items.unassigned}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.unassigned.map((unitId) => {
                  const unit = unitLookup[unitId];
                  return (
                    <SortableItem
                      key={unitId}
                      id={unitId}
                      label={unit.name}
                      category={unit.category}
                      containerId="unassigned"
                      onClick={handleFallbackAssign}
                    />
                  );
                })}
                {items.unassigned.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/40 px-3 py-4 text-center text-sm text-slate-500">
                    Everything is assigned — great work!
                  </p>
                )}
              </div>
            </SortableContext>
          </DroppableColumn>

          <div className="space-y-4">
            {TIERS.map((tier) => (
              <DroppableColumn
                key={tier}
                id={tier}
                title={`${tier} Tier`}
                accentClass={tierStyles[tier]}
                description={`High impact units belong in ${tier}.`}
                itemCount={items[tier].length}
              >
                <SortableContext id={tier} items={items[tier]} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items[tier].map((unitId) => {
                      const unit = unitLookup[unitId];
                      return (
                        <SortableItem
                          key={unitId}
                          id={unitId}
                          label={unit.name}
                          category={unit.category}
                          containerId={tier}
                          onClick={handleFallbackAssign}
                        />
                      );
                    })}
                    {items[tier].length === 0 && (
                      <p className="rounded-lg border border-dashed border-slate-700/80 bg-slate-900/40 px-3 py-4 text-center text-sm text-slate-500">
                        Drop or assign units here
                      </p>
                    )}
                  </div>
                </SortableContext>
              </DroppableColumn>
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

interface DroppableColumnProps {
  id: ContainerId;
  title: string;
  description?: string;
  itemCount: number;
  accentClass?: string;
  children: ReactNode;
}

function DroppableColumn({ id, title, description, itemCount, accentClass, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'container', containerId: id } });

  return (
    <section
      ref={setNodeRef}
      className={`flex h-full flex-col gap-3 rounded-2xl border-2 border-slate-700/80 bg-slate-900/60 p-4 shadow-lg transition ${
        isOver ? 'border-sky-400/80 bg-slate-900/80' : ''
      } ${accentClass ?? ''}`}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {description ? <p className="text-xs text-slate-400">{description}</p> : null}
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{itemCount} units</span>
      </header>
      <div className="flex flex-1 flex-col">
        {itemCount === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full">{children}</div>
          </div>
        ) : (
          <div className="w-full">{children}</div>
        )}
      </div>
    </section>
  );
}
