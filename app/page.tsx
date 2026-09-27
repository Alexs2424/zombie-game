"use client";
import { useEffect, useRef, useState } from "react";
import type { GameRuntime, GameView } from "../lib/game/runtime";
const initial: GameView = {
  phase: "ready",
  health: 100,
  points: 400,
  round: 0,
  kills: 0,
  headshots: 0,
  earned: 0,
  time: 0,
  weapon: "pistol",
  weaponName: "HOUSE SPECIAL",
  mag: 12,
  reserve: 84,
  capacity: 12,
  hasShotgun: false,
  reload: 0,
  reloadTotal: 1.5,
  enemies: 0,
  remaining: 0,
  intermission: 1,
  lounge: false,
  shortcut: false,
  upgraded: false,
  message: "",
  prompt: null,
  hit: 0,
  headshot: false,
  damage: 0,
  fps: 60,
  p95: 0,
};
const timeString = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
function Controls() {
  return (
    <div className="keys">
      <kbd>W A S D</kbd> MOVE <kbd>SHIFT</kbd> SPRINT
      <br />
      <kbd>MOUSE</kbd> LOOK <kbd>LEFT CLICK</kbd> FIRE
      <br />
      <kbd>R</kbd> RELOAD <kbd>E</kbd> BUY
      <br />
      <kbd>1 / 2</kbd> SWITCH <kbd>ESC</kbd> PAUSE
    </div>
  );
}
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<GameRuntime | null>(null);
  const [view, setView] = useState(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [settings, setSettings] = useState(false),
    [sensitivity, setSensitivity] = useState(1),
    [volume, setVolume] = useState(0.45),
    [debug, setDebug] = useState(false);
  useEffect(() => {
    let disposed = false;
    import("../lib/game/runtime")
      .then(({ GameRuntime }) => {
        if (disposed || !canvas.current) return;
        try {
          runtime.current = new GameRuntime(canvas.current, setView, setError);
          setReady(true);
        } catch (e) {
          setError(
            `The 3D scene could not start. Enable graphics acceleration in Chrome and reload. ${e instanceof Error ? e.message : ""}`,
          );
        }
      })
      .catch(() =>
        setError("The game could not load. Check your connection and reload."),
      );
    return () => {
      disposed = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, []);
  const enter = (restart = false) => {
    setSettings(false);
    void runtime.current?.enter(restart);
  };
  const active = view.phase === "playing",
    menu = view.phase === "ready",
    paused = view.phase === "paused",
    dead = view.phase === "dead";
  return (
    <main className={`game-shell ${active ? "in-game" : ""}`}>
      <div className="casino-backdrop" />
      <canvas
        ref={canvas}
        className={`game-canvas ${menu ? "attract" : ""}`}
        aria-label="Last Jackpot first-person casino survival game"
      />
      {menu && <div className="menu-shade" />}
      {!active && (
        <header className="masthead">
          <div className="wordmark">
            LJ<span>LAST JACKPOT</span>
          </div>
          <span className="build-tag">SOLO SURVIVAL · V0</span>
        </header>
      )}
      {menu && (
        <>
          <section className="title-screen">
            <p className="eyebrow">LAS VEGAS, AFTER HOURS</p>
            <h1>
              LAST
              <br />
              <span>JACKPOT</span>
              <i>♠</i>
            </h1>
            <p className="tagline">
              The house is empty.
              <br />
              The night is just getting started.
            </p>
            <button
              className="primary-button"
              disabled={!ready}
              onClick={() => enter()}
            >
              {ready ? "ENTER THE CASINO" : "LOADING CASINO…"}
              <span>↗</span>
            </button>
            <button
              className="text-button"
              onClick={() => setSettings(!settings)}
            >
              SETTINGS & CONTROLS
            </button>
            <div className="run-details">
              <span>01 MAP</span>
              <span>∞ ROUNDS</span>
              <span>ONE MORE RUN</span>
            </div>
          </section>
          <aside className="briefing">
            <span className="eyebrow">YOUR LUCK STARTS HERE</span>
            <p>
              Keep moving. Make every shot count.
              <br />
              Buy yourself a way out.
            </p>
            <Controls />
          </aside>
          <footer className="menu-footer">
            <span>♢ AN ABANDONED CASINO. ANOTHER CHANCE.</span>
            <span>MOUSE + KEYBOARD</span>
          </footer>
        </>
      )}
      {!menu && (
        <div className="hud" aria-label="Game status">
          <div className="hud-top">
            <div className="wave-box">
              <span className="small-label">ROUND</span>
              <strong>
                {String(Math.max(1, view.round)).padStart(2, "0")}
              </strong>
              <span className="wave-detail">
                {view.intermission > 0
                  ? `NEXT IN ${Math.ceil(view.intermission)}s`
                  : `${view.enemies + view.remaining} REMAINING`}
              </span>
            </div>
            <div className="run-clock">
              LAST JACKPOT <span>{timeString(view.time)}</span>
            </div>
            <div className="points">
              <span className="small-label">POINTS</span>
              <strong>{view.points.toLocaleString()}</strong>
            </div>
          </div>
          <div className="progress-list">
            <span className={view.lounge ? "complete" : ""}>
              {view.lounge ? "◆" : "◇"} LOUNGE
            </span>
            <span className={view.shortcut ? "complete" : ""}>
              {view.shortcut ? "◆" : "◇"} STAFF PASSAGE
            </span>
            <span className={view.upgraded ? "complete" : ""}>
              {view.upgraded ? "◆" : "◇"} HIGH ROLLER
            </span>
          </div>
          {active && (
            <>
              <div
                className={`crosshair ${view.hit > 0 ? "hit" : ""} ${view.headshot ? "headshot" : ""}`}
              >
                <i />
                <i />
                <i />
                <i />
              </div>
              {view.damage > 0 && (
                <div
                  className="damage-vignette"
                  style={{ opacity: view.damage / 0.4 }}
                />
              )}
              {view.message && (
                <div className="game-message" role="status">
                  {view.message}
                </div>
              )}
              {view.prompt && (
                <div
                  className={`purchase-prompt ${view.prompt.reason ? "unavailable" : ""}`}
                >
                  <kbd>E</kbd>
                  <div>
                    <strong>{view.prompt.name}</strong>
                    <span>{view.prompt.reason || view.prompt.detail}</span>
                  </div>
                  <b>
                    {view.prompt.price.toLocaleString()} <small>PTS</small>
                  </b>
                </div>
              )}
              {view.reload > 0 && (
                <div className="reload-indicator">
                  RELOADING
                  <div>
                    <i
                      style={{
                        width: `${(1 - view.reload / view.reloadTotal) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
          <div className="hud-bottom">
            <div className="health-panel">
              <span className="small-label">
                VITALS <b>{Math.ceil(view.health)}</b>
              </span>
              <div className={`health-track ${view.health < 35 ? "low" : ""}`}>
                <i style={{ width: `${view.health}%` }} />
              </div>
              <span className="hud-hint">
                {view.health < 100
                  ? "Health recovers when you avoid damage"
                  : "KEEP MOVING. STAY LUCKY."}
              </span>
            </div>
            <div className="weapon-panel">
              <div className="weapon-slots">
                <span className={view.weapon === "pistol" ? "selected" : ""}>
                  1 PISTOL
                </span>
                <span className={view.weapon === "shotgun" ? "selected" : ""}>
                  {view.hasShotgun ? "2 SHOTGUN" : "2 —"}
                </span>
              </div>
              <span className="weapon-name">{view.weaponName}</span>
              <div className="ammo">
                <strong className={view.mag === 0 ? "empty" : ""}>
                  {String(view.mag).padStart(2, "0")}
                </strong>
                <span>/ {view.reserve}</span>
              </div>
              <span className="hud-hint">
                {view.mag === 0
                  ? "R TO RELOAD"
                  : "R RELOAD · E INTERACT · ESC PAUSE"}
              </span>
            </div>
          </div>
        </div>
      )}
      {(paused || dead) && (
        <div className="pause-shade">
          <section className="pause-card">
            <p className="eyebrow">
              {dead ? "THE HOUSE COLLECTS" : "TAKE A BREATHER"}
            </p>
            <h2>{dead ? "Out of luck." : "On the house."}</h2>
            <p>
              {dead
                ? "Another run. A better hand."
                : "Your run is paused. The casino can wait."}
            </p>
            {dead && (
              <div className="result-grid">
                <div>
                  <b>{view.round}</b>
                  <span>ROUND</span>
                </div>
                <div>
                  <b>{view.kills}</b>
                  <span>KILLS</span>
                </div>
                <div>
                  <b>{view.headshots}</b>
                  <span>HEADSHOTS</span>
                </div>
                <div>
                  <b>{timeString(view.time)}</b>
                  <span>SURVIVED</span>
                </div>
                <div>
                  <b>{view.earned.toLocaleString()}</b>
                  <span>POINTS EARNED</span>
                </div>
              </div>
            )}
            <button className="primary-button" onClick={() => enter(dead)}>
              {dead ? "TRY YOUR LUCK AGAIN" : "RESUME RUN"}
              <span>↗</span>
            </button>
            {paused && (
              <button className="text-button" onClick={() => enter(true)}>
                RESTART RUN
              </button>
            )}
            <button
              className="text-button"
              onClick={() => setSettings(!settings)}
            >
              SETTINGS & CONTROLS
            </button>
          </section>
        </div>
      )}
      {settings && !active && (
        <section className="settings-panel" aria-label="Settings">
          <div className="settings-heading">
            <h3>Make yourself comfortable.</h3>
            <button
              aria-label="Close settings"
              onClick={() => setSettings(false)}
            >
              ×
            </button>
          </div>
          <label>
            Mouse sensitivity <b>{sensitivity.toFixed(1)}×</b>
            <input
              type="range"
              min=".2"
              max="2.5"
              step=".1"
              value={sensitivity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSensitivity(v);
                runtime.current?.setSensitivity(v);
              }}
            />
          </label>
          <label>
            Sound volume <b>{Math.round(volume * 100)}%</b>
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                runtime.current?.setVolume(v);
              }}
            />
          </label>
          <Controls />
          <label className="debug-check">
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
            />{" "}
            Show performance
          </label>
          <p className="settings-note">
            Escape or switching away pauses your run. Mouse + keyboard required.
            Controller support is planned.
          </p>
        </section>
      )}
      {debug && (
        <div className="debug-panel">
          {Math.round(view.fps)} FPS · p95 {view.p95.toFixed(1)} ms ·{" "}
          {view.enemies} ACTIVE / {view.remaining} QUEUED
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      )}
    </main>
  );
}
