export type TerrainTile = { url: string; pixels: ImageData; elevation?: Float32Array }

const tiles = new Map<string, Promise<TerrainTile>>()

export function getSeamlessTerrain(url: string): Promise<TerrainTile> {
  const cached = tiles.get(url)
  if (cached) return cached

  const tile = makeTile(url).catch(error => {
    tiles.delete(url)
    throw error
  })
  tiles.set(url, tile)
  return tile
}

function seamWeight(position: number, size: number) {
  const fromEdge = Math.min(position, size - position - 1)
  const blend = Math.min(1, fromEdge / (size * 0.24))
  return (1 + Math.cos(blend * Math.PI)) / 2
}

function opaqueBounds({ data, width, height }: ImageData) {
  if (!data.some((value, index) => index % 4 === 3 && value < 250)) return { x: 0, y: 0, width, height }

  // Find the largest opaque rectangle using consecutive opaque rows per column.
  // Probing at reduced resolution keeps preparation cheap for large PNG artwork.
  const runs = new Uint16Array(width + 1)
  const stack: number[] = []
  let best = { x: 0, y: 0, width: 0, height: 0 }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) runs[x] = data[(y * width + x) * 4 + 3] >= 250 ? runs[x] + 1 : 0
    stack.length = 0
    for (let x = 0; x <= width; x++) {
      while (stack.length && runs[stack[stack.length - 1]] > runs[x]) {
        const bottomRun = runs[stack.pop()!]
        const left = stack.length ? stack[stack.length - 1] + 1 : 0
        if ((x - left) * bottomRun > best.width * best.height) {
          best = { x: left, y: y - bottomRun + 1, width: x - left, height: bottomRun }
        }
      }
      stack.push(x)
    }
  }
  // Keep the sampling footprint clear of the cutout edge at full resolution.
  if (best.width < 5 || best.height < 5) throw new Error('Terrain texture needs an opaque area to tile')
  return { x: best.x + 2, y: best.y + 2, width: best.width - 4, height: best.height - 4 }
}

async function makeTile(url: string) {
  const image = new Image()
  image.src = url
  await image.decode()

  const probe = document.createElement('canvas')
  const probeScale = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight))
  probe.width = Math.max(1, Math.round(image.naturalWidth * probeScale))
  probe.height = Math.max(1, Math.round(image.naturalHeight * probeScale))
  const probeContext = probe.getContext('2d')
  if (!probeContext) throw new Error('Could not inspect terrain texture')
  probeContext.drawImage(image, 0, 0, probe.width, probe.height)
  const crop = opaqueBounds(probeContext.getImageData(0, 0, probe.width, probe.height))
  const scaleX = image.naturalWidth / probe.width
  const scaleY = image.naturalHeight / probe.height
  const sourceWidth = crop.width * scaleX
  const sourceHeight = crop.height * scaleY

  const canvas = document.createElement('canvas')
  const cutout = crop.width !== probe.width || crop.height !== probe.height
  const scale = (cutout ? 768 : 512) / Math.max(sourceWidth, sourceHeight)
  const width = canvas.width = Math.max(2, 2 * Math.round(sourceWidth * scale / 2))
  const height = canvas.height = Math.max(2, 2 * Math.round(sourceHeight * scale / 2))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare terrain texture')
  context.drawImage(image, crop.x * scaleX, crop.y * scaleY, sourceWidth, sourceHeight, 0, 0, width, height)
  const source = context.getImageData(0, 0, width, height).data
  const result = context.createImageData(width, height)
  const horizontal = Array.from({ length: width }, (_, x) => seamWeight(x, width))

  // Fade into a half-tile offset near each edge. Opposite edges then sample
  // adjacent points near the center of the source, where the image is continuous.
  for (let y = 0; y < height; y++) {
    const row = y * width
    const shiftedRow = ((y + height / 2) % height) * width
    const vertical = seamWeight(y, height)
    for (let x = 0; x < width; x++) {
      const shiftedX = (x + width / 2) % width
      const weight = horizontal[x]
      const index = (row + x) * 4
      for (let channel = 0; channel < 3; channel++) {
        const top = source[index + channel] * (1 - weight) + source[(row + shiftedX) * 4 + channel] * weight
        const bottom = source[(shiftedRow + x) * 4 + channel] * (1 - weight) + source[(shiftedRow + shiftedX) * 4 + channel] * weight
        result.data[index + channel] = top * (1 - vertical) + bottom * vertical
      }
      result.data[index + 3] = 255
    }
  }
  context.putImageData(result, 0, 0)
  return { url: canvas.toDataURL('image/png'), pixels: result }
}
