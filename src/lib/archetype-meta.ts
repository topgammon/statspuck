// Archetype names and their plain-English descriptions. No data imports, so any component can use them.

export type Archetype =
  | "Sniper"
  | "Playmaker"
  | "Power Forward"
  | "Two-Way Forward"
  | "Depth Grinder"
  | "Puck-Moving D"
  | "Two-Way D"
  | "Shutdown D"
  | "Workhorse Starter"
  | "Tandem / 1B"
  | "Backup";

export const ARCHETYPE_TIP: Record<Archetype, string> = {
  Sniper: "Goal-first scorer: a high share of his points are goals, with a high shot volume.",
  Playmaker: "Sets up teammates: a high share of his points are assists, with real power-play usage.",
  "Power Forward": "6'2\" or 205+ lbs, and he backs it up with shots, penalty minutes or scoring.",
  "Two-Way Forward": "Heavy penalty-kill minutes, strong faceoffs and a positive plus-minus.",
  "Depth Grinder": "Bottom-six energy role: modest minutes, with penalty-kill or physical usage.",
  "Puck-Moving D": "Offensive defenseman: high points per game and power-play time.",
  "Two-Way D": "Balanced offense with heavy even-strength and penalty-kill minutes.",
  "Shutdown D": "Penalty-kill workhorse who blocks a lot of shots and takes the tough matchups.",
  "Workhorse Starter": "Starts 55 or more games a year.",
  "Tandem / 1B": "Shares the net: roughly 30 to 54 starts a year.",
  Backup: "Fewer than 30 starts a year.",
};
