/** Shared casino layout: artwork, aiming targets, rules and puzzle use these values. */
export const PLACE_NUMBERS = [4, 5, 6, 8, 9, 10] as const;
export type PlaceNumber = typeof PLACE_NUMBERS[number];
export const placeAmount = (number: PlaceNumber, chip: number) => Math.ceil(Math.max(25, chip) / (number === 6 || number === 8 ? 6 : 5)) * (number === 6 || number === 8 ? 6 : 5);
export const placeProfit = (number: PlaceNumber, stake: number) => Math.round(stake * (number === 4 || number === 10 ? 9 / 5 : number === 5 || number === 9 ? 7 / 5 : 7 / 6));
// Match the printed place boxes in generate_tables.py's 3072 × 1344 felt texture.
// Babylon mirrors glTF X; both printed banks accept the same place bets.
export const CRAPS_FELT_Y = .810;
export const BET_TARGETS = [165, 1790].flatMap((left, bank) => PLACE_NUMBERS.map((number, i) => ({
  number, bank,
  x: 35 - ((left + (i+.5)*1115/6)/3072*4.11 - 2.055),
  y: CRAPS_FELT_Y,
  z: -3 + (336.5/1344*1.81 - .905),
  halfWidth: 1115/6/3072*4.11/2,
  halfDepth: 213/1344*1.81/2,
})));
export const SECRET_CODE = ["spade", "7", "heart", "4", "club", "9", "diamond", "2"];
export const SUIT_GLYPHS: Record<string,string> = {spade:"♠",heart:"♥",club:"♣",diamond:"♦"};
export const KEYPAD_TARGETS = ["spade","heart","club","diamond", "1","2","3","4","5","6","7","8","9","0","reset"].map((key,i)=>({
  key, x:41.64, y:2.55-Math.floor(i/4)*.32, z:-4.1-(i%4-1.5)*.32,
}));
export const SECRET_DOOR = {id:"speakeasy",x:42,z:-4.1,w:.45,d:3.8,h:4.8};
export const RELIC_NAMES = {pistol:"MIDNIGHT SPECIAL",shotgun:"GILDED RECKONING",smg:"VELVET VENGEANCE",rifle:"THE HOUSE ALWAYS WINS"};
