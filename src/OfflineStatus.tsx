import { useEffect, useSyncExternalStore } from 'react';
import {
  applyOfflineUpdate, getOfflineState, installApp, refreshStorageHealth,
  requestPersistentStorage, retryOffline, startOffline, subscribeOffline,
} from './offline';
import './offline-status.css';

type Props = { beforeReload?: () => void | Promise<void> };
const bytes = (value: number) => value < 1_000_000 ? `${Math.round(value / 1000)} KB` : `${(value / 1_000_000).toFixed(1)} MB`;
export function OfflineStatus({ beforeReload }: Props) {
  const state = useSyncExternalStore(subscribeOffline, getOfflineState, getOfflineState);
  useEffect(startOffline, []);
  const label = state.phase === 'ready' ? state.online ? 'Offline ready' : 'Working offline'
    : state.phase === 'development' ? 'Local development'
    : state.phase === 'unsupported' ? 'Browser access available'
    : state.phase === 'error' ? 'Offline setup incomplete' : 'Preparing offline access…';
  const storage = state.storage;
  return <aside className="offline-access" aria-label="Installation and offline access">
    <details className="offline-details" onToggle={event => {
      if (event.currentTarget.open && !storage.checked && !storage.checking) void refreshStorageHealth();
    }}>
      <summary>
        <span className={`offline-dot offline-dot-${state.phase}`} aria-hidden="true"/>
        <strong role="status" data-testid="offline-status">{label}</strong>
        <span className="offline-summary-label">Offline & storage</span>
        {state.installed && <span className="offline-installed">Installed</span>}
      </summary>
      <div className="offline-detail-body">
        <div className="offline-capabilities">
          <div><h3>Works offline after preparation</h3><p>Exercise catalog, calculations, all workbenches, saved notes, prepared examples, and file import/export run on this device. Wait for <strong>Offline ready</strong> before disconnecting.</p></div>
          <div><h3>Needs a connection</h3><p>First access, downloading or repairing app files, checking for updates, and opening external reference links. Hosting sign-in or access changes may also need internet; use the already prepared app when offline.</p></div>
        </div>
        <p className="offline-privacy">Calculations and your workspace stay in this browser. The app checks its own site for updated files; it does not upload your measurements or call an external AI service.</p>
        {state.phase === 'development' && <p>Offline caching is enabled on the production build and hosted app, not this development server.</p>}
        {state.phase === 'unsupported' && <p>This browser cannot prepare offline access here. Use a compatible browser over HTTPS; normal browser access remains available.</p>}
        {state.phase === 'error' && <button onClick={() => void retryOffline()}>Retry offline setup</button>}

        <section className="offline-storage" aria-labelledby="storage-health-heading">
          <h3 id="storage-health-heading">Keep your work</h3>
          <dl className="offline-diagnostics">
            <div><dt>Local saving</dt><dd>{storage.checking ? 'Checking…' : storage.writable === null ? 'Not checked' : storage.writable ? 'Available for a small test write' : 'Unavailable or full'}</dd></div>
            <div><dt>Retention policy</dt><dd>{storage.persistent === true ? 'Persistent storage granted' : storage.persistent === false ? 'Browser may clear storage under pressure' : 'Not reported by this browser'}</dd></div>
            {storage.usage !== null && <div><dt>Site storage estimate</dt><dd>{bytes(storage.usage)} used{storage.quota === null ? '' : ` of approximately ${bytes(storage.quota)}`}</dd></div>}
          </dl>
          <p>Use <strong>Whole workspace backup</strong> for a portable copy. Storage protection may reduce automatic eviction; it does not prevent you or the browser from clearing data. Private sessions may discard work when closed. Storage estimates include cached files and do not guarantee room for a large save.</p>
          <div className="offline-actions">
            <button disabled={storage.checking} onClick={() => void refreshStorageHealth()}>{storage.checking ? 'Checking storage…' : 'Check storage'}</button>
            {storage.canRequestPersistence && storage.persistent !== true && <button disabled={storage.requestingPersistence} onClick={() => void requestPersistentStorage()}>{storage.requestingPersistence ? 'Requesting protection…' : 'Request storage protection'}</button>}
          </div>
          {storage.notice && <p role="status">{storage.notice}</p>}
          {storage.error && <p className="offline-error" role="alert">{storage.error}</p>}
        </section>

        <section className="offline-install"><h3>Install if useful</h3>
          {state.installed ? <p>Installed on this device</p> : <p>Installation is optional. Android: Chrome’s menu → Install app / Add to Home screen. iPhone or iPad: Safari → Share → Add to Home Screen. Desktop: use the browser’s install action if offered. Installation and offline preparation are separate.</p>}
          {state.installAvailable && !state.installed && <button onClick={() => void installApp()}>Install app</button>}
          {state.version && <p className="offline-build">Prepared build: <code>{state.version}</code>. Updates replace app files after your pending work has been saved.</p>}
        </section>
      </div>
    </details>
    {state.updateAvailable && <button className="offline-update" disabled={state.applyingUpdate} onClick={() => void applyOfflineUpdate(beforeReload)}>{state.applyingUpdate ? 'Applying update…' : 'Save & update'}</button>}
    {state.error && <p className="offline-error offline-main-error" role="alert">{state.error}</p>}
  </aside>;
}
