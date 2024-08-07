import { useState, useRef, useEffect } from "react";

import resizeObserver from "metabase/lib/resize-observer";

interface UseIsResizingOptions {
  /** In milliseconds, how long to wait after the last resize event before
   * considering the element to no longer be resizing. Default is 200ms. */
  delay?: number;
}

export const useIsResizing = (
  element: Element | null,
  options: UseIsResizingOptions = {},
) => {
  const { delay = 200 } = options;
  const [isResizing, setIsResizing] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!element) {
      return;
    }
    const onResize = () => {
      setIsResizing(true);
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIsResizing(false);
      }, delay);
    };
    resizeObserver.subscribe(element, onResize);
    return () => {
      resizeObserver.unsubscribe(element, onResize);
      clearTimeout(timeoutRef.current);
    };
  }, [element, delay]);

  return isResizing;
};
