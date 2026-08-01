// Helpers d'unités et de libellés — PURS (aucun réseau, aucun JSX).
import type { Quantity, UnitSystem } from '@/api/types'

export const QUANTITY_LABELS: Record<Quantity, string> = {
  R: "Réaction d'appui (R)",
  M: 'Moment fléchissant (M)',
  V: 'Effort tranchant (V)',
}

export interface SystemDefaults {
  spans: string
  dx: number
  force: string
  length: string
  wdc: number
  wdw: number
}

export const UNIT_DEFAULTS: Record<UnitSystem, SystemDefaults> = {
  SI: { spans: '15, 10, 15', dx: 1, force: 'kN', length: 'm', wdc: 10, wdw: 3 },
  US: { spans: '50, 30, 50', dx: 2.5, force: 'kip', length: 'ft', wdc: 1.0, wdw: 0.3 },
}

export const forceUnit = (sys: UnitSystem): string => UNIT_DEFAULTS[sys].force
export const lengthUnit = (sys: UnitSystem): string => UNIT_DEFAULTS[sys].length

/** Unité réglementaire de la largeur de bande E (pouces US, mm SI), pas l'unité système. */
export const stripUnit = (sys: UnitSystem): string => (sys === 'US' ? 'in' : 'mm')

/** Moment par unité de largeur : kN·m/m (SI) ou kip·ft/ft (US). */
export const lineUnit = (sys: UnitSystem): string =>
  `${forceUnit(sys)}·${lengthUnit(sys)}/${lengthUnit(sys)}`

export interface DeckSystemDefaults {
  n: number
  s: number
  oh: number
  dx: number
  wdc: number
  wdw: number
  pb: number // charge ponctuelle barrière DC (force)
  xb: number // position transversale barrière
  xr: number // position transversale glissière (charge nulle par défaut)
}

export const DECK_DEFAULTS: Record<UnitSystem, DeckSystemDefaults> = {
  SI: { n: 6, s: 2.4, oh: 1.0, dx: 0.1, wdc: 7.0, wdw: 1.2, pb: 7.0, xb: 0.0, xr: 0.3 },
  US: { n: 6, s: 8, oh: 3.25, dx: 0.25, wdc: 0.15, wdw: 0.025, pb: 0.5, xb: 0.0, xr: 1.0 },
}

/** Effort tranchant par unité de largeur : kN/m (SI) ou kip/ft (US). */
export const shearLineUnit = (sys: UnitSystem): string =>
  `${forceUnit(sys)}/${lengthUnit(sys)}`

/** Unité d'un effet : force·longueur pour le moment, force seule sinon. */
export function effectUnit(q: Quantity, sys: UnitSystem): string {
  const { force, length } = UNIT_DEFAULTS[sys]
  return q === 'M' ? `${force}·${length}` : force
}

/** Parse une liste de travées « 15, 10, 15 » en nombres strictement positifs. */
export function parseSpans(text: string): number[] {
  return text
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

/** Arrondit `x` au multiple de `dx` le plus proche (snap sur la grille de nœuds). */
export function snapToGrid(x: number, dx: number): number {
  return Math.round(x / dx) * dx
}

/** Positions d'appuis déduites des travées (somme cumulée) : [0, L1, L1+L2, …]. */
export function supportPositions(spans: number[]): number[] {
  const out = [0]
  let acc = 0
  for (const s of spans) {
    acc += s
    out.push(acc)
  }
  return out
}

/**
 * Sections où la grandeur EST calculable (sinon le moteur renvoie 400) :
 *  - R : uniquement AUX APPUIS (une réaction n'existe qu'à un appui) ;
 *  - M / V : nœuds INTÉRIEURS (jamais les deux extrémités de la poutre).
 */
export function validTargets(
  spans: number[],
  dx: number,
  quantity: Quantity,
): number[] {
  if (spans.length === 0 || dx <= 0) return []
  if (quantity === 'R') return supportPositions(spans)
  const L = spans.reduce((a, b) => a + b, 0)
  const n = Math.round(L / dx)
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) * dx) // nœuds 1..n-1
}

/** La cible valide la plus proche de `x` (pour le snap du repère de section). */
export function nearestTarget(targets: number[], x: number): number {
  if (targets.length === 0) return x
  return targets.reduce(
    (best, t) => (Math.abs(t - x) < Math.abs(best - x) ? t : best),
    targets[0],
  )
}

/** Largeur totale de la dalle (miroir de deck_geometry, pour bornes/échelle UI). */
export function deckTotal(n: number, s: number, oh: number): number {
  return 2 * oh + (n - 1) * s
}

/**
 * Nœuds INTÉRIEURS de la grille transversale dx (cibles de snap du repère d'étude).
 * Les extrémités libres sont exclues : M/V n'y sont pas calculables (400 moteur).
 */
export function deckStudyTargets(
  n: number,
  s: number,
  oh: number,
  dx: number,
): number[] {
  if (n < 2 || s <= 0 || oh < 0 || dx <= 0) return []
  const total = deckTotal(n, s, oh)
  const count = Math.round(total / dx)
  return Array.from({ length: count - 1 }, (_, i) => (i + 1) * dx)
}

/** Section d'étude par défaut : mi-baie intérieure (longeron 1 + S/2), snappée sur dx. */
export function defaultDeckStudyX(
  n: number,
  s: number,
  oh: number,
  dx: number,
): number {
  const targets = deckStudyTargets(n, s, oh, dx)
  if (targets.length === 0) return 0
  const bayMid = oh + s + s / 2 // girders[1] + S/2
  return nearestTarget(targets, bayMid)
}

/** Section par défaut « parlante » : 1er appui intérieur si possible, sinon le milieu. */
export function defaultTarget(
  spans: number[],
  dx: number,
  quantity: Quantity,
): number {
  const targets = validTargets(spans, dx, quantity)
  if (targets.length === 0) return 0
  const L = spans.reduce((a, b) => a + b, 0)
  const interiorSupport = supportPositions(spans).find(
    (s) => s > 1e-9 && s < L - 1e-9,
  )
  if (
    interiorSupport !== undefined &&
    targets.some((t) => Math.abs(t - interiorSupport) < 1e-9)
  ) {
    return interiorSupport
  }
  return targets[Math.floor(targets.length / 2)]
}
