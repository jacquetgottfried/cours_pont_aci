import { afterEach, describe, expect, it, vi } from 'vitest'
import { deckSectionStudy } from './deck'
import type { DeckSectionStudyRequest } from './types'

const REQ: DeckSectionStudyRequest = {
  n_girders: 6,
  spacing: 2.4,
  overhang: 1.0,
  dx: 0.1,
  w_dc: 7,
  w_dw: 1.2,
  gamma_dc: 1.25,
  gamma_dw: 1.5,
  gamma_ll: 1.75,
  mpf1: 1.2,
  mpf2: 1.0,
  mpf3: 0.85,
  p_barrier: 7,
  x_barrier: 0,
  p_rail: 0,
  x_rail: 0.3,
  impact: true,
  unit_system: 'SI',
  target_x: 4.6,
}

afterEach(() => vi.unstubAllGlobals())

describe('api deck (client mocké)', () => {
  it('deckSectionStudy POST /deck-section-study avec target_x', async () => {
    const payload = { target_x: 4.6, moment: {}, shear: {}, influence_lines: {} }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const res = await deckSectionStudy(REQ)
    expect(res).toEqual(payload)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/deck-section-study')
    expect(JSON.parse(opts.body)).toEqual(REQ)
  })

  it('deckSectionStudy propage le detail métier (400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'target_x ne tombe pas sur un nœud' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(deckSectionStudy(REQ)).rejects.toThrow(
      'target_x ne tombe pas sur un nœud',
    )
  })
})
