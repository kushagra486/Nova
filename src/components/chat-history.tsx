"use client";

import { useSyncExternalStore } from "react";
import { History, Trash2 } from "lucide-react";
import type { PrivacyClass } from "@/lib/nova/types";

export interface HistoryEntry {
  id: string;
  prompt: string;
  output: string;
  taskType: string;
  privacyClass: PrivacyClass;
  executor: string;
  timestamp: number;
}

const STORAGE_KEY = "nova:chat-history";
const MAX_ENTRIES = 50;

/**
 * Chat history lives in this browser's localStorage only — never synced to
 * Supabase. The rest of the app deliberately never persists raw task text
 * server-side (only a hash, for privacy — see supabase/migrations); this
 * keeps that guarantee intact while still giving you a real history on this
 * device. Clearing your browser storage clears it too.
 *
 * Backed by useSyncExternalStore rather than a plain useState+useEffect: the
 * server always has an empty history (there's no localStorage to read), so
 * the store must hand back that same empty snapshot during hydration and
 * only swap in the real, possibly non-empty, value afterward — otherwise a
 * returning visitor with saved entries gets a hydration mismatch.
 */
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    // Private browsing or storage disabled — history just won't persist.
    return "[]";
  }
}

function getServerSnapshot(): string {
  return "[]";
}

function parseEntries(raw: string): HistoryEntry[] {
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function useHistory() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entries = parseEntries(raw);

  function addEntry(entry: HistoryEntry) {
    const next = [entry, ...entries].slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort; the app works fine without persisted history.
    }
    emitChange();
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to do — there was nothing persisted anyway.
    }
    emitChange();
  }

  return { entries, addEntry, clear };
}

const PRIVACY_DOT: Record<PrivacyClass, string> = {
  P0: "bg-emerald-400",
  P1: "bg-amber-400",
  P2: "bg-amber-400",
  P3: "bg-red-400",
};

interface ChatHistoryProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function ChatHistory({ entries, onSelect, onClear }: ChatHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <History className="h-3.5 w-3.5" />
        No history yet on this device — it appears here after your first request.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <History className="h-3.5 w-3.5" />
          {entries.length} saved on this device (not synced — see Guide)
        </span>
        <button
          onClick={onClear}
          className="flex cursor-pointer items-center gap-1 text-xs text-zinc-600 transition-colors hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onSelect(entry)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/15 hover:bg-white/[0.05]"
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIVACY_DOT[entry.privacyClass]}`} />
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{entry.prompt || "(attached file)"}</span>
            <span className="shrink-0 text-[10px] text-zinc-600">{entry.executor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
