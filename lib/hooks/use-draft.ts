"use client";

import { useEffect, useCallback, useRef } from "react";

const DRAFT_KEY = "clippost-editor-draft";
const SAVE_DEBOUNCE_MS = 2000;

interface DraftState {
  url: string;
  start: number;
  end: number;
  language: string;
  captions: unknown[];
  captionStyle: unknown;
  savedAt: number;
}

export function useDraft() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const saveDraft = useCallback((data: Omit<DraftState, "savedAt">) => {
    // Debounce saves
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const draft: DraftState = { ...data, savedAt: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const loadDraft = useCallback((): DraftState | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const draft = JSON.parse(raw) as DraftState;
      // Expire drafts older than 24 hours
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { saveDraft, loadDraft, clearDraft };
}
