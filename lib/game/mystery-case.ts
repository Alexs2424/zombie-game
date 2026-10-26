/** Shared, pause-safe timing for the case, displayed weapon and audio. */
export const CASE_OPEN_SECONDS = 2.8;
export const CASE_OFFER_SECONDS = 20;
export const CASE_CLOSE_SECONDS = 1.2;
export type CaseState = {remaining:number; resolved:boolean; reward:string|null; offerRemaining?:number; claimed?:boolean; closingRemaining?:number; taken?:boolean};
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function casePose(s:CaseState|null) {
  if (!s) return {lid:0,lift:0,visible:false};
  if (!s.resolved) { const t=CASE_OPEN_SECONDS-s.remaining; return {lid:ease(t/.8),lift:ease((t-.8)/2),visible:t>.8}; }
  if ((s.closingRemaining??0)>0) {const t=CASE_CLOSE_SECONDS-s.closingRemaining!;return {lid:1-ease((t-.5)/.7),lift:1-ease(t/.6),visible:!s.taken&&t<.6};}
  return {lid:s.claimed?0:1,lift:s.claimed?0:1,visible:!s.claimed&&!!s.reward};
}
