// Contrat API : miroir typé des schémas Pydantic du backend (couche calcul).
// Aucun calcul ici — uniquement les formes de données échangées.

export type UnitSystem = 'SI' | 'US'
export type Quantity = 'R' | 'M' | 'V'
export type Vehicle = 'truck' | 'tandem'

export interface InfluenceLineRequest {
  spans: number[]
  quantity: Quantity
  target_x: number
  dx: number
  supports?: number[]
  unit_system: UnitSystem
}

export interface InfluenceLineMeta {
  quantity: Quantity
  target_x: number
  support_positions: number[]
  n_ddl: number
  n_elements: number
}

export interface InfluenceLineResponse {
  x: number[]
  y: number[]
  y_nodes: number[]
  normalization: number
  meta: InfluenceLineMeta
}

export interface VehicleEnvelopeRequest extends InfluenceLineRequest {
  vehicle: Vehicle
  rear_spacing?: number
  impact: boolean
}

export interface AxlePosition {
  x: number
  load: number
}

export interface EnvelopeExtreme {
  value: number
  lead_pos: number
  axle_positions: AxlePosition[]
}

export interface VehicleEnvelopeResponse {
  positions: number[]
  effects: number[]
  max: EnvelopeExtreme
  min: EnvelopeExtreme
  governing: EnvelopeExtreme
  unit: string
}

// --- Charges réparties permanentes DC / DW (chargement alterné / pattern loading) ---

export interface DistributedRequest extends InfluenceLineRequest {
  w_dc: number
  w_dw: number
}

/** Effet d'une configuration de charge, décomposé DC / DW / somme + zones chargées. */
export interface DistributedComponent {
  dc: number
  dw: number
  total: number
  zones: number[][]
}

export interface DistributedEffectResponse {
  full: DistributedComponent
  max: DistributedComponent
  min: DistributedComponent
  governing: DistributedComponent
  w_dc: number
  w_dw: number
  unit: string
}

export interface DistributedPoint {
  position: number
  value: number
}

export interface DistributedGoverning {
  value: number
  position: number
  zones: number[][]
  sign: number
}

export interface DistributedEnvelopeResponse {
  positions: number[]
  max: number[]
  min: number[]
  full: number[]
  governing: DistributedGoverning
  midspan_points: DistributedPoint[]
  support_points: DistributedPoint[]
  quantity: Quantity
  w_dc: number
  w_dw: number
  unit: string
}

// --- Tablier (dalle) : méthode de la bande équivalente (AASHTO) ---

export interface DeckCatalog {
  P: number
  gage: number
  edge_offset: number
  im: number
  force_unit: string
  length_unit: string
}

export interface DeckDesignRequest {
  n_girders: number
  spacing: number
  overhang: number
  dx: number
  w_dc: number
  w_dw: number
  gamma_dc: number
  gamma_dw: number
  gamma_ll: number
  mpf1: number
  mpf2: number
  mpf3: number
  p_barrier: number
  x_barrier: number
  p_rail: number
  x_rail: number
  impact: boolean
  unit_system: UnitSystem
}

export interface DeckGeometry {
  total: number
  girders: number[]
  overhang: number
  spacing: number
  n_girders: number
  dx: number
}

export interface DeckLaneCase {
  n_lanes: number
  mpf: number
  M_strip: number
  M_LL: number
}

export interface DeckSection {
  M_DC: number
  M_DC_dist: number
  M_DC_barrier: number
  M_DC_rail: number
  M_DW: number
  M_LL: number
  M_strip: number
  live_lanes: DeckLaneCase[]
  E: number
  E_length: number
  Mu: number
  target_x: number
}

export interface DeckOverhangWheel {
  x: number
  X: number
  P: number
}

export interface DeckOverhangSection {
  M_DC: number
  M_DC_dist: number
  M_DC_barrier: number
  M_DC_rail: number
  M_DW: number
  M_LL: number
  M_strip: number
  E: number
  E_length: number
  Mu: number
  X: number
  wheels: DeckOverhangWheel[]
}

export interface DeckILView {
  x: number[]
  y: number[]
  target_x: number
  support_positions: number[]
  wheels: AxlePosition[]
  dead_zones: number[][]
}

export interface DeckDesignResponse {
  geometry: DeckGeometry
  wheel: { P: number; gage: number; edge_offset: number; im: number }
  factors: {
    gamma_dc: number
    gamma_dw: number
    gamma_ll: number
    mpf1: number
    mpf2: number
    mpf3: number
  }
  sections: {
    positive: DeckSection
    negative: DeckSection
    shear: DeckSection
    overhang: DeckOverhangSection
  }
  influence_lines: {
    positive: DeckILView
    negative: DeckILView
    shear: DeckILView
  }
  unit_effort: string
  unit_line: string
  unit_shear: string
  unit_shear_line: string
}

// --- Étude d'une section transversale choisie (M et V à target_x) ---

/** Comme /deck-design + la section d'étude ; charges permanentes nulles autorisées. */
export interface DeckSectionStudyRequest extends DeckDesignRequest {
  target_x: number
}

/** Cas de voies enrichi : combinaison Strength I et roues au placement critique du cas. */
export interface DeckStudyLaneCase extends DeckLaneCase {
  Mu: number
  wheels: AxlePosition[]
}

export interface DeckStudySection extends Omit<DeckSection, 'live_lanes'> {
  live_lanes: DeckStudyLaneCase[]
  /** Type de bande E inféré : négative au droit d'un longeron (et pour V), positive sinon. */
  strip_kind: 'positive' | 'negative'
}

export interface DeckSectionStudyResponse {
  geometry: DeckGeometry
  wheel: DeckDesignResponse['wheel']
  factors: DeckDesignResponse['factors']
  target_x: number
  moment: DeckStudySection
  shear: DeckStudySection
  influence_lines: {
    moment: DeckILView
    shear: DeckILView
  }
  unit_effort: string
  unit_line: string
  unit_shear: string
  unit_shear_line: string
}
