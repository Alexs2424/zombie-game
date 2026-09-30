/** Shared casino artwork, aiming targets, place-bet rules and hidden-room geometry. */
import { CRAPS_TABLES } from './casino-layout.ts';
export { SECRET_ROOM } from './casino-layout.ts';
import { POKER_TABLES } from './poker.ts';
export const PLACE_NUMBERS = [4, 5, 6, 8, 9, 10] as const;
export type PlaceNumber = typeof PLACE_NUMBERS[number];
export const placeAmount = (number: PlaceNumber, chip: number) => Math.ceil(Math.max(25, chip) / (number === 6 || number === 8 ? 6 : 5)) * (number === 6 || number === 8 ? 6 : 5);
export const placeProfit = (number: PlaceNumber, stake: number) => Math.round(stake * (number === 4 || number === 10 ? 9 / 5 : number === 5 || number === 9 ? 7 / 5 : 7 / 6));
// Match the printed place boxes in generate_tables.py's 3072 × 1344 felt texture.
// Babylon mirrors glTF X; both printed banks accept the same place bets.
export const CRAPS_FELT_Y = .810;
export const BET_TARGETS = CRAPS_TABLES.flatMap(table => [165, 1790].flatMap((left, bank) => PLACE_NUMBERS.map((number, i) => ({
  tableId: table.id, number, bank,
  x: table.x - ((left + (i+.5)*1115/6)/3072*4.11 - 2.055),
  y: CRAPS_FELT_Y,
  z: table.z + (336.5/1344*1.81 - .905),
  halfWidth: 1115/6/3072*4.11/2,
  halfDepth: 213/1344*1.81/2,
}))));
export const SECRET_CODE = ["spade", "7", "heart", "4", "club", "9", "diamond", "2"];
export const SUIT_GLYPHS: Record<string,string> = {spade:"♠",heart:"♥",club:"♣",diamond:"♦"};
export const SECRET_OFFSET = { x: 1, z: -12 };
export const SECRET_DOOR = { id:"speakeasy", x:43, z:-16.1, w:.45, d:3.8, h:4.8 };
export const CASINO_SECRET_ANCHORS = {
  painting: { x:41.8,z:-16.1 },
  keypad: { x:42.64,z:-16.1 },
  mystery: { x:49,z:-19.3 },
  mysteryCabinet: { x:49,z:-20.6 },
  stick: { x:CRAPS_TABLES[0].x-3.9,z:CRAPS_TABLES[0].z-.1 },
  clue: { x:POKER_TABLES[1].x,z:POKER_TABLES[1].approachZ },
};
export const KEYPAD_TARGETS = ["spade","heart","club","diamond", "1","2","3","4","5","6","7","8","9","0","reset"].map((key,i)=>({
  key, x:CASINO_SECRET_ANCHORS.keypad.x, y:2.55-Math.floor(i/4)*.32, z:CASINO_SECRET_ANCHORS.keypad.z-(i%4-1.5)*.32,
}));
// Replace the cashier east enclosure with a single concealed entrance from its public hall.
// The secure cashier area retains a solid wall; this door cannot bypass its glass barrier.
export const SECRET_RECTS = [
  {id:'secret-wall-west-s',x:43,z:-21,w:.45,d:6,h:4.8},
  {id:'secret-wall-west-n',x:43,z:-5.1,w:.45,d:18.2,h:4.8},
  {id:'secret-wall-east',x:53,z:-12,w:.45,d:24.45,h:4.8},
  {id:'secret-wall-south',x:48,z:-24,w:10.45,d:.45,h:4.8},
  {id:'secret-wall-north',x:48,z:0,w:10.45,d:.45,h:4.8},
  {id:'mystery-cabinet',...CASINO_SECRET_ANCHORS.mysteryCabinet,w:1.6,d:1.1,h:1.25},
  {id:'secret-bar',x:44.2,z:-9,w:1.4,d:8,h:1.2},
];
export const RELIC_NAMES = {pistol:"MIDNIGHT SPECIAL",shotgun:"GILDED RECKONING",smg:"VELVET VENGEANCE",rifle:"THE HOUSE ALWAYS WINS"};
