import {
  buildSectionsFromBlocks,
  cleanFileStem,
  countWords,
  escapeHtml,
  extractMetadataFromLines,
  type HtmlBlock,
  type ParsedDocument,
} from './documentParsers'

interface PdfJsModule {
  getDocument: (params: Record<string, unknown>) => { promise: Promise<any> }
}

let pdfJsPromise: Promise<PdfJsModule> | null = null

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        // @ts-expect-error pdf.worker.mjs does not ship a .d.mts declaration file
        import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
      ])
      ;(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = worker
      return pdfjs as unknown as PdfJsModule
    })().catch((err) => {
      pdfJsPromise = null
      throw err
    })
  }
  return pdfJsPromise
}

interface PdfLine {
  pageNum: number
  y: number
  x: number
  rightX: number
  firstWordWidth: number
  fontSize: number
  isBold: boolean
  isItalic: boolean
  text: string
  html: string
}

function cleanPdfGlyphArtifacts(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/([A-Za-z])[\u00ad\ufffd]([A-Za-z])/g, '$1-$2')
}

function getMedian(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function resolvePageFontFlags(
  page: any,
  fontNames: Iterable<string>,
  styles: Record<string, { fontFamily?: string }>
): Map<string, { isBold: boolean; isItalic: boolean }> {
  const map = new Map<string, { isBold: boolean; isItalic: boolean }>()
  for (const fontName of fontNames) {
    if (!fontName) continue
    let descriptorName = ''
    let boldFlag = false
    let italicFlag = false

    try {
      if (page.commonObjs?.has?.(fontName)) {
        const fontObj = page.commonObjs.get(fontName)
        if (fontObj) {
          descriptorName = fontObj.name || ''
          boldFlag = Boolean(fontObj.bold)
          italicFlag = Boolean(fontObj.italic)
        }
      }
    } catch {
      // Ignore unavailable font descriptor objects
    }

    const hint = `${fontName} ${descriptorName} ${styles[fontName]?.fontFamily || ''}`
    map.set(fontName, {
      isBold: boldFlag || /(bold|black|heavy|semibold|demi|700|600)/i.test(hint),
      isItalic: italicFlag || /(italic|oblique)/i.test(hint),
    })
  }
  return map
}

function mergeAdjacentInlineTags(html: string): string {
  return html
    .replace(/<\/strong>(\s*)<strong>/g, '$1')
    .replace(/<\/em>(\s*)<em>/g, '$1')
}

async function extractPdfLines(pdf: any): Promise<PdfLine[]> {
  const allLines: PdfLine[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    try {
      // Populate page.commonObjs with real embedded font names/bold/italic flags
      await page.getOperatorList().catch(() => {})
      const textContent = await page.getTextContent()
      const styles: Record<string, { fontFamily?: string }> = textContent?.styles || {}

      const usedFonts = new Set<string>()
      for (const rawItem of textContent?.items || []) {
        if (rawItem && typeof rawItem === 'object' && 'fontName' in rawItem && rawItem.fontName) {
          usedFonts.add(String(rawItem.fontName))
        }
      }
      const fontFlags = resolvePageFontFlags(page, usedFonts, styles)

      interface RawSpan {
        x: number
        y: number
        rightX: number
        fontSize: number
        isBold: boolean
        isItalic: boolean
        str: string
      }

      const spans: RawSpan[] = []
      for (const rawItem of textContent?.items || []) {
        if (!rawItem || typeof rawItem !== 'object' || !('str' in rawItem)) continue
        const item = rawItem as {
          str: string
          transform?: number[]
          width?: number
          height?: number
          fontName?: string
        }
        const cleanedStr = cleanPdfGlyphArtifacts(item.str || '')
        if (!cleanedStr) continue

        const tr = Array.isArray(item.transform) && item.transform.length >= 6
          ? item.transform
          : [12, 0, 0, 12, 0, 0]
        const x = tr[4]
        const y = tr[5]
        const fontSize =
          Math.hypot(tr[0], tr[1]) ||
          Math.hypot(tr[2], tr[3]) ||
          item.height ||
          12
        const width = typeof item.width === 'number' && item.width > 0
          ? item.width
          : cleanedStr.length * fontSize * 0.5

        const flags = fontFlags.get(item.fontName || '')
        const fontKey = `${item.fontName || ''} ${styles[item.fontName || '']?.fontFamily || ''}`
        const isBold = flags ? flags.isBold : /(bold|black|heavy|semibold|demi|700|600)/i.test(fontKey)
        const isItalic = flags ? flags.isItalic : /(italic|oblique)/i.test(fontKey)

        spans.push({
          x,
          y,
          rightX: x + width,
          fontSize,
          isBold,
          isItalic,
          str: cleanedStr,
        })
      }

      if (spans.length === 0) continue

      spans.sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) return b.y - a.y
        return a.x - b.x
      })

      const lineGroups: RawSpan[][] = []
      for (const span of spans) {
        const lastGroup = lineGroups[lineGroups.length - 1]
        if (!lastGroup) {
          lineGroups.push([span])
          continue
        }
        const ref = lastGroup[0]
        const yTol = Math.max(2.5, Math.min(ref.fontSize, span.fontSize) * 0.45)
        if (Math.abs(span.y - ref.y) <= yTol) {
          lastGroup.push(span)
        } else {
          lineGroups.push([span])
        }
      }

      for (const group of lineGroups) {
        group.sort((a, b) => a.x - b.x)

        let lineText = ''
        let lineHtml = ''
        let prevRight = group[0].x
        let nonSpaceChars = 0
        let boldChars = 0
        let italicChars = 0
        let weightedSizeSum = 0

        for (let idx = 0; idx < group.length; idx++) {
          const span = group[idx]
          const raw = span.str
          const gap = idx === 0 ? 0 : span.x - prevRight
          const needsGapSpace =
            idx > 0 &&
            gap > span.fontSize * 0.16 &&
            lineText.length > 0 &&
            !/\s$/.test(lineText) &&
            !/^\s/.test(raw)

          if (needsGapSpace) {
            lineText += ' '
            lineHtml += ' '
          }

          lineText += raw

          let pieceHtml = escapeHtml(raw)
          if (span.isBold) pieceHtml = `<strong>${pieceHtml}</strong>`
          if (span.isItalic) pieceHtml = `<em>${pieceHtml}</em>`
          lineHtml += pieceHtml

          const trimmedLen = raw.trim().length
          if (trimmedLen > 0) {
            nonSpaceChars += trimmedLen
            weightedSizeSum += span.fontSize * trimmedLen
            if (span.isBold) boldChars += trimmedLen
            if (span.isItalic) italicChars += trimmedLen
          }

          prevRight = Math.max(prevRight, span.rightX)
        }

        const normalizedText = lineText.replace(/\s+/g, ' ').trim()
        if (!normalizedText) continue

        const avgFontSize = nonSpaceChars > 0 ? weightedSizeSum / nonSpaceChars : group[0].fontSize
        const firstWordMatch = normalizedText.match(/^\S+/)
        const firstWordLen = firstWordMatch ? firstWordMatch[0].length : 1
        const firstWordWidth = firstWordLen * avgFontSize * 0.52

        allLines.push({
          pageNum,
          y: group[0].y,
          x: group[0].x,
          rightX: prevRight,
          firstWordWidth,
          fontSize: avgFontSize,
          isBold: boldChars * 2 >= nonSpaceChars && nonSpaceChars > 0,
          isItalic: italicChars * 2 >= nonSpaceChars && nonSpaceChars > 0,
          text: normalizedText,
          html: mergeAdjacentInlineTags(lineHtml.trim()),
        })
      }
    } finally {
      try {
        page.cleanup?.()
      } catch {
        // Ignore cleanup failures
      }
    }
  }

  return allLines
}

