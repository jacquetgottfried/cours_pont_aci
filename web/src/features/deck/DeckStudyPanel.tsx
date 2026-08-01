// Panneau « Étude d'une section » : section choisie (champ + repère glissable),
// nombre de voies, bouton « Calculer » → M et V simultanés (2 LI + tableau).
// Le calcul vit en Python (/deck-section-study) ; ici uniquement de la sélection
// de données (cas de voies affiché) et de la présentation.
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DeckDesignRequest, DeckSectionStudyResponse } from '@/api/types'
import { deckStudyTargets, lengthUnit, nearestTarget, stripUnit } from '@/lib/units'
import { useDeckSectionStudy } from './useDeck'
import { DeckILChart } from './DeckILChart'
import { DeckStudyTable } from './DeckStudyTable'

export type LaneCount = 1 | 2 | 3

interface Props {
  req: DeckDesignRequest
  studyX: number
  onStudyXChange: (x: number) => void
  /** Géométrie invalide : bouton désactivé (l'étude accepte les charges nulles). */
  disabled: boolean
  /** État remonté à DeckPage : la coupe transversale affiche les roues du cas choisi. */
  study: DeckSectionStudyResponse | null
  onStudyChange: (s: DeckSectionStudyResponse | null) => void
  nLanes: LaneCount
  onNLanesChange: (n: LaneCount) => void
}

export function DeckStudyPanel({
  req,
  studyX,
  onStudyXChange,
  disabled,
  study,
  onStudyChange,
  nLanes,
  onNLanesChange,
}: Props) {
  const [xText, setXText] = useState(String(studyX))
  const mutation = useDeckSectionStudy()

  const lu = lengthUnit(req.unit_system)
  const su = stripUnit(req.unit_system)

  // Le champ suit le repère glissable (et les re-snaps de DeckPage).
  useEffect(() => {
    setXText(String(studyX))
  }, [studyX])

  const commitX = () => {
    const v = Number(xText.replace(',', '.'))
    if (!Number.isFinite(v)) {
      setXText(String(studyX))
      return
    }
    const targets = deckStudyTargets(req.n_girders, req.spacing, req.overhang, req.dx)
    const snapped = targets.length > 0 ? nearestTarget(targets, v) : studyX
    onStudyXChange(snapped)
    setXText(String(snapped))
  }

  const compute = () => {
    mutation.mutate(
      { ...req, target_x: studyX },
      { onSuccess: (res) => onStudyChange(res) },
    )
  }

  const mpfOf = (n: LaneCount) => [req.mpf1, req.mpf2, req.mpf3][n - 1]
  const caseM = study?.moment.live_lanes.find((c) => c.n_lanes === nLanes)
  const caseV = study?.shear.live_lanes.find((c) => c.n_lanes === nLanes)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Étude d'une section</CardTitle>
        <CardDescription>
          Choisissez la section x (repère orange sur la coupe ou champ ci-dessous) et le
          nombre de voies chargées, puis « Calculer » : moment ET effort tranchant à
          cette section.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="study-x">Section d'étude x ({lu})</Label>
            <Input
              id="study-x"
              type="number"
              className="w-32"
              step={req.dx}
              value={xText}
              onChange={(e) => setXText(e.target.value)}
              onBlur={commitX}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitX()
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Voies chargées</Label>
            <div className="flex gap-1">
              {([1, 2, 3] as const).map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={nLanes === n ? 'default' : 'outline'}
                  onClick={() => onNLanesChange(n)}
                >
                  {n} voie{n > 1 ? 's' : ''} · MPF {mpfOf(n).toFixed(2)}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={compute} disabled={disabled || mutation.isPending}>
            {mutation.isPending ? 'Calcul…' : 'Calculer'}
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            Erreur : {mutation.error?.message}
            <br />
            <span className="text-muted-foreground">
              x doit tomber sur la grille dx, hors extrémités libres de la dalle.
            </span>
          </p>
        )}

        {study && caseM && caseV ? (
          <>
            <div>
              <p className="mb-1 text-sm font-medium">
                LI transversale — Moment M à x = {study.target_x.toFixed(2)} {lu}
              </p>
              <DeckILChart
                il={{ ...study.influence_lines.moment, wheels: caseM.wheels }}
                lengthUnit={lu}
                quantity="M"
                targetX={study.target_x}
              />
              <p className="text-xs text-muted-foreground">
                Roues du cas {nLanes} voie{nLanes > 1 ? 's' : ''} à leur position
                critique pour le MOMENT · M_LL+IM ={' '}
                <strong>
                  {caseM.M_LL.toFixed(3)} {study.unit_line}
                </strong>{' '}
                · Mu = {caseM.Mu.toFixed(2)} {study.unit_line}
              </p>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">
                LI transversale — Effort tranchant V à x = {study.target_x.toFixed(2)}{' '}
                {lu}
              </p>
              <DeckILChart
                il={{ ...study.influence_lines.shear, wheels: caseV.wheels }}
                lengthUnit={lu}
                quantity="V"
                targetX={study.target_x}
              />
              <p className="text-xs text-muted-foreground">
                Roues du cas {nLanes} voie{nLanes > 1 ? 's' : ''} à leur position
                critique pour L'EFFORT TRANCHANT (elle peut différer de celle du moment)
                · V_LL+IM ={' '}
                <strong>
                  {caseV.M_LL.toFixed(3)} {study.unit_shear_line}
                </strong>{' '}
                · Vu = {caseV.Mu.toFixed(2)} {study.unit_shear_line}
              </p>
            </div>

            <DeckStudyTable study={study} nLanes={nLanes} stripUnitLabel={su} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun résultat — cliquez « Calculer ».
          </p>
        )}
      </CardContent>
    </Card>
  )
}
