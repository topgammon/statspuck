// The six core StatsPuck modules. Used by the home page grid and the menu drawer.

export type ModuleStatus = "LIVE NOW" | "UP NEXT" | "COMING SOON";

export type ModuleInfo = {
  name: string;
  status: ModuleStatus;
  blurb: string;
  href?: string;
  cta?: string;
  icon: "draft" | "path" | "trade" | "luck" | "matchup" | "ref";
};

export const modules: ModuleInfo[] = [
  {
    name: "Draft Rater",
    status: "LIVE NOW",
    href: "/draft-rater",
    cta: "Open the board →",
    icon: "draft",
    blurb: "Every NHL pick since 2005 graded on two-way Impact vs. draft slot—separating scouting skill from lottery luck.",
  },
  {
    name: "Development Path",
    status: "LIVE NOW",
    href: "/development",
    cta: "Explore the pathways →",
    icon: "path",
    blurb: "Interactive CHL, NCAA, European & AHL-to-NHL pathways showing graduation odds and optimal routes by draft slot.",
  },
  {
    name: "Trade Machine",
    status: "LIVE NOW",
    href: "/trade-machine",
    cta: "Make a trade →",
    icon: "trade",
    blurb: "EA-style trade simulator: every player and pick on one 0–100 Asset Value scale, with live salary cap floor and ceiling checks.",
  },
  {
    name: "Luck Meter",
    status: "COMING SOON",
    icon: "luck",
    blurb: "Quantifying shooting/save luck, injury man-games lost, and linemate quality for every player, team, GM, and coach.",
  },
  {
    name: "Matchup Edge",
    status: "COMING SOON",
    icon: "matchup",
    blurb: "Goal-type breakdowns, goalie tendency heatmaps, and line chemistry reports for actionable pregame edges.",
  },
  {
    name: "Ref Rater",
    status: "COMING SOON",
    icon: "ref",
    blurb: "Referee crew transparency reports, penalty call tendencies, and team-specific pregame officiating edges.",
  },
];
