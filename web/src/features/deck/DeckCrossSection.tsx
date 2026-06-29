// Coupe transversale de la dalle (Konva) : longerons, porte-à-faux, roues placées.
// Visualisation pure (pas de glissement) : reflète la géométrie + le cas de charge.
import { useEffect, useRef, useState } from 'react'
import { Arrow, Layer, Line, Rect, Stage, Text } from 'react-konva'
import type { AxlePosition, DeckGeometry } from '@/api/types'

interface PointLoad {
  x: number
  P: number
  label: string
}

interface Props {
  geometry: DeckGeometry
  wheels: AxlePosition[]
  pointLoads?: PointLoad[]
  forceUnit: string
  lengthUnit: string
}

const HEIGHT = 170
const MARGIN = 40
const DECK_Y = 96

export function DeckCrossSection({
  geometry,
  wheels,
  pointLoads = [],
  forceUnit,
  lengthUnit,
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
        </Layer>
      </Stage>
    </div>
  )
}
