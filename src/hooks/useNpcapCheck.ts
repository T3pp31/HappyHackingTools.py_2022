import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface NpcapStatus {
  available: boolean;
  download_url: string;
}

export function useNpcapCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");

  const checkAndExecute = useCallback(async (onAvailable: () => void) => {
    try {
      const status = await invoke<NpcapStatus>("check_npcap");
      if (status.available) {
        onAvailable();
      } else {
        setDownloadUrl(status.download_url);
        setShowDialog(true);
      }
    } catch {
      onAvailable(); // チェック失敗時は実行を試みる
    }
  }, []);

  const closeDialog = useCallback(() => setShowDialog(false), []);

  return { showDialog, downloadUrl, checkAndExecute, closeDialog };
}