function buildBlocksFromPdfLines(lines: PdfLine[]): HtmlBlock[] {
  if (lines.length === 0) return []

  const sizeHistogram = new Map<number, number>()
  let maxFontSize = 0
  for (const line of lines) {
    const bucket = Math.round(line.fontSize * 2) / 2
    sizeHistogram.set(bucket, (sizeHistogram.get(bucket) || 0) + line.text.length)
    if (line.fontSize > maxFontSize) maxFontSize = line.fontSize
  }

  let bodyFontSize = 12
  let maxChars = -1
  for (const [bucket, charCount] of sizeHistogram.entries()) {
    if (charCount > maxChars) {
      maxChars = charCount
      bodyFontSize = bucket
    }
  }

  const h1Threshold =
    maxFontSize >= bodyFontSize * 1.75
      ? Math.max(bodyFontSize * 1.75, maxFontSize * 0.86)
      : bodyFontSize * 1.85
  const h2Threshold = bodyFontSize * 1.28
  const h3Threshold = bodyFontSize * 1.08

  const classifyLineTag = (line: PdfLine): 'h1' | 'h2' | 'h3' | 'p' => {
    if (line.text.length <= 140) {
      if (line.fontSize >= h1Threshold) return 'h1'
      if (line.fontSize >= h2Threshold) return 'h2'
      if (line.fontSize >= h3Threshold) return 'h3'
      if (
        line.isBold &&
        line.text.length <= 90 &&
        !/[.!?]$/.test(line.text)
      ) {
        const isStoryHeading =
          /^(?:chapter|prologue|epilogue|part|act|scene|day\s+\d+)\b/i.test(line.text) ||
          /\bpov$/i.test(line.text)
        const isShortAttrKV = /^[A-Za-z][A-Za-z0-9\s\-/&()']{1,24}:\s+/.test(line.text)
        if (isStoryHeading || !isShortAttrKV) {
          return 'h3'
        }
      }
    }
    return 'p'
  }

  const pageSteps: number[] = []
  const pageRightEdges = new Map<number, number[]>()
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i]
    if (cur.fontSize <= bodyFontSize * 1.15) {
      const arr = pageRightEdges.get(cur.pageNum) || []
      arr.push(cur.rightX)
      pageRightEdges.set(cur.pageNum, arr)
    }
    if (i > 0 && lines[i - 1].pageNum === cur.pageNum) {
      const prev = lines[i - 1]
      const gap = prev.y - cur.y
      if (gap > bodyFontSize * 0.6 && gap < bodyFontSize * 2.6 && prev.fontSize <= bodyFontSize * 1.15) {
        pageSteps.push(gap)
      }
    }
  }

  const medianLineStep = getMedian(pageSteps) || bodyFontSize * 1.35
  const allBodyRights: number[] = []
  for (const edges of pageRightEdges.values()) allBodyRights.push(...edges)
  allBodyRights.sort((a, b) => a - b)
  const globalRightEdge =
    allBodyRights[Math.min(allBodyRights.length - 1, Math.floor(allBodyRights.length * 0.97))] || 500

  const pageMaxRight = new Map<number, number>()
  for (const [pg, edges] of pageRightEdges.entries()) {
    if (edges.length < 8) {
      pageMaxRight.set(pg, globalRightEdge)
      continue
    }
    const sorted = [...edges].sort((a, b) => a - b)
    const idx97 = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.97))
    pageMaxRight.set(pg, Math.max(sorted[idx97] || globalRightEdge, globalRightEdge * 0.95))
  }

  const filtered = lines.filter(
    (line) => !/^(?:page\s*)?\d{1,4}(?:\s*of\s*\d{1,4})?$/i.test(line.text)
  )

  const blocks: HtmlBlock[] = []
  let paraHtml = ''
  let paraText = ''
  let listType: 'ul' | 'ol' | null = null
  let listItems: Array<{ html: string; text: string }> = []
  let prevBodyLine: PdfLine | null = null

  const flushParagraph = () => {
    const cleanText = paraText.replace(/\s+/g, ' ').trim()
    if (cleanText) {
      blocks.push({
        tag: 'p',
        html: `<p>${mergeAdjacentInlineTags(paraHtml.trim())}</p>`,
        text: cleanText,
      })
    }
    paraHtml = ''
    paraText = ''
    prevBodyLine = null
  }

  const flushList = () => {
    if (!listType || listItems.length === 0) return
    blocks.push({
      tag: listType,
      html: `<${listType}>${listItems
        .map((it) => `<li><p>${mergeAdjacentInlineTags(it.html)}</p></li>`)
        .join('')}</${listType}>`,
      text: listItems.map((it) => `- ${it.text}`).join('\n'),
    })
    listType = null
    listItems = []
  }

  const appendWrappedLine = (line: PdfLine) => {
    if (!paraText) {
      paraText = line.text
      paraHtml = line.html
    } else if (paraText.endsWith('-') && !paraText.endsWith(' -')) {
      paraText = paraText.slice(0, -1) + line.text
      paraHtml = paraHtml.replace(/-(<\/(?:strong|em)>)*$/, '$1') + line.html
    } else {
      paraText += ' ' + line.text
      paraHtml += ' ' + line.html
    }
    prevBodyLine = line
  }

  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i]
    const tag = classifyLineTag(line)

    if (tag !== 'p') {
      flushParagraph()
      flushList()

      let mergedText = line.text
      let mergedHtml = line.html
      const curTag = tag

      while (
        (curTag === 'h1' || curTag === 'h2') &&
        i + 1 < filtered.length &&
        filtered[i + 1].pageNum === line.pageNum &&
        classifyLineTag(filtered[i + 1]) === curTag &&
        Math.abs(filtered[i].y - filtered[i + 1].y) <= filtered[i].fontSize * 1.65
      ) {
        i++
        mergedText += ' ' + filtered[i].text
        mergedHtml += ' ' + filtered[i].html
      }

      blocks.push({
        tag: curTag,
        html: `<${curTag}>${mergeAdjacentInlineTags(mergedHtml.trim())}</${curTag}>`,
        text: mergedText.trim(),
        level: curTag === 'h1' ? 1 : curTag === 'h2' ? 2 : 3,
      })
      continue
    }

    const bulletMatch = line.text.match(/^([•◦▪●○■]|[-–—])\s+(.+)$/)
    const orderedMatch = line.text.match(/^(\d{1,3})[.)]\s+(.+)$/)
    const isKVLine = /^[A-Za-z][A-Za-z0-9\s\-/&()']{1,31}:\s+/.test(line.text)

    if (bulletMatch) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      const strippedHtml = line.html.replace(/^(\s*<[^>]+>)*\s*([•◦▪●○■]|[-–—])\s+/, '$1')
      listItems.push({ html: strippedHtml.trim(), text: bulletMatch[2].trim() })
      continue
    }

    if (orderedMatch) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push({ html: line.html, text: line.text })
      continue
    }

    if (listType && listItems.length > 0 && !isKVLine) {
      const prevLine = filtered[i - 1]
      const samePage = prevLine && prevLine.pageNum === line.pageNum
      const tightGap = samePage && prevLine.y - line.y <= medianLineStep * 1.18
      const indentedContinuation = line.x > (prevLine?.x ?? 0) - bodyFontSize * 0.4
      if (tightGap && indentedContinuation && !/^[•◦▪●○■]/.test(line.text)) {
        const last = listItems[listItems.length - 1]
        last.text += ' ' + line.text
        last.html += ' ' + line.html
        continue
      }
      flushList()
    } else if (listType) {
      flushList()
    }

    if (isKVLine) {
      flushParagraph()
      appendWrappedLine(line)
      continue
    }

    if (!prevBodyLine) {
      appendWrappedLine(line)
      continue
    }

    const samePage = prevBodyLine.pageNum === line.pageNum
    const yGap = samePage ? prevBodyLine.y - line.y : 0
    const rightEdge = pageMaxRight.get(prevBodyLine.pageNum) || 500
    const fitsOnPrevLine =
      rightEdge > 0 && prevBodyLine.rightX + line.firstWordWidth + bodyFontSize * 1.6 < rightEdge
    const styleChanged =
      prevBodyLine.isBold !== line.isBold ||
      (prevBodyLine.isItalic && !line.isItalic && prevBodyLine.rightX < rightEdge - bodyFontSize * 3.5)
    const prevEndedShort = prevBodyLine.rightX < rightEdge - bodyFontSize * 4.5
    const prevEndedSentence = /[.!?…"”'’:\)]$/.test(prevBodyLine.text)
    const prevWasKV = /^[A-Za-z][A-Za-z0-9\s\-/&()']{1,31}:\s+/.test(prevBodyLine.text)

    const shouldBreak =
      (samePage && yGap > medianLineStep * 1.22) ||
      styleChanged ||
      fitsOnPrevLine ||
      (prevEndedShort && prevEndedSentence) ||
      (prevWasKV && prevEndedSentence)

    if (shouldBreak) {
      flushParagraph()
    }

    appendWrappedLine(line)
  }

  flushParagraph()
  flushList()

  return blocks
}

