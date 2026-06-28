// Orchestre la tranche Poutre : détient l'état local d'UI, délègue TOUT le calcul
// à l'API via les hooks. Aucune mécanique ici.
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  Quantity,
  UnitSystem,
  Vehicle,
  VehicleEnvelopeResponse,
} from '@/api/types'
import {
  UNIT_DEFAULTS,
  defaultTarget,
  effectUnit,
  forceUnit,
  lengthUnit,
  nearestTarget,
  parseSpans,
  supportPositions,
  validTargets,
} from '@/lib/units'
import { useInfluenceLine, useVehicleSweep } from './useBeam'
import { BeamControls } from './BeamControls'
import { BeamEditor } from './BeamEditor'
import { InfluenceLineChart } from './InfluenceLineChart'

const INITIAL_SPANS = UNIT_DEFAULTS.SI.spans

export function BeamPage() {
  const [spansText, setSpansText] = useState(INITIAL_SPANS)
  const [quantity, setQuantity] = useState<Quantity>('M')
  const [dx, setDx] = useState<number>(UNIT_DEFAULTS.SI.dx)
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('SI')
  const [vehicle, setVehicle] = useState<Vehicle>('truck')
  const [targetX, setTargetX] = useState(() =>
    defaultTarget(parseSpans(INITIAL_SPANS), UNIT_DEFAULTS.SI.dx, 'M'),
  )
  const [placement, setPlacement] = useState<VehicleEnvelopeResponse | null>(null)

  const spans = useMemo(() => parseSpans(spansText), [spansText])
  const L = useMemo(() => spans.reduce((a, b) => a + b, 0), [spans])
  const targets = useMemo(
    () => validTargets(spans, dx, quantity),
    [spans, dx, quantity],
  )

  // La section reste TOUJOURS sur une cible valide (appui pour R, nœud pour M/V).
  // Quand la liste change (grandeur / travées / dx), on recale au plus proche.
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
  const sweep = useVehicleSweep()

  // Le convoi placé devient obsolète dès qu'une entrée change.
  useEffect(() => {
    setPlacement(null)
  }, [spansText, quantity, dx, unitSystem, vehicle, reqTarget])

  const onUnitSystem = (sys: UnitSystem) => {
    const d = UNIT_DEFAULTS[sys]
    setUnitSystem(sys)
    setSpansText(d.spans)
    setDx(d.dx)
    setTargetX(defaultTarget(parseSpans(d.spans), d.dx, quantity))
  }

  const supports = il.data?.meta.support_positions ?? supportPositions(spans)
  const lu = lengthUnit(unitSystem)
  const fu = forceUnit(unitSystem)

  const findCritical = () => {
    if (!ilReq) return
    sweep.mutate({ ...ilReq, vehicle, impact: true }, { onSuccess: setPlacement })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Colonne entrées */}
      <Card>
        <CardHeader>
          <CardTitle>Données</CardTitle>
          <CardDescription>Poutre continue · méthode de Müller-Breslau</CardDescription>
        </CardHeader>
        <CardContent>
          <BeamControls
            spansText={spansText}
            quantity={quantity}
            dx={dx}
            unitSystem={unitSystem}
            vehicle={vehicle}
            onSpansText={setSpansText}
            onQuantity={setQuantity}
            onDx={setDx}
            onUnitSystem={onUnitSystem}
            onVehicle={setVehicle}
          />
          <Button
            className="mt-4 w-full"
            onClick={findCritical}
            disabled={!il.data || sweep.isPending}
          >
            {sweep.isPending ? 'Calcul…' : 'Position critique du convoi'}
          </Button>
          {(il.isError || sweep.isError) && (
            <p className="mt-3 text-sm text-destructive">
              Erreur : {(il.error ?? sweep.error)?.message}
              <br />
              <span className="text-muted-foreground">
                Le backend est-il lancé ? (uvicorn backend.main:app)
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Colonne sorties */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Éditeur de poutre</CardTitle>
            <CardDescription>
              {quantity === 'R'
                ? "Glissez le repère sur un appui (la réaction n'existe qu'aux appuis)."
                : 'Glissez le repère orange pour choisir la section, puis « Position critique ».'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spans.length > 0 && targets.length > 0 ? (
              <BeamEditor
                spanLength={L}
                supports={supports}
                targetX={reqTarget}
                snapTargets={targets}
                axles={placement?.governing.axle_positions ?? null}
                forceUnit={fu}
                lengthUnit={lu}
                onTargetXChange={setTargetX}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Saisissez des travées valides.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Ligne d'influence — {quantity} à x = {reqTarget.toFixed(1)} {lu}
            </CardTitle>
            {placement && (
              <CardDescription>
                Effet gouvernant :{' '}
                <strong>
                  {placement.governing.value.toFixed(2)} {effectUnit(quantity, unitSystem)}
                </strong>{' '}
                (essieu de tête à {placement.governing.lead_pos.toFixed(2)} {lu})
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {il.data ? (
              <InfluenceLineChart data={il.data} lengthUnit={lu} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {il.isFetching ? 'Calcul…' : 'En attente de calcul.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
