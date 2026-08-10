export function filterAvailableGigs<T extends { id: string }>(
  gigs: T[],
  appliedGigIds: Iterable<string>,
) {
  const applied = appliedGigIds instanceof Set ? appliedGigIds : new Set(appliedGigIds);
  return gigs.filter((gig) => !applied.has(gig.id));
}
