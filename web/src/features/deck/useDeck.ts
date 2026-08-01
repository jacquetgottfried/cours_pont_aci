// Hooks d'état serveur du tablier (React Query) : fetch only.
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { deckCatalog, deckDesign, deckSectionStudy } from '@/api/deck'
import type {
  DeckDesignRequest,
  DeckSectionStudyRequest,
  UnitSystem,
} from '@/api/types'

/** Roue de calcul (P, gage, recul) du système courant. */
export function useDeckCatalog(unitSystem: UnitSystem) {
  return useQuery({
    queryKey: ['deck-catalog', unitSystem],
    queryFn: () => deckCatalog(unitSystem),
    retry: false,
  })
}

/** Dimensionnement live : recalcule à chaque changement d'entrée valide. */
export function useDeckDesign(req: DeckDesignRequest | null) {
  return useQuery({
    queryKey: ['deck-design', req],
    queryFn: () => deckDesign(req as DeckDesignRequest),
    enabled: req !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Action « Calculer » de l'étude de section (déclenchée par bouton, jamais live). */
export function useDeckSectionStudy() {
  return useMutation({
    mutationFn: (req: DeckSectionStudyRequest) => deckSectionStudy(req),
  })
}
