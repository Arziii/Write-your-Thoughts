import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { ImagePlus, Map as MapIcon, MapPin as PinIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import { MAP_IMAGE_LIMIT } from '../../../../../shared/maps'
import type { BookMap, MapImage, MapPin } from '../../../../../shared/maps'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import Modal from '../../ui/Modal'
import MapCanvas from './MapCanvas'
import ParchmentMapTools, { disposeParchmentMap, initializeParchmentMap } from './ParchmentMapTools'
import LocationSummaryPanel from '../LocationSummaryPanel'

const buttonStyle = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium hover:bg-surface-800 disabled:opacity-50'
const fieldStyle = 'min-w-0 rounded-md border border-surface-700 bg-surface-950 px-2.5 py-1.5 text-sm text-surface-100'
const getError = (error: unknown) => error instanceof Error ? error.message : 'Could not save the map. Try again.'

type MapAction = { type: 'create' } | { type: 'rename' | 'delete'; map: BookMap }

export default function BookMaps({ bookId }: { bookId: string }) {
  const [maps, setMaps] = useState<BookMap[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [action, setAction] = useState<MapAction | null>(null)
  const [name, setName] = useState('')
  const [parchment, setParchment] = useState(false)
  const storageKey = `wyt-map-selection-${bookId}`
  const selectedMap = maps.find(map => map.id === selectedId)
  const focused = useWorkspaceStore(state => state.mapEditorFocused)
  const setFocused = useWorkspaceStore(state => state.setMapEditorFocused)

  useEffect(() => () => setFocused(false), [setFocused])

  useEffect(() => {
    if (window.api.isMock) {
      setLoadError('Open the desktop app to use your book’s maps.')
      setLoading(false)
      return
    }
    let cancelled = false
    window.api.maps.list(bookId).then((items: BookMap[]) => {
      if (cancelled) return
      const last = localStorage.getItem(storageKey)
      setMaps(items)
      setSelectedId(items.find(map => map.id === last)?.id ?? items[0]?.id ?? '')
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(getError(error))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bookId, storageKey])

  function selectMap(id: string) {
    localStorage.setItem(storageKey, id)
    setSelectedId(id)
  }

  function startAction(next: MapAction) {
    setActionError('')
    setName(next.type === 'create' ? '' : next.map.name)
    setParchment(false)
    setAction(next)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action || busy) return
    setBusy(true)
    setActionError('')
    try {
      if (action.type === 'create') {
        const map: BookMap = await window.api.maps.create({ bookId, name })
        setMaps(current => [...current, map])
        selectMap(map.id)
        initializeParchmentMap(map.id, parchment)
      } else if (action.type === 'rename') {
        const map: BookMap = await window.api.maps.rename({ mapId: action.map.id, name })
        setMaps(current => current.map(item => item.id === map.id ? map : item))
      } else {
        await window.api.maps.delete(action.map.id)
        const remaining = maps.filter(map => map.id !== action.map.id)
        setMaps(remaining)
        selectMap(remaining[0]?.id ?? '')
        disposeParchmentMap(action.map.id)
      }
      setAction(null)
    } catch (error) {
      setActionError(getError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="studio-desk flex h-full min-h-0 flex-col !p-0 text-surface-100">
      {!focused && <div className="flex flex-wrap items-center gap-2 border-b border-surface-800 bg-surface-900 px-3 py-1.5">
        {maps.length > 0 && (
          <>
            <label htmlFor="book-map-picker" className="text-xs font-medium text-surface-400">Map</label>
            <select id="book-map-picker" className={`${fieldStyle} max-w-56`} value={selectedId} onChange={event => selectMap(event.target.value)}>
              {maps.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}
            </select>
          </>
        )}
        <button type="button" className={buttonStyle} disabled={loading || Boolean(loadError)} onClick={() => startAction({ type: 'create' })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New map
        </button>
        {selectedMap && (
          <>
            <button type="button" className={buttonStyle} onClick={() => startAction({ type: 'rename', map: selectedMap })}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
            </button>
            <button type="button" className={buttonStyle} title="Delete map" aria-label="Delete map" onClick={() => startAction({ type: 'delete', map: selectedMap })}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>}

      {selectedMap ? <MapWorkspace key={selectedMap.id} map={selectedMap} bookId={bookId} focused={focused} onFocusChange={setFocused} /> : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <MapIcon className="h-8 w-8 text-surface-500" aria-hidden="true" />
          <p role="status" className="text-sm text-surface-400">{loadError || (loading ? 'Loading maps…' : 'Create a map to start placing locations. You can add an image later.')}</p>
        </div>
      )}

      {action && (
        <Modal isOpen onClose={() => { if (!busy) setAction(null) }} title={action.type === 'delete' ? 'Delete map' : action.type === 'rename' ? 'Rename map' : 'New map'}>
          <form className="flex flex-col gap-4" onSubmit={submit}>
            {action.type === 'delete' ? (
              <p className="text-sm text-surface-300">Delete “{action.map.name}” and its pins? The linked locations will still be in your book.</p>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm">
                Map name
                <input className={fieldStyle} value={name} onChange={event => setName(event.target.value)} placeholder="World map" required maxLength={100} autoFocus />
              </label>
            )}
            {action.type === 'create' && (
              <div className="space-y-2">
                <p className="text-sm text-surface-400">New maps start as open ocean. Use Edit map to paint land.</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={parchment} onChange={event => setParchment(event.target.checked)} />
                  Use the sample parchment region
                </label>
              </div>
            )}
            {actionError && <p role="alert" className="text-sm text-danger-500">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={buttonStyle} disabled={busy} onClick={() => setAction(null)}>Cancel</button>
              <button type="submit" className={buttonStyle} disabled={busy || (action.type !== 'delete' && !name.trim())}>
                {action.type === 'delete' ? 'Delete map' : action.type === 'rename' ? 'Save name' : 'Create map'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

function MapWorkspace({ map, bookId, focused, onFocusChange }: {
  map: BookMap
  bookId: string
  focused: boolean
  onFocusChange: (focused: boolean) => void
}) {
  const mapId = map.id
  const locations = useWorkspaceStore(state => state.locations)
  const openTab = useWorkspaceStore(state => state.openTab)
  const [pins, setPins] = useState<MapPin[]>([])
  const [image, setImage] = useState<Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [locationId, setLocationId] = useState('')
  const [summaryLocationId, setSummaryLocationId] = useState('')
  const [placing, setPlacing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const bookLocations = locations.filter(location => location.book_id === bookId)
  const location = bookLocations.find(item => item.id === locationId)
  const summaryLocation = bookLocations.find(item => item.id === summaryLocationId)
  const existingPin = pins.some(pin => pin.locationId === locationId)
  const namedPins = pins.flatMap(pin => {
    const match = bookLocations.find(item => item.id === pin.locationId)
    return match ? [{ ...pin, name: match.name }] : []
  })

  useEffect(() => {
    let cancelled = false
    window.api.maps.load(mapId).then((data: { pins: MapPin[]; image: MapImage | null }) => {
      if (cancelled) return
      setPins(data.pins)
      if (data.image) setImage(new Blob([new Uint8Array(data.image.bytes)], { type: data.image.mime }))
    }).catch((failure: unknown) => {
      if (!cancelled) setError(getError(failure))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mapId])

  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  async function updateMap(operation: () => Promise<void>) {
    if (busy || loading) return
    setBusy(true)
    setError('')
    try {
      await operation()
    } catch (failure) {
      setError(getError(failure))
    } finally {
      setBusy(false)
    }
  }

  async function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await updateMap(async () => {
      if (file.size > MAP_IMAGE_LIMIT) throw new Error('Choose an image up to 40 MB.')
      const bitmap = await createImageBitmap(file).catch(() => { throw new Error('This image could not be decoded.') })
      bitmap.close()
      await window.api.maps.setImage({ mapId, bytes: new Uint8Array(await file.arrayBuffer()) })
      setImage(file)
      setPlacing(false)
    })
  }

  function placePin(point: { x: number; y: number }) {
    if (!location) return
    void updateMap(async () => {
      const pin: MapPin = await window.api.maps.savePin({ mapId, locationId: location.id, ...point })
      setPins(current => [...current.filter(item => item.locationId !== pin.locationId), pin])
      setPlacing(false)
    })
  }

  function removePin() {
    void updateMap(async () => {
      await window.api.maps.removePin({ mapId, locationId })
      setPins(current => current.filter(pin => pin.locationId !== locationId))
      setSummaryLocationId(current => current === locationId ? '' : current)
      setPlacing(false)
    })
  }

  const mapControls = (
    <>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden onChange={importImage} />
      <button type="button" className={buttonStyle} onClick={() => fileInput.current?.click()} disabled={busy || loading}>
        <ImagePlus className="h-4 w-4" aria-hidden="true" /> {image ? 'Replace image' : 'Import image'}
      </button>
      <select className={`${fieldStyle} max-w-52`} aria-label="Location to pin" value={locationId} disabled={busy || loading} onChange={event => {
        setLocationId(event.target.value)
        setPlacing(false)
      }}>
        <option value="">{bookLocations.length ? 'Choose a location' : 'No locations yet'}</option>
        {bookLocations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {location && (
        <>
          <button type="button" className={buttonStyle} aria-pressed={placing} disabled={busy || loading} onClick={() => setPlacing(value => !value)}>
            <PinIcon className="h-4 w-4" aria-hidden="true" /> {placing ? 'Cancel placement' : existingPin ? 'Move pin' : 'Place pin'}
          </button>
          {existingPin && (
            <>
              <button type="button" className={buttonStyle} onClick={() => openTab(location.id, 'location', location.name)}>Open location</button>
              <button type="button" className={buttonStyle} disabled={busy} onClick={removePin}>Remove pin</button>
            </>
          )}
        </>
      )}
    </>
  )

  return (
    <>
      {error && <p role="alert" className="px-4 py-2 text-sm text-danger-500">{error}</p>}
      {placing && <p role="status" className="px-4 py-2 text-xs text-surface-400">Click the map to place the pin for {location?.name}.</p>}
      {loading ? <p role="status" className="p-4 text-sm text-surface-400">Loading map…</p> : (
        <ParchmentMapTools mapId={mapId} mapName={map.name} hasImage={Boolean(imageUrl)} focused={focused} viewerControls={mapControls}
          onEdit={() => { setSummaryLocationId(''); onFocusChange(true) }}
          onExit={() => onFocusChange(false)}
          beforeDrawing={() => { setPlacing(false); setSummaryLocationId('') }}>
          {({ overlay, placementPreview, viewportOverlay, brush, onEditPoint, hideImage, hidePins }) => (
            <div className="flex min-h-0 min-w-0 flex-1">
              <MapCanvas overlay={overlay} placementPreview={placementPreview} viewportOverlay={viewportOverlay} brush={brush} key={imageUrl ?? 'blank'} imageUrl={imageUrl} hideImage={focused && hideImage}
                fitTrigger={focused}
                pins={focused && hidePins ? [] : namedPins} placing={Boolean(onEditPoint) || placing}
                selectedLocationId={locationId} onSelectPin={id => {
                  setLocationId(id)
                  setSummaryLocationId(id)
                }} onPlace={onEditPoint ?? placePin} />
              {summaryLocation && <LocationSummaryPanel key={summaryLocation.id} location={summaryLocation} onClose={() => setSummaryLocationId('')} />}
            </div>
          )}
        </ParchmentMapTools>
      )}
    </>
  )
}

