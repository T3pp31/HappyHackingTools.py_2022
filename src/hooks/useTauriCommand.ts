import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseTauriCommandResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (args?: Record<string, unknown>) => Promise<T | null>;
}

export function useTauriCommand<T>(
  command: string
): UseTauriCommandResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (args?: Record<string, unknown>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<T>(command, args ?? {});
        setData(result);
        return result;
      } catch (e) {
        const errorMessage =
          typeof e === "string" ? e : (e as Error).message || "Unknown error";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [command]
  );

  return { data, loading, error, execute };
}
