export type PlayerInput = {
  id?: string | number;
  name?: string;
  player_name?: string;
  full_name?: string;
  position?: string;
  isRookie?: boolean;
  projected_points?: number | string;
  projectedPoints?: number | string;
  points?: number | string;
  adp?: number | string;
  avg_adp?: number | string;
  earlySeasonPoints?: number | string;
  early_season_points?: number | string;
  bye_week?: number | string;
  byeWeek?: number | string;
  std_dev?: number | string;
  best?: number | string;
  worst?: number | string;
  [key: string]: unknown;
};

export type DashboardPlayer = {
  id: string;
  name: string;
  position: string;
  isRookie: boolean;
  projectedPoints: number;
  earlySeasonPoints: number | null;
  adp: number | null;
  customValueScore: number;
  overallRank: number | null;
  injuryStatus: string | null;
  byeWeek: number | null;
  stdDev: number | null;
  best: number | null;
  worst: number | null;
  raw: PlayerInput;
};
