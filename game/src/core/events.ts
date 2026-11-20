import { EVENTS, EVENT_LENGTH_MS, EVENT_SLOT_MS, FIRST_EVENT_AFTER_MS } from "../data/world.ts";
import type { EventDef } from "./types.ts";

export interface ActiveEvent {
  def: EventDef;
  endsAt: number;
  personal: boolean;
}

/** The world event running at `now` (UTC clock), or null. Slots rotate through EVENTS. */
export function worldEvent(now: number): ActiveEvent | null {
  const slot = Math.floor(now / EVENT_SLOT_MS);
  const into = now - slot * EVENT_SLOT_MS;
  if (into >= EVENT_LENGTH_MS) return null;
  return { def: EVENTS[slot % EVENTS.length], endsAt: slot * EVENT_SLOT_MS + EVENT_LENGTH_MS, personal: false };
}

/** When the next world event starts. */
export function nextWorldEvent(now: number): { def: EventDef; startsAt: number } {
  const slot = Math.floor(now / EVENT_SLOT_MS) + 1;
  return { def: EVENTS[slot % EVENTS.length], startsAt: slot * EVENT_SLOT_MS };
}

/**
 * A player who has never seen an event gets a personal Golden Hour a few minutes into
 * their first session, so every new player meets the event system before minute five.
 * Returns the start time of that personal event once it is due (else null).
 */
export function personalEventDue(now: number, sessionStart: number, seenEvent: boolean): number | null {
  if (seenEvent || worldEvent(now)) return null;
  return now - sessionStart >= FIRST_EVENT_AFTER_MS ? now : null;
}

export function currentEvent(now: number, personalEventAt: number | null): ActiveEvent | null {
  const world = worldEvent(now);
  if (world) return world;
  if (personalEventAt !== null && now >= personalEventAt && now < personalEventAt + EVENT_LENGTH_MS) {
    return { def: EVENTS.find((e) => e.id === "golden_hour")!, endsAt: personalEventAt + EVENT_LENGTH_MS, personal: true };
  }
  return null;
}

/** local night (20:00-06:00) enables the ghost mutation */
/** 1 in full daylight, 0 at night, smooth through dawn (6-8) and dusk (17:30-19:30), by the player's clock */
export const daylightAt = (now: number) => {
  const d = new Date(now), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 8 && h <= 17.5) return 1;
  if (h > 6 && h < 8) return (h - 6) / 2;
  if (h > 17.5 && h < 19.5) return 1 - (h - 17.5) / 2;
  return 0;
};
export const isNight = (now: number) => {
  const h = new Date(now).getHours();
  return h >= 20 || h < 6;
};
