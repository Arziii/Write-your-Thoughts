import { app, type IpcMain } from 'electron'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dbAll, dbGet, dbRun } from '../database/init'
import { MAP_IMAGE_LIMIT } from '../../shared/maps'
import type { MapImage, MapPin } from '../../shared/maps'

function getMap(mapId: string) {
  const map = dbGet('SELECT id, book_id FROM book_maps WHERE id = ?', [mapId])
  if (!map) throw new Error('Map could not be found.')
  return map
}

function imagePath(mapId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(mapId)) throw new Error('Invalid map ID.')
  return join(app.getPath('userData'), 'map-images', mapId)
}

function imageMime(bytes: Buffer): MapImage['mime'] {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png'
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  throw new Error('Choose a PNG, JPEG, or WebP image.')
}

export function getBookMapIds(bookId: string): string[] {
  return dbAll('SELECT id FROM book_maps WHERE book_id = ?', [bookId]).map(row => String(row.id))
}

export function removeMapImage(mapId: string): void {
  try {
    rmSync(imagePath(mapId), { force: true })
  } catch (error) {
    console.error('Could not remove map image', error)
  }
}

function mapName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new Error('Enter a map name of up to 100 characters.')
  return trimmed
}

export function registerMapHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('maps:list', (_event, bookId: string) =>
    dbAll('SELECT id, name FROM book_maps WHERE book_id = ? ORDER BY created_at, id', [bookId]))

  ipcMain.handle('maps:create', (_event, { bookId, name }: { bookId: string; name: string }) => {
    if (!dbGet('SELECT id FROM books WHERE id = ?', [bookId])) throw new Error('Book could not be found.')
    const map = { id: randomUUID(), name: mapName(name) }
    dbRun('INSERT INTO book_maps (id, book_id, name) VALUES (?, ?, ?)', [map.id, bookId, map.name])
    return map
  })

  ipcMain.handle('maps:rename', (_event, { mapId, name }: { mapId: string; name: string }) => {
    getMap(mapId)
    const map = { id: mapId, name: mapName(name) }
    dbRun('UPDATE book_maps SET name = ? WHERE id = ?', [map.name, mapId])
    return map
  })

  ipcMain.handle('maps:delete', (_event, mapId: string) => {
    getMap(mapId)
    dbRun('DELETE FROM book_maps WHERE id = ?', [mapId])
    removeMapImage(mapId)
  })

  ipcMain.handle('maps:load', (_event, mapId: string) => {
    getMap(mapId)
    const pins = dbAll('SELECT location_id AS locationId, x, y FROM map_pins WHERE map_id = ?', [mapId])
    let image: MapImage | null = null
    try {
      const bytes = readFileSync(imagePath(mapId))
      image = { bytes, mime: imageMime(bytes) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return { pins, image }
  })

  ipcMain.handle('maps:setImage', (_event, { mapId, bytes }: { mapId: string; bytes: Uint8Array }) => {
    getMap(mapId)
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAP_IMAGE_LIMIT) {
      throw new Error('Choose an image up to 40 MB.')
    }
    const data = Buffer.from(bytes)
    imageMime(data)
    const path = imagePath(mapId)
    mkdirSync(join(app.getPath('userData'), 'map-images'), { recursive: true })
    const pending = path + '.tmp'
    try {
      writeFileSync(pending, data)
      renameSync(pending, path)
    } finally {
      rmSync(pending, { force: true })
    }
  })

  ipcMain.handle('maps:savePin', (_event, { mapId, locationId, x, y }: MapPin & { mapId: string }) => {
    const map = getMap(mapId)
    if (!dbGet('SELECT id FROM locations WHERE id = ? AND book_id = ?', [locationId, map.book_id])) {
      throw new Error('Choose a location from this book.')
    }
    if (![x, y].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new Error('Place the pin inside the map.')
    }
    dbRun(
      'INSERT INTO map_pins (map_id, location_id, x, y) VALUES (?, ?, ?, ?) ON CONFLICT(map_id, location_id) DO UPDATE SET x = excluded.x, y = excluded.y',
      [mapId, locationId, x, y]
    )
    return { locationId, x, y }
  })

  ipcMain.handle('maps:removePin', (_event, { mapId, locationId }: { mapId: string; locationId: string }) => {
    dbRun('DELETE FROM map_pins WHERE map_id = ? AND location_id = ?', [mapId, locationId])
  })
}

