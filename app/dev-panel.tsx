"use client";
import { useState } from "react";
import type { GameView } from "../lib/game/runtime";

const groups: Record<string, string[][]> = {
  "Hotel and casino QA": [
    ["toggle-invulnerability","Toggle invulnerability"],
    ["hotel-reception","Reception ledger"],
    ["hotel-suitcase","Guest suitcase"],
    ["hotel-panel","Concealed panel"],
    ["hotel-register","Collection register"],
    ["hotel-cache","Gallery supplies"],
    ["mystery-unlock","Unlock gallery (QA)"],
    ["casinoWide","Grand casino overview"],
    ["barExit","Bar second door"],
    ["vipGate","High Roller entrance"],
    ["vipExit","High Roller second door"],
    ["casinoCouchNorth","Casino north couch"],
    ["casinoCouchSouth","Casino south couch"],
    ["loungeCouch","Lounge couch"],
    ["cashierGate","Cashier entrance"],
    ["cashier","Cashier room"],
    ["crapsB","Craps table II"],
    ["craps-roll-b","Roll craps II"],
    ["rouletteB","Roulette table II"],
    ["roulette-spin-b","Spin roulette II"],
  ],
  "Session": [
    ["new", "Seed run"],
    ["unlock-all", "Open all doors"],
    ["add-chips", "+10,000 chips"]
  ],
  "Locations": [
    ["hotel-entrance", "Hotel entrance"],
    ["hotel-lobby", "Hotel lobby"],
    ["hotel-upper", "Restaurant"],
    ["hotel-jukebox", "Lobby jukebox"],
    ["hotel-tour", "Walk hotel loop"],
    ["floor", "Casino floor"],
    ["slotsWest", "Slots west"],
    ["slotsEast", "Slots east"],
    ["slotsBank", "Slots second bank"],
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
    ["staff", "Staff door"],
    ["serviceOverview", "Service overview"],
    ["serviceTruck", "Service truck"],
    ["serviceStorage", "Service storage"],
    ["workshop", "Workshop"],
    ["ammo", "Ammo rack"],
    ["tablesGate", "Table room door"],
    ["tables", "Table room"],
    ["craps", "Craps table"],
    ["clue", "Clue table"],
    ["portrait", "Secret portrait"],
    ["mystery-view", "Mystery machine"],
    ["roulette", "Roulette table"],
    ["rouletteClose", "Wheel close-up"],
    ["use", "Interact E"],
    ["left", "Turn left"],
    ["right", "Turn right"],
    ["forward", "Walk forward"],
    ["back", "Walk back"]
  ],
  "Weapons": [
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
    ["weapon-tommy", "Equip Tommy"],
    ["give-magnum", "Give High Roller"],
    ["give-tommy", "Give Chicago Typewriter"],
    ["give-doublebarrel", "Give Double or Nothing"],
    ["give-dual", "Give Snake Eyes"],
    ["give-machinepistol", "Give Enforcer"],
    ["give-lever", "Give Silver Dollar"],
    ["give-autoshotgun", "Give Last Call"],
    ["give-sniper", "Give Eye in the Sky"],
    ["give-lmg", "Give House Edge"],
    ["give-launcher", "Give Debt Collector"],
    ["give-stick", "Give Stickman"],
    ["give-axe", "Give Fire Exit"]
  ],
  "Combat": [
    ["zombie-deaths", "Collapse zombies"],
    ["bell-clear-wave", "Clear ambushers (QA)"],
    ["hotel-chase", "Test upstairs pursuit"],
    ["clear", "Finish round"],
    ["round", "Start round"],
    ["crowd", "Spawn 14"],
    ["zombies", "Zombie lineup"],
    ["zombie-wounds", "Show wounds"],
    ["zombie-limbs", "Sever limbs"],
    ["zombie-attacks", "Three attacks"]
  ],
  "Casino": [
    ["hotel-bell", "Restaurant bell"],
    ["poker-a", "Card table I"],
    ["poker-b", "Card table II"],
    ["poker-near-flush", "Prepare flush"],
    ["poker-swap", "Swap test card"],
    ["hold-chips", "Hold chips"],
    ["bet-4", "Place 4"],
    ["bet-6", "Place 6"],
    ["take-bets", "Take bets"],
    ["key-spade", "Shoot spade"],
    ["key-7", "Shoot 7"],
    ["key-heart", "Shoot heart"],
    ["key-4", "Shoot 4"],
    ["key-club", "Shoot club"],
    ["key-9", "Shoot 9"],
    ["key-diamond", "Shoot diamond"],
    ["key-2", "Shoot 2"],
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
    ["dice-win", "Test payout"]
  ],
  "Audio": [
    ["sound-slots-west", "Walk slots west"],
    ["sound-slots-east", "Walk slots east"],
    ["sound-slots-bank", "Walk second bank"],
    ["sound-chase", "Hear chase"],
    ["sound-last", "Hear last zombie"],
    ["sound-horde", "Hear horde"]
  ]
};

