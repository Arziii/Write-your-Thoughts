import { isZipBytes, readZipEntries } from './zipReader'
import { parsePdfDocument } from './pdfParser'

export type SupportedImportFormat = 'html' | 'docx' | 'rtf' | 'pdf' | 'md' | 'txt'

export interface ParsedSection {
  title: string
  html: string
  plainText: string
  level: number
  metadataFields: Record<string, string>
}

export interface ParsedDocument {
  format: SupportedImportFormat
  sourcePath: string
  fileName: string
  title: string
  html: string
  plainText: string
  wordCount: number
  metadataFields: Record<string, string>
  sections: ParsedSection[]
  warnings: string[]
}

export const SUPPORTED_IMPORT_EXTENSIONS = [
  '.html',
  '.htm',
  '.docx',
  '.rtf',
  '.pdf',
  '.md',
  '.markdown',
  '.txt',
  '.zip',
] as const

export function getImportFormat(fileName: string): SupportedImportFormat | 'zip' | null {
  const lower = fileName.toLowerCase().trim()
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (lower.endsWith('.docx')) return 'docx'
  if (lower.endsWith('.rtf')) return 'rtf'
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (lower.endsWith('.txt')) return 'txt'
  return null
}

export function cleanFileStem(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() || fileName
  return base.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function extractMetadataFromLines(
  plainText: string,
  existing: Record<string, string> = {}
): Record<string, string> {
  const out: Record<string, string> = { ...existing }
  const lines = plainText.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.length > 300) continue
    const match = line.match(/^([A-Za-z][A-Za-z0-9\s\-/&()']{1,31})\s*:\s+(.+)$/)
    if (!match) continue
    const key = match[1].replace(/\s+/g, ' ').trim()
    const val = match[2].trim()
    if (!val) continue
    // Ignore dialogue attributions or sentences ending in punctuation
    if (key.includes('"') || key.includes('“') || val.startsWith('"') || val.startsWith('“')) continue
    const existingLower = Object.keys(out).find((k) => k.toLowerCase() === key.toLowerCase())
    if (!existingLower) {
      out[key] = val
    }
  }
  return out
}

export interface HtmlBlock {
  tag: 'h1' | 'h2' | 'h3' | 'p' | 'blockquote' | 'ul' | 'ol' | 'hr'
  html: string
  text: string
  level?: number
}

export function buildSectionsFromBlocks(
  blocks: HtmlBlock[],
  fallbackTitle: string,
  rootMetadata: Record<string, string>
): ParsedSection[] {
  const h1Count = blocks.filter((b) => b.tag === 'h1' && b.text.trim()).length
  const h2Count = blocks.filter((b) => b.tag === 'h2' && b.text.trim()).length
  const splitTag = h1Count >= 2 ? 'h1' : h1Count === 0 && h2Count >= 2 ? 'h2' : null
  if (!splitTag) return []

  const splitLevel = splitTag === 'h1' ? 1 : 2
  const sections: ParsedSection[] = []
  let currentTitle = fallbackTitle
  let currentBlocks: HtmlBlock[] = []

  const flush = () => {
    while (currentBlocks.length > 0) {
      const tailText = currentBlocks[currentBlocks.length - 1].text.trim().toLowerCase()
      if (tailText === 'notepad' || tailText === 'new note' || tailText === '---') {
        currentBlocks.pop()
      } else {
        break
      }
    }
    const html = currentBlocks.map((b) => b.html).join('\n').trim()
    const plainText = currentBlocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
    if (plainText) {
      sections.push({
        title: currentTitle || fallbackTitle,
        html,
        plainText,
        level: splitLevel,
        metadataFields: extractMetadataFromLines(plainText, rootMetadata),
      })
    }
  }

  for (const block of blocks) {
    if (block.tag === splitTag && block.text.trim()) {
      flush()
      currentTitle = block.text.trim()
      currentBlocks = []
    } else {
      currentBlocks.push(block)
    }
  }
  flush()

  return mergeOrphanSubSections(sections)
}

function normalizeAlnum(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function mergeOrphanSubSections(sections: ParsedSection[]): ParsedSection[] {
  if (sections.length < 2) return sections

  const merged: ParsedSection[] = []
  for (let i = 0; i < sections.length; i++) {
    const cur = sections[i]
    const next = sections[i + 1]
    if (
      next &&
      countWords(cur.plainText) <= 15 &&
      normalizeAlnum(cur.title).length >= 3 &&
      normalizeAlnum(next.title).startsWith(normalizeAlnum(cur.title))
    ) {
      const curBodyNorm = normalizeAlnum(cur.plainText)
      const nextTitleNorm = normalizeAlnum(next.title)
      if (!curBodyNorm || nextTitleNorm.includes(curBodyNorm)) {
        continue
      }
      sections[i + 1] = {
        ...next,
        html: `${cur.html}\n${next.html}`.trim(),
        plainText: `${cur.plainText}\n\n${next.plainText}`.trim(),
      }
      continue
    }
    merged.push(cur)
  }

  return merged.length >= 2 ? merged : []
}

function normalizeInlineText(text: string): string {
  return text.replace(/[\u00a0]/g, ' ').replace(/\s+/g, ' ')
}

function sanitizeInlineHtml(node: Node): { html: string; text: string } {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = normalizeInlineText(node.textContent || '')
    return { html: escapeHtml(raw), text: raw }
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { html: '', text: '' }
  }

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg' || tag === 'iframe') {
    return { html: '', text: '' }
  }
  if (tag === 'br') {
    return { html: '<br>', text: '\n' }
  }

  let childHtml = ''
  let childText = ''
  el.childNodes.forEach((child) => {
    const res = sanitizeInlineHtml(child)
    childHtml += res.html
    childText += res.text
  })

  if (!childText && !childHtml) return { html: '', text: '' }

  if (tag === 'strong' || tag === 'b') {
    return { html: `<strong>${childHtml}</strong>`, text: childText }
  }
  if (tag === 'em' || tag === 'i') {
    return { html: `<em>${childHtml}</em>`, text: childText }
  }
  if (tag === 'u') {
    return { html: `<u>${childHtml}</u>`, text: childText }
  }
  if (tag === 's' || tag === 'del' || tag === 'strike') {
    return { html: `<s>${childHtml}</s>`, text: childText }
  }
  if (tag === 'span') {
    const style = (el.getAttribute('style') || '').toLowerCase()
    let wrapped = childHtml
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) wrapped = `<strong>${wrapped}</strong>`
    if (/font-style\s*:\s*italic/.test(style)) wrapped = `<em>${wrapped}</em>`
    if (/text-decoration[^;]*underline/.test(style)) wrapped = `<u>${wrapped}</u>`
    if (/text-decoration[^;]*line-through/.test(style)) wrapped = `<s>${wrapped}</s>`
    return { html: wrapped, text: childText }
  }

  return { html: childHtml, text: childText }
}

