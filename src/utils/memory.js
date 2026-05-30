import { shuffle, uid } from './helpers';

/**
 * Build shuffled card pairs for the memory game.
 * Each product generates two cards: one "product" card and one "plu" card.
 *
 * @param {Object[]} products – pool to draw from
 * @param {number}   pairs    – number of product pairs
 * @returns {Object[]} shuffled flat array of cards
 */
export function buildMemoryPairs(products, pairs) {
  const selected = shuffle(products).slice(0, pairs);
  const cards = [];

  selected.forEach((product, i) => {
    cards.push({
      id: `prod-${uid()}`,
      pairId: i,
      type: 'product',
      product,
      isFlipped: false,
      isMatched: false,
    });
    cards.push({
      id: `plu-${uid()}`,
      pairId: i,
      type: 'plu',
      product,
      isFlipped: false,
      isMatched: false,
    });
  });

  return shuffle(cards);
}

/**
 * Check whether two flipped cards form a match.
 * A match = same pairId, different types (one 'product', one 'plu').
 */
export function isMatch(cardA, cardB) {
  return cardA.pairId === cardB.pairId && cardA.type !== cardB.type;
}

/**
 * Apply a flip action to the cards array (immutable).
 */
export function flipCard(cards, cardId) {
  return cards.map(c =>
    c.id === cardId ? { ...c, isFlipped: true } : c
  );
}

/**
 * Mark matched cards (immutable).
 */
export function markMatched(cards, pairId) {
  return cards.map(c =>
    c.pairId === pairId ? { ...c, isMatched: true, isFlipped: true } : c
  );
}

/**
 * Unflip unmatched cards (immutable).
 */
export function unflipUnmatched(cards) {
  return cards.map(c =>
    c.isMatched ? c : { ...c, isFlipped: false }
  );
}

/** Returns true when all pairs are matched. */
export function isGameComplete(cards) {
  return cards.length > 0 && cards.every(c => c.isMatched);
}

/** Grid column count suggestion based on total cards. */
export function gridCols(totalCards) {
  if (totalCards <= 8)  return 4;
  if (totalCards <= 12) return 4;
  if (totalCards <= 16) return 4;
  return 6;
}
