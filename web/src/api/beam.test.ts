import { afterEach, describe, expect, it, vi } from 'vitest'
import { influenceLine } from './beam'
import type { InfluenceLineRequest } from './types'

const REQ: InfluenceLineRequest = {
  spans: [10],
  quantity: 'M',
  target_x: 5,
  dx: 1,
  unit_system: 'SI',
}

afterEach(() => vi.unstubAllGlobals())

describe('api/beam (client mické)', () => {
  it('influenceLine POST /influence-line et renvoie le JSON', async () => {
    const payload = {
      x: [0, 5, 10],
      y: [0, 2.5, 0],
      y_nodes: [0, 2.5, 0],
      normalization: 1,
      meta: {
        quantity: 'M',
        target_x: 5,
        support_positions: [0, 10],
        n_ddl: 6,
        n_elements: 10,
      },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const res = await influenceLine(REQ)
    expect(res).toEqual(payload)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/influence-line')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual(REQ)
  })

  it('lève une Error avec le detail métier sur réponse !ok (400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'point hors nœud' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(influenceLine(REQ)).rejects.toThrow('point hors nœud')
  })

  it('aplati les erreurs de validation Pydantic (422) en message lisible', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: [{ msg: 'travée ≤ 0' }, { msg: 'dx invalide' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(influenceLine(REQ)).rejects.toThrow('travée ≤ 0 ; dx invalide')
  })
})
