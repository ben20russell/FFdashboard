'use client';

import React, { useMemo, useState } from 'react';

export type Player = {
  id: string;
  name: string;
  team: string;
  position: string;
  ecr?: number;
  proj_pts?: number;
  advancedFields?: Record<string, unknown>;
};

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;
type PositionFilter = (typeof POSITIONS)[number];
type SortDirection = 'asc' | 'desc';
type SortKey = 'name' | 'team' | 'position' | 'ecr' | 'proj_pts' | `advanced:${string}`;
type SortConfig = { key: SortKey; direction: SortDirection };
type AdvancedColumnOption = {
  path: string;
  valueCount: number;
};

function flattenFieldPaths(value: unknown, prefix = '', into: Set<string>) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const item = value[index];
      const nextPrefix = prefix ? `${prefix}.${index}` : String(index);
      flattenFieldPaths(item, nextPrefix, into);
    }
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, nestedValue] of entries) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenFieldPaths(nestedValue, nextPrefix, into);
    }
    return;
  }

  if (prefix) {
    into.add(prefix);
  }
}

function getValueAtPath(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) {
    return undefined;
  }

  const segments = path.split('.');
  let current: unknown = source;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }

    return undefined;
  }

  return current;
}

function formatAdvancedValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function sanitizePathForTestId(path: string): string {
  return path.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getSortValue(player: Player, key: SortKey): unknown {
  if (key === 'name') return player.name;
  if (key === 'team') return player.team;
  if (key === 'position') return player.position;
  if (key === 'ecr') return player.ecr;
  if (key === 'proj_pts') return player.proj_pts;
  if (key.startsWith('advanced:')) {
    const path = key.slice('advanced:'.length);
    return getValueAtPath(player.advancedFields, path);
  }
  return undefined;
}

function compareValues(a: Player, b: Player, key: SortKey, direction: SortDirection): number {
  const valueA = getSortValue(a, key);
  const valueB = getSortValue(b, key);

  const isMissingA = valueA === undefined || valueA === null || valueA === '';
  const isMissingB = valueB === undefined || valueB === null || valueB === '';

  if (isMissingA && !isMissingB) return 1;
  if (!isMissingA && isMissingB) return -1;
  if (isMissingA && isMissingB) return 0;

  if (typeof valueA === 'number' && typeof valueB === 'number') {
    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  }

  const textA = String(valueA).toLowerCase();
  const textB = String(valueB).toLowerCase();
  const result = textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

export default function DashboardClient({ initialData }: { initialData: Player[] }) {
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [showAdvancedColumns, setShowAdvancedColumns] = useState(false);
  const [selectedAdvancedColumns, setSelectedAdvancedColumns] = useState<string[]>([]);

  const advancedColumnOptions = useMemo<AdvancedColumnOption[]>(() => {
    const pathSet = new Set<string>();

    for (const player of initialData) {
      flattenFieldPaths(player.advancedFields, '', pathSet);
    }

    const paths = Array.from(pathSet).sort((a, b) => a.localeCompare(b));
    return paths.map((path) => ({
      path,
      valueCount: initialData.filter((player) => getValueAtPath(player.advancedFields, path) !== undefined).length,
    }));
  }, [initialData]);

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    console.log('[DashboardClient] handleSort', { key, direction });
    setSortConfig({ key, direction });
  };

  const handleAdvancedColumnToggle = (path: string) => {
    setSelectedAdvancedColumns((previous) => {
      if (previous.includes(path)) {
        console.log('[DashboardClient] advanced column removed', { path });
        return previous.filter((item) => item !== path);
      }

      console.log('[DashboardClient] advanced column added', { path });
      return [...previous, path];
    });
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

      <div className="border-b border-slate-100 bg-white p-4" data-testid="advanced-columns-panel">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          data-testid="advanced-columns-toggle"
          onClick={() => {
            const nextValue = !showAdvancedColumns;
            console.log('[DashboardClient] advanced columns panel toggled', {
              showAdvancedColumns: nextValue,
              availableColumns: advancedColumnOptions.length,
            });
            setShowAdvancedColumns(nextValue);
          }}
        >
          Advanced Columns ({selectedAdvancedColumns.length})
        </button>

        {showAdvancedColumns ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3" data-testid="advanced-columns-options">
            {advancedColumnOptions.length > 0 ? (
              advancedColumnOptions.map((option) => (
                <label
                  key={option.path}
                  htmlFor={`advanced-column-${option.path}`}
                  className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                >
                  <input
                    id={`advanced-column-${option.path}`}
                    type="checkbox"
                    checked={selectedAdvancedColumns.includes(option.path)}
                    onChange={() => handleAdvancedColumnToggle(option.path)}
                  />
                  <span>{option.path}</span>
                  <span className="ml-auto text-slate-400">{option.valueCount}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-slate-500">No additional merged fields available for this dataset.</p>
            )}
          </div>
        ) : null}
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
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('team')}
                data-testid="sort-team"
              >
                Team {sortConfig?.key === 'team' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                onClick={() => handleSort('position')}
                data-testid="sort-position"
              >
                Position {sortConfig?.key === 'position' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
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
              {selectedAdvancedColumns.map((path) => {
                const sortKey = `advanced:${path}` as SortKey;
                const sanitized = sanitizePathForTestId(path);
                return (
                  <th
                    key={path}
                    className="cursor-pointer px-6 py-4 hover:bg-slate-100"
                    data-testid={`advanced-header-${sanitized}`}
                    onClick={() => handleSort(sortKey)}
                  >
                    {path} {sortConfig?.key === sortKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                );
              })}
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
                  {selectedAdvancedColumns.map((path) => {
                    const displayValue = formatAdvancedValue(getValueAtPath(player.advancedFields, path));
                    return (
                      <td
                        key={`${player.id}-${path}`}
                        className="px-6 py-4 font-mono text-xs"
                        data-testid={`advanced-cell-${player.id}-${sanitizePathForTestId(path)}`}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5 + selectedAdvancedColumns.length}
                  className="px-6 py-12 text-center text-slate-500"
                  data-testid="dashboard-empty-state"
                >
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
