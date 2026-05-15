'use client';

import React, { useMemo, useState } from 'react';

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  ecr?: number;
  proj_pts?: number;
};

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;
type PositionFilter = (typeof POSITIONS)[number];
type SortKey = 'name' | 'ecr' | 'proj_pts';
type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection };

function compareValues(a: Player, b: Player, key: SortKey, direction: SortDirection): number {
  if (key === 'name') {
    const result = a.name.localeCompare(b.name);
    return direction === 'asc' ? result : -result;
  }

  const valA = key === 'ecr' ? a.ecr ?? Number.POSITIVE_INFINITY : a.proj_pts ?? Number.NEGATIVE_INFINITY;
  const valB = key === 'ecr' ? b.ecr ?? Number.POSITIVE_INFINITY : b.proj_pts ?? Number.NEGATIVE_INFINITY;

  if (valA < valB) return direction === 'asc' ? -1 : 1;
  if (valA > valB) return direction === 'asc' ? 1 : -1;
  return 0;
}

export default function DashboardClient({ initialData }: { initialData: Player[] }) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    console.log('[DashboardClient] handleSort', { key, direction });
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    console.log('[DashboardClient] deriving table data', {
      initialCount: initialData.length,
      search,
      positionFilter,
      sortKey: sortConfig?.key ?? null,
      sortDirection: sortConfig?.direction ?? null,
    });

    let filtered = [...initialData];

    if (search) {
      filtered = filtered.filter((player) => player.name.toLowerCase().includes(search.toLowerCase()));
      console.log('[DashboardClient] search filter applied', { resultCount: filtered.length });
    }

    if (positionFilter !== 'ALL') {
      filtered = filtered.filter((player) => player.position === positionFilter);
      console.log('[DashboardClient] position filter applied', { positionFilter, resultCount: filtered.length });
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => compareValues(a, b, sortConfig.key, sortConfig.direction));
      console.log('[DashboardClient] sort applied', { key: sortConfig.key, direction: sortConfig.direction });
    }

    return filtered;
  }, [initialData, search, positionFilter, sortConfig]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-testid="dashboard-client-root"
    >
      <div
        className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 sm:flex-row"
        data-testid="dashboard-controls"
      >
        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => {
              console.log('[DashboardClient] search updated', { value: e.target.value });
              setSearch(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="player-search-input"
          />
        </div>

        <div className="flex w-full gap-2 overflow-x-auto pb-2 sm:w-auto sm:pb-0">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => {
                console.log('[DashboardClient] position filter updated', { position: pos });
                setPositionFilter(pos);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                positionFilter === pos
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
              data-testid={`position-filter-${pos.toLowerCase()}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600" data-testid="players-table">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-500">
            <tr>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('name')}
                data-testid="sort-name"
              >
                Player {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-4">Team</th>
              <th className="px-6 py-4">Position</th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('ecr')}
                data-testid="sort-ecr"
              >
                Consensus Rank (ECR) {sortConfig?.key === 'ecr' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('proj_pts')}
                data-testid="sort-proj-pts"
              >
                Projected Points {sortConfig?.key === 'proj_pts' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((player) => (
                <tr key={player.id} className="transition-colors hover:bg-slate-50" data-testid={`player-row-${player.id}`}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{player.name}</td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold tracking-wide text-slate-700">
                      {player.team}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        player.position === 'RB'
                          ? 'bg-green-100 text-green-700'
                          : player.position === 'WR'
                            ? 'bg-blue-100 text-blue-700'
                            : player.position === 'QB'
                              ? 'bg-red-100 text-red-700'
                              : player.position === 'TE'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {player.position}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">{player.ecr ?? '-'}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-indigo-600">
                    {typeof player.proj_pts === 'number' ? player.proj_pts.toFixed(1) : '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500" data-testid="dashboard-empty-state">
                  No players found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
