// The six core StatsPuck tools. Used by the home page cards, the Tools dropdown and the menu drawer.

export type ModuleStatus = "LIVE NOW" | "UP NEXT" | "COMING SOON";

export type ModuleInfo = {
  name: string;
  status: ModuleStatus;
  blurb: string;
  href: string;
  live: boolean;
  icon: "draft" | "path" | "trade" | "edge" | "ref" | "board";
  /** False keeps it off the home page tool grid (menu only). */
  onHome?: boolean;
  /** Sub-pages shown in the menu drawer. */
  links?: { href: string; label: string }[];
};

export const modules: ModuleInfo[] = [
  {
    name: "Draft Rater",
    status: "LIVE NOW",
    href: "/draft-rater",
    live: true,
    icon: "draft",
    blurb: "Every NHL pick since 2005 graded on Impact vs. draft slot.",
    links: [
      { href: "/draft-rater", label: "Board" },
      { href: "/draft-rater/drafts", label: "Drafts" },
      { href: "/draft-rater/methodology", label: "Method" },
    ],
  },
  {
    name: "Development Path",
    status: "LIVE NOW",
    href: "/development",
    live: true,
    icon: "path",
    blurb: "League-by-league routes to the NHL and the teams that develop best.",
  },
  {
    name: "Trade Machine",
    status: "LIVE NOW",
    href: "/trade-machine",
    live: true,
    icon: "trade",
    blurb: "Every player and pick on one 0–100 Asset Value scale, with live cap checks.",
    links: [
      { href: "/trade-machine", label: "Mock Trade" },
      { href: "/trade-machine/rater", label: "Trade Rater" },
      { href: "/trade-machine/trees", label: "Trade Trees" },
    ],
  },
  {
    name: "UFA & RFA Tracker",
    status: "LIVE NOW",
    href: "/ufa-tracker",
    live: true,
    icon: "trade",
    onHome: false,
    blurb: "Next summer's free agents with projected next contracts from comparable deals.",
  },
  {
    name: "Game Edge",
    status: "COMING SOON",
    href: "/game-edge",
    live: false,
    icon: "edge",
    blurb: "Goal types, line chemistry, goalie tendencies and pregame matchup edges.",
  },
  {
    name: "Ref Watch",
    status: "COMING SOON",
    href: "/ref-watch",
    live: false,
    icon: "ref",
    blurb: "Referee crew tendencies, penalty differentials and a pregame Ref Edge.",
  },
  {
    name: "Leaderboards",
    status: "LIVE NOW",
    href: "/leaderboards",
    live: true,
    icon: "board",
    blurb: "Skill, contracts, steals, teams and GMs. Every row clicks through.",
  },
];

/** The five tools in the Tools dropdown (Leaderboards has its own nav link). */
export const tools = modules.filter((item) => item.icon !== "board");
