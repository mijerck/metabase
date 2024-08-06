import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { t } from "ttag";

import { getColumnGroupName } from "metabase/common/utils/column-groups";
import Input from "metabase/core/components/Input";
import { useDebouncedValue } from "metabase/hooks/use-debounced-value";
import { SEARCH_DEBOUNCE_DURATION } from "metabase/lib/constants";
import { DelayGroup } from "metabase/ui";
import * as Lib from "metabase-lib";

import { ColumnGroupName, SearchContainer } from "./BreakoutColumnList.styled";
import { BreakoutColumnListItem } from "./BreakoutColumnListItem";

export interface BreakoutColumnListProps {
  query: Lib.Query;
  stageIndex: number;
  onAddBreakout: (column: Lib.ColumnMetadata) => void;
  onUpdateBreakout: (
    breakout: Lib.BreakoutClause,
    column: Lib.ColumnMetadata,
  ) => void;
  onRemoveBreakout: (breakout: Lib.BreakoutClause) => void;
  onReplaceBreakouts: (column: Lib.ColumnMetadata) => void;
}

export function BreakoutColumnList({
  query,
  stageIndex,
  onAddBreakout,
  onUpdateBreakout,
  onRemoveBreakout,
  onReplaceBreakouts,
}: BreakoutColumnListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery,
    SEARCH_DEBOUNCE_DURATION,
  );
  const isSearching = searchQuery.trim().length > 0;

  const breakouts = Lib.breakouts(query, stageIndex);
  const [pinnedBreakoutIndexes, setPinnedBreakoutIndexes] = useState(() =>
    breakouts.map((_, breakoutIndex) => breakoutIndex),
  );

  const pinnedItems = useMemo(
    () =>
      pinnedBreakoutIndexes
        .map(breakoutIndex => breakouts[breakoutIndex])
        .filter(breakout => breakout != null)
        .map(breakout => getBreakoutListItem(query, stageIndex, breakout)),
    [query, stageIndex, breakouts, pinnedBreakoutIndexes],
  );

  const allColumns = useMemo(
    () => Lib.breakoutableColumns(query, stageIndex),
    [query, stageIndex],
  );

  const unpinnedColumns = useMemo(
    () =>
      allColumns.filter(
        column =>
          !isPinnedColumn(query, stageIndex, pinnedBreakoutIndexes, column),
      ),
    [query, stageIndex, allColumns, pinnedBreakoutIndexes],
  );

  const sections = useMemo(
    () =>
      getColumnSections(
        query,
        stageIndex,
        isSearching ? allColumns : unpinnedColumns,
        debouncedSearchQuery,
      ),
    [
      query,
      stageIndex,
      allColumns,
      unpinnedColumns,
      isSearching,
      debouncedSearchQuery,
    ],
  );

  const handleRemovePinnedBreakout = useCallback(
    (breakout: Lib.BreakoutClause, itemIndex: number) => {
      const newPinnedBreakouts = [...pinnedBreakoutIndexes];
      newPinnedBreakouts.splice(itemIndex, 1);
      setPinnedBreakoutIndexes(newPinnedBreakouts);
      onRemoveBreakout(breakout);
    },
    [pinnedBreakoutIndexes, onRemoveBreakout],
  );

  const handleReplaceBreakouts = useCallback(
    (column: Lib.ColumnMetadata) => {
      onReplaceBreakouts(column);
      setPinnedBreakoutIndexes([]);
    },
    [onReplaceBreakouts],
  );

  const handleChangeSearchQuery = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(event.target.value);
    },
    [],
  );

  const handleResetSearch = useCallback(() => setSearchQuery(""), []);

  return (
    <>
      <SearchContainer>
        <Input
          fullWidth
          placeholder={t`Find...`}
          value={searchQuery}
          leftIcon="search"
          onResetClick={handleResetSearch}
          onChange={handleChangeSearchQuery}
        />
      </SearchContainer>
      {!isSearching && (
        <DelayGroup>
          <ul data-testid="pinned-dimensions">
            {pinnedItems.map((item, itemIndex) => (
              <BreakoutColumnListItem
                key={itemIndex}
                query={query}
                stageIndex={stageIndex}
                item={item}
                breakout={item.breakout}
                isPinned
                onAddBreakout={onAddBreakout}
                onUpdateBreakout={onUpdateBreakout}
                onRemoveBreakout={breakout =>
                  handleRemovePinnedBreakout(breakout, itemIndex)
                }
              />
            ))}
          </ul>
        </DelayGroup>
      )}
      <DelayGroup>
        <ul data-testid="unpinned-dimensions">
          {sections.map(section => (
            <li key={section.name}>
              <ColumnGroupName>{section.name}</ColumnGroupName>
              <ul>
                {section.items.map((item, itemIndex) => (
                  <BreakoutColumnListItem
                    key={itemIndex}
                    query={query}
                    stageIndex={stageIndex}
                    item={item}
                    breakout={item.breakout}
                    onAddBreakout={onAddBreakout}
                    onUpdateBreakout={onUpdateBreakout}
                    onRemoveBreakout={onRemoveBreakout}
                    onReplaceBreakouts={handleReplaceBreakouts}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </DelayGroup>
    </>
  );
}

type ListItem = Lib.ColumnDisplayInfo & {
  column: Lib.ColumnMetadata;
  breakout?: Lib.BreakoutClause;
};

type ListSection = {
  name: string;
  items: ListItem[];
};

function getBreakoutListItem(
  query: Lib.Query,
  stageIndex: number,
  breakout: Lib.BreakoutClause,
): ListItem {
  const column = Lib.breakoutColumn(query, stageIndex, breakout);
  const columnInfo = Lib.displayInfo(query, stageIndex, column);
  return { ...columnInfo, column, breakout };
}

function getColumnListItems(
  query: Lib.Query,
  stageIndex: number,
  breakouts: Lib.BreakoutClause[],
  column: Lib.ColumnMetadata,
): ListItem[] {
  const columnInfo = Lib.displayInfo(query, stageIndex, column);
  const { breakoutPositions = [] } = columnInfo;
  if (breakoutPositions.length === 0) {
    return [{ ...columnInfo, column }];
  }

  return breakoutPositions.map(index => ({
    ...columnInfo,
    column,
    breakout: breakouts[index],
  }));
}

function getColumnSections(
  query: Lib.Query,
  stageIndex: number,
  columns: Lib.ColumnMetadata[],
  searchQuery: string,
): ListSection[] {
  const breakouts = Lib.breakouts(query, stageIndex);
  const formattedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredColumns =
    formattedSearchQuery.length > 0
      ? columns.filter(column => {
          const { displayName } = Lib.displayInfo(query, stageIndex, column);
          return displayName.toLowerCase().includes(formattedSearchQuery);
        })
      : columns;

  return Lib.groupColumns(filteredColumns).map(group => {
    const groupInfo = Lib.displayInfo(query, stageIndex, group);

    const items = Lib.getColumnsFromColumnGroup(group).flatMap(column =>
      getColumnListItems(query, stageIndex, breakouts, column),
    );

    return {
      name: getColumnGroupName(groupInfo),
      items,
    };
  });
}

function isPinnedColumn(
  query: Lib.Query,
  stageIndex: number,
  pinnedBreakoutIndexes: number[],
  column: Lib.ColumnMetadata,
): boolean {
  const { breakoutPositions = [] } = Lib.displayInfo(query, stageIndex, column);
  return breakoutPositions.every(breakoutIndex =>
    pinnedBreakoutIndexes.includes(breakoutIndex),
  );
}
