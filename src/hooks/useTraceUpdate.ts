/**
 * @file useTraceUpdate.ts
 * Debugging hook to trace which props triggered a re-render in a component.
 * Logs prop changes to the browser console to aid in debugging unnecessary re-renders.
 */

import { useEffect, useRef } from 'react';

/**
 * Debugging hook to trace which props triggered a re-render.
 * Usage: useTraceUpdate(props); inside your component.
 *
 * @param props - An object containing the component's current props or state values to monitor for changes.
 * @param componentName - An optional name for the component (defaults to 'Component'), used in the console group label.
 * @returns void. Results are logged to the browser's developer console via console.group/console.log.
 */
export const useTraceUpdate = (props: Record<string, unknown>, componentName: string = 'Component') => {
  const prev = useRef(props);
  useEffect(() => {
    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        (ps as Record<string, unknown>)[k] = [prev.current[k], v];
      }
      return ps;
    }, {});
    if (Object.keys(changedProps).length > 0) {
      console.group(`[${componentName}] Re-render caused by:`);
      console.log('Changed props:', changedProps);
      console.groupEnd();
    }
    prev.current = props;
  });
};
