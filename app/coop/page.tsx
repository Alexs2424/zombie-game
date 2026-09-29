/* eslint-disable @next/next/no-html-link-for-pages -- Full-document navigation tears down the WebGL session and avoids next/link's separate React graph in the Vinext preview. */
"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { CoopRuntime, CoopView } from "../../lib/coop/runtime";
import type { PlayerSummary } from "../../lib/coop/protocol";
import "./coop.css";

const seatColors = ["#79cbbb", "#e7b967", "#a7a2f2", "#ec8b9e"];
const playerColor = (player: PlayerSummary) => player.color > 3 ? `#${player.color.toString(16).padStart(6, "0")}` : seatColors[player.color] ?? seatColors[0];

function Roster({ players, selfId, hostId, compact = false }: {
  players: PlayerSummary[]; selfId: string | null; hostId: string; compact?: boolean;
}) {
  return <div className={`coop-roster ${compact ? "coop-roster-compact" : ""}`} aria-label="Your party">
    {players.map((player, index) => <div className="coop-seat" key={player.id}>
      <span className="coop-seat-marker" style={{ color: playerColor(player) }}>{String(index + 1).padStart(2, "0")}</span>
      <div className="coop-seat-info">
        <strong>{player.name}{player.id === selfId && <small>YOU</small>}{player.id === hostId && <small>HOST</small>}</strong>
        <span>{!player.connected ? "Connection lost" : compact ? player.alive ? `${Math.ceil(player.health)} / ${player.maxHealth} HP` : "Spectating" : "Connected"}</span>
        {compact && <div className="coop-team-health"><i style={{ width: `${Math.max(0, Math.min(100, player.health / player.maxHealth * 100))}%`, background: playerColor(player) }} /></div>}
      </div>
      <span className={`coop-presence ${player.connected ? "is-connected" : ""}`} aria-label={player.connected ? "Connected" : "Disconnected"} />
    </div>)}
    {!compact && Array.from({ length: Math.max(0, 4 - players.length) }, (_, index) => <div className="coop-seat coop-seat-empty" key={`empty-${index}`}>
      <span className="coop-seat-marker">{String(players.length + index + 1).padStart(2, "0")}</span>
      <div className="coop-seat-info"><strong>Open seat</strong><span>Share the room code with a friend</span></div>
      <span className="coop-empty-mark">+</span>
    </div>)}
  </div>;
}

function FocusPanel({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("button:not(:disabled), input")?.focus();
  }, []);
  return <section ref={panel} className={`coop-panel ${className}`} role="dialog" aria-modal="true" aria-label={label} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input, a[href], select"));
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>{children}</section>;
}

function Controls() {
  return <div className="coop-controls">
    <span><kbd>WASD</kbd> Move <kbd>SHIFT</kbd> Sprint</span>
    <span><kbd>MOUSE</kbd> Look <kbd>CLICK</kbd> Fire</span>
    <span><kbd>R</kbd> Reload <kbd>E</kbd> Interact</span>
    <span><kbd>G</kbd> Grenade <kbd>V</kbd> Knife</span>
    <span><kbd>Q / WHEEL</kbd> Switch weapon</span>
    <span><kbd>ESC</kbd> Release controls</span>
  </div>;
}

