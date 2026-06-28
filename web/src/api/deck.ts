// Appels typés du tablier (dalle). Réutilise les routes Python existantes.
import { getJSON, postJSON } from './client'
import type {
  DeckCatalog,
  DeckDesignRequest,
  DeckDesignResponse,
  UnitSystem,
} from './types'

/** Roue de calcul du tablier (essieu HL-93 arrière / 2). */
export function deckCatalog(unitSystem: UnitSystem): Promise<DeckCatalog> {
  return getJSON<DeckCatalog>('/deck-catalog', { unit_system: unitSystem })
}

/** Dimensionnement de la dalle par la méthode de la bande équivalente. */
export function deckDesign(req: DeckDesignRequest): Promise<DeckDesignResponse> {
  return postJSON<DeckDesignResponse>('/deck-design', req)
}
