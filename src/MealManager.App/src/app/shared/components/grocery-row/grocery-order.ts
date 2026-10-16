import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

export function moveGrocery<T extends { id: string; atHome: boolean }>(
  neededItems: T[],
  atHomeItems: T[],
  item: T,
  direction: -1 | 1,
) {
  const needed = [...neededItems];
  const atHome = [...atHomeItems];
  const source = item.atHome ? atHome : needed;
  const sourceIndex = source.findIndex((candidate) => candidate.id === item.id);
  if (sourceIndex < 0) return null;
  let position = sourceIndex + direction;
  if (position >= 0 && position < source.length) {
    moveItemInArray(source, sourceIndex, position);
  } else if (!item.atHome && direction > 0 && sourceIndex === needed.length - 1) {
    transferArrayItem(needed, atHome, sourceIndex, 0);
    position = 0;
  } else if (item.atHome && direction < 0 && sourceIndex === 0) {
    transferArrayItem(atHome, needed, sourceIndex, needed.length);
    position = needed.length - 1;
  } else {
    return null;
  }
  return {
    needed: needed.map((item) => ({ ...item, atHome: false })),
    atHome: atHome.map((item) => ({ ...item, atHome: true })),
    position,
  };
}

export function dropGrocery<T extends { id: string; atHome: boolean }>(
  neededItems: T[],
  atHomeItems: T[],
  sameSection: boolean,
  targetAtHome: boolean,
  previousIndex: number,
  currentIndex: number,
) {
  const needed = [...neededItems];
  const atHome = [...atHomeItems];
  const target = targetAtHome ? atHome : needed;
  if (sameSection) moveItemInArray(target, previousIndex, currentIndex);
  else transferArrayItem(targetAtHome ? needed : atHome, target, previousIndex, currentIndex);
  return {
    needed: needed.map((item) => ({ ...item, atHome: false })),
    atHome: atHome.map((item) => ({ ...item, atHome: true })),
  };
}
