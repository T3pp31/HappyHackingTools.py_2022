import { useEffect } from "react";
import { useTauriCommand } from "./useTauriCommand";
import type { NetworkInfo } from "../types";

export function useNetworkInfo() {
  const { data, loading, error, execute } =
    useTauriCommand<NetworkInfo>("get_network_info");

  useEffect(() => {
    execute();
  }, [execute]);

  return { networkInfo: data, loading, error, refresh: execute };
}