function collectHtmlBlocks(
  root: Element,
  blocks: HtmlBlock[],
  metadataFields: Record<string, string>
): void {
  const blockTags = new Set([
    'p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'ul', 'ol', 'table', 'dl', 'hr', 'pre',
  ])

  const pushParagraphFromNodes = (nodes: Node[]) => {
    let html = ''
    let text = ''
    for (const n of nodes) {
      const res = sanitizeInlineHtml(n)
      html += res.html
      text += res.text
    }
    const cleanText = text.trim()
    if (!cleanText) return
    blocks.push({ tag: 'p', html: `<p>${html.trim()}</p>`, text: cleanText })
  }

  let inlineBuffer: Node[] = []
  const flushInlineBuffer = () => {
    if (inlineBuffer.length > 0) {
      pushParagraphFromNodes(inlineBuffer)
      inlineBuffer = []
    }
  }

  root.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if ((child.textContent || '').trim()) {
        inlineBuffer.push(child)
      } else if (inlineBuffer.length > 0) {
        inlineBuffer.push(child)
      }
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return

    const el = child as Element
    const tag = el.tagName.toLowerCase()

    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg' || tag === 'iframe' || tag === 'head' || tag === 'meta' || tag === 'link') {
      return
    }

    if (!blockTags.has(tag)) {
      inlineBuffer.push(el)
      return
    }

    flushInlineBuffer()

    if (tag === 'hr') {
      blocks.push({ tag: 'hr', html: '<hr>', text: '---' })
      return
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      const targetTag = tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3'
      const level = targetTag === 'h1' ? 1 : targetTag === 'h2' ? 2 : 3
      const inline = sanitizeInlineHtml(el)
      const text = inline.text.trim()
      if (text) {
        blocks.push({
          tag: targetTag,
          html: `<${targetTag}>${inline.html.trim()}</${targetTag}>`,
          text,
          level,
        })
      }
      return
    }

    if (tag === 'blockquote') {
      const inline = sanitizeInlineHtml(el)
      const text = inline.text.trim()
      if (text) {
        blocks.push({
          tag: 'blockquote',
          html: `<blockquote><p>${inline.html.trim()}</p></blockquote>`,
          text,
        })
      }
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      const listTag = tag
      const itemHtmls: string[] = []
      const itemTexts: string[] = []
      el.querySelectorAll(':scope > li').forEach((li) => {
        const inline = sanitizeInlineHtml(li)
        const text = inline.text.trim()
        if (text) {
          itemHtmls.push(`<li><p>${inline.html.trim()}</p></li>`)
          itemTexts.push(`- ${text}`)
        }
      })
      if (itemHtmls.length > 0) {
        blocks.push({
          tag: listTag,
          html: `<${listTag}>${itemHtmls.join('')}</${listTag}>`,
          text: itemTexts.join('\n'),
        })
      }
      return
    }

    if (tag === 'table') {
      el.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th, td')).map((cell) =>
          (cell.textContent || '').replace(/\s+/g, ' ').trim()
        ).filter(Boolean)
        if (cells.length === 2 && cells[0].length <= 40) {
          const label = cells[0].replace(/:+$/, '').trim()
          const value = cells[1]
          if (label && value) {
            metadataFields[label] = value
            blocks.push({
              tag: 'p',
              html: `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
              text: `${label}: ${value}`,
            })
          }
        } else if (cells.length > 0) {
          const line = cells.join(' — ')
          blocks.push({ tag: 'p', html: `<p>${escapeHtml(line)}</p>`, text: line })
        }
      })
      return
    }

    if (tag === 'dl') {
      const children = Array.from(el.children)
      for (let i = 0; i < children.length; i++) {
        const cur = children[i]
        if (cur.tagName.toLowerCase() === 'dt') {
          const label = (cur.textContent || '').replace(/\s+/g, ' ').replace(/:+$/, '').trim()
          const next = children[i + 1]
          if (next && next.tagName.toLowerCase() === 'dd') {
            const value = (next.textContent || '').replace(/\s+/g, ' ').trim()
            if (label && value) {
              metadataFields[label] = value
              blocks.push({
                tag: 'p',
                html: `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
                text: `${label}: ${value}`,
              })
            }
            i++
          } else if (label) {
            blocks.push({ tag: 'p', html: `<p><strong>${escapeHtml(label)}</strong></p>`, text: label })
          }
        }
      }
      return
    }

    if (tag === 'p' || tag === 'pre') {
      const inline = sanitizeInlineHtml(el)
      const text = inline.text.trim()
      if (text) {
        blocks.push({ tag: 'p', html: `<p>${inline.html.trim()}</p>`, text })
      }
      return
    }

    // Container block (div, section, article, main, etc.)
    const hasChildBlock = Array.from(el.children).some((c) => blockTags.has(c.tagName.toLowerCase()))
    if (hasChildBlock) {
      collectHtmlBlocks(el, blocks, metadataFields)
    } else {
      const inline = sanitizeInlineHtml(el)
      const text = inline.text.trim()
      if (text) {
        blocks.push({ tag: 'p', html: `<p>${inline.html.trim()}</p>`, text })
      }
    }
  })

  flushInlineBuffer()
}

