/** Move a retained item without changing its identity or accepting out-of-range positions. */
export function moveItemInArray<T>(items: T[], from: number, to: number): void {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return;
  items.splice(to, 0, items.splice(from, 1)[0]);
}
