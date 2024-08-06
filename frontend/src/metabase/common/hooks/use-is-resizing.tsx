import { useState, useRef, useEffect } from "react";

import resizeObserver from "metabase/lib/resize-observer";

export const useIsResizing = (element: Element | null) => {
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
      }, 200);
    };
    resizeObserver.subscribe(element, onResize);
    return () => {
      resizeObserver.unsubscribe(element, onResize);
    };
  }, [element]);

  return isResizing;
};