function parseHtmlDocument(bytes: Uint8Array, fileName: string, sourcePath: string): ParsedDocument {
  const rawHtml = new TextDecoder('utf-8').decode(bytes)
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')

  const blocks: HtmlBlock[] = []
  const metadataFields: Record<string, string> = {}
  if (doc.body) {
    collectHtmlBlocks(doc.body, blocks, metadataFields)
  }

  const rawTitleTag = (doc.querySelector('title')?.textContent || '').trim()
  const firstH1 = blocks.find((b) => b.tag === 'h1')?.text.trim() || ''
  const genericTitle = !rawTitleTag || /^(campfire|export|document|untitled|story)$/i.test(rawTitleTag)
  const title = firstH1 || (!genericTitle ? rawTitleTag : '') || cleanFileStem(fileName)

  const html = blocks.map((b) => b.html).join('\n').trim() || '<p></p>'
  const plainText = blocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
  const enrichedMetadata = extractMetadataFromLines(plainText, metadataFields)
  const sections = buildSectionsFromBlocks(blocks, title, enrichedMetadata)

  return {
    format: 'html',
    sourcePath,
    fileName,
    title,
    html,
    plainText,
    wordCount: countWords(plainText),
    metadataFields: enrichedMetadata,
    sections,
    warnings: plainText ? [] : ['HTML file contained no readable text content.'],
  }
}

