import { useEffect } from "react";
import { listen, type Event } from "@tauri-apps/api/event";

type TauriEventHandler<T> = (payload: T, event: Event<T>) => void;

export function useTauriEvent<T>(
  eventName: string,
  handler: TauriEventHandler<T>,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    const register = async () => {
      const registeredUnlisten = await listen<T>(eventName, (event) => {
        if (!disposed) {
          handler(event.payload, event);
        }
      });

      if (disposed) {
        registeredUnlisten();
        return;
      }

      unlisten = registeredUnlisten;
    };

    void register();

    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
        unlisten = null;
      }
    };
  }, [enabled, eventName, handler]);
}
