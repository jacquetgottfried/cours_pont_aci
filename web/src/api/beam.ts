// Fonctions d'appel typées de la poutre. Réutilise les routes Python existantes.
import { postJSON } from './client'
import type {
  DistributedEffectResponse,
  DistributedEnvelopeResponse,
  DistributedRequest,
  InfluenceLineRequest,
  InfluenceLineResponse,
  VehicleEnvelopeRequest,
  VehicleEnvelopeResponse,
} from './types'

/** Ligne d'influence d'une grandeur (R/M/V) à une section. */
export function influenceLine(
  req: InfluenceLineRequest,
): Promise<InfluenceLineResponse> {
  return postJSON<InfluenceLineResponse>('/influence-line', req)
}

/** Balaye le convoi HL-93 et renvoie la position la plus défavorable. */
export function vehicleSweep(
  req: VehicleEnvelopeRequest,
): Promise<VehicleEnvelopeResponse> {
  return postJSON<VehicleEnvelopeResponse>('/vehicle-envelope', req)
}

/** Effet DC/DW sur la LI d'une section (full + alterné max/min + zones chargées). */
export function distributedEffect(
  req: DistributedRequest,
): Promise<DistributedEffectResponse> {
  return postJSON<DistributedEffectResponse>('/distributed-effect', req)
}

/** Ligne d'enveloppe DC/DW (chargement alterné) sur toute la poutre. */
export function distributedEnvelope(
  req: DistributedRequest,
): Promise<DistributedEnvelopeResponse> {
  return postJSON<DistributedEnvelopeResponse>('/distributed-envelope', req)
}