export default function CoopPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<CoopRuntime | null>(null);
  const [view, setView] = useState<CoopView | null>(null);
  const [ready, setReady] = useState(false);
  const [uiError, setUiError] = useState("");
  const [dismissedError, setDismissedError] = useState("");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [code, setCode] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [mode, setMode] = useState<"join" | "create">("join");
  const [savedSession, setSavedSession] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [sensitivity, setSensitivity] = useState(1);
  const [copied, setCopied] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    let disposed = false;
    void Promise.all([import("../../lib/coop/runtime"), import("../../lib/coop/client")]).then(([module, client]) => {
      if (disposed || !canvas.current) return;
      const initialEndpoint = client.defaultCoopEndpoint();
      setEndpoint(initialEndpoint);
      const saved = client.getSavedSession(initialEndpoint);
      if (saved) { setName(saved.name); setCode(saved.code); setSavedSession(true); }
      setView(module.initialCoopView);
      const game = new module.CoopRuntime(canvas.current, (next) => {
        if (!disposed) setView(next);
      }, (message) => { if (!disposed) { setUiError(message); setDismissedError(""); } });
      runtime.current = game;
      game.setVolume(0.45);
      game.setSensitivity(1);
      void game.renderer.ready.then(() => { if (!disposed) setReady(true); }).catch(() => {
        if (!disposed) setUiError("The casino models could not load. Reload this page to try again.");
      });
    }).catch((error: unknown) => {
      if (!disposed) setUiError(error instanceof Error ? error.message : "The casino could not load. Reload this page to try again.");
    });
    return () => { disposed = true; runtime.current?.dispose(); runtime.current = null; };
  }, []);

  useEffect(() => {
    let disposed = false;
    if (endpoint) void import("../../lib/coop/client").then(({ getSavedSession }) => {
      if (!disposed) setSavedSession(!!getSavedSession(endpoint));
    });
    return () => { disposed = true; };
  }, [endpoint, view?.status]);

  const status = view?.status ?? "idle";
  const room = view?.room;
  const game = view?.game;
  const connected = status === "connected";
  const connecting = status === "connecting" || status === "reconnecting";
  const showConnection = !room || status === "disconnected" || status === "idle";
  const inRun = !!room && room.phase === "playing" && !showConnection;
  const shopOpen = inRun && !!game?.shopOpen && !!view?.alive;
  const showPause = inRun && !shopOpen && (settingsOpen || (!!view?.alive && !!view.localPaused));
  const isHost = !!room && room.hostId === view?.playerId;
  const rawError = uiError || view?.error;
  const error = rawError === dismissedError ? "" : rawError;

  async function connect(event?: FormEvent, resume = false) {
    event?.preventDefault();
    setUiError("");
    setDismissedError("");
    setSettingsOpen(false);
    setHasEntered(false);
    try {
      await runtime.current?.connect({ mode: resume ? "resume" : mode, endpoint: endpoint.trim(), name: name.trim(), code: code.trim().toUpperCase(), hostKey: hostKey || undefined });
      setHostKey("");
    } catch (error) { setUiError(error instanceof Error ? error.message : "Could not connect. Check the server address and room code."); }
  }

  function enter() {
    setUiError("");
    setSettingsOpen(false);
    setHasEntered(true);
    void runtime.current?.enter().catch((error: unknown) => setUiError(error instanceof Error ? error.message : "Click Enter again to capture the mouse."));
  }

  function leave() {
    runtime.current?.leave();
    setSettingsOpen(false);
    setUiError("");
    setHasEntered(false);
  }

  async function copyCode() {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setUiError("Copy the room code shown above and send it to your party."); }
  }

  const settings = <div className="coop-settings">
    <label htmlFor="coop-volume">Sound <span>{Math.round(volume * 100)}%</span></label>
    <input id="coop-volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); runtime.current?.setVolume(value); }} />
    <label htmlFor="coop-sensitivity">Mouse sensitivity <span>{sensitivity.toFixed(1)}×</span></label>
    <input id="coop-sensitivity" type="range" min="0.3" max="2.5" step="0.1" value={sensitivity} onChange={(event) => { const value = Number(event.target.value); setSensitivity(value); runtime.current?.setSensitivity(value); }} />
    <Controls />
  </div>;

  return <main className={`coop-shell ${inRun ? "coop-in-run" : ""}`}>
    <canvas ref={canvas} className="coop-canvas" aria-label="Last Jackpot cooperative casino survival game" />
    {!inRun && <div className="coop-backdrop-shade" />}
    <header className="coop-masthead">
      {!inRun ? <a href="/" className="coop-wordmark"><b>LJ</b><span>LAST JACKPOT</span></a> : <span className="coop-live-tag">PRIVATE CO-OP <i /> {room?.code}</span>}
      <div className="coop-header-actions">
        <span className={`coop-network-status coop-status-${status}`} role="status">{status === "idle" ? "UP TO 4 PLAYERS" : status.toUpperCase()}</span>
        {inRun && <button className="coop-small-button" onClick={() => { runtime.current?.pause(); setSettingsOpen(true); }}>MENU <kbd>ESC</kbd></button>}
        {!inRun && <a className="coop-back-link" href="/">SOLO SURVIVAL ↗</a>}
      </div>
    </header>

    {showConnection && <div className="coop-entry-layout">
      <section className="coop-intro">
        <p className="coop-eyebrow">THE HOUSE HAS ROOM FOR FOUR</p>
        <h1>Better odds.<br /><span>Bad company.</span></h1>
        <p className="coop-intro-copy">Bring your friends to the casino.<br />Hold the floor. Share the way out.</p>
        <div className="coop-feature-row"><span>01 SHARED WORLD</span><span>04 SURVIVORS</span><span>∞ ROUNDS</span></div>
        <div className="coop-playtest-note"><span>PRIVATE CO-OP · PLAYTEST</span><p>Shared survival, weapons, and doors.<br />Casino games and hotel challenges are still being prepared for co-op.</p></div>
      </section>
      <section className="coop-connection-panel" aria-label="Connect to a private game">
        <div className="coop-panel-heading"><span className="coop-eyebrow">YOUR PARTY STARTS HERE</span><span className="coop-suit">♠</span></div>
        <div className="coop-mode-switch" aria-label="Room connection mode">
          <button aria-pressed={mode === "join"} className={mode === "join" ? "selected" : ""} disabled={connecting} onClick={() => setMode("join")}>JOIN A ROOM</button>
          <button aria-pressed={mode === "create"} className={mode === "create" ? "selected" : ""} disabled={connecting} onClick={() => setMode("create")}>CREATE A ROOM</button>
        </div>
        <form onSubmit={(event) => void connect(event)}>
          <label className="coop-field" htmlFor="coop-name">YOUR NAME<input id="coop-name" name="name" required maxLength={24} autoComplete="nickname" placeholder="Name at the table" value={name} disabled={connecting} onChange={(event) => setName(event.target.value)} /></label>
          {mode === "join" && <label className="coop-field" htmlFor="coop-code">ROOM CODE<input id="coop-code" name="code" className="coop-code-input" required minLength={4} maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ENTER CODE" value={code} disabled={connecting} onChange={(event) => setCode(event.target.value.replace(/\s/g, "").toUpperCase())} /></label>}
          {mode === "create" && <p className="coop-form-help">Create a private room, then share its code with up to three friends.</p>}
          <details className="coop-advanced"><summary>Advanced connection</summary>
            <label className="coop-field" htmlFor="coop-endpoint">GAME SERVER<input id="coop-endpoint" type="url" required placeholder="ws://localhost:2567" value={endpoint} disabled={connecting} onChange={(event) => setEndpoint(event.target.value)} spellCheck={false} autoComplete="off" /></label>
            <p>The party must use the same game server. Use a secure wss:// address when playing from a hosted page.</p>
            {mode === "create" && <label className="coop-field" htmlFor="coop-host-key">HOST KEY <span>IF REQUIRED BY THE SERVER</span><input id="coop-host-key" type="password" autoComplete="off" value={hostKey} disabled={connecting} onChange={(event) => setHostKey(event.target.value)} /></label>}
          </details>
          <button className="coop-primary" type="submit" disabled={!ready || connecting || !endpoint || !name.trim() || (mode === "join" && !code.trim())}>{!ready ? "LOADING CASINO…" : connecting ? "CONNECTING…" : mode === "join" ? "JOIN THE PARTY" : "CREATE PRIVATE ROOM"}<span>↗</span></button>
        </form>
        {savedSession && <button className="coop-text-button coop-resume-link" disabled={!ready || connecting} onClick={() => void connect(undefined, true)}>REJOIN YOUR PREVIOUS ROOM ↗</button>}
        <p className="coop-connection-footnote">Mouse + keyboard · Headphones recommended</p>
      </section>
    </div>}

    {!showConnection && room?.phase === "lobby" && <div className="coop-lobby-layout">
      <section className="coop-lobby-intro"><p className="coop-eyebrow">THE LAST JACKPOT · PRIVATE ROOM</p><h1>Pull up<br /><span>a chair.</span></h1><p>Send this code to your party.<br />Everyone joins the same casino.</p><div className="coop-room-code"><span>ROOM CODE</span><strong>{room.code}</strong><button className="coop-small-button" onClick={() => void copyCode()}>{copied ? "COPIED ✓" : "COPY CODE"}</button></div><Controls /></section>
      <section className="coop-connection-panel coop-lobby-panel"><div className="coop-panel-heading"><span className="coop-eyebrow">TONIGHT’S PARTY</span><span>{room.players.length} / 4</span></div><Roster players={room.players} selfId={view?.playerId ?? null} hostId={room.hostId} /><p className="coop-form-help">Your inventory is yours. Doors open for everyone.<br />If you fall, spectate until the next round.</p>{isHost ? <button className="coop-primary" disabled={!ready || !connected} onClick={() => runtime.current?.start()}>START THE RUN <span>↗</span></button> : <div className="coop-waiting" role="status">Waiting for the host to start the run…</div>}<button className="coop-text-button" onClick={leave}>LEAVE ROOM</button></section>
    </div>}

    {inRun && game && view && <>
      <div className="coop-hud" aria-label="Game status">
        <div className="coop-round"><span>ROUND</span><strong>{String(Math.max(1, game.round)).padStart(2, "0")}</strong><small>{game.intermission > 0 ? `NEXT IN ${Math.ceil(game.intermission)}s` : `${game.enemies + game.remaining} REMAINING`}</small></div>
        <div className="coop-chips"><span>YOUR CHIPS</span><strong>{game.points.toLocaleString()}</strong></div>
        <div className="coop-party-hud"><Roster players={room.players} selfId={view.playerId} hostId={room.hostId} compact /></div>
        {view.alive && <><div className="coop-health"><span>HEALTH</span><strong>{Math.ceil(game.health)}<small> / {game.maxHealth}</small></strong><div className="coop-health-track"><i style={{ width: `${Math.max(0, Math.min(100, game.health / game.maxHealth * 100))}%` }} /></div><p><kbd>G</kbd> {game.grenades} GRENADES <span><kbd>V</kbd> KNIFE</span></p></div><div className="coop-ammo"><span>{game.weaponName}</span><strong>{game.mag}<small> / {game.reserve}</small></strong><p>{game.reload > 0 ? `RELOADING · ${Math.ceil(game.reload * 10) / 10}s` : "R · RELOAD"}</p></div></>}
        {view.alive && !view.localPaused && !shopOpen && <><div className={`coop-crosshair ${game.aiming ? "is-aiming" : ""}`} aria-hidden="true">+</div>{game.hit > 0 && <div className={`coop-hitmarker ${game.headshot ? "is-headshot" : ""}`} aria-hidden="true">×</div>}{game.prompt && <div className="coop-interact"><kbd>E</kbd><div><strong>{game.prompt.name}</strong><span>{game.prompt.reason || game.prompt.detail}{game.prompt.price > 0 ? ` · ${game.prompt.price.toLocaleString()} chips` : ""}</span></div></div>}</>}
        {game.message && <p className="coop-game-message" role="status">{game.message}</p>}
      </div>
      {!view.alive && <div className="coop-spectator-banner"><span>YOU’RE SPECTATING</span><strong>Back in at the next round.</strong><p>Your party is still fighting. Follow a surviving teammate.</p></div>}
      {game.damage > 0 && view.alive && <div className="coop-damage-flash" style={{ opacity: Math.min(0.65, game.damage * 1.6) }} aria-hidden="true" />}
    </>}

    {showPause && view && <div className="coop-modal-shade"><FocusPanel label="Local controls" className="coop-pause-panel"><p className="coop-eyebrow">{view.alive ? "YOUR CONTROLS ARE RELEASED" : "WATCHING THE PARTY"}</p><h2>{view.alive ? hasEntered ? "Take a breath." : "The party is in." : "Still in good company."}</h2><p className="coop-live-warning">The game keeps going. {view.alive ? "You can still be attacked." : "You return at the next round."}</p>{view.alive ? <button className="coop-primary" disabled={!connected || !ready} onClick={enter}>{hasEntered ? "RESUME PLAYING" : "ENTER THE CASINO"}<span>↗</span></button> : <button className="coop-primary" onClick={() => setSettingsOpen(false)}>BACK TO SPECTATING <span>↗</span></button>}{settings}<button className="coop-text-button" onClick={leave}>LEAVE ROOM</button></FocusPanel></div>}

    {shopOpen && game && <div className="coop-modal-shade"><FocusPanel label="Marlowe’s bar" className="coop-shop-panel"><div className="coop-panel-heading"><span className="coop-eyebrow">THE LAST CALL · MARLOWE’S MENU</span><strong>{game.points.toLocaleString()} CHIPS</strong></div><h2>A little house advantage.</h2><p className="coop-live-warning">Combat continues while you order. Stay close to your party.</p><div className="coop-weapon-picker" aria-label="Weapon to upgrade">{game.owned.map((weapon) => <button className={game.weapon === weapon.id ? "selected" : ""} key={weapon.id} onClick={() => runtime.current?.selectBarWeapon(weapon.id)}>{weapon.label}</button>)}</div><div className="coop-shop-offers">{game.shopOffers.map((offer) => <button key={offer.id} disabled={!!offer.reason || !connected} onClick={() => runtime.current?.buyBar(offer.id)}><div><strong>{offer.name}</strong><span>{offer.detail}</span><small>{offer.reason || "Buy for this run"}</small></div><b>{offer.price.toLocaleString()}<small>CHIPS</small></b></button>)}</div><p className="coop-form-help">{game.message || "Take what you need. Make it back."}</p><button className="coop-primary" onClick={enter}>BACK TO THE FLOOR <span>↗</span></button></FocusPanel></div>}

    {!showConnection && room?.phase === "ended" && <div className="coop-modal-shade coop-results-shade"><section className="coop-panel coop-results-panel"><p className="coop-eyebrow">THE HOUSE COLLECTS</p><h2>One more<br /><em>round?</em></h2><p>Your party made it to round {game?.round ?? 1}.</p><div className="coop-result-stats"><div><span>YOUR KILLS</span><strong>{game?.kills ?? 0}</strong></div><div><span>YOUR CHIPS</span><strong>{game?.points.toLocaleString() ?? "0"}</strong></div></div><Roster players={room.players} selfId={view?.playerId ?? null} hostId={room.hostId} />{isHost ? <button className="coop-primary" disabled={!connected} onClick={() => { setHasEntered(false); runtime.current?.start(); }}>PLAY ANOTHER RUN <span>↗</span></button> : <p className="coop-waiting">Waiting for the host to start another run…</p>}<button className="coop-text-button" onClick={leave}>LEAVE ROOM</button></section></div>}

    {status === "reconnecting" && <div className="coop-reconnect-banner" role="status"><strong>RECONNECTING TO YOUR PARTY…</strong><span>Your controls are released while the connection recovers.</span></div>}
    {error && <div className="coop-error" role="alert"><div><strong>COULDN’T COMPLETE THAT</strong><span>{error}</span></div><button aria-label="Dismiss error" onClick={() => { setDismissedError(error); setUiError(""); }}>×</button></div>}
    {!inRun && !room && <footer className="coop-footer"><span>♢ A BAD NIGHT. GOOD COMPANY.</span><span>PRIVATE CO-OP PLAYTEST</span></footer>}
  </main>;
}