export function DevPanel({view, ready, onAction, onPlay, onPause, onClose}: {
  view: GameView; ready: boolean; onAction: (id: string) => void;
  onPlay: () => void; onPause: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState("Session");
  const [query, setQuery] = useState("");
  const [last, setLast] = useState("");
  const source = query.trim() ? Object.entries(groups) : [[tab, groups[tab]]] as [string, string[][]][];
  return <aside className="dev-panel playtest-tools" aria-label="Development workspace">
    <header><div><small>LAST JACKPOT</small><h2>Development</h2></div><button onClick={onClose} aria-label="Close development panel">×</button></header>
    <div className="dev-session">
      <span className={`dev-state ${view.phase}`}>{view.phase === "paused" ? "INSPECTING" : view.phase.toUpperCase()}</span>
      <div className="dev-buttons"><button disabled={!ready} onClick={onPlay}>▶ Play · capture mouse</button><button disabled={!ready || view.phase !== "playing"} onClick={onPause}>Ⅱ Inspect</button></div>
      <small>F2 tools · Esc releases mouse · Play hides tools</small>
    </div>
    <label className="dev-search">Find a tool<input type="search" placeholder="Search weapons, places, actions…" value={query} onChange={e=>setQuery(e.target.value)} /></label>
    <nav aria-label="Tool categories">{Object.keys(groups).map(name=><button key={name} aria-pressed={tab===name} onClick={()=>{setTab(name);setQuery("");}}>{name}</button>)}</nav>
    <div className="dev-tool-list">{source.map(([name, actions])=> {
      const matches=actions.filter(([,label])=>label.toLowerCase().includes(query.toLowerCase().trim()));
      return matches.length ? <section key={name}><h3>{name}</h3>{name==="Session" && <p>Seed run starts a fresh sandbox with chips and invulnerability. Hotel scenarios also start a fresh run.</p>}<div className="dev-action-grid">{matches.map(([id,label])=><button key={id} disabled={!ready || ((view.phase === "ready" || view.phase === "dead") && id !== "new" && !id.startsWith("hotel-") && !id.startsWith("sound-"))} onClick={()=>{onAction(id);setLast(label);}}>{label}</button>)}</div></section> : null;
    })}{!source.some(([,actions])=>actions.some(([,label])=>label.toLowerCase().includes(query.toLowerCase().trim()))) && <p>No matching tools.</p>}</div>
    <footer><div className="dev-metrics"><span>{Math.round(view.fps)} FPS</span><span>{view.p95.toFixed(1)} ms p95</span><span>{view.enemies} alive</span><span>{view.points.toLocaleString()} chips</span></div><p>{view.room} · Round {view.round}</p><output aria-live="polite">{last ? `Last action: ${last}` : "Choose a tool or press Play."}</output><details><summary>Audio and scene diagnostics</summary><p>{view.zombieAudioStatus}</p><p>{view.hotelPlaytestStatus}</p><p>{view.slotAudioStatus}</p></details></footer>
  </aside>;
}
