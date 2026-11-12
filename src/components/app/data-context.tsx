"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCategories, getPublicTools } from "@/lib/api";
import type { CategoryDTO, ToolDTO } from "@/lib/types";

interface AppDataState {
  /** Published tools only — what visitors see. */
  tools: ToolDTO[];
  categories: CategoryDTO[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the public catalog (called after admin changes). */
  refresh: () => Promise<void>;
}

const DataContext = createContext<AppDataState | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [tools, setTools] = useState<ToolDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [t, c] = await Promise.all([getPublicTools(), getCategories()]);
      setTools(t);
      setCategories(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DataContext.Provider value={{ tools, categories, loading, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData must be used within a DataProvider");
  return ctx;
}
