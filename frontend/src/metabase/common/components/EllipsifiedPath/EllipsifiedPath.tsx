import cx from "classnames";
import { useMemo, useRef } from "react";

import { useIsResizing } from "metabase/common/hooks/use-is-resizing";
import { useAreAnyTruncated } from "metabase/hooks/use-is-truncated";
import { Tooltip } from "metabase/ui";

import S from "./EllipsifiedPath.module.css";

type EllipsifiedPathProps = { items: string[]; tooltip: string };

/**
 * Displays a path such as "Collection / Subcollection / Subsubcollection /
 * Parent Collection".
 *
 * If the path is too long to fit, some items may be truncated, like this:
 * "Collection / Subcollec... / Subsub... / Parent Collection".
 *
 * The first and last item are never truncated.
 *
 * A tooltip is shown if any items are truncated.
 */
export const EllipsifiedPath = ({ items, tooltip }: EllipsifiedPathProps) => {
  const { areAnyTruncated, ref } = useAreAnyTruncated<HTMLDivElement>();
  const path = useRef<HTMLDivElement | null>(null);
  const resizing = useIsResizing(path.current);
  const smallItemCount = useMemo(
    () =>
      [...ref.current.values()].slice(0, -1).filter(el => el.offsetWidth < 25)
        .length,
    [ref],
  );

  return (
    <Tooltip
      label={tooltip}
      disabled={!areAnyTruncated && smallItemCount === 0}
      multiline
      maw="20rem"
    >
      <div className={S.path} ref={path}>
        {items.length > 1 && (
          <div className={S.dots}>
            … <div className={S.slash}>/</div>
          </div>
        )}
        {items.map((item, index) => {
          const key = `${item}${index}`;
          const div = ref.current.get(key);
          return (
            <>
              <div
                key={key}
                ref={el => el && ref.current.set(key, el)}
                className={cx(S.item, {
                  [S.small]: !resizing && div && div.offsetWidth < 25,
                })}
              >
                {item}
              </div>
              {index < items.length - 1 && (
                <div key={`${key}-sep`} className={S.slash}>
                  /
                </div>
              )}
            </>
          );
        })}
      </div>
    </Tooltip>
  );
};
