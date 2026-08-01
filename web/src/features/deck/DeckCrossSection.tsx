// Coupe transversale de la dalle (Konva) : longerons, porte-à-faux, charges de bord
// et repère de la section d'étude GLISSABLE (snap sur la grille dx). Présentation/
// interaction pure : ne calcule rien, remonte `studyX` via onStudyXChange.
import { useEffect, useRef, useState } from 'react'
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { AxlePosition, DeckGeometry } from '@/api/types'
import { nearestTarget } from '@/lib/units'

interface PointLoad {
  x: number
  P: number
  label: string
}

interface Props {
  geometry: DeckGeometry
  wheels?: AxlePosition[]
  pointLoads?: PointLoad[]
  forceUnit: string
  lengthUnit: string
  /** Repère de section d'étude (glissable si onStudyXChange est fourni). */
  studyX?: number
  snapTargets?: number[]
  onStudyXChange?: (x: number) => void
}

const HEIGHT = 170
const MARGIN = 40
const DECK_Y = 96

export function DeckCrossSection({
  geometry,
  wheels = [],
  pointLoads = [],
  forceUnit,
  lengthUnit,
  studyX,
  snapTargets = [],
  onStudyXChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(720)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const { total, girders, overhang } = geometry
  const plotW = Math.max(1, width - 2 * MARGIN)
  const scale = plotW / (total || 1)
  const px = (x: number) => MARGIN + x * scale
  const physFromPx = (pxX: number) =>
    nearestTarget(snapTargets, (pxX - MARGIN) / scale)

  const handleDrag = (e: KonvaEventObject<DragEvent>) => {
    onStudyXChange?.(physFromPx(e.target.x()))
  }

  return (
    <div ref={wrapRef} className="w-full">
      <Stage width={width} height={HEIGHT}>
        <Layer>
          {/* Porte-à-faux (zones ombrées aux deux bords) */}
          <Rect x={px(0)} y={DECK_Y - 8} width={overhang * scale} height={16} fill="#fde68a" />
          <Rect
            x={px(total - overhang)}
            y={DECK_Y - 8}
            width={overhang * scale}
            height={16}
            fill="#fde68a"
          />
          {/* Dalle */}
          <Rect x={px(0)} y={DECK_Y - 8} width={total * scale} height={16} stroke="#0f172a" strokeWidth={2} />

          {/* Longerons (appuis) sous la dalle */}
          {girders.map((g, i) => (
            <Line
              key={g}
              points={[px(g), DECK_Y + 8, px(g), DECK_Y + 44]}
              stroke="#b91c1c"
              strokeWidth={i === 0 || i === girders.length - 1 ? 5 : 6}
            />
          ))}

          {/* Roues de calcul placées (file gouvernante) */}
          {wheels.map((w, i) => (
            <Arrow
              key={i}
              points={[px(w.x), DECK_Y - 56, px(w.x), DECK_Y - 12]}
              stroke="#dc2626"
              fill="#dc2626"
              strokeWidth={2}
              pointerLength={8}
              pointerWidth={7}
            />
          ))}
          {wheels.map((w, i) => (
            <Text
              key={`t${i}`}
              x={px(w.x) - 28}
              y={DECK_Y - 72}
              width={56}
              align="center"
              text={`${w.load} ${forceUnit}`}
              fontSize={11}
              fill="#dc2626"
            />
          ))}

          {/* Charges ponctuelles permanentes (barrière/glissière) en vert */}
          {pointLoads.map((p, i) => (
            <Arrow
              key={`pl${i}`}
              points={[px(p.x), DECK_Y - 40, px(p.x), DECK_Y - 12]}
              stroke="#059669"
              fill="#059669"
              strokeWidth={2}
              pointerLength={8}
              pointerWidth={7}
            />
          ))}
          {pointLoads.map((p, i) => (
            <Text
              key={`plt${i}`}
              x={px(p.x) - 34}
              y={DECK_Y - 54}
              width={68}
              align="center"
              text={`${p.label} ${p.P} ${forceUnit}`}
              fontSize={10}
              fill="#059669"
            />
          ))}

          {/* Largeur totale */}
          <Text
            x={px(0)}
            y={DECK_Y + 50}
            text={`largeur dalle = ${total.toFixed(2)} ${lengthUnit}  ·  ${girders.length} longerons`}
            fontSize={12}
            fill="#6b7280"
          />

          {/* Repère de la section d'étude, glissable (snap sur la grille dx) */}
          {studyX !== undefined && (
            <Group
              x={px(studyX)}
              y={0}
              draggable={onStudyXChange !== undefined}
              dragBoundFunc={(pos) => ({
                x: px(physFromPx(Math.max(MARGIN, Math.min(MARGIN + plotW, pos.x)))),
                y: 0,
              })}
              onDragMove={handleDrag}
            >
              <Line
                points={[0, 14, 0, DECK_Y + 46]}
                stroke="#b45309"
                strokeWidth={2}
                dash={[5, 3]}
              />
              <Circle x={0} y={14} radius={7} fill="#b45309" />
              <Text
                x={6}
                y={8}
                text={`x = ${studyX.toFixed(2)} ${lengthUnit}`}
                fontSize={12}
                fontStyle="bold"
                fill="#b45309"
              />
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  )
}
