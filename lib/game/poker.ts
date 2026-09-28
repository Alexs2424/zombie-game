/** Cards and finite decks for the two persistent flush challenges. */
export const CARD_SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type CardSuit = (typeof CARD_SUITS)[number];
export type PlayingCard = { rank: number; suit: CardSuit };
export type PokerTableId = "poker-a" | "poker-b";
export const POKER_RULES = { handSize: 5, swapsPerRound: 1 } as const;
export const POKER_TABLES = [
  {
    id: "poker-a",
    name: "The Dead Man’s Hand · Table I",
    x: 22,
    z: -3,
    approachZ: -4.7,
  },
  {
    id: "poker-b",
    name: "The Dead Man’s Hand · Table II",
    x: 22,
    z: 5,
    approachZ: 3.3,
  },
] as const;
export type PokerState = {
  hand: PlayingCard[];
  drawPile: PlayingCard[];
  discard: PlayingCard[];
  lastSwapRound: number;
  swaps: number;
  completed: boolean;
};

export const suitSymbol = (suit: CardSuit) =>
  ({ spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" })[suit];
const rankLabels: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};
const rankNames: Record<number, string> = {
  1: "Ace",
  11: "Jack",
  12: "Queen",
  13: "King",
};
export const cardRank = (rank: number) => rankLabels[rank] ?? String(rank);
export const cardName = (card: PlayingCard) =>
  `${rankNames[card.rank] ?? card.rank} of ${card.suit}`;

export function freshPokerState(): PokerState {
  return {
    hand: [],
    drawPile: [],
    discard: [],
    lastSwapRound: -1,
    swaps: 0,
    completed: false,
  };
}
export function cardDeck(): PlayingCard[] {
  return CARD_SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, suit })),
  );
}
function shuffle(cards: PlayingCard[], random: () => number) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function dealPoker(state: PokerState, random: () => number) {
  if (state.hand.length) return;
  state.drawPile = shuffle(cardDeck(), random);
  state.hand = state.drawPile.splice(-POKER_RULES.handSize);
}
export function bestPokerSuit(hand: readonly PlayingCard[]) {
  let suit: CardSuit = "spades",
    count = 0;
  for (const candidate of CARD_SUITS) {
    const total = hand.filter((card) => card.suit === candidate).length;
    if (total > count) {
      suit = candidate;
      count = total;
    }
  }
  return { suit, count };
}
export function isFlush(hand: readonly PlayingCard[]) {
  return (
    hand.length === POKER_RULES.handSize &&
    bestPokerSuit(hand).count === POKER_RULES.handSize
  );
}
/** Recycle only previously discarded cards, never cards still in the hand. */
export function exchangePokerCard(
  state: PokerState,
  index: number,
  random: () => number,
) {
  if (!Number.isInteger(index) || index < 0 || index >= state.hand.length)
    return false;
  if (!state.drawPile.length) {
    state.drawPile = shuffle(state.discard.splice(0), random);
  }
  const next = state.drawPile.pop();
  if (!next) return false;
  state.discard.push(state.hand[index]);
  state.hand[index] = next;
  state.swaps++;
  return true;
}
