export type PlayerInput = {
  id?: string | number;
  name?: string;
  player_name?: string;
  full_name?: string;
  position?: string;
  projected_points?: number | string;
  projectedPoints?: number | string;
  points?: number | string;
  [key: string]: unknown;
};

export type DashboardPlayer = {
  id: string;
  name: string;
  position: string;
  projectedPoints: number;
  customValueScore: number;
  overallRank: number | null;
  injuryStatus: string | null;
  raw: PlayerInput;
};
