import { borderStyles, riverPresets, roadTextures } from './atlasPaths'
import type { AtlasPathSettings, AtlasPathTool } from './atlasPaths'

export default function AtlasPathControls({ tool, settings, update, control, id, canClose = true }: {
  tool: AtlasPathTool
  settings: AtlasPathSettings
  update: (patch: Partial<AtlasPathSettings>) => void
  control: string
  id: string
  canClose?: boolean
}) {
  function number(label: string, key: 'width' | 'mouthWidth' | 'spacing' | 'opacity', min: number, max: number) {
    const value = key === 'opacity' ? Math.round(settings.opacity * 100) : settings[key]
    return <label className="flex flex-wrap items-center gap-1 text-xs">{label}
      <input className={control + ' w-16'} type="number" min={min} max={max} key={id + ':' + value} defaultValue={value}
        onBlur={event => {
          const next = event.target.valueAsNumber
          const normalized = Number.isFinite(next) ? Math.min(max, Math.max(min, Math.round(next))) : value
          event.target.value = String(normalized)
          if (normalized !== value) update({ [key]: key === 'opacity' ? normalized / 100 : normalized })
        }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
    </label>
  }
  return <>
    {tool === 'Route' && <>
      <label className="flex flex-wrap items-center gap-1 text-xs">Terrain
        <select className={control} value={settings.terrainMode}
          onChange={event => update({ terrainMode: event.target.value as AtlasPathSettings['terrainMode'] })}>
          <option value="auto">Auto Terrain</option>
          <option value="manual">Manual texture</option>
        </select>
      </label>
      {settings.terrainMode === 'manual' && <label className="flex flex-wrap items-center gap-1 text-xs">Texture
        <select className={control} value={settings.texture}
          onChange={event => update({ texture: event.target.value as AtlasPathSettings['texture'] })}>
          {Object.entries(roadTextures).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>}
    </>}
    {tool === 'River' && <label className="flex flex-wrap items-center gap-1 text-xs">River style
      <select className={control} value={settings.river} onChange={event => {
        const river = event.target.value as AtlasPathSettings['river']
        update({ river, width: riverPresets[river].width, mouthWidth: riverPresets[river].mouth })
      }}>
        {Object.entries(riverPresets).map(([value, style]) => <option key={value} value={value}>{style.label}</option>)}
      </select>
    </label>}
    {tool === 'Border' && <>
      <label className="flex flex-wrap items-center gap-1 text-xs">Border style
        <select className={control} value={settings.border}
          onChange={event => update({ border: event.target.value as AtlasPathSettings['border'] })}>
          {Object.entries(borderStyles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1 text-xs">Border color
        <input type="color" className="h-7 w-8 cursor-pointer" key={id + ':' + settings.color} defaultValue={settings.color}
          onBlur={event => { if (event.target.value !== settings.color) update({ color: event.target.value }) }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      </label>
      {['dashed', 'dotted', 'decorative'].includes(settings.border) && number('Spacing', 'spacing', 2, 100)}
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={settings.closed || settings.fill}
        disabled={settings.fill || !canClose} onChange={event => update({ closed: event.target.checked })} />Close border</label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={settings.fill} disabled={!canClose}
        onChange={event => update({ fill: event.target.checked })} />Territory fill</label>
    </>}
    {number(tool === 'River' ? 'Source width' : 'Width', 'width', 1, tool === 'Border' ? 30 : 128)}
    {tool === 'River' && number('Mouth width', 'mouthWidth', 1, 128)}
    {number('Opacity (%)', 'opacity', 0, 100)}
  </>
}
