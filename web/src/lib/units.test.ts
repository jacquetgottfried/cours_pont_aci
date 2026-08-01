import { describe, expect, it } from 'vitest'
import {
  deckStudyTargets,
  deckTotal,
  defaultDeckStudyX,
  defaultTarget,
  effectUnit,
  lineUnit,
  nearestTarget,
  parseSpans,
  snapToGrid,
  stripUnit,
  supportPositions,
  validTargets,
} from './units'

describe('units (pur)', () => {
  it('parseSpans ne garde que les nombres strictement positifs', () => {
    expect(parseSpans('15, 10, 15')).toEqual([15, 10, 15])
    expect(parseSpans('15, , -3, abc, 5')).toEqual([15, 5])
    expect(parseSpans('')).toEqual([])
  })

  it("effectUnit : force·longueur pour M, force seule pour R/V", () => {
    expect(effectUnit('M', 'SI')).toBe('kN·m')
    expect(effectUnit('R', 'SI')).toBe('kN')
    expect(effectUnit('V', 'US')).toBe('kip')
    expect(effectUnit('M', 'US')).toBe('kip·ft')
  })

  it('snapToGrid arrondit au multiple de dx', () => {
    expect(snapToGrid(7.4, 1)).toBe(7)
    expect(snapToGrid(7.6, 0.5)).toBe(7.5)
    expect(snapToGrid(2.4, 2.5)).toBe(2.5)
  })
})

describe('cibles valides selon la grandeur', () => {
  const spans = [15, 10, 15] // appuis: 0, 15, 25, 40 ; L = 40

  it('R : uniquement aux appuis', () => {
    expect(validTargets(spans, 1, 'R')).toEqual([0, 15, 25, 40])
    expect(supportPositions(spans)).toEqual([0, 15, 25, 40])
  })

  it('M / V : nœuds intérieurs (jamais les extrémités 0 et L)', () => {
    const t = validTargets(spans, 1, 'M')
    expect(t[0]).toBe(1)
    expect(t[t.length - 1]).toBe(39)
    expect(t).not.toContain(0)
    expect(t).not.toContain(40)
  })

  it('defaultTarget : 1er appui intérieur (section parlante, valide pour R/M/V)', () => {
    expect(defaultTarget(spans, 1, 'M')).toBe(15)
    expect(defaultTarget(spans, 1, 'R')).toBe(15)
    expect(defaultTarget(spans, 1, 'V')).toBe(15)
  })

  it('nearestTarget recale sur la cible la plus proche', () => {
    expect(nearestTarget([0, 15, 25, 40], 12)).toBe(15)
    expect(nearestTarget([0, 15, 25, 40], 7)).toBe(0)
  })
})

describe('unités tablier', () => {
  it('stripUnit : pouces en US, mm en SI', () => {
    expect(stripUnit('US')).toBe('in')
    expect(stripUnit('SI')).toBe('mm')
  })

  it('lineUnit : moment par unité de largeur', () => {
    expect(lineUnit('US')).toBe('kip·ft/ft')
    expect(lineUnit('SI')).toBe('kN·m/m')
  })
})

describe('section d’étude du tablier', () => {
  // Défauts SI : 6 longerons, S=2.4, porte-à-faux 1.0, dx=0.1 → largeur 14 m.
  it('deckTotal : 2·overhang + (n-1)·S', () => {
    expect(deckTotal(6, 2.4, 1.0)).toBeCloseTo(14)
    expect(deckTotal(6, 8, 3.25)).toBeCloseTo(46.5)
  })

  it('deckStudyTargets : nœuds intérieurs seulement (extrémités exclues)', () => {
    const t = deckStudyTargets(6, 2.4, 1.0, 0.1)
    expect(t.length).toBe(139) // 140 pas − extrémité
    expect(t[0]).toBeCloseTo(0.1)
    expect(t[t.length - 1]).toBeCloseTo(13.9)
    expect(t).not.toContain(0)
    expect(deckStudyTargets(1, 2.4, 1.0, 0.1)).toEqual([]) // géométrie invalide
  })

  it('defaultDeckStudyX : mi-baie intérieure (longeron 1 + S/2), snappée sur dx', () => {
    expect(defaultDeckStudyX(6, 2.4, 1.0, 0.1)).toBeCloseTo(4.6) // 3.4 + 1.2
    expect(defaultDeckStudyX(6, 8, 3.25, 0.25)).toBeCloseTo(15.25) // 11.25 + 4
  })
})
