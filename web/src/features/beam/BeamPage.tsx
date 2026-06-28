// Orchestre l'onglet Poutre : géométrie PARTAGÉE (travées, grandeur, dx, unité, section)
// + sous-onglets « Charge mobile HL-93 » / « Charges permanentes DC/DW ». Aucun calcul ici.
import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Quantity, UnitSystem } from '@/api/types'
import {
  UNIT_DEFAULTS,
  defaultTarget,
  forceUnit,
  lengthUnit,
  nearestTarget,
  parseSpans,
  supportPositions,
  validTargets,
} from '@/lib/units'
import { useInfluenceLine } from './useBeam'
import { BeamControls } from './BeamControls'
import { VehiclePanel } from './VehiclePanel'
import { DistributedPanel } from './DistributedPanel'
import type { SharedBeam } from './shared'

const INITIAL_SPANS = UNIT_DEFAULTS.SI.spans

export function BeamPage() {
  const [spansText, setSpansText] = useState(INITIAL_SPANS)
  const [quantity, setQuantity] = useState<Quantity>('M')
  const [dx, setDx] = useState<number>(UNIT_DEFAULTS.SI.dx)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('SI')
  const [targetX, setTargetX] = useState(() =>
    defaultTarget(parseSpans(INITIAL_SPANS), UNIT_DEFAULTS.SI.dx, 'M'),
  )

  const spans = useMemo(() => parseSpans(spansText), [spansText])
  const L = useMemo(() => spans.reduce((a, b) => a + b, 0), [spans])
  const targets = useMemo(
    () => validTargets(spans, dx, quantity),
    [spans, dx, quantity],
  )

  // La section reste toujours sur une cible valide (appui pour R, nœud pour M/V).
  useEffect(() => {
    if (targets.length === 0) return
    if (!targets.some((t) => Math.abs(t - targetX) < 1e-9)) {
      setTargetX(nearestTarget(targets, targetX))
    }
  }, [targets, targetX])

  const reqTarget = targets.length ? nearestTarget(targets, targetX) : targetX
  const ilReq =
    spans.length > 0 && dx > 0 && targets.length > 0
      ? { spans, quantity, target_x: reqTarget, dx, unit_system: unitSystem }
      : null
  const il = useInfluenceLine(ilReq)

  const onUnitSystem = (sys: UnitSystem) => {
    const d = UNIT_DEFAULTS[sys]
    setUnitSystem(sys)
    setSpansText(d.spans)
    setDx(d.dx)
    setTargetX(defaultTarget(parseSpans(d.spans), d.dx, quantity))
  }

  const shared: SharedBeam = {
    ilData: il.data,
    ilFetching: il.isFetching,
    spans,
    spanLength: L,
    supports: il.data?.meta.support_positions ?? supportPositions(spans),
    quantity,
    targetX: reqTarget,
    snapTargets: targets,
    dx,
    unitSystem,
    lengthUnit: lengthUnit(unitSystem),
    forceUnit: forceUnit(unitSystem),
    geomKey: `${spansText}|${dx}|${unitSystem}`,
    onTargetXChange: setTargetX,
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Géométrie partagée */}
      <Card>
        <CardHeader>
          <CardTitle>Données</CardTitle>
          <CardDescription>Géométrie partagée · Müller-Breslau</CardDescription>
        </CardHeader>
        <CardContent>
          <BeamControls
            spansText={spansText}
            quantity={quantity}
            dx={dx}
            unitSystem={unitSystem}
            onSpansText={setSpansText}
            onQuantity={setQuantity}
            onDx={setDx}
            onUnitSystem={onUnitSystem}
          />
          {il.isError && (
            <p className="mt-3 text-sm text-destructive">
              Erreur : {il.error?.message}
              <br />
              <span className="text-muted-foreground">
                Le backend est-il lancé ? (uvicorn backend.main:app)
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analyses (sous-onglets) */}
      <Tabs defaultValue="hl93" className="min-w-0">
        <TabsList>
          <TabsTrigger value="hl93">Charge mobile HL-93</TabsTrigger>
          <TabsTrigger value="dcdw">Charges permanentes DC/DW</TabsTrigger>
        </TabsList>
        <TabsContent value="hl93" className="mt-4">
          <VehiclePanel shared={shared} />
        </TabsContent>
        <TabsContent value="dcdw" className="mt-4">
          <DistributedPanel shared={shared} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
