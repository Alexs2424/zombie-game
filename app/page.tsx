/* eslint-disable @next/next/no-img-element -- HUD weapon art is static, pre-sized WebP drawn over the WebGL canvas. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameRuntime, GameView } from "../lib/game/runtime";
import { PRICES, ROULETTE_RULES, WEAPONS } from "../lib/game/simulation";
import { cardName, cardRank, suitSymbol } from "../lib/game/poker";
import { HOTEL_RULES } from "../lib/game/hotel-gameplay";
import { DevPanel } from "./dev-panel";
const initial: GameView = {
  owned: [{ id: "pistol", label: "Pistol", key: "1" }],
  pickup: null,
  mysteryReel: { spinning: false, id: null },
  casino: {holding:false,chip:25,bets:{},nearTable:false,result:"",speakeasy:false,nearPainting:false,paintingOpen:false,codeProgress:0,mystery:"",nearMystery:false},
  grenades: 2,
  knifeReady: true,
  phase: "ready",
  stamina: 100,
  sprintExhausted: false,
  health: 100,
  maxHealth: 100,
  inventory: [
    { id: "pistol", label: "Pistol", owned: true },
    { id: "shotgun", label: "Shotgun", owned: false },
    { id: "smg", label: "SMG", owned: false },
    { id: "rifle", label: "Rifle", owned: false },
    { id: "revolver", label: "Revolver", owned: false },
    { id: "tommy", label: "Tommy gun", owned: false },
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
  tables: true,
  supply: false,
  cashier: false,
  doorsOpen: { lounge: false, shortcut: false, vip: false, vipExit: false, supply: false, cashier: false },
  hotel: false,
  hotelMystery: { ledgerFound: false, suitcaseFound: false, keyFound: false, passageOpen: false, registerFound: false, cacheClaimed: false },
  hotelDocument: null,
  hotelChallenge: { phase: "idle", remaining: 0, pending: 0, alive: 0 },
  slowRound: 0,
  dice: null,
  roulette: null,
  diceResults: [],
  rouletteResults: [],
  damageBoostRemaining: 0,
  room: "Grand Casino",
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
      <kbd>W A S D</kbd> MOVE <kbd>SPACE</kbd> SPRINT
      <br />
      <kbd>MOUSE</kbd> LOOK <kbd>LEFT CLICK</kbd> FIRE
      <br />
      <kbd>R</kbd> RELOAD <kbd>F</kbd> INTERACT
      <br />
      <kbd>G</kbd> GRENADE <kbd>V</kbd> KNIFE
      <br />
      <kbd>C</kbd> HOLD CHIPS · AIM + CLICK TO BET
      <br />
      CHIPS: <kbd>R</kbd> VALUE <kbd>X</kbd> TAKE BETS <kbd>F</kbd> PUT AWAY / ROLL
      <br />
      <kbd>SHIFT / RMB</kbd> HOLD AIM <kbd>B</kbd> BOTH BARRELS
      <br />
      <kbd>1–2</kbd> <kbd>Q / E</kbd> <kbd>WHEEL</kbd> SWITCH <kbd>ESC</kbd> PAUSE
    </div>
  );
}
const MYSTERY_REEL = [
  "magnum",
  "tommy",
  "doublebarrel",
  "dual",
  "machinepistol",
  "lever",
  "autoshotgun",
  "sniper",
  "lmg",
  "launcher",
] as const;
/** Cycles the ten Blender renders while the cabinet spins, then shows the payout. */
function MysteryReel({ reel }: { reel: GameView["mysteryReel"] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!reel.spinning) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 95);
    return () => window.clearInterval(timer);
  }, [reel.spinning]);
  const id = reel.spinning ? MYSTERY_REEL[tick % MYSTERY_REEL.length] : reel.id;
  if (!id) return null;
  return (
    <div className={`mystery-reel ${reel.spinning ? "spinning" : "paid"}`}>
      <img src={`/ui/weapons/${id}-side.webp`} alt="" />
    </div>
  );
}
function HotelDocument({
  document: clue,
  onReturn,
  onPause,
}: {
  document: NonNullable<GameView["hotelDocument"]>;
  onReturn: () => void;
  onPause: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, [clue.id]);
  return (
    <div className="hotel-document-shade">
      <section
        className="hotel-document"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotel-document-title"
        aria-describedby="hotel-document-body"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header className="hotel-document-masthead">
          <span>GRAND HOTEL</span>
          <span>Ⅱ GAME PAUSED</span>
        </header>
        <div className="hotel-document-paper">
          <div className="hotel-document-crest" aria-hidden="true">GH</div>
          <p className="hotel-document-kicker">{clue.kicker}</p>
          <h2 id="hotel-document-title">{clue.title}</h2>
          <div id="hotel-document-body" className="hotel-document-body">
            {clue.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          <div className="hotel-document-lead">
            <span>YOUR NOTES</span>
            <p>{clue.lead}</p>
          </div>
        </div>
        <footer className="hotel-document-footer">
          <p>Saved for this run.<br /><span>Revisit from the pause menu.</span></p>
          <div>
            <button className="hotel-document-pause" onClick={onPause}>PAUSE MENU <kbd>ESC</kbd></button>
            <button className="primary-button" onClick={onReturn}>RETURN TO RUN <span>↗</span></button>
          </div>
        </footer>
      </section>
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
    runtime = useRef<GameRuntime | null>(null),
    resumeButton = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState(initial),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [settings, setSettings] = useState(false),
    [sensitivity, setSensitivity] = useState(1),
    [volume, setVolume] = useState(0.45),
    [debug, setDebug] = useState(false),
    [playtesting, setPlaytesting] = useState(false),
    [devOpen, setDevOpen] = useState(false);
  const [rangeMode, setRangeMode] = useState(false);
  const [scenario, setScenario] = useState("targets");
  const [god, setGod] = useState(false);
  const [showExplanations, setShowExplanations] = useState(true);
  const changeExplanations = (show: boolean) => {
    setShowExplanations(show);
    try { localStorage.setItem("last-jackpot-explanations", String(show)); } catch { /* Storage may be unavailable in private previews. */ }
  };
  const [spawnBehavior, setSpawnBehavior] = useState("pursuit");
  useEffect(() => {
    if (!playtesting || rangeMode) return;
    const key = (event: KeyboardEvent) => {
      if (event.code !== "F2" || event.repeat) return;
      event.preventDefault();
      runtime.current?.pause();
      setDevOpen(open => !open);
    };
    const lock = () => { if (document.pointerLockElement) setDevOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerlockchange", lock);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerlockchange", lock); };
  }, [playtesting, rangeMode]);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new ResizeObserver(() => runtime.current?.renderer.resize());
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    import("../lib/game/runtime")
      .then(({ GameRuntime }) => {
        if (disposed || !canvas.current) return;
        try { setShowExplanations(localStorage.getItem("last-jackpot-explanations") !== "false"); } catch {}
        setRangeMode(process.env.NODE_ENV !== "production" && new URLSearchParams(location.search).has("range"));
        setPlaytesting(
          process.env.NODE_ENV !== "production" &&
            new URLSearchParams(window.location.search).has("playtest"),
        );
        try {
          runtime.current = new GameRuntime(canvas.current, setView, setError);
          if (
            process.env.NODE_ENV !== "production" &&
            new URLSearchParams(window.location.search).has("playtest")
          )
            // Browser automation hook for development screenshots only.
            (window as unknown as { __lastJackpot?: GameRuntime }).__lastJackpot =
              runtime.current;
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
    paused = view.phase === "paused" && !view.shopOpen && !view.pokerOpen && !view.hotelDocument,
    dead = view.phase === "dead";
  useEffect(() => {
    if (paused) resumeButton.current?.focus();
  }, [paused]);
  const runPlaytestAction = useCallback((id: string) => runtime.current?.testAction(id), []);
  const tableDice = view.diceResults.find(({ tableId }) => tableId === view.casino.tableId)?.dice;
  const showBetting = view.casino.nearTable && (
    view.casino.holding || Object.values(view.casino.bets).some(value => (value ?? 0) > 0) ||
    tableDice?.quickWager === false
  );
  const diceResults = view.diceResults.filter(({ tableId, dice }) =>
    (!dice.resolved || dice.resultRemaining > 0) && !(showBetting && tableId === view.casino.tableId));
  const rouletteResults = view.rouletteResults.filter(({ roulette }) => !roulette.resolved || roulette.resultRemaining > 0);
  const showDice = diceResults.length > 0;
  const showRoulette = rouletteResults.length > 0;
  const rouletteOutcome = (roulette: NonNullable<GameView["roulette"]>) =>
    roulette.reward === "ammo"
      ? { title: "AMMO REFILLED", detail: `${roulette.weapon ? WEAPONS[roulette.weapon].label : "Equipped weapon"} magazine + reserve refilled.` }
      : roulette.reward === "maxAmmo"
        ? { title: "MAX AMMO", detail: "Every owned weapon’s magazine + reserve refilled." }
        : roulette.reward === "jackpot"
          ? { title: "ZERO. JACKPOT.", detail: `All owned weapons refilled. Double damage for ${ROULETTE_RULES.damageDuration} seconds.` }
          : { title: "THE HOUSE HOLDS", detail: "No reward this spin. Try your luck again." };

  useEffect(() => {
    if (ready && rangeMode) runtime.current?.rangeAction("targets");
  }, [ready, rangeMode]);
  const rangeAction = (action: string) => { runtime.current?.rangeAction(action); if (["targets","pursuit","blast","empty"].includes(action)) {setScenario(action);setGod(false);} if(action === "reset") setGod(false); };
  return (
    <main className={`game-shell ${showExplanations ? "" : "hide-explanations"} ${active ? "in-game" : ""} ${rangeMode ? "range-workspace" : playtesting ? "development-shell" : ""}`}>
      <div className="game-viewport">
      <div className="casino-backdrop" />
      <canvas
        ref={canvas}
        className={`game-canvas ${menu ? "attract" : ""}`}
        aria-label="Last Jackpot first-person casino survival game"
      />
      {menu && <div className="menu-shade" />}
      {!active && (!playtesting || menu || dead) && !view.shopOpen && !view.pokerOpen && (
        <header className="masthead">
          <div className="wordmark">
            LJ<span>LAST JACKPOT</span>
          </div>
          <span className="build-tag">SOLO SURVIVAL · V0</span>
        </header>
      )}
      {menu && !rangeMode && (
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
                {view.hotelChallenge.phase === "active" ? "RESTAURANT AMBUSH" : view.intermission > 0
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
              {view.lounge ? "◆" : "◇"} BAR · {+view.doorsOpen.lounge + +view.doorsOpen.shortcut}/2 DOORS
            </span>
            <span className={view.vip ? "complete" : ""}>
              {view.vip ? "◆" : "◇"} HIGH ROLLER · {+view.doorsOpen.vip + +view.doorsOpen.vipExit}/2 DOORS
            </span>
            <span className={view.supply ? "complete" : ""}>
              {view.supply ? "◆" : "◇"} SUPPLY ROOM
            </span>
            <span className={view.cashier ? "complete" : ""}>
              {view.cashier ? "◆" : "◇"} CASHIER
            </span>
            <span className={view.hotel ? "complete" : ""}>
              {view.hotel ? "◆" : "◇"} GRAND HOTEL
            </span>
            {view.hotel && <span className={view.hotelChallenge.phase === "complete" ? "complete" : ""}>
              {view.hotelChallenge.phase === "complete" ? "◆ TOMMY GUN" : "◇ RESTAURANT BELL"}
            </span>}
            <span className={view.upgraded ? "complete" : ""}>
              {view.upgraded ? "◆" : "◇"} WEAPON UPGRADE
            </span>
          </div>
          {active && (
            <>
              {showBetting && (
                <section className="casino-betting" aria-label="Craps place bets">
                  <small>CRAPS {view.casino.tableId === "craps-b" ? "2" : "1"} · PLACE BETS</small>
                  <strong>{view.casino.holding ? `HOLDING ${view.casino.chip} CHIPS` : "C · TAKE CHIPS IN HAND"}</strong>
                  <div className="bet-number-row">{[4,5,6,8,9,10].map(n=><div key={n}><b>{n}</b><span>{view.casino.bets[n]??0} ON</span><small>+{Math.ceil(view.casino.chip/(n===6||n===8?6:5))*(n===6||n===8?6:5)} CHIPS</small></div>)}</div>
                  <p>Aim at a printed number + click · R chip value<br/>F put away / roll · X return bets · weapon keys put chips away</p>
                  {view.casino.hover && <p className="bet-hover-hint">{view.casino.hover.affordable ? `CLICK · ${view.casino.hover.amount} CHIPS ON ${view.casino.hover.number}` : `NEED ${view.casino.hover.amount} CHIPS`}</p>}
                  <small>4/10 pay 9:5 · 5/9 pay 7:5 · 6/8 pay 7:6<br/>One roll per table each round. Seven clears this table’s bets.</small>
                  {tableDice && <p role="status">{tableDice.resolved ? `${tableDice.values[0]} + ${tableDice.values[1]} · ${view.casino.result}` : "⚄ ⚂ Rolling… bets locked"}</p>}
                </section>
              )}
              {view.casino.nearPainting && view.casino.paintingOpen && !view.casino.speakeasy && <div className="secret-status">THE LOCK · {view.casino.codeProgress} / 8<br/><small>Read the pinned cards left to right. Shoot suit, then number.</small></div>}
              {view.casino.nearMystery && (
                <div className="secret-status mystery-status">
                  <strong>THE VELVET FORTUNE</strong>
                  <MysteryReel reel={view.mysteryReel} />
                  <p>
                    {view.casino.mystery ||
                      "400 chips · 50% one of ten 1970s house guns / 50% nothing · F spin"}
                  </p>
                </div>
              )}
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
                  className={`gambling-results ${diceResults.length + rouletteResults.length > 2 ? "multiple-wagers" : ""}`}
                  aria-label="Table game results"
                >
                  {diceResults.map(({ tableId, label, dice, result }) => (
                    <div
                      className={`gambling-card dice-result ${dice.resolved && dice.values[0] + dice.values[1] === 7 ? "cursed" : ""}`}
                      key={tableId}
                      role="status"
                    >
                      <span>{dice.quickWager === false ? "PLACE BETS" : "SEVEN’S CURSE"} · {label}</span>
                      <div
                        className={
                          dice.resolved
                            ? "dice-faces"
                            : "dice-faces rolling"
                        }
                      >
                        {dice.resolved ? (
                          dice.values.map((n, i) => (
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
                        {!dice.resolved
                          ? "Rolling…"
                          : dice.quickWager === false
                            ? result
                            : dice.values[0] + dice.values[1] === 7
                            ? "SEVEN. THE HOUSE COLLECTS."
                            : `${dice.values[0] + dice.values[1]} · +500 CHIPS`}
                      </strong>
                      <p>
                        {!dice.resolved
                          ? "Stay alert. The game keeps moving."
                          : dice.quickWager === false
                            ? "Winnings paid. Remaining bets stay on this table."
                            : dice.values[0] + dice.values[1] === 7
                            ? `Movement reduced 20% for round ${dice.round}.`
                            : "Your luck holds. Come back next round."}
                      </p>
                    </div>
                  ))}
                  {rouletteResults.map(({ tableId, label, roulette }) => (
                    <div
                      className={`gambling-card roulette-result roulette-${roulette.resolved ? roulette.reward : "spinning"}`}
                      role="status"
                      key={`${tableId}-${roulette.id}`}
                    >
                      <div className="roulette-heading">
                        <span>{label}</span>
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
                              ? rouletteOutcome(roulette).title
                              : "BALL IN MOTION"}
                          </strong>
                          <p>
                            {roulette.resolved
                              ? rouletteOutcome(roulette).detail
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
                  ))}
                </div>
              )}
              {view.hotelChallenge.phase === "active" && (
                <div className="hotel-challenge" role="status">
                  <span>LAST SERVICE · RESTAURANT AMBUSH</span>
                  <strong>{view.hotelChallenge.remaining > 0 ? `${Math.ceil(view.hotelChallenge.remaining)}s` : "CLEAR THE ROOM"}</strong>
                  <p>Stay upstairs · {view.hotelChallenge.alive + view.hotelChallenge.pending} ambushers remaining</p>
                  <div className="hotel-challenge-progress"><i style={{ width: `${Math.min(100, Math.max(0, 1 - view.hotelChallenge.remaining / HOTEL_RULES.ambushDuration) * 100)}%` }} /></div>
                  <small>Reward: THE CHICAGO TYPEWRITER · Tommy gun</small>
                </div>
              )}
              {view.roundCue && view.hotelChallenge.phase !== "active" && (
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
              {view.intermission > 0 && view.intermission <= 30 && view.round > 0 && !view.roundCue && view.hotelChallenge.phase !== "active" && (
                <div className="intermission-cue">
                  NEXT ROUND IN <b>{Math.ceil(view.intermission)}</b>
                </div>
              )}

              <div
                className={`crosshair ${view.aiming ? "aiming" : ""} ${view.hit > 0 ? "hit" : ""} ${view.headshot ? "headshot" : ""}`}
              >
                <i />
                <i />
                <i />
                <i />
              </div>
              {view.scoped && <div className="scope-view" aria-label="Fixed four-power scope"><div className="scope-reticle" /></div>}
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
                  <kbd>F</kbd>
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
                      ) : view.prompt.name.startsWith("Craps") ? (
                        "ROLL DICE"
                      ) : view.prompt.name === "The crooked portrait" ? (
                        "REVEAL"
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
          {view.pickup && !(playtesting && paused) && (
            <section
              className="pickup-card"
              key={`${view.pickup.id}-${view.pickup.at}`}
              role="status"
              aria-label={`${view.pickup.name} acquired`}
            >
              <span className="pickup-eyebrow">
                {view.pickup.melee ? "IN HAND" : "THE HOUSE PAYS OUT"}
              </span>
              <img src={`/ui/weapons/${view.pickup.id}-card.webp`} alt="" />
              <strong>{view.pickup.name}</strong>
              <small>
                {view.pickup.label.toUpperCase()}
                {view.pickup.id === "stick"
                  ? " · 3 SWEEPS"
                  : view.pickup.melee
                    ? " · MELEE"
                    : ` · ${view.pickup.capacity} ROUNDS`}
              </small>
              <dl>
                {(
                  [
                    ["Damage", view.pickup.stats.damage],
                    ["Fire rate", view.pickup.stats.rate],
                    ["Capacity", view.pickup.stats.capacity],
                    ["Mobility", view.pickup.stats.mobility],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      <i style={{ width: `${Math.round(value * 100)}%` }} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p>{view.pickup.flavor}</p>
            </section>
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
              <div className={`stamina-meter ${view.sprintExhausted ? "exhausted" : ""}`}>
                <span>{view.sprintExhausted ? "RECOVERING" : "STAMINA"}</span>
                <progress aria-label="Sprint stamina" value={view.stamina} max={100} />
              </div>
              <span className="hud-hint">
                {view.health < view.maxHealth
                  ? "Health recovers when you avoid damage"
                  : "KEEP MOVING. STAY LUCKY."}
              </span>
            </div>
            <div className="weapon-panel">
              <div className="weapon-slots" aria-label="Owned weapons">
                {view.owned.map((w) => (
                  <span
                    key={w.id}
                    className={view.weapon === w.id ? "selected" : ""}
                    title={w.label}
                  >
                    <b>{w.key}</b>
                    <img src={`/ui/weapons/${w.id}-side.webp`} alt={w.label} />
                  </span>
                ))}
              </div>
              <div className="weapon-indicator">
                <img src={`/ui/weapons/${view.weapon}-side.webp`} alt="" />
                <span className="weapon-name">{view.weaponName}</span>
              </div>
              {view.casino.holding && (
                <span className="hud-hint">
                  CHIPS IN HAND · {view.casino.chip} · F / WEAPON KEY TO EQUIP
                </span>
              )}
              <span className="hud-hint">
                G GRENADE · {view.grenades} / 4 &nbsp; V KNIFE ·{" "}
                {view.knifeReady ? "READY" : "RECOVERING"}
              </span>
              {view.weapon === "stick" || view.weapon === "axe" ? (
                <div className="ammo melee">
                  <strong>
                    {view.weapon === "stick" ? view.mag : "∞"}
                  </strong>
                  <span>{view.weapon === "stick" ? "SWEEPS LEFT" : "NEVER BREAKS"}</span>
                </div>
              ) : (
                <div className="ammo">
                  <strong className={view.mag === 0 ? "empty" : ""}>
                    {String(view.mag).padStart(2, "0")}
                  </strong>
                  <span>/ {view.reserve}</span>
                </div>
              )}
              <span className="hud-hint">
                {view.mag === 0
                  ? "R TO RELOAD"
                  : "R RELOAD · F INTERACT · ESC PAUSE"}
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
      {view.hotelDocument && (
        <HotelDocument
          document={view.hotelDocument}
          onReturn={() => runtime.current?.closeHotelDocument(true)}
          onPause={() => runtime.current?.closeHotelDocument()}
        />
      )}
      {((paused && !playtesting) || dead) && !rangeMode && (
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
            {paused && (view.hotelMystery.ledgerFound || view.hotelMystery.suitcaseFound || view.hotelMystery.registerFound) && (
              <section className="hotel-journal" aria-labelledby="hotel-journal-title">
                <div className="hotel-journal-heading">
                  <h3 id="hotel-journal-title">The missing guest</h3>
                  <span>RETAINED CLUES</span>
                </div>
                <div className="hotel-journal-entries">
                  {view.hotelMystery.ledgerFound && <button onClick={() => runtime.current?.readHotelDocument("ledger")}><span>01</span> Guest ledger <b>↗</b></button>}
                  {view.hotelMystery.suitcaseFound && <button onClick={() => runtime.current?.readHotelDocument("suitcase")}><span>02</span> The abandoned suitcase <b>↗</b></button>}
                  {view.hotelMystery.registerFound && <button onClick={() => runtime.current?.readHotelDocument("register")}><span>03</span> Collection register <b>↗</b></button>}
                </div>
                <p>{view.hotelMystery.passageOpen ? "Service gallery unlocked for this run." : view.hotelMystery.keyFound ? "Brass service key acquired." : "Your discoveries are saved during this run."}{view.hotelMystery.cacheClaimed ? " Supplies collected." : ""}</p>
              </section>
            )}
            <button ref={resumeButton} className="primary-button" onClick={() => enter(dead)}>
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
      {settings && !active && !view.pokerOpen && !view.hotelDocument && (
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
          <label className="debug-check">
            <input type="checkbox" checked={showExplanations} onChange={e => changeExplanations(e.target.checked)} />
            Show tips & explanation cards
          </label>
          <Controls />
          {process.env.NODE_ENV !== "production" && (
            <fieldset className="debug-actions">
              <legend>Debug · current run</legend>
              <button disabled={!ready || view.phase === "ready" || view.phase === "dead"} onClick={() => runtime.current?.debugAction("unlock-all")}>Open all doors</button>
              <button disabled={!ready || view.phase === "ready" || view.phase === "dead"} onClick={() => runtime.current?.debugAction("add-chips")}>+10,000 chips</button>
              <button disabled={!ready || view.phase === "ready" || view.phase === "dead"} onClick={() => runtime.current?.debugAction("toggle-invulnerability")}>Toggle invulnerability</button>
              <small>Start a run first. Includes the hotel and speakeasy. New runs reset these changes.</small>
            </fieldset>
          )}
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
      {playtesting && !rangeMode && <div className="dev-launcher">
        <button onClick={()=>{window.location.assign(new URL("/?playtest=1&range=1", window.location.origin));}}>Mechanics lab →</button>
        {view.previewControls && active && <span className="dev-preview-hint">PREVIEW · Right-drag to look · WASD move · Left-click fire</span>}
        <button onClick={() => { runtime.current?.pause(); setDevOpen(open=>!open); }} aria-expanded={devOpen}>F2 · {devOpen ? "Hide tools" : "Developer tools"}</button>
        {paused && <button disabled={!ready} onClick={()=>{setDevOpen(false);void runtime.current?.enter();}}>Ⅱ Paused · Resume</button>}
      </div>}
      </div>
      {playtesting && !rangeMode && devOpen && <DevPanel view={view} ready={ready}
        onAction={runPlaytestAction}
        onPlay={()=>{setDevOpen(false);setSettings(false);void runtime.current?.enter();}}
        onPause={()=>runtime.current?.pause()} onClose={()=>setDevOpen(false)} />}
      {rangeMode && <aside className="range-panel" aria-label="Mechanics test range">
        <p className="range-kicker">DEVELOPMENT / SANDBOX</p>
        <h1>Mechanics lab</h1>
        <p>Move freely. Test one variable. Reset and repeat.</p>
        <button className="range-play" disabled={!ready} onClick={() => {if(view.phase === "dead") setGod(false); enter(view.phase === "dead");}}>{active ? "Recapture mouse" : view.phase === "dead" ? "Restart scenario" : "Play scenario"}</button>
        <button onClick={() => runtime.current?.pause()}>Pause / release mouse · Esc</button>
        <label><input type="checkbox" checked={showExplanations} onChange={e => changeExplanations(e.target.checked)} /> Show tips & explanation cards</label>
        <h2>Scenario</h2>
        <select aria-label="Test scenario" value={scenario} disabled={!ready} onChange={e => rangeAction(e.target.value)}>
          <option value="targets">Weapon range · 5 / 10 / 20 m</option>
          <option value="pursuit">Combat · three pursuing zombies</option>
          <option value="blast">Explosions · cover and self damage</option>
          <option value="empty">Movement · empty greybox</option>
        </select>
        <p>{scenario === "targets" ? "Three stationary zombies at the selected round’s health. Compare sights, spread, reloads and hit reactions. They can still attack at close range." : scenario === "pursuit" ? "Three active zombies, no automatic waves. Test movement and close combat." : scenario === "blast" ? "G throws a grenade. Compare exposed distance with the tall cover wall. Damage is enabled; nearby blasts can kill." : "Clear floor, low obstacles and full-height cover for movement checks."}</p>
        <label>Test round <input type="number" min={1} max={100} value={view.round} onChange={e => rangeAction(`round-health:${e.target.value}`)} /></label>
        <button disabled={!ready} onClick={() => rangeAction("reset")}>Reset this scenario</button>
        <h2>Add enemies</h2>
        <select aria-label="Spawn behavior" value={spawnBehavior} onChange={e => setSpawnBehavior(e.target.value)}>
          <option value="pursuit">Pursuing zombies</option>
          <option value="stationary">Stationary targets</option>
        </select>
        <div className="range-spawn-buttons">
          {[1,5,10].map(count => <button key={count} disabled={!ready || view.phase === "dead" || view.enemies >= 60} onClick={() => rangeAction(`spawn:${count}:${spawnBehavior}`)}>+{count}</button>)}
        </div>
        <p>Add to this run without resetting. Spawns favor space ahead of you. Limit: 60 enemies.</p>
        <h2>Loadout · 2 guns</h2>
        <output>{view.owned.filter(w => w.id !== "axe" && w.id !== "stick").map(w => `${w.key} · ${w.label}`).join(" / ")}</output>
        <select aria-label="Range weapon" value={view.weapon} disabled={!ready} onChange={e => rangeAction(`equip:${e.target.value}`)}>
          {Object.entries(WEAPONS).map(([id,w]) => <option key={id} value={id}>{w.label} · {w.damage * w.pellets} damage{w.pellets > 1 ? " (all pellets)" : ""}</option>)}
        </select>
        <button disabled={!ready} onClick={() => rangeAction("refill")}>Restore health, ammo & grenades</button>
        <button disabled={!ready} onClick={() => rangeAction("clear")}>Clear enemies & live grenades</button>
        <label><input type="checkbox" checked={god} disabled={!ready} onChange={e => {setGod(e.target.checked);rangeAction("god");}} /> Invulnerable (damage off)</label>
        <h2>Live readout</h2>
        <output>{view.phase.toUpperCase()} · {Math.ceil(view.health)} HP<br />{view.enemies} enemies · {view.grenades} grenades<br />{Math.round(view.fps)} FPS · {view.p95.toFixed(1)} ms p95</output>
        <h2>Controls</h2>
        <p>WASD move · Space sprint · Mouse look<br />LMB fire · Shift / RMB sights · R reload<br />G grenade · V melee · Q / E switch · F interact</p>
        <p>Embedded preview: if mouse capture is unavailable, hold RMB and drag to look. Click the scene before moving.</p>
        <button onClick={()=>window.location.assign(new URL("/?playtest=1", window.location.origin))}>Casino integration tests →</button>
      </aside>}
    </main>
  );
}
