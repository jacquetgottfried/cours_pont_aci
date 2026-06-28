// Éditeur graphique de la poutre (Konva) : appuis + section GLISSABLE + convoi.
// Présentation/interaction pure : il ne calcule rien, il remonte `target_x`.
import { useEffect, useRef, useState } from 'react'
import {
  Arrow,
  Circle,
  Group,
  Layer,
  Line,
  RegularPolygon,
  Stage,
  Text,
} from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { AxlePosition } from '@/api/types'
import { nearestTarget } from '@/lib/units'

interface Props {
  spanLength: number
  supports: number[]
  targetX: number
  /** Positions où la section peut se poser (appuis pour R, nœuds pour M/V). */
  snapTargets: number[]
  axles: AxlePosition[] | null
  forceUnit: string
  lengthUnit: string
  onTargetXChange: (x: number) => void
}

const HEIGHT = 200
const MARGIN = 48
const BEAM_Y = 110

export function BeamEditor({
  spanLength: L,
  supports,
  targetX,
  snapTargets,
  axles,
  forceUnit,
  lengthUnit,
  onTargetXChange,
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

  const plotW = Math.max(1, width - 2 * MARGIN)
  const scale = plotW / (L || 1)
  const px = (x: number) => MARGIN + x * scale
  const physFromPx = (pxX: number) =>
    nearestTarget(snapTargets, (pxX - MARGIN) / scale)

  const handleDrag = (e: KonvaEventObject<DragEvent>) => {
    onTargetXChange(physFromPx(e.target.x()))
  }

  return (
    <div ref={wrapRef} className="w-full">
      <Stage width={width} height={HEIGHT}>
        <Layer>
          {/* Poutre */}
          <Line points={[px(0), BEAM_Y, px(L), BEAM_Y]} stroke="#0f172a" strokeWidth={5} />

          {/* Appuis (triangles, apex au droit de la poutre) */}
          {supports.map((s) => (
            <RegularPolygon
              key={s}
              x={px(s)}
              y={BEAM_Y + 11}
              sides={3}
              radius={11}
              fill="#b91c1c"
            />
          ))}

          {/* Convoi placé au cas gouvernant (flèches descendantes) */}
          {axles?.map((a, i) => (
            <Group key={i}>
              <Arrow
                points={[px(a.x), BEAM_Y - 56, px(a.x), BEAM_Y - 4]}
                stroke="#dc2626"
                fill="#dc2626"
                strokeWidth={2}
                pointerLength={8}
                pointerWidth={7}
              />
              <Text
                x={px(a.x) - 26}
                y={BEAM_Y - 72}
                width={52}
                align="center"
                text={`${a.load} ${forceUnit}`}
                fontSize={11}
                fill="#dc2626"
              />
            </Group>
          ))}

          {/* Marqueur de section, glissable (snap sur la grille dx) */}
          <Group
            x={px(targetX)}
            y={0}
            draggable
            dragBoundFunc={(pos) => ({
              x: px(physFromPx(Math.max(MARGIN, Math.min(MARGIN + plotW, pos.x)))),
              y: 0,
            })}
            onDragMove={handleDrag}
          >
            <Line points={[0, 20, 0, HEIGHT - 14]} stroke="#b45309" strokeWidth={2} dash={[5, 3]} />
            <Circle x={0} y={20} radius={8} fill="#b45309" />
            <Text
              x={6}
              y={HEIGHT - 18}
              text={`x = ${targetX.toFixed(1)} ${lengthUnit}`}
              fontSize={12}
              fontStyle="bold"
              fill="#b45309"
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}
