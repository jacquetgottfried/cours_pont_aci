// État partagé de la poutre, passé aux deux sous-onglets (HL-93 / DC-DW).
import type { InfluenceLineResponse, Quantity, UnitSystem } from '@/api/types'

export interface SharedBeam {
  ilData?: InfluenceLineResponse
  ilFetching: boolean
  spans: number[]
  spanLength: number
  supports: number[]
  quantity: Quantity
  targetX: number
  snapTargets: number[]
  dx: number
  unitSystem: UnitSystem
  lengthUnit: string
  forceUnit: string
  /** Clé stable de géométrie (travées|dx|unité) pour les effets de dépendance. */
  geomKey: string
  onTargetXChange: (x: number) => void
}
