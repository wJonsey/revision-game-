/**
 * Fictional game ranks. These are progression labels only and are not
 * real-world professional qualifications or job titles.
 */
export const RANKS = [
  { name: "Trainee", minXp: 0 },
  { name: "Junior Developer", minXp: 1500 },
  { name: "Developer", minXp: 5000 },
  { name: "Senior Developer", minXp: 12000 },
  { name: "Software Engineer", minXp: 25000 },
  { name: "Systems Specialist", minXp: 45000 },
  { name: "Technical Architect", minXp: 75000 },
  { name: "Master Developer", minXp: 120000 },
];

export function rankFor(xp) {
  const safeXp = Math.max(0, xp);
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (safeXp >= RANKS[i].minXp) index = i;
  }
  const next = RANKS[index + 1];
  const progress = next ? (safeXp - RANKS[index].minXp) / (next.minXp - RANKS[index].minXp) : 1;
  return { ...RANKS[index], index, next: next ?? null, progress };
}

/** Player level: every level needs 100 XP more than the previous one. */
export function levelFor(xp) {
  let level = 1;
  let needed = 500;
  let remaining = Math.max(0, xp);
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed += 100;
  }
  return { level, intoLevel: remaining, needed };
}
