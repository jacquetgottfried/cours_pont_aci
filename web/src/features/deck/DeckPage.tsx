// Orchestre l'onglet Tablier : état d'UI local, calcul délégué à /deck-design
// (tableaux AASHTO live) et /deck-section-study (étude à la demande).
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  DeckDesignRequest,
  DeckSectionStudyResponse,
  UnitSystem,
} from '@/api/types'
import {
  DECK_DEFAULTS,
  deckStudyTargets,
  defaultDeckStudyX,
  forceUnit,
  lengthUnit,
  nearestTarget,
  stripUnit,
} from '@/lib/units'
import { useDeckCatalog, useDeckDesign } from './useDeck'
import { DeckControls } from './DeckControls'
import { DeckCrossSection } from './DeckCrossSection'
import { DeckResultsTable } from './DeckResultsTable'
import { DeckStudyPanel, type LaneCount } from './DeckStudyPanel'

function initialStudyX(sys: UnitSystem): number {
  const d = DECK_DEFAULTS[sys]
  return defaultDeckStudyX(d.n, d.s, d.oh, d.dx)
}

/** Paire symétrique d'une charge de bord pour l'affichage (miroir du moteur). */
function edgeLoadsDisplay(total: number, p: number, x: number, label: string) {
  if (p <= 0) return []
  const out = [{ x, P: p, label }]
  const xMirror = total - x
  if (Math.abs(xMirror - x) > 1e-9) out.push({ x: xMirror, P: p, label })
  return out
}

function initialReq(sys: UnitSystem): DeckDesignRequest {
  const d = DECK_DEFAULTS[sys]
  return {
    n_girders: d.n,
    spacing: d.s,
    overhang: d.oh,
    dx: d.dx,
    w_dc: d.wdc,
    w_dw: d.wdw,
    gamma_dc: 1.25,
    gamma_dw: 1.5,
    gamma_ll: 1.75,
    mpf1: 1.2,
    mpf2: 1.0,
    mpf3: 0.85,
    p_barrier: d.pb,
    x_barrier: d.xb,
    p_rail: 0,
    x_rail: d.xr,
    impact: true,
    unit_system: sys,
  }
}

export function DeckPage() {
  const [req, setReq] = useState<DeckDesignRequest>(() => initialReq('SI'))
  const [studyX, setStudyX] = useState<number>(() => initialStudyX('SI'))
  // Résultat d'étude + cas de voies affiché : remontés ici pour que la coupe
  // transversale matérialise les roues du cas choisi (bascule M/V ci-dessous).
  const [study, setStudy] = useState<DeckSectionStudyResponse | null>(null)
  const [nLanes, setNLanes] = useState<LaneCount>(1)
  const [crossQ, setCrossQ] = useState<'moment' | 'shear'>('moment')

  const onChange = (patch: Partial<DeckDesignRequest>) =>
    setReq((r) => ({ ...r, ...patch }))
  const onUnitSystem = (sys: UnitSystem) => {
    // Pas de conversion des valeurs saisies (cf. doc 05 D6) : reset aux défauts.
    setReq(initialReq(sys))
    setStudyX(initialStudyX(sys))
  }

  // La section d'étude reste snappée sur la grille quand la géométrie change.
  useEffect(() => {
    const targets = deckStudyTargets(req.n_girders, req.spacing, req.overhang, req.dx)
    if (targets.length === 0) return
    setStudyX((x) => nearestTarget(targets, x))
  }, [req.n_girders, req.spacing, req.overhang, req.dx])

  // Le résultat d'étude devient obsolète dès qu'une entrée ou la section change.
  // Changer le nombre de voies ou la bascule M/V n'invalide PAS (sélection de vue).
  useEffect(() => {
    setStudy(null)
  }, [req, studyX])

  const catalog = useDeckCatalog(req.unit_system)
  const geomValid =
    req.n_girders >= 2 && req.spacing > 0 && req.overhang >= 0 && req.dx > 0
  const valid = geomValid && (req.w_dc > 0 || req.w_dw > 0)
  const design = useDeckDesign(valid ? req : null)

  const lu = lengthUnit(req.unit_system)
  const fu = forceUnit(req.unit_system)
  const su = stripUnit(req.unit_system)
  const data = design.data

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      {/* Entrées */}
      <Card>
        <CardHeader>
          <CardTitle>Tablier — bande équivalente</CardTitle>
          <CardDescription>
            Dalle = poutre transversale sur longerons (AASHTO §4.6.2.1)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeckControls
            req={req}
            catalog={catalog.data}
            onChange={onChange}
            onUnitSystem={onUnitSystem}
          />
          {design.isError && (
            <p className="mt-3 text-sm text-destructive">
              Erreur : {design.error?.message}
              <br />
              <span className="text-muted-foreground">
                dx doit diviser la grille (longerons, porte-à-faux).
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sorties */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Coupe transversale</CardTitle>
              {study && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={crossQ === 'moment' ? 'default' : 'outline'}
                    onClick={() => setCrossQ('moment')}
                  >
                    Roues M
                  </Button>
                  <Button
                    size="sm"
                    variant={crossQ === 'shear' ? 'default' : 'outline'}
                    onClick={() => setCrossQ('shear')}
                  >
                    Roues V
                  </Button>
                </div>
              )}
            </div>
            <CardDescription>
              Longerons (rouge) · porte-à-faux (jaune) · barrière/glissière aux deux
              rives (vert) · repère de section (orange, glissable)
              {study &&
                ` · roues du cas ${nLanes} voie${nLanes > 1 ? 's' : ''} (placement critique ${
                  crossQ === 'moment' ? 'du moment' : "de l'effort tranchant"
                })`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <DeckCrossSection
                geometry={data.geometry}
                wheels={
                  study?.[crossQ].live_lanes.find((c) => c.n_lanes === nLanes)
                    ?.wheels ?? []
                }
                pointLoads={[
                  ...edgeLoadsDisplay(
                    data.geometry.total,
                    req.p_barrier,
                    req.x_barrier,
                    'Barr.',
                  ),
                  ...edgeLoadsDisplay(
                    data.geometry.total,
                    req.p_rail,
                    req.x_rail,
                    'Gliss.',
                  ),
                ]}
                forceUnit={fu}
                lengthUnit={lu}
                studyX={studyX}
                snapTargets={deckStudyTargets(
                  req.n_girders,
                  req.spacing,
                  req.overhang,
                  req.dx,
                )}
                onStudyXChange={setStudyX}
              />
            ) : (
              <p className="text-sm text-muted-foreground">En attente de calcul.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moments de calcul (par unité de largeur)</CardTitle>
            {data && (
              <CardDescription>
                Porte-à-faux par statique · m_LL = MPF·M_bande/E · Mu = Σ γ·M
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {data ? (
              <DeckResultsTable data={data} stripUnitLabel={su} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {design.isFetching ? 'Calcul…' : 'Saisissez une géométrie valide.'}
              </p>
            )}
          </CardContent>
        </Card>

        <DeckStudyPanel
          req={req}
          studyX={studyX}
          onStudyXChange={setStudyX}
          disabled={!geomValid}
          study={study}
          onStudyChange={setStudy}
          nLanes={nLanes}
          onNLanesChange={setNLanes}
        />
      </div>
    </div>
  )
}
