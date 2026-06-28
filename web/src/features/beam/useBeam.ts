// Hooks d'état serveur (React Query) : ils FONT le fetch, rien d'autre.
// Les composants consomment ces hooks et n'appellent jamais l'API directement.
import {
  keepPreviousData,
  useMutation,
  useQuery,
} from '@tanstack/react-query'
import {
  distributedEffect,
  distributedEnvelope,
  influenceLine,
  vehicleSweep,
} from '@/api/beam'
import type {
  DistributedRequest,
  InfluenceLineRequest,
  VehicleEnvelopeRequest,
} from '@/api/types'

/**
 * Ligne d'influence de la section courante. `req = null` désactive la requête.
 * `keepPreviousData` garde la courbe précédente pendant le rechargement → le tracé
 * reste fluide quand on glisse la section.
 */
export function useInfluenceLine(req: InfluenceLineRequest | null) {
  return useQuery({
    queryKey: ['influence-line', req],
    queryFn: () => influenceLine(req as InfluenceLineRequest),
    enabled: req !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Action « position critique » : balaye le convoi (déclenché par un bouton). */
export function useVehicleSweep() {
  return useMutation({
    mutationFn: (req: VehicleEnvelopeRequest) => vehicleSweep(req),
  })
}

/** Effet DC/DW (full + alterné) sur la LI de la section courante. */
export function useDistributedEffect(req: DistributedRequest | null) {
  return useQuery({
    queryKey: ['distributed-effect', req],
    queryFn: () => distributedEffect(req as DistributedRequest),
    enabled: req !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Ligne d'enveloppe DC/DW (pattern loading) pour une grandeur (M ou V). */
export function useDistributedEnvelope(req: DistributedRequest | null) {
  return useQuery({
    queryKey: ['distributed-envelope', req],
    queryFn: () => distributedEnvelope(req as DistributedRequest),
    enabled: req !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
