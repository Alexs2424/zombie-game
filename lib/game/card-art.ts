import { cardRank, suitSymbol, type PlayingCard } from "./poker";

/** Original print artwork, redrawn only when a tabletop card changes. */
export function paintPlayingCard(
  ctx: CanvasRenderingContext2D,
  card?: PlayingCard,
) {
  const w = 384,
    h = 544;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#eee5ca";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#b8a275";
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  if (!card) {
    ctx.fillStyle = "#143e36";
    ctx.fillRect(17, 17, w - 34, h - 34);
    ctx.strokeStyle = "#af9252";
    ctx.lineWidth = 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(24, 24, w - 48, h - 48);
    ctx.clip();
    for (let x = -h; x < w + h; x += 23) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - h, h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = "#143e36";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 94, 131, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c3a665";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#d9c28c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 100px Georgia";
    ctx.fillText("♠", w / 2, h / 2 - 17);
    ctx.font = "bold 21px Georgia";
    ctx.fillText("LAST JACKPOT", w / 2, h / 2 + 69);
    return;
  }
  // Subtle paper fibres remain stable across frames and visits.
  for (let i = 0; i < 1000; i++) {
    ctx.fillStyle = i % 2 ? "rgba(100,75,38,.045)" : "rgba(255,255,255,.19)";
    ctx.fillRect((i * 137) % w, (i * 89) % h, 1, 2);
  }
  const ink =
    card.suit === "hearts" || card.suit === "diamonds" ? "#982f35" : "#142e2b";
  const suit = suitSymbol(card.suit);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const flipped of [false, true]) {
    ctx.save();
    if (flipped) {
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
    }
    ctx.font = "bold 54px Georgia";
    ctx.fillText(cardRank(card.rank), 42, 48);
    ctx.font = "44px Georgia";
    ctx.fillText(suit, 42, 101);
    ctx.restore();
  }
  if (card.rank > 10) {
    // Mirrored original court medallions: engraved crown, diamond and suit.
    ctx.strokeStyle = "#b0904b";
    ctx.lineWidth = 3;
    ctx.strokeRect(92, 100, 200, 344);
    for (const flipped of [false, true]) {
      ctx.save();
      if (flipped) {
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
      }
      ctx.fillStyle = "#bea364";
      ctx.beginPath();
      ctx.moveTo(119, 172);
      ctx.lineTo(113, 126);
      ctx.lineTo(153, 149);
      ctx.lineTo(192, 113);
      ctx.lineTo(231, 149);
      ctx.lineTo(271, 126);
      ctx.lineTo(265, 172);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = "bold 78px Georgia";
      ctx.fillText(cardRank(card.rank), 192, 211);
      ctx.font = "35px Georgia";
      ctx.fillText(suit, 192, 263);
      ctx.restore();
    }
  } else {
    const positions: [number, number][] = [];
    if (card.rank === 1) positions.push([192, 272]);
    else if (card.rank <= 3) {
      positions.push([192, 148], [192, 396]);
      if (card.rank === 3) positions.push([192, 272]);
    } else {
      const rows =
        card.rank >= 8
          ? [139, 217, 327, 405]
          : card.rank >= 6
            ? [147, 272, 397]
            : [148, 396];
      for (const y of rows) positions.push([123, y], [261, y]);
      if (card.rank % 2) positions.push([192, 272]);
      if (card.rank === 10) positions.push([192, 175], [192, 369]);
    }
    ctx.font = `${card.rank === 1 ? 140 : 68}px Georgia`;
    for (const [x, y] of positions) {
      ctx.save();
      ctx.translate(x, y);
      if (y > h / 2) ctx.rotate(Math.PI);
      ctx.fillText(suit, 0, 0);
      ctx.restore();
    }
  }
}
