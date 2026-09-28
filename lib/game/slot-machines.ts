import { STATIC_RECTS, type Rect } from "./simulation.ts";

export type SlotMachineSource = {
  id: string;
  islandId: string;
  x: number;
  z: number;
  rootX: number;
  rootZ: number;
  side: -1 | 1;
  variant: 0 | 1;
  modelVariant: "emerald" | "burgundy";
};

/** One layout for the visible cabinets and their outward-facing speakers. */
export function slotCabinetsForIsland(
  island: Pick<Rect, "id" | "x" | "z" | "w" | "d">,
): SlotMachineSource[] {
  const cabinets: SlotMachineSource[] = [];
  for (const side of [-1, 1] as const) {
    for (let row = 0; row < 3; row++) {
      const z = island.z - island.d / 2 + 0.7 + (row * (island.d - 1.4)) / 2;
      const variant = (row + (side > 0 ? 1 : 0)) % 2 ? 1 : 0;
      cabinets.push({
        id: `${island.id}:${side < 0 ? "west" : "east"}:${row}`,
        islandId: island.id,
        // The collision rectangle encloses the whole bank. Place the speaker
        // just outside it so the bank itself does not occlude its own front.
        x: island.x + side * (island.w / 2 + 0.04),
        z,
        rootX: island.x + side * (island.w / 2 - 0.7),
        rootZ: z,
        side,
        variant,
        modelVariant: variant ? "burgundy" : "emerald",
      });
    }
  }
  return cabinets;
}

export const SLOT_MACHINE_SOURCES: readonly SlotMachineSource[] =
  STATIC_RECTS.filter((rect) => rect.id === "slots-a" || rect.id === "slots-b")
    .flatMap(slotCabinetsForIsland);