function getLocalAttr(el: Element, attrName: string): string | null {
  if (el.hasAttribute(attrName)) return el.getAttribute(attrName)
  if (el.hasAttribute(`w:${attrName}`)) return el.getAttribute(`w:${attrName}`)
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    if (attr.localName === attrName) return attr.value
  }
  return null
}

function childByLocalName(parent: Element, localName: string): Element | undefined {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) return parent.children[i]
  }
  return undefined
}

function childrenByLocalName(parent: Element, localName: string): Element[] {
  const result: Element[] = []
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].localName === localName) result.push(parent.children[i])
  }
  return result
}

function isDocxRunFlagEnabled(rPr: Element, flagName: string): boolean {
  const el = childByLocalName(rPr, flagName)
  if (!el) return false
  const val = (getLocalAttr(el, 'val') || '').toLowerCase()
  return val !== '0' && val !== 'false' && val !== 'none'
}

function extractDocxParagraphContent(p: Element): { html: string; text: string } {
  let html = ''
  let text = ''

  const appendRun = (r: Element) => {
    const rPr = childByLocalName(r, 'rPr')
    const bold = rPr ? isDocxRunFlagEnabled(rPr, 'b') : false
    const italic = rPr ? isDocxRunFlagEnabled(rPr, 'i') : false
    const underline = rPr ? isDocxRunFlagEnabled(rPr, 'u') : false
    const strike = rPr ? isDocxRunFlagEnabled(rPr, 'strike') : false

    let runText = ''
    for (let i = 0; i < r.children.length; i++) {
      const child = r.children[i]
      if (child.localName === 't' || child.localName === 'delText') {
        runText += child.textContent || ''
      } else if (child.localName === 'br' || child.localName === 'cr') {
        runText += '\n'
      } else if (child.localName === 'tab') {
        runText += ' '
      }
    }

    if (!runText) return
    text += runText

    let runHtml = escapeHtml(runText).replace(/\n/g, '<br>')
    if (bold) runHtml = `<strong>${runHtml}</strong>`
    if (italic) runHtml = `<em>${runHtml}</em>`
    if (underline) runHtml = `<u>${runHtml}</u>`
    if (strike) runHtml = `<s>${runHtml}</s>`
    html += runHtml
  }

  for (let i = 0; i < p.children.length; i++) {
    const child = p.children[i]
    if (child.localName === 'r') {
      appendRun(child)
    } else if (child.localName === 'hyperlink' || child.localName === 'sdt') {
      const subRuns = child.localName === 'sdt'
        ? childByLocalName(child, 'sdtContent')?.children
        : child.children
      if (subRuns) {
        for (let j = 0; j < subRuns.length; j++) {
          if (subRuns[j].localName === 'r') appendRun(subRuns[j])
        }
      }
    }
  }

  return { html, text }
}

