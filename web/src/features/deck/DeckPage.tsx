// Orchestre l'onglet Tablier : état d'UI local, calcul délégué à /deck-design.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { DeckDesignRequest, UnitSystem } from '@/api/types'
import { DECK_DEFAULTS, forceUnit, lengthUnit, stripUnit } from '@/lib/units'
import { useDeckCatalog, useDeckDesign } from './useDeck'
import { DeckControls } from './DeckControls'
import { DeckCrossSection } from './DeckCrossSection'
import { DeckILChart } from './DeckILChart'
import { DeckResultsTable } from './DeckResultsTable'

type DeckSectionKey = 'positive' | 'negative' | 'shear'

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
  const [section, setSection] = useState<DeckSectionKey>('positive')

  const onChange = (patch: Partial<DeckDesignRequest>) =>
    setReq((r) => ({ ...r, ...patch }))
  const onUnitSystem = (sys: UnitSystem) => setReq(initialReq(sys))

  const catalog = useDeckCatalog(req.unit_system)
  const valid =
    req.n_girders >= 2 &&
    req.spacing > 0 &&
    req.overhang >= 0 &&
    req.dx > 0 &&
    (req.w_dc > 0 || req.w_dw > 0)
  const design = useDeckDesign(valid ? req : null)

  const lu = lengthUnit(req.unit_system)
  const fu = forceUnit(req.unit_system)
  const su = stripUnit(req.unit_system)
  const data = design.data
  const il = data ? data.influence_lines[section] : null

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
            <CardTitle>Coupe transversale</CardTitle>
            <CardDescription>
              Longerons (rouge) · porte-à-faux (jaune) · roues HL-93 (cas{' '}
              {section === 'positive'
                ? 'positif'
                : section === 'negative'
                  ? 'négatif'
                  : 'effort tranchant'}
              )
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data ? (
              <DeckCrossSection
                geometry={data.geometry}
                wheels={il?.wheels ?? []}
                pointLoads={[
                  ...(req.p_barrier > 0
                    ? [{ x: req.x_barrier, P: req.p_barrier, label: 'Barr.' }]
                    : []),
                  ...(req.p_rail > 0
                    ? [{ x: req.x_rail, P: req.p_rail, label: 'Gliss.' }]
                    : []),
                ]}
                forceUnit={fu}
                lengthUnit={lu}
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Ligne d'influence transversale</CardTitle>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={section === 'positive' ? 'default' : 'outline'}
                  onClick={() => setSection('positive')}
                >
                  Positif
                </Button>
                <Button
                  size="sm"
                  variant={section === 'negative' ? 'default' : 'outline'}
                  onClick={() => setSection('negative')}
                >
                  Négatif
                </Button>
                <Button
                  size="sm"
                  variant={section === 'shear' ? 'default' : 'outline'}
                  onClick={() => setSection('shear')}
                >
                  Eff. tranchant
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {il ? (
              <DeckILChart il={il} lengthUnit={lu} quantity={section === 'shear' ? 'V' : 'M'} />
            ) : (
              <p className="text-sm text-muted-foreground">En attente de calcul.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
