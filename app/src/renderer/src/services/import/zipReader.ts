export interface ZipEntry {
  path: string
  name: string
  bytes: Uint8Array
  isDirectory: boolean
  warning?: string
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50
const LOCAL_FILE_SIGNATURE = 0x04034b50

export function isZipBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05)
  )
}

async function decompressWithStream(
  bytes: Uint8Array,
  format: 'deflate-raw' | 'deflate'
): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Built-in DecompressionStream is not available in this runtime.')
  }
  const stream = new DecompressionStream(format)
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()

  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)

  const writePromise = writer.write(copy).then(() => writer.close())
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value && value.byteLength > 0) {
      chunks.push(value)
      totalLength += value.byteLength
    }
  }

  await writePromise

  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return decompressWithStream(bytes, 'deflate-raw')
}

export async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    return await decompressWithStream(bytes, 'deflate')
  } catch {
    return await decompressWithStream(bytes, 'deflate-raw')
  }
}

function isMacJunkPath(normalizedPath: string): boolean {
  const lower = normalizedPath.toLowerCase()
  if (lower.startsWith('__macosx/') || lower.includes('/__macosx/')) return true
  const baseName = normalizedPath.split('/').pop() || normalizedPath
  return baseName === '.DS_Store' || baseName.startsWith('._')
}

export async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[]> {
  if (bytes.length < 22) {
    throw new Error('Archive is too small to be a valid ZIP file.')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minScan = Math.max(0, bytes.length - 65557)
  let eocdOffset = -1

  for (let pos = bytes.length - 22; pos >= minScan; pos--) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) {
      eocdOffset = pos
      break
    }
  }

  if (eocdOffset < 0) {
    throw new Error('ZIP End of Central Directory signature not found.')
  }

  const cdCount = view.getUint16(eocdOffset + 10, true)
  const cdOffset = view.getUint32(eocdOffset + 16, true)

  if (cdOffset >= bytes.length) {
    throw new Error('ZIP Central Directory offset is out of bounds.')
  }

  const decoder = new TextDecoder('utf-8')
  const entries: ZipEntry[] = []
  let cursor = cdOffset

  for (let i = 0; i < cdCount; i++) {
    if (cursor + 46 > bytes.length) break
    if (view.getUint32(cursor, true) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error('Corrupted ZIP Central Directory header.')
    }

    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compSize = view.getUint32(cursor + 20, true)
    const nameLen = view.getUint16(cursor + 28, true)
    const extraLen = view.getUint16(cursor + 30, true)
    const commentLen = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)

    const rawPath = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen))
    const normalizedPath = rawPath.replace(/\\/g, '/')
    cursor += 46 + nameLen + extraLen + commentLen

    if (!normalizedPath || normalizedPath.endsWith('/') || isMacJunkPath(normalizedPath)) {
      continue
    }

    const fileName = normalizedPath.split('/').pop() || normalizedPath

    if ((flags & 0x01) !== 0) {
      entries.push({
        path: normalizedPath,
        name: fileName,
        bytes: new Uint8Array(0),
        isDirectory: false,
        warning: 'Encrypted ZIP entry skipped.',
      })
      continue
    }

    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== LOCAL_FILE_SIGNATURE) {
      entries.push({
        path: normalizedPath,
        name: fileName,
        bytes: new Uint8Array(0),
        isDirectory: false,
        warning: 'Invalid ZIP local file header.',
      })
      continue
    }

    const localNameLen = view.getUint16(localOffset + 26, true)
    const localExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const dataEnd = Math.min(bytes.length, dataStart + compSize)
    const compressed = bytes.subarray(dataStart, dataEnd)

    if (method === 0) {
      entries.push({
        path: normalizedPath,
        name: fileName,
        bytes: compressed.slice(),
        isDirectory: false,
      })
    } else if (method === 8) {
      try {
        const inflated = await inflateRaw(compressed)
        entries.push({
          path: normalizedPath,
          name: fileName,
          bytes: inflated,
          isDirectory: false,
        })
      } catch {
        entries.push({
          path: normalizedPath,
          name: fileName,
          bytes: new Uint8Array(0),
          isDirectory: false,
          warning: 'Failed to deflate compressed ZIP entry.',
        })
      }
    } else {
      entries.push({
        path: normalizedPath,
        name: fileName,
        bytes: new Uint8Array(0),
        isDirectory: false,
        warning: `Unsupported ZIP compression method (${method}).`,
      })
    }
  }

  return entries
}
