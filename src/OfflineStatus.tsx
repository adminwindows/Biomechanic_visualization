import { useEffect, useSyncExternalStore } from "react";
import {
  applyOfflineUpdate,
  getOfflineState,
  installApp,
  retryOffline,
  startOffline,
  subscribeOffline,
} from "./offline";

type Props = { beforeReload?: () => void | Promise<void> };
export function OfflineStatus({ beforeReload }: Props) {
  const state = useSyncExternalStore(
    subscribeOffline,
    getOfflineState,
    getOfflineState,
  );
  useEffect(startOffline, []);
  const label =
    state.phase === "ready"
      ? state.online
        ? "Offline ready"
        : "Working offline"
      : state.phase === "development"
        ? "Local development"
        : state.phase === "unsupported"
          ? "Browser access available"
          : state.phase === "error"
            ? "Offline setup incomplete"
            : "Preparing offline access…";
  return (
    <aside
      aria-label="Installation and offline access"
      style={{
        border: "1px solid #dce2d7",
        background: "#edf2e8",
        borderRadius: 9,
        padding: "12px 15px",
        margin: "16px 0",
        color: "#3e594f",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "8px 16px",
        }}
      >
        <div>
          <strong role="status" data-testid="offline-status">
            {label}
          </strong>
          <span style={{ marginLeft: 9, color: "#667d70", fontSize: 11 }}>
            {state.installed
              ? "Installed on this device"
              : "Use in the browser or install on your device"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {state.installAvailable && !state.installed && (
            <button onClick={() => void installApp()}>Install app</button>
          )}
          {state.updateAvailable && (
            <button
              disabled={state.applyingUpdate}
              onClick={() => void applyOfflineUpdate(beforeReload)}
            >
              {state.applyingUpdate ? "Applying update…" : "Save & update"}
            </button>
          )}
          {state.phase === "error" && (
            <button onClick={() => void retryOffline()}>
              Retry offline setup
            </button>
          )}
        </div>
      </div>
      {state.updateAvailable && (
        <p style={{ marginTop: 7, fontSize: 11 }}>
          An update is ready. Your current comparison will be saved before the
          page reloads.
        </p>
      )}
      {state.error && (
        <p
          role="alert"
          style={{ marginTop: 7, color: "#98472e", fontSize: 11 }}
        >
          {state.error}
        </p>
      )}
      {state.phase === "unsupported" && (
        <p style={{ marginTop: 7, fontSize: 11 }}>
          Offline installation requires a compatible browser and HTTPS. You can
          still use the application online.
        </p>
      )}
      {state.phase === "development" && (
        <p style={{ marginTop: 7, fontSize: 11 }}>
          Offline caching is enabled on the built app and hosted preview.
        </p>
      )}
      {!state.installed && (
        <details style={{ border: 0, marginTop: 3 }}>
          <summary style={{ minHeight: 34, fontSize: 11, fontWeight: 500 }}>
            Install on Android or another device
          </summary>
          <p style={{ fontSize: 11, lineHeight: 1.7, paddingBottom: 5 }}>
            On Android, open this link in Chrome and choose “Install app” or
            “Add to Home screen” from the browser menu. On iPhone or iPad, use
            Safari → Share → Add to Home Screen. On desktop, use your browser’s
            install action if offered. Wait for “Offline ready” before
            disconnecting. Installation and offline access are separate; browser
            support varies. Saved settings remain on this browser/device—export
            a backup.
          </p>
        </details>
      )}
    </aside>
  );
}
