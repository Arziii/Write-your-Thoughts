import { memo, useLayoutEffect, useRef } from 'react'
import { atlasHeight, atlasWidth } from './atlasPaths'
import { TerrainCompositor } from './terrainBlend'
import type { TerrainFeature, TerrainTextures } from './terrainBlend'

export default memo(function TerrainBlendLayer({ features, draft, textures, surfaces }: {
  features: TerrainFeature[]
  draft: TerrainFeature | null
  textures: TerrainTextures
  surfaces: TerrainTextures
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const compositor = useRef<TerrainCompositor | null>(null)
  useLayoutEffect(() => {
    if (!canvas.current) return
    compositor.current ??= new TerrainCompositor(canvas.current)
    compositor.current.render(features, draft, textures, surfaces)
  }, [features, draft, textures, surfaces])

  return <foreignObject x="0" y="0" width={atlasWidth} height={atlasHeight} pointerEvents="none">
    <canvas ref={canvas} width={atlasWidth} height={atlasHeight} data-terrain-blend="" style={{ display: 'block' }} />
  </foreignObject>
})