export async function parsePdfDocument(
  bytes: Uint8Array,
  fileName: string,
  sourcePath: string
): Promise<ParsedDocument> {
  const pdfjs = await loadPdfJs()
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  })

  const pdf = await loadingTask.promise
  let lines: PdfLine[] = []
  try {
    lines = await extractPdfLines(pdf)
  } finally {
    await pdf.destroy().catch(() => {})
  }

  const rawBlocks = buildBlocksFromPdfLines(lines)

  const cleanedBlocks = rawBlocks.filter((b, idx) => {
    const norm = b.text.trim().toLowerCase()
    if (norm === 'notepad' || norm === 'new note') {
      const next = rawBlocks[idx + 1]
      if (!next || next.tag === 'h1' || next.tag === 'h2') return false
    }
    return true
  })

  const firstH1 = cleanedBlocks.find((b) => b.tag === 'h1')?.text.trim() || ''
  const title = firstH1 || cleanFileStem(fileName)
  const html = cleanedBlocks.map((b) => b.html).join('\n').trim() || '<p></p>'
  const plainText = cleanedBlocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
  const wordCount = countWords(plainText)
  const metadataFields = extractMetadataFromLines(plainText)
  const sections = buildSectionsFromBlocks(cleanedBlocks, title, metadataFields)

  const warnings: string[] = []
  const suspiciousChars = (plainText.match(/[^\x20-\x7E\u00A0-\u024F\u2000-\u206F\n\r\t•◦▪]/g) || []).length
  const badRatio = plainText.length > 0 ? suspiciousChars / plainText.length : 1
  const gibberishHits = (plainText.match(/[a-z][{}|~][a-z]/gi) || []).length

  if (wordCount < 5 || badRatio > 0.12 || gibberishHits > 5) {
    warnings.push(
      'PDF text extraction was partial or unreadable (this file may be scanned images or use unsupported encoding). Try exporting as HTML or DOCX if possible.'
    )
  }

  return {
    format: 'pdf',
    sourcePath,
    fileName,
    title,
    html,
    plainText,
    wordCount,
    metadataFields,
    sections,
    warnings,
  }
}
