import { memo, useEffect, useRef, useState } from 'react'
import { atlasHeight, atlasWidth } from './atlasPaths'
import type { AtlasPathFeature, AtlasTerrain, WorldPoint } from './atlasPaths'
import { loadPathTextures, paintAtlasPaths } from './atlasPathPaint'
import type { Textures } from './atlasPathPaint'

const fallback: Textures = {}

export default memo(function AtlasPathLayer({ paths, terrainAt }: {
  paths: AtlasPathFeature[]
  terrainAt: (point: WorldPoint) => AtlasTerrain
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [textures, setTextures] = useState(fallback)
  const hasPaths = paths.length > 0
  useEffect(() => {
    if (!hasPaths || textures !== fallback) return
    let active = true
    void loadPathTextures().then(loaded => { if (active) setTextures(loaded) })
    return () => { active = false }
  }, [hasPaths, textures])

  useEffect(() => {
    if (!canvas.current || !hasPaths) return
    const target = canvas.current
    const frame = requestAnimationFrame(() => paintAtlasPaths(target, paths, textures, terrainAt))
    return () => cancelAnimationFrame(frame)
  }, [hasPaths, paths, textures, terrainAt])

  return hasPaths ? <canvas ref={canvas} width={atlasWidth} height={atlasHeight}
    className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" /> : null
})
