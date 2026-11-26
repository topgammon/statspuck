export type PickGroup = "F" | "D" | "G";

export type Stamp = "DEVELOPING" | "STALLED" | "BUST" | "STEAL" | "LATE BLOOMER" | "ELITE" | "RETIRED";

export type PickRow = {
  id: number;
  year: number;
  round: number;
  overall: number;
  team: string;
  franchise: string;
  teamName: string;
  franchiseName: string;
  pos: string;
  group: PickGroup;
  playerId: number | null;
  hasHeadshot: boolean;
  active: boolean | null;
  name: string;
  country: string | null;
  amateur: string | null;
  gpCareer: number;
  gp: number;
  goals: number | null;
  assists: number | null;
  points: number | null;
  ppg: number | null;
  savePct: number | null;
  gaa: number | null;
  draftPlus: number;
  qg: number;
  seasons: number[];
  expectedPath: number[];
  expected: number | null;
  score: number | null;
  milestone: number;
  developing: boolean;
  included: boolean;
  letter: string | null;
  rating: number | null;
  redraft: number;
  stamps: Stamp[];
  alsoDrafted: number[];
  /** A slot the league took away. Shown in the draft order, never graded, no profile page. */
  forfeited?: boolean;
  /** Current NHL team from today's rosters, or null if not on an NHL roster. */
  currentTeam?: string | null;
};

export type BriefPick = {
  id: number;
  name: string;
  year: number;
  round: number;
  overall: number;
  franchise: string;
  franchiseName: string;
  teamName: string;
  color: string;
  pos: string;
  group: PickGroup;
  gp: number;
  gpCareer: number;
  playerId: number | null;
  hasHeadshot: boolean;
  draftPlus: number;
  qg: number;
  expected: number | null;
  score: number | null;
  milestone: number;
  developing: boolean;
  included: boolean;
  letter: string | null;
  rating: number | null;
  redraft: number;
  stamps: Stamp[];
};

export type YearPoint = {
  year: number;
  avg: number;
  n: number;
  developing: number;
  rating: number | null;
  letter: string | null;
};

export type DevRound = {
  label: string;
  n: number;
  rate25: number | null;
  rate100: number | null;
  expected25: number | null;
  expected100: number | null;
  league25: number | null;
  league100: number | null;
};

/** Development Grade (Pillar 2). Dev Score is centered so 0.0 is the average NHL franchise. */
export type DevGrade = {
  avg: number;
  rating: number | null;
  letter: string | null;
  rank?: number;
  n: number;
  rounds: DevRound[];
  gems: { id: number; dev: number; q6: number }[];
};

export type TeamGrade = {
  dev?: DevGrade | null;
  abbr: string;
  name: string;
  short: string;
  color: string;
  avg: number;
  total: number;
  n: number;
  developing: number;
  best: BriefPick;
  worst: BriefPick;
  byYear: YearPoint[];
  rating: number;
  letter: string;
  rank: number;
};

export type Era = {
  id: number;
  slug: string;
  team: string;
  teamName: string;
  color: string;
  person: string;
  role: string;
  startYear: number;
  endYear: number | null;
  note: string;
  n: number;
  developing: number;
  avg: number | null;
  total: number | null;
  rating: number | null;
  letter: string | null;
  dev?: DevGrade | null;
  /** Wikimedia Commons photo, or null for the silhouette. */
  photoUrl?: string | null;
  /** Wikipedia page the photo came from, for credit. */
  photoPage?: string | null;
};

export type Headlines = {
  bestClass: {
    franchise: string;
    franchiseName: string;
    color: string;
    year: number;
    avg: number;
    n: number;
    letter: string | null;
    rating: number | null;
  };
  steal: BriefPick;
  bust: BriefPick;
};

export type FitSummary = {
  model: string;
  sigma: number | null;
  mae: number;
  alternate: string;
  alternateSigma: number | null;
  alternateMae: number;
  options: { model: string; sigma: number | null; mae: number }[];
};

export type Meta = {
  generatedAt: string;
  asOf: string;
  lastCompleteSeason: number;
  seasonInProgress: number | null;
  seasonProgress: number;
  curveFirstYear: number;
  curveLastYear: number;
  latestDraftYear: number;
  window: number;
  skaterCap: number;
  goalieCap: number;
  goalieCurveLastYear: number;
  skaterWindow: number;
  goalieWindow: number;
  graduateQg: number;
  /** Raw league-average team score. Team and GM Draft Scores are centered on it. */
  leagueAvg: number;
  skater: FitSummary;
  goalie: FitSummary;
  examples: BriefPick[];
  pickCount: number;
  gradedPickCount: number;
  developingCount: number;
  eraNote: string;
};

export type TeamInfo = {
  abbr: string;
  name: string;
  short: string;
  color: string;
};

export type ClassTeam = {
  franchise: string;
  franchiseName: string;
  color: string;
  avg: number;
  n: number;
  developing: number;
  rating: number | null;
  letter: string | null;
};

export type DraftClass = {
  year: number;
  avg: number;
  n: number;
  developing: number;
  rating: number;
  letter: string;
  teams: ClassTeam[];
};

export type CurveSet = {
  maxPick: number;
  skater: Record<string, number[]>;
  goalie: Record<string, number[]>;
};

export type OgIndex = {
  home: string;
  method: string;
  teams: Record<string, string>;
  picks: Record<string, Record<string, string>>;
  eras: Record<string, string>;
  classes?: Record<string, string>;
};