function parseDocxStyles(xmlBytes: Uint8Array): Map<string, number> {
  const styleMap = new Map<string, number>()
  try {
    const xmlText = new TextDecoder('utf-8').decode(xmlBytes)
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
    const root = doc.documentElement
    if (!root) return styleMap

    for (const styleEl of childrenByLocalName(root, 'style')) {
      const styleId = getLocalAttr(styleEl, 'styleId')
      const nameEl = childByLocalName(styleEl, 'name')
      const styleName = (nameEl ? getLocalAttr(nameEl, 'val') : '') || ''
      if (!styleId || !styleName) continue
      const lower = styleName.toLowerCase()
      if (lower === 'title' || /^heading\s*1\b/.test(lower)) styleMap.set(styleId, 1)
      else if (lower === 'subtitle' || /^heading\s*2\b/.test(lower)) styleMap.set(styleId, 2)
      else if (/^heading\s*[3-6]\b/.test(lower)) styleMap.set(styleId, 3)
    }
  } catch {
    // Ignore optional styles parsing issues
  }
  return styleMap
}

async function parseDocxDocument(
  bytes: Uint8Array,
  fileName: string,
  sourcePath: string
): Promise<ParsedDocument> {
  const entries = await readZipEntries(bytes)
  const docEntry = entries.find((e) => e.path.toLowerCase() === 'word/document.xml')
  if (!docEntry || docEntry.bytes.length === 0) {
    throw new Error('Invalid DOCX file: word/document.xml was not found.')
  }

  const stylesEntry = entries.find((e) => e.path.toLowerCase() === 'word/styles.xml')
  const styleHeadingMap = stylesEntry ? parseDocxStyles(stylesEntry.bytes) : new Map<string, number>()

  const xmlText = new TextDecoder('utf-8').decode(docEntry.bytes)
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const body = childByLocalName(doc.documentElement, 'body')
  if (!body) {
    throw new Error('Invalid DOCX XML structure: document body missing.')
  }

  const blocks: HtmlBlock[] = []
  const metadataFields: Record<string, string> = {}
  let pendingListItems: Array<{ html: string; text: string }> = []

  const flushList = () => {
    if (pendingListItems.length === 0) return
    blocks.push({
      tag: 'ul',
      html: `<ul>${pendingListItems.map((item) => `<li><p>${item.html}</p></li>`).join('')}</ul>`,
      text: pendingListItems.map((item) => `- ${item.text}`).join('\n'),
    })
    pendingListItems = []
  }

  for (let i = 0; i < body.children.length; i++) {
    const child = body.children[i]
    if (child.localName === 'p') {
      const pPr = childByLocalName(child, 'pPr')
      const pStyle = pPr ? childByLocalName(pPr, 'pStyle') : undefined
      const styleVal = pStyle ? getLocalAttr(pStyle, 'val') || '' : ''
      const numPr = pPr ? childByLocalName(pPr, 'numPr') : undefined

      let headingLevel = styleHeadingMap.get(styleVal) || 0
      if (!headingLevel && styleVal) {
        const norm = styleVal.toLowerCase()
        if (norm === 'title' || /^heading1$|^h1$/i.test(norm)) headingLevel = 1
        else if (norm === 'subtitle' || /^heading2$|^h2$/i.test(norm)) headingLevel = 2
        else if (/^heading[3-6]$|^h[3-6]$/i.test(norm)) headingLevel = 3
      }

      const { html, text } = extractDocxParagraphContent(child)
      const trimmed = text.trim()
      if (!trimmed) continue

      if (headingLevel > 0) {
        flushList()
        const tag = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3'
        blocks.push({ tag, html: `<${tag}>${html.trim()}</${tag}>`, text: trimmed, level: headingLevel })
      } else if (numPr) {
        pendingListItems.push({ html: html.trim(), text: trimmed })
      } else {
        flushList()
        blocks.push({ tag: 'p', html: `<p>${html.trim()}</p>`, text: trimmed })
      }
    } else if (child.localName === 'tbl') {
      flushList()
      for (const tr of childrenByLocalName(child, 'tr')) {
        const cellTexts = childrenByLocalName(tr, 'tc')
          .map((tc) =>
            childrenByLocalName(tc, 'p')
              .map((p) => extractDocxParagraphContent(p).text.trim())
              .filter(Boolean)
              .join(' ')
          )
          .filter(Boolean)

        if (cellTexts.length === 2 && cellTexts[0].length <= 40) {
          const label = cellTexts[0].replace(/:+$/, '').trim()
          const value = cellTexts[1]
          if (label && value) {
            metadataFields[label] = value
            blocks.push({
              tag: 'p',
              html: `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
              text: `${label}: ${value}`,
            })
          }
        } else if (cellTexts.length > 0) {
          const line = cellTexts.join(' — ')
          blocks.push({ tag: 'p', html: `<p>${escapeHtml(line)}</p>`, text: line })
        }
      }
    }
  }
  flushList()

  const firstH1 = blocks.find((b) => b.tag === 'h1')?.text.trim() || ''
  const title = firstH1 || cleanFileStem(fileName)
  const html = blocks.map((b) => b.html).join('\n').trim() || '<p></p>'
  const plainText = blocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
  const enrichedMetadata = extractMetadataFromLines(plainText, metadataFields)
  const sections = buildSectionsFromBlocks(blocks, title, enrichedMetadata)

  return {
    format: 'docx',
    sourcePath,
    fileName,
    title,
    html,
    plainText,
    wordCount: countWords(plainText),
    metadataFields: enrichedMetadata,
    sections,
    warnings: plainText ? [] : ['DOCX file contained no readable paragraph text.'],
  }
}

const WIN1252_EXTENDED: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

function decodeWin1252Byte(code: number): string {
  if (code >= 0x80 && code <= 0x9f && WIN1252_EXTENDED[code]) {
    return WIN1252_EXTENDED[code]
  }
  return String.fromCharCode(code)
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk))
    out += String.fromCharCode(...slice)
  }
  return out
}

const RTF_SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'objdata',
  'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
  'listtable', 'listoverridetable', 'revtbl', 'rsidtbl', 'mmathPr', 'fldinst',
  'xmlnstbl', 'themedata', 'colorschememapping', 'latentstyles', 'datastore', 'pnseclvl',
  'generator', 'pgdsctbl',
])

interface RtfGroupState {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  uc: number
  skip: boolean
}

function parseRtfDocument(bytes: Uint8Array, fileName: string, sourcePath: string): ParsedDocument {
  const input = bytesToLatin1(bytes)
  const stack: RtfGroupState[] = [
    { bold: false, italic: false, underline: false, strike: false, uc: 1, skip: false },
  ]

  const paragraphs: Array<{ html: string; text: string }> = []
  let curHtml = ''
  let curText = ''
  let hexBuffer: string[] = []
  let skipNextFallback = 0

  const top = () => stack[stack.length - 1]

  const flushHexBuffer = () => {
    if (hexBuffer.length === 0) return
    const decoded = hexBuffer
      .map((h) => decodeWin1252Byte(parseInt(h, 16)))
      .join('')
    hexBuffer = []
    appendStyledText(decoded)
  }

  const appendStyledText = (chunk: string) => {
    if (!chunk || top().skip) return
    curText += chunk
    let formatted = escapeHtml(chunk)
    const state = top()
    if (state.bold) formatted = `<strong>${formatted}</strong>`
    if (state.italic) formatted = `<em>${formatted}</em>`
    if (state.underline) formatted = `<u>${formatted}</u>`
    if (state.strike) formatted = `<s>${formatted}</s>`
    curHtml += formatted
  }

  const flushParagraph = () => {
    flushHexBuffer()
    const cleanText = curText.replace(/\s+/g, ' ').trim()
    if (cleanText) {
      paragraphs.push({ html: `<p>${curHtml.trim()}</p>`, text: cleanText })
    }
    curHtml = ''
    curText = ''
  }

  let i = 0
  while (i < input.length) {
    const ch = input[i]

    if (ch === '{') {
      flushHexBuffer()
      stack.push({ ...top() })
      i++
      continue
    }

    if (ch === '}') {
      flushHexBuffer()
      if (stack.length > 1) stack.pop()
      i++
      continue
    }

    if (ch === '\\') {
      i++
      if (i >= input.length) break
      const next = input[i]

      // Ignorable destination marker \*
      if (next === '*') {
        flushHexBuffer()
        top().skip = true
        i++
        continue
      }

      // Hex byte escape \'hh
      if (next === "'") {
        const hex = input.slice(i + 1, i + 3)
        i += 3
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (skipNextFallback > 0) {
            skipNextFallback--
          } else if (!top().skip) {
            hexBuffer.push(hex)
          }
        }
        continue
      }

      flushHexBuffer()

      if (next === '\\' || next === '{' || next === '}') {
        if (skipNextFallback > 0) skipNextFallback--
        else appendStyledText(next)
        i++
        continue
      }
      if (next === '~') {
        appendStyledText(' ')
        i++
        continue
      }
      if (next === '_') {
        appendStyledText('-')
        i++
        continue
      }
      if (next === '-') {
        i++
        continue
      }
      if (next === '\r' || next === '\n') {
        flushParagraph()
        i++
        continue
      }

      // Control word
      const wordMatch = input.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/)
      if (wordMatch) {
        const word = wordMatch[1]
        const paramStr = wordMatch[2]
        const param = paramStr !== undefined ? parseInt(paramStr, 10) : undefined
        i += wordMatch[0].length

        if (RTF_SKIP_DESTINATIONS.has(word)) {
          top().skip = true
          continue
        }
        if (top().skip) continue

        if (word === 'par' || word === 'line' || word === 'page' || word === 'sect' || word === 'row') {
          flushParagraph()
        } else if (word === 'cell') {
          appendStyledText(': ')
        } else if (word === 'tab') {
          appendStyledText(' ')
        } else if (word === 'emdash') {
          appendStyledText('—')
        } else if (word === 'endash') {
          appendStyledText('–')
        } else if (word === 'lquote') {
          appendStyledText('‘')
        } else if (word === 'rquote') {
          appendStyledText('’')
        } else if (word === 'ldblquote') {
          appendStyledText('“')
        } else if (word === 'rdblquote') {
          appendStyledText('”')
        } else if (word === 'bullet') {
          appendStyledText('• ')
        } else if (word === 'b') {
          top().bold = param !== 0
        } else if (word === 'i') {
          top().italic = param !== 0
        } else if (word === 'ul') {
          top().underline = param !== 0
        } else if (word === 'ulnone') {
          top().underline = false
        } else if (word === 'strike') {
          top().strike = param !== 0
        } else if (word === 'plain') {
          top().bold = false
          top().italic = false
          top().underline = false
          top().strike = false
        } else if (word === 'uc' && param !== undefined) {
          top().uc = Math.max(0, param)
        } else if (word === 'u' && param !== undefined) {
          const codePoint = param < 0 ? param + 65536 : param
          appendStyledText(String.fromCharCode(codePoint))
          skipNextFallback = top().uc
        }
        continue
      }

      i++
      continue
    }

    flushHexBuffer()
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }

    if (skipNextFallback > 0) {
      skipNextFallback--
      i++
      continue
    }

    appendStyledText(ch)
    i++
  }

  flushParagraph()

  const html = paragraphs.map((p) => p.html).join('\n').trim() || '<p></p>'
  const plainText = paragraphs.map((p) => p.text).filter(Boolean).join('\n\n').trim()
  const title = cleanFileStem(fileName)

  return {
    format: 'rtf',
    sourcePath,
    fileName,
    title,
    html,
    plainText,
    wordCount: countWords(plainText),
    metadataFields: extractMetadataFromLines(plainText),
    sections: [],
    warnings: plainText ? [] : ['RTF file contained no readable text content.'],
  }
}

function renderInlineMarkdown(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/~~([^~]+)~~/g, '<s>$1</s>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
  out = out.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
  return out
}

function parseMarkdownDocument(bytes: Uint8Array, fileName: string, sourcePath: string): ParsedDocument {
  let raw = new TextDecoder('utf-8').decode(bytes).replace(/\r\n/g, '\n')
  const frontmatterMeta: Record<string, string> = {}

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/)
  if (fmMatch) {
    raw = raw.slice(fmMatch[0].length)
    for (const line of fmMatch[1].split('\n')) {
      const m = line.match(/^([A-Za-z0-9_\-\s]{1,32}):\s*(.+)$/)
      if (m) frontmatterMeta[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }

  const lines = raw.split('\n')
  const blocks: HtmlBlock[] = []
  let paraLines: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  const flushPara = () => {
    if (paraLines.length === 0) return
    const text = paraLines.join(' ').trim()
    if (text) {
      blocks.push({ tag: 'p', html: `<p>${renderInlineMarkdown(text)}</p>`, text })
    }
    paraLines = []
  }

  const flushList = () => {
    if (!listType || listItems.length === 0) return
    blocks.push({
      tag: listType,
      html: `<${listType}>${listItems.map((i) => `<li><p>${renderInlineMarkdown(i)}</p></li>`).join('')}</${listType}>`,
      text: listItems.map((i) => `- ${i}`).join('\n'),
    })
    listType = null
    listItems = []
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      flushPara()
      flushList()
      continue
    }

    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      flushPara()
      flushList()
      blocks.push({ tag: 'hr', html: '<hr>', text: '---' })
      continue
    }

    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
      flushPara()
      flushList()
      const level = Math.min(3, hMatch[1].length) as 1 | 2 | 3
      const tag = `h${level}` as 'h1' | 'h2' | 'h3'
      const text = hMatch[2].trim()
      blocks.push({
        tag,
        html: `<${tag}>${renderInlineMarkdown(text)}</${tag}>`,
        text,
        level,
      })
      continue
    }

    if (trimmed.startsWith('> ')) {
      flushPara()
      flushList()
      const text = trimmed.slice(2).trim()
      if (text) {
        blocks.push({
          tag: 'blockquote',
          html: `<blockquote><p>${renderInlineMarkdown(text)}</p></blockquote>`,
          text,
        })
      }
      continue
    }

    const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      flushPara()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(ulMatch[1].trim())
      continue
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      flushPara()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(olMatch[1].trim())
      continue
    }

    flushList()
    paraLines.push(trimmed)
  }

  flushPara()
  flushList()

  const firstH1 = blocks.find((b) => b.tag === 'h1')?.text.trim()
  const title = frontmatterMeta.title || firstH1 || cleanFileStem(fileName)
  const html = blocks.map((b) => b.html).join('\n').trim() || '<p></p>'
  const plainText = blocks.map((b) => b.text).filter(Boolean).join('\n\n').trim()
  const metadataFields = extractMetadataFromLines(plainText, frontmatterMeta)
  const sections = buildSectionsFromBlocks(blocks, title, metadataFields)

  return {
    format: 'md',
    sourcePath,
    fileName,
    title,
    html,
    plainText,
    wordCount: countWords(plainText),
    metadataFields,
    sections,
    warnings: plainText ? [] : ['Markdown file contained no readable text.'],
  }
}

function parsePlainTextDocument(bytes: Uint8Array, fileName: string, sourcePath: string): ParsedDocument {
  const raw = new TextDecoder('utf-8').decode(bytes).replace(/\r\n/g, '\n').trim()
  const hasBlankLines = /\n\s*\n/.test(raw)
  const chunks = hasBlankLines
    ? raw.split(/\n\s*\n+/).map((p) => p.replace(/\n+/g, ' ').trim()).filter(Boolean)
    : raw.split('\n').map((l) => l.trim()).filter(Boolean)

  const html = chunks.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n').trim() || '<p></p>'
  const plainText = chunks.join('\n\n').trim()

  return {
    format: 'txt',
    sourcePath,
    fileName,
    title: cleanFileStem(fileName),
    html,
    plainText,
    wordCount: countWords(plainText),
    metadataFields: extractMetadataFromLines(plainText),
    sections: [],
    warnings: plainText ? [] : ['Text file contained no readable content.'],
  }
}

export async function parseDocumentBytes(
  bytes: Uint8Array,
  fileName: string,
  sourcePath = fileName
): Promise<ParsedDocument> {
  const fmt = getImportFormat(fileName)
  if (!fmt || fmt === 'zip') {
    throw new Error(`Unsupported document format for "${fileName}".`)
  }

  if (fmt === 'html') return parseHtmlDocument(bytes, fileName, sourcePath)
  if (fmt === 'docx') {
    if (!isZipBytes(bytes)) {
      throw new Error(`"${fileName}" does not appear to be a valid DOCX archive.`)
    }
    return parseDocxDocument(bytes, fileName, sourcePath)
  }
  if (fmt === 'rtf') return parseRtfDocument(bytes, fileName, sourcePath)
  if (fmt === 'pdf') return parsePdfDocument(bytes, fileName, sourcePath)
  if (fmt === 'md') return parseMarkdownDocument(bytes, fileName, sourcePath)
  return parsePlainTextDocument(bytes, fileName, sourcePath)
}
