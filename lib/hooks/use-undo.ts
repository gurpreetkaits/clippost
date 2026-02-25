"use client";

import { useState, useCallback, useRef } from "react";

interface UseUndoReturn<T> {
  state: T;
  set: (newState: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (initial: T) => void;
}

const MAX_HISTORY = 50;

export function useUndo<T>(initialState: T): UseUndoReturn<T> {
  const [state, setState] = useState(initialState);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const set = useCallback((newState: T) => {
    setState((prev) => {
      pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), prev];
      futureRef.current = [];
      return newState;
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (pastRef.current.length === 0) return prev;
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, prev];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (futureRef.current.length === 0) return prev;
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current, prev];
      return next;
    });
  }, []);

  const reset = useCallback((initial: T) => {
    setState(initial);
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    reset,
  };
}
