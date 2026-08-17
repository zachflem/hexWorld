/** Implied courier trip state on a resource structure (Milestone 26). */

export type CourierPhase = "toBase" | "returning";

export interface CourierTrip {
  phase: CourierPhase;
  departedAt: number;
  arriveAt: number;
  /** Cargo units held while `phase === "toBase"`; 0 while returning. */
  cargo: number;
}
