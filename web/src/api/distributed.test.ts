import { afterEach, describe, expect, it, vi } from 'vitest'
import { distributedEffect, distributedEnvelope } from './beam'
import type { DistributedRequest } from './types'

const REQ: DistributedRequest = {
  spans: [15, 10, 15],
  quantity: 'M',
  target_x: 0,
  dx: 1,
  unit_system: 'SI',
  w_dc: 10,
  w_dw: 3,
}

afterEach(() => vi.unstubAllGlobals())

describe('api distributed (client mické)', () => {
  it('distributedEnvelope POST /distributed-envelope', async () => {
    const payload = {
      positions: [15, 25],
      max: [10, 8],
      min: [-30, -28],
      full: [-12, -10],
      governing: { value: -30, position: 15, zones: [], sign: -1 },
      midspan_points: [{ position: 7, value: 40 }],
      support_points: [{ position: 15, value: -30 }],
      quantity: 'M',
      w_dc: 10,
      w_dw: 3,
      unit: 'kN·m',
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const res = await distributedEnvelope(REQ)
    expect(res).toEqual(payload)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/distributed-envelope')
    expect(JSON.parse(opts.body)).toEqual(REQ)
  })

  it('distributedEffect propage le detail métier (400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'point hors nœud' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(distributedEffect(REQ)).rejects.toThrow('point hors nœud')
  })
})
