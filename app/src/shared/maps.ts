export const MAP_IMAGE_LIMIT = 40 * 1024 * 1024

export interface BookMap {
  id: string
  name: string
}

export interface MapPin {
  locationId: string
  x: number
  y: number
}

export interface MapImage {
  bytes: Uint8Array
  mime: 'image/png' | 'image/jpeg' | 'image/webp'
}

export interface LocationChapterReference {
  chapterId: string
  title: string
  excerpts: string[]
}
