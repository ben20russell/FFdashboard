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
  [key: string]: unknown;
};

export type DashboardPlayer = {
  id: string;
  name: string;
  position: string;
  isRookie: boolean;
  projectedPoints: number;
  adp: number | null;
  customValueScore: number;
  overallRank: number | null;
  injuryStatus: string | null;
  raw: PlayerInput;
};
