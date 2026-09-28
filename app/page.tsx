"use client";
import { useEffect, useRef, useState } from "react";
import type { GameRuntime, GameView } from "../lib/game/runtime";
import { PRICES, ROULETTE_RULES, WEAPONS } from "../lib/game/simulation";
import { cardName, cardRank, suitSymbol } from "../lib/game/poker";
const initial: GameView = {
  grenades: 2,
  knifeReady: true,
  phase: "ready",
  health: 100,
  maxHealth: 100,
  inventory: [
    { id: "pistol", label: "Pistol", owned: true },
    { id: "shotgun", label: "Shotgun", owned: false },
    { id: "smg", label: "SMG", owned: false },
    { id: "rifle", label: "Rifle", owned: false },
    { id: "revolver", label: "Revolver", owned: false },
  ],
  perks: [],
  shopOpen: false,
  shopOffers: [],
  pokerOpen: false,
  poker: null,
  roundCue: null,
  roundCueRemaining: 0,
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
  vip: false,
  tables: false,
  slowRound: 0,
  dice: null,
  roulette: null,
  damageBoostRemaining: 0,
  room: "Casino Floor",
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
      <kbd>R</kbd> RELOAD <kbd>E</kbd> INTERACT
      <br />
      <kbd>G</kbd> GRENADE <kbd>V</kbd> KNIFE
      <br />
      <kbd>1–5</kbd> SWITCH <kbd>ESC</kbd> PAUSE
    </div>
  );
}
function PokerMenu({
  poker,
  onSwap,
  onClose,
}: {
  poker: NonNullable<GameView["poker"]>;
  onSwap: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, []);
  const selectedCard = selected === null ? null : poker.hand[selected];
  return (
    <div className="shop-shade poker-shade">
      <section
        ref={dialog}
        className={`poker-menu ${poker.completed ? "poker-completed" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="poker-title"
        aria-describedby="poker-rules"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === dialog.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="poker-heading">
          <div>
            <p className="eyebrow">
              {poker.name.toUpperCase()} · FIVE-CARD CHALLENGE
            </p>
            <h2 id="poker-title">
              {poker.completed
                ? "A hand the house remembers."
                : "Make your own luck."}
            </h2>
          </div>
          <span className="poker-paused">Ⅱ GAME PAUSED</span>
        </div>
        <p id="poker-rules" className="poker-rules">
          Make a flush: <strong>five cards of the same suit.</strong> Ranks can
          be in any order. One free card swap per table, per round. Your hand
          stays with the table.
        </p>
        <div className="poker-hand-heading">
          <div
            className="poker-suit-progress"
            aria-label={`${poker.bestCount} of 5 ${poker.bestSuit}`}
          >
            <span aria-hidden="true">{suitSymbol(poker.bestSuit)}</span>
            <strong>
              {poker.bestCount}
              <small> / 5</small>
            </strong>
            <span className="poker-suit-name">{poker.bestSuit}</span>
          </div>
          <span
            className={`poker-swap-status ${poker.canSwap ? "poker-swap-ready" : ""}`}
          >
            {poker.completed
              ? "FLUSH COMPLETE"
              : poker.canSwap
                ? "FREE SWAP AVAILABLE"
                : "SWAP USED THIS ROUND"}
          </span>
        </div>
        <div
          className="poker-hand"
          role="group"
          aria-label="Your five-card hand. Select one card to swap."
        >
          {poker.hand.map((card, index) => (
            <button
              key={`${index}-${card.rank}-${card.suit}`}
              type="button"
              className={`poker-card ${card.suit === "hearts" || card.suit === "diamonds" ? "poker-card-red" : "poker-card-black"} ${selected === index ? "poker-card-selected" : ""}`}
              aria-label={cardName(card)}
              aria-pressed={selected === index}
              disabled={!poker.canSwap}
              onClick={() => setSelected(selected === index ? null : index)}
            >
              <span className="poker-card-face" aria-hidden="true">
                <span className="poker-card-corner">
                  {cardRank(card.rank)}
                  <small>{suitSymbol(card.suit)}</small>
                </span>
                <span className="poker-card-suit">{suitSymbol(card.suit)}</span>
                <span className="poker-card-corner poker-card-corner-bottom">
                  {cardRank(card.rank)}
                  <small>{suitSymbol(card.suit)}</small>
                </span>
              </span>
              <span className="poker-card-selection" aria-hidden="true">
                {selected === index ? "SWAP THIS CARD" : "KEEP"}
              </span>
            </button>
          ))}
        </div>
        <div
          className={`poker-reward ${poker.completed ? "poker-reward-won" : ""}`}
          role={poker.completed ? "status" : undefined}
        >
          <span className="poker-reward-mark" aria-hidden="true">
            ♠
          </span>
          <div>
            <span className="poker-reward-label">
              {poker.completed
                ? "FLUSH COMPLETE · REWARD SECURED"
                : poker.rewardUnlocked
                  ? "YOUR NEXT FLUSH"
                  : "THE FLUSH REWARD"}
            </span>
            <strong>THE DEAD MAN’S HAND</strong>
            <p>
              {poker.completed
                ? "Your revolver is ready in weapon slot 5. Press 5 on the floor to equip."
                : poker.rewardUnlocked
                  ? "Complete this table’s flush to refill your revolver’s magazine and reserve."
                  : "An exclusive revolver. Complete a flush to unlock and equip weapon slot 5."}
            </p>
          </div>
          <span className="poker-reward-slot" aria-label="Weapon slot 5">
            5<small>WEAPON SLOT</small>
          </span>
        </div>
        <div className="poker-footer">
          <p className="poker-selection-hint" role="status">
            {poker.completed
              ? "This table’s challenge is complete."
              : !poker.canSwap
                ? poker.reason || "Return next round for another free swap."
                : selectedCard
                  ? `${cardName(selectedCard)} selected. Confirm to draw its replacement.`
                  : "Select one card, then confirm your free swap."}
          </p>
          <div className="poker-actions">
            {!poker.completed && (
              <button
                className="primary-button poker-swap-button"
                disabled={!poker.canSwap || selected === null}
                onClick={() => {
                  if (selected === null) return;
                  onSwap(selected);
                  setSelected(null);
                }}
              >
                SWAP CARD <span>↻</span>
              </button>
            )}
            <button className="poker-back-button" onClick={onClose}>
              BACK TO THE FLOOR <span>↗</span>
            </button>
          </div>
        </div>
      </section>
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
    [debug, setDebug] = useState(false),
    [playtesting, setPlaytesting] = useState(false);
  useEffect(() => {
    let disposed = false;
    import("../lib/game/runtime")
      .then(({ GameRuntime }) => {
        if (disposed || !canvas.current) return;
        setPlaytesting(
          process.env.NODE_ENV !== "production" &&
            new URLSearchParams(window.location.search).has("playtest"),
        );
        try {
          runtime.current = new GameRuntime(canvas.current, setView, setError);
          void runtime.current.renderer.ready
            .then(() => {
              if (!disposed) setReady(true);
            })
            .catch(() => {
              if (!disposed)
                setError(
                  "The casino models could not load. Reload to try again.",
                );
            });
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
    paused = view.phase === "paused" && !view.shopOpen && !view.pokerOpen,
    dead = view.phase === "dead";
  const showDice =
    !!view.dice && (!view.dice.resolved || view.dice.resultRemaining > 0);
  const roulette = view.roulette;
  const showRoulette =
    !!roulette && (!roulette.resolved || roulette.resultRemaining > 0);
  const rouletteOutcome =
    roulette?.reward === "ammo"
      ? {
          title: "AMMO REFILLED",
          detail: `${roulette.weapon ? WEAPONS[roulette.weapon].label : "Equipped weapon"} magazine + reserve refilled.`,
        }
      : roulette?.reward === "maxAmmo"
        ? {
            title: "MAX AMMO",
            detail: "Every owned weapon’s magazine + reserve refilled.",
          }
        : roulette?.reward === "jackpot"
          ? {
              title: "ZERO. JACKPOT.",
              detail: `All owned weapons refilled. Double damage for ${ROULETTE_RULES.damageDuration} seconds.`,
            }
          : {
              title: "THE HOUSE HOLDS",
              detail: "No reward this spin. Try your luck again.",
            };
  return (
    <main className={`game-shell ${active ? "in-game" : ""}`}>
      <div className="casino-backdrop" />
      <canvas
        ref={canvas}
        className={`game-canvas ${menu ? "attract" : ""}`}
        aria-label="Last Jackpot first-person casino survival game"
      />
      {menu && <div className="menu-shade" />}
      {!active && !view.shopOpen && !view.pokerOpen && (
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
        <div
          className={`hud ${active && (showDice || showRoulette) ? "has-wager" : ""}`}
          aria-label="Game status"
        >
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
              {view.room.toUpperCase()} <span>{timeString(view.time)}</span>
            </div>
            <div className="points">
              <span className="small-label">CHIPS</span>
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
            <span className={view.vip ? "complete" : ""}>
              {view.vip ? "◆" : "◇"} HIGH ROLLER CLUB
            </span>
            <span className={view.tables ? "complete" : ""}>
              {view.tables ? "◆" : "◇"} DEVIL’S TABLES
            </span>
            <span className={view.upgraded ? "complete" : ""}>
              {view.upgraded ? "◆" : "◇"} WEAPON UPGRADE
            </span>
          </div>
          {active && (
            <>
              {(view.slowRound > 0 || view.damageBoostRemaining > 0) && (
                <div className="status-effects">
                  {view.slowRound > 0 && (
                    <div className="curse-badge">
                      SEVEN’S CURSE{" "}
                      <span>
                        −20% movement ·{" "}
                        {view.slowRound > view.round
                          ? `next round (${view.slowRound})`
                          : `round ${view.slowRound}`}
                      </span>
                    </div>
                  )}
                  {view.damageBoostRemaining > 0 && (
                    <div
                      className="damage-boost-badge"
                      aria-label={`Double damage: ${Math.ceil(view.damageBoostRemaining)} seconds remaining`}
                    >
                      <div>
                        <b>{ROULETTE_RULES.damageMultiplier}×</b>
                        <span>
                          DOUBLE DAMAGE<small>ZERO’S BLESSING</small>
                        </span>
                      </div>
                      <strong>
                        {Math.ceil(view.damageBoostRemaining)}
                        <small>s</small>
                      </strong>
                      <i
                        style={{
                          width: `${Math.min(1, view.damageBoostRemaining / ROULETTE_RULES.damageDuration) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {(showDice || showRoulette) && (
                <div
                  className="gambling-results"
                  aria-label="Table game results"
                >
                  {view.dice && showDice && (
                    <div
                      className={`gambling-card dice-result ${view.dice.resolved && view.dice.values[0] + view.dice.values[1] === 7 ? "cursed" : ""}`}
                      role="status"
                    >
                      <span>SEVEN’S CURSE · CRAPS</span>
                      <div
                        className={
                          view.dice.resolved
                            ? "dice-faces"
                            : "dice-faces rolling"
                        }
                      >
                        {view.dice.resolved ? (
                          view.dice.values.map((n, i) => (
                            <b key={i}>
                              {["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n]}
                            </b>
                          ))
                        ) : (
                          <>
                            <b>⚄</b>
                            <b>⚂</b>
                          </>
                        )}
                      </div>
                      <strong>
                        {!view.dice.resolved
                          ? "Rolling…"
                          : view.dice.values[0] + view.dice.values[1] === 7
                            ? "SEVEN. THE HOUSE COLLECTS."
                            : `${view.dice.values[0] + view.dice.values[1]} · +500 CHIPS`}
                      </strong>
                      <p>
                        {!view.dice.resolved
                          ? "Stay alert. The game keeps moving."
                          : view.dice.values[0] + view.dice.values[1] === 7
                            ? `Movement reduced 20% for round ${view.dice.round}.`
                            : "Your luck holds. Come back next round."}
                      </p>
                    </div>
                  )}
                  {roulette && showRoulette && (
                    <div
                      className={`gambling-card roulette-result roulette-${roulette.resolved ? roulette.reward : "spinning"}`}
                      role="status"
                      key={roulette.id}
                    >
                      <div className="roulette-heading">
                        <span>ROULETTE</span>
                        <small>{PRICES.roulette} CHIPS PAID</small>
                      </div>
                      <div className="roulette-outcome">
                        <div
                          className="roulette-pocket"
                          aria-label={
                            roulette.resolved
                              ? `Winning number ${roulette.number}`
                              : "Result pending"
                          }
                        >
                          <b>{roulette.resolved ? roulette.number : "?"}</b>
                        </div>
                        <div>
                          <strong>
                            {roulette.resolved
                              ? rouletteOutcome.title
                              : "BALL IN MOTION"}
                          </strong>
                          <p>
                            {roulette.resolved
                              ? rouletteOutcome.detail
                              : "Stay alert. Combat continues."}
                          </p>
                        </div>
                      </div>
                      <div className="roulette-footer">
                        <span>
                          {roulette.resolved
                            ? `NEXT SPIN · ${PRICES.roulette} CHIPS`
                            : "WAITING FOR THE BALL"}
                        </span>
                        {!roulette.resolved && (
                          <b aria-hidden="true">
                            {Math.ceil(roulette.remaining)}s
                          </b>
                        )}
                      </div>
                      {!roulette.resolved && (
                        <div className="roulette-progress" aria-hidden="true">
                          <i
                            style={{
                              width: `${Math.max(0, Math.min(1, 1 - roulette.remaining / ROULETTE_RULES.spinDuration)) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {view.roundCue && (
                <div
                  className={`round-announcement ${view.roundCue}`}
                  key={`${view.round}-${view.roundCue}`}
                  role="status"
                >
                  <span>
                    {view.roundCue === "start"
                      ? "THE HOUSE WANTS YOU"
                      : "TAKE A BREATH"}
                  </span>
                  <strong>
                    {view.roundCue === "start"
                      ? `ROUND ${String(view.round).padStart(2, "0")}`
                      : `ROUND ${view.round} SURVIVED`}
                  </strong>
                  <i>
                    {view.roundCue === "start"
                      ? "Stay sharp. Stay moving."
                      : "Reload. Restock. Find your next advantage."}
                  </i>
                </div>
              )}
              {view.intermission > 0 && view.round > 0 && !view.roundCue && (
                <div className="intermission-cue">
                  NEXT ROUND IN <b>{Math.ceil(view.intermission)}</b>
                </div>
              )}

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
                    {view.prompt.actionLabel ||
                      (view.prompt.price ? (
                        <>
                          {view.prompt.price.toLocaleString()}{" "}
                          <small>CHIPS</small>
                        </>
                      ) : (
                        "VIEW MENU"
                      ))}
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
          {view.perks.length > 0 && (
            <div className="perk-badges">
              {view.perks.map((p) => (
                <span key={p.id}>{p.name}</span>
              ))}
            </div>
          )}
          <div className="hud-bottom">
            <div className="health-panel">
              <span className="small-label">
                VITALS <b>{Math.ceil(view.health)}</b>
              </span>
              <div className={`health-track ${view.health < 35 ? "low" : ""}`}>
                <i
                  style={{ width: `${(100 * view.health) / view.maxHealth}%` }}
                />
              </div>
              <span className="hud-hint">
                {view.health < view.maxHealth
                  ? "Health recovers when you avoid damage"
                  : "KEEP MOVING. STAY LUCKY."}
              </span>
            </div>
            <div className="weapon-panel">
              <div className="weapon-slots">
                {view.inventory.map((w, i) => (
                  <span
                    key={w.id}
                    className={view.weapon === w.id ? "selected" : ""}
                  >
                    {i + 1} {w.owned ? w.label.toUpperCase() : "—"}
                  </span>
                ))}
              </div>
              <span className="weapon-name">{view.weaponName}</span>
              <span className="hud-hint">
                G GRENADE · {view.grenades} / 4 &nbsp; V KNIFE ·{" "}
                {view.knifeReady ? "READY" : "RECOVERING"}
              </span>
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
      {view.shopOpen && (
        <div className="shop-shade">
          <section
            className="bar-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Marlowe’s bar menu"
          >
            <div className="bar-menu-heading">
              <div>
                <p className="eyebrow">THE LAST CALL · MARLOWE’S MENU</p>
                <h2>A little house advantage.</h2>
                <p>
                  Perks last for this run. Your game is paused while you order.
                </p>
              </div>
              <strong>
                {view.points.toLocaleString()} <small>CHIPS</small>
              </strong>
            </div>
            <div
              className="bar-weapon-picker"
              aria-label="Choose weapon to upgrade"
            >
              {view.inventory
                .filter((w) => w.owned)
                .map((w) => (
                  <button
                    key={w.id}
                    className={view.weapon === w.id ? "selected" : ""}
                    onClick={() => runtime.current?.selectBarWeapon(w.id)}
                  >
                    {w.label}
                  </button>
                ))}
            </div>
            <div className="cocktail-list">
              {view.shopOffers.map((offer, i) => (
                <button
                  key={offer.id}
                  disabled={!!offer.reason}
                  onClick={() => runtime.current?.buyBar(offer.id)}
                  className={`cocktail-item cocktail-${i}`}
                >
                  <span className="drink-mark">
                    {["♥", "»", "♠", "♢"][i]}
                  </span>
                  <div>
                    <strong>{offer.name}</strong>
                    <span>{offer.detail}</span>
                    <em>{offer.reason || "Buy for this run"}</em>
                  </div>
                  <b>
                    {offer.price.toLocaleString()}
                    <small>CHIPS</small>
                  </b>
                </button>
              ))}
            </div>
            <div className="bar-menu-footer">
              <span>
                {view.message || "Marlowe: Take what you need. Make it back."}
              </span>
              <button className="primary-button" onClick={() => enter()}>
                BACK TO THE FLOOR <span>↗</span>
              </button>
            </div>
          </section>
        </div>
      )}
      {view.pokerOpen && view.poker && (
        <PokerMenu
          key={`${view.poker.id}-${view.poker.swaps}-${view.poker.hand.map((card) => `${card.rank}${card.suit}`).join("-")}`}
          poker={view.poker}
          onSwap={(index) => runtime.current?.swapPoker(index)}
          onClose={() => enter()}
        />
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
                  <span>CHIPS EARNED</span>
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
      {settings && !active && !view.pokerOpen && (
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
      {playtesting && (
        <nav
          className="playtest-tools"
          aria-label="Development playtest controls"
        >
          <strong>DEVELOPMENT PLAYTEST</strong>
          <span>{view.zombieAudioStatus}</span>
          <span>{view.slotAudioStatus}</span>
          {[
            ["new", "Seed run"],
            ["floor", "Casino floor"],
            ["slotsWest", "Slots west"],
            ["slotsEast", "Slots east"],
            ["slotsBank", "Slots second bank"],
            ["sound-slots-west", "Walk slots west"],
            ["sound-slots-east", "Walk slots east"],
            ["sound-slots-bank", "Walk second bank"],
            ["gate", "Lounge door"],
            ["bar", "Bartender"],
            ["loungeWide", "Lounge overview"],
            ["loungeEntrance", "Lounge entry view"],
            ["loungeSeating", "Lounge seating"],
            ["shotgun", "Shotgun rack"],
            ["smg", "SMG rack"],
            ["rifle", "Rifle rack"],
            ["vip", "VIP room"],
            ["couch", "VIP couch"],
            ["poker-a", "Card table I"],
            ["poker-b", "Card table II"],
            ["poker-near-flush", "Prepare flush"],
            ["poker-swap", "Swap test card"],
            ["staff", "Staff door"],
            ["serviceOverview", "Service overview"],
            ["serviceTruck", "Service truck"],
            ["serviceStorage", "Service storage"],
            ["workshop", "Workshop"],
            ["ammo", "Ammo rack"],
            ["tablesGate", "Table room door"],
            ["tables", "Table room"],
            ["craps", "Craps table"],
            ["roulette", "Roulette table"],
            ["rouletteClose", "Wheel close-up"],
            ["roulette-spin", "Spin roulette"],
            ["roulette-4", "Test 4 ammo"],
            ["roulette-24", "Test 24 ammo"],
            ["roulette-7", "Test 7 ammo"],
            ["roulette-0", "Test 0 jackpot"],
            ["roulette-miss", "Test miss"],
            ["roulette-expire", "Expire jackpot"],
            ["roulette-pause", "Pause wager"],
            ["roulette-resume", "Resume wager"],
            ["dice-seven", "Test seven"],
            ["dice-win", "Test payout"],
            ["use", "Interact E"],
            ["left", "Turn left"],
            ["right", "Turn right"],
            ["forward", "Walk forward"],
            ["back", "Walk back"],
            ["shoot", "Fire"],
            ["grenade", "Throw grenade"],
            ["knife", "Knife slash"],
            ["melee-target", "Knife target"],
            ["reload", "Reload"],
            ["weapon-pistol", "Equip pistol"],
            ["weapon-shotgun", "Equip shotgun"],
            ["weapon-smg", "Equip SMG"],
            ["weapon-rifle", "Equip rifle"],
            ["weapon-revolver", "Equip revolver"],
            ["clear", "Finish round"],
            ["round", "Start round"],
            ["crowd", "Spawn 14"],
            ["sound-chase", "Hear chase"],
            ["sound-last", "Hear last zombie"],
            ["sound-horde", "Hear horde"],
            ["zombies", "Zombie lineup"],
            ["zombie-wounds", "Show wounds"],
            ["zombie-limbs", "Sever limbs"],
            ["zombie-attacks", "Three attacks"],
          ].map(([id, label]) => (
            <button
              key={id}
              disabled={!ready}
              onClick={() => runtime.current?.testAction(id)}
            >
              {label}
            </button>
          ))}
        </nav>
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
