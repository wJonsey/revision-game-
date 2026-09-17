/**
 * Original player classes. Abilities support learning (hints, eliminating options,
 * second attempts) as well as movement and combat.
 *
 * Ability effect kinds used by the game:
 *   revealEnemies, revealObjectives, speedBoost, damageReduction, stunPulse   (combat, cooldown in seconds)
 *   questionAid: eliminate | hint | retry | extraTime | noPenalty             (ultimate, charged by correct answers)
 * Passive kinds: xpBonusTypes, xpBonusWeak, shieldOnStreak, shieldOnRetryCorrect, shieldOnDoor
 */
export const CLASSES = [
  {
    id: "developer",
    name: "The Developer",
    focus: "Programming",
    colour: "#3ddbd9",
    passive: { name: "Syntax Sense", description: "+15% XP on predict-the-output and fill-in-the-blank questions.", kind: "xpBonusTypes", types: ["predict_output", "fill_blank"], multiplier: 1.15 },
    basic: { name: "Debug Scan", description: "Reveal every drone on the minimap for 8 seconds.", kind: "revealEnemies", duration: 8, cooldown: 20 },
    tactical: { name: "Code Boost", description: "Move 60% faster for 5 seconds.", kind: "speedBoost", duration: 5, multiplier: 1.6, cooldown: 25 },
    ultimate: { name: "Syntax Shield", description: "Your next question: remove two wrong options (multiple choice) and a wrong answer costs no shield.", kind: "questionAid", aids: ["eliminate", "noPenalty"], charge: 4 },
  },
  {
    id: "analyst",
    name: "The Analyst",
    focus: "Algorithms, data and problem solving",
    colour: "#be95ff",
    passive: { name: "Pattern Recognition", description: "3 correct answers in a row restores 15 shield.", kind: "shieldOnStreak", streak: 3, amount: 15 },
    basic: { name: "Data Reveal", description: "Show every objective on the minimap for 10 seconds.", kind: "revealObjectives", duration: 10, cooldown: 20 },
    tactical: { name: "Logic Pulse", description: "Stun drones within 8 metres for 4 seconds.", kind: "stunPulse", radius: 8, duration: 4, cooldown: 30 },
    ultimate: { name: "Decompose", description: "Your next question shows the spec section and its common mistake before you answer.", kind: "questionAid", aids: ["hint"], charge: 3 },
  },
  {
    id: "tester",
    name: "The Tester",
    focus: "Testing, QA and debugging",
    colour: "#6fdc8c",
    passive: { name: "Regression Shield", description: "Correctly answering a question you previously got wrong restores 20 shield.", kind: "shieldOnRetryCorrect", amount: 20 },
    basic: { name: "Bug Scanner", description: "Reveal every drone on the minimap for 8 seconds.", kind: "revealEnemies", duration: 8, cooldown: 20 },
    tactical: { name: "Boundary Barrier", description: "Take 60% less damage for 6 seconds.", kind: "damageReduction", duration: 6, factor: 0.4, cooldown: 28 },
    ultimate: { name: "Test Suite", description: "If you get your next question wrong you may try it once more (it still counts as wrong for revision).", kind: "questionAid", aids: ["retry"], charge: 4 },
  },
  {
    id: "architect",
    name: "The Architect",
    focus: "Systems, design and architecture",
    colour: "#78a9ff",
    passive: { name: "Blueprint", description: "Correct answers at doors restore 10 shield.", kind: "shieldOnDoor", amount: 10 },
    basic: { name: "System Scan", description: "Show every objective on the minimap for 10 seconds.", kind: "revealObjectives", duration: 10, cooldown: 20 },
    tactical: { name: "Architecture Barrier", description: "Take no damage for 3 seconds.", kind: "damageReduction", duration: 3, factor: 0, cooldown: 30 },
    ultimate: { name: "Dependency Map", description: "Your next question shows a hint and removes two wrong options.", kind: "questionAid", aids: ["hint", "eliminate"], charge: 5 },
  },
  {
    id: "project-lead",
    name: "The Project Lead",
    focus: "ESP, requirements and planning",
    colour: "#ffb784",
    passive: { name: "Task Prioritisation", description: "+20% XP on questions from your weakest sections.", kind: "xpBonusWeak", threshold: 0.5, multiplier: 1.2 },
    basic: { name: "Requirement Reveal", description: "Show every objective on the minimap for 10 seconds.", kind: "revealObjectives", duration: 10, cooldown: 20 },
    tactical: { name: "Sprint Boost", description: "Move 50% faster for 6 seconds.", kind: "speedBoost", duration: 6, multiplier: 1.5, cooldown: 25 },
    ultimate: { name: "Stakeholder Review", description: "Your next timed question gets 60 extra seconds and a hint.", kind: "questionAid", aids: ["extraTime", "hint"], charge: 3 },
  },
];

export function getClass(classId) {
  return CLASSES.find((playerClass) => playerClass.id === classId) ?? CLASSES[0];
}
