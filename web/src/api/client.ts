// Client HTTP minimal et typé vers l'API FastAPI (couche calcul Python).
// Seul endroit qui parle réseau ; les composants ne font jamais de fetch.

const BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

/** Extrait un message lisible du `detail` d'une erreur HTTP (string 400 ou liste 422). */
function errorDetail(data: unknown): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const d = (data as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          e && typeof e === 'object' && 'msg' in e
            ? String((e as { msg: unknown }).msg)
            : JSON.stringify(e),
        )
        .join(' ; ')
    }
  }
  return 'Erreur inconnue'
}

async function parse<T>(resp: Response): Promise<T> {
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(errorDetail(data))
  return data as T
}

export async function getJSON<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : ''
  return parse<T>(await fetch(`${BASE}${path}${qs}`))
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return parse<T>(resp)
}

export { BASE as API_BASE }
