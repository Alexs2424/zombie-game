/** Shared clues and placements for the optional downstairs hotel investigation. */
import type { WorldRect } from "./world.ts";

export const HOTEL_MYSTERY_ANCHORS = {
  hotelLedger: { x: -12, y: 0, z: 21.9 },
  hotelSuitcase: { x: -7.8, y: 0, z: 23.6 },
  hotelPanel: { x: -12, y: 0, z: 44.7 },
  hotelRegister: { x: -5, y: 0, z: 48 },
  hotelCache: { x: 0, y: 0, z: 48 },
} as const;

export type HotelMysteryInteractionId = keyof typeof HOTEL_MYSTERY_ANCHORS;
export type HotelDocumentId = "ledger" | "suitcase" | "register";
export type HotelMysteryState = {
  ledgerFound: boolean;
  suitcaseFound: boolean;
  keyFound: boolean;
  passageOpen: boolean;
  registerFound: boolean;
  cacheClaimed: boolean;
};
export type HotelMysteryDocument = {
  title: string;
  kicker: string;
  body: string[];
  lead: string;
};

export const HOTEL_MYSTERY_GATES: WorldRect[] = [
  { id: "hotel-secret-left", x: -12, z: 46, w: 2.6, d: 0.24, h: 3.7 },
  { id: "hotel-secret-right", x: 4, z: 46, w: 2.6, d: 0.24, h: 3.7 },
];

export const HOTEL_MYSTERY_DOCUMENTS: Record<HotelDocumentId, HotelMysteryDocument> = {
  ledger: {
    title: "A guest who never left",
    kicker: "Reception · guest ledger",
    body: [
      "ELIAS VARGA · ROOM 214. The departure column reads CHECKED OUT. There is no signature, and no porter has initialed the luggage receipt.",
      "A penciled note interrupts the neat handwriting: ‘Brown leather case still at reception. Check the lining before forwarding.’",
      "The room’s brass key is missing from its hook. His suitcase is waiting beside the desk.",
    ],
    lead: "Inspect Varga’s brown suitcase beside reception.",
  },
  suitcase: {
    title: "Inside the lining",
    kicker: "Elias Varga · room 214",
    body: [
      "Beneath a folded evening shirt, a loose stitch reveals a pocket in the lining. A small brass key has been sewn inside.",
      "A torn hotel envelope holds one sentence: ‘They’re still using my room.’",
      "The key’s tag reads SERVICE GALLERY · WEST PANEL. The hotel plan marks a paneled entrance beneath the restaurant, at the back of the lobby.",
    ],
    lead: "Service key collected. Find the west panel beneath the restaurant.",
  },
  register: {
    title: "The collection register",
    kicker: "Service gallery · luggage storeroom",
    body: [
      "Rows of suitcases fill the storeroom. Every tag belongs to a guest already marked as departed in the reception ledger.",
      "This second book records room numbers and collection times. ELIAS VARGA · 214 appears on the latest page. The entry was made minutes ago.",
      "The porter’s instruction is underlined: ‘Leave the luggage. Return the room key. Do not amend the departure book.’ Below it, another collection is still pending.",
    ],
    lead: "The service gallery now connects both sides of the lobby. Supplies are stored beside the register.",
  },
};

const UNOPENED_SUITCASE: HotelMysteryDocument = {
  title: "Luggage awaiting collection",
  kicker: "Reception · brown leather suitcase",
  body: [
    "An embossed luggage tag reads ELIAS VARGA · 214. His evening clothes are neatly packed, but there is no travel ticket among them.",
    "A forwarding slip has been left blank. Reception may explain why a departed guest’s case is still here.",
  ],
  lead: "Check the guest ledger on the reception counter.",
};

/** A first look at the case never reveals a clue that has not been uncovered. */
export function getHotelMysteryDocument(id: HotelDocumentId, state: HotelMysteryState): HotelMysteryDocument {
  if (id === "suitcase" && !state.keyFound) return state.ledgerFound
    ? { ...UNOPENED_SUITCASE, lead: "Return to Varga’s suitcase and inspect the lining mentioned in the ledger." }
    : UNOPENED_SUITCASE;
  return HOTEL_MYSTERY_DOCUMENTS[id];
}

export function freshHotelMystery(): HotelMysteryState {
  return {
    ledgerFound: false, suitcaseFound: false, keyFound: false,
    passageOpen: false, registerFound: false, cacheClaimed: false,
  };
}

export function isHotelMysteryInteraction(id: string): id is HotelMysteryInteractionId {
  return Object.prototype.hasOwnProperty.call(HOTEL_MYSTERY_ANCHORS, id);
}
