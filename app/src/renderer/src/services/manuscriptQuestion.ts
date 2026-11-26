type Passage = { number: number; text: string; highlighted?: true }

const MAX_EVIDENCE = 6500
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()
const questionWords = (text: string) =>
  new Set(text.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])

export function getManuscriptParagraphs(html: string, includeHeadings = true): string[] {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content.querySelectorAll('script, style, template').forEach(node => node.remove())
  if (!includeHeadings) template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(node => node.remove())
  // Preserve paragraphs while converting editor HTML and entities to plain text.
  template.content.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, br, div, blockquote, hr')
    .forEach(node => node.after(document.createTextNode('\n')))
  return (template.content.textContent ?? '').split(/\n+/).map(normalize).filter(Boolean)
}

export function collectManuscriptPassages(html: string, selection: string, question: string) {
  const paragraphs = getManuscriptParagraphs(html)
  const passages: Passage[] = []
  for (const paragraph of paragraphs) {
    let remaining = paragraph
    while (remaining.length > 1100) {
      const breakAt = remaining.lastIndexOf(' ', 1100)
      const end = breakAt > 0 ? breakAt : 1100
      passages.push({ number: passages.length + 1, text: remaining.slice(0, end) })
      remaining = remaining.slice(end).trimStart()
    }
    if (remaining) passages.push({ number: passages.length + 1, text: remaining })
  }
  const wholeText = passages.map(passage => passage.text).join(' ')
  const selected = normalize(selection)
  const start = selected ? wholeText.indexOf(selected) : -1
  const terms = questionWords(question)
  let offset = 0
  const ranked = passages.map(passage => {
    const end = offset + passage.text.length
    const distance = start < 0 ? Infinity : Math.max(start - end, offset - (start + selected.length), 0)
    offset = end + 1
    const words = questionWords(passage.text)
    const matches = [...terms].filter(term => words.has(term)).length
    return {
      passage: distance === 0 ? { ...passage, highlighted: true as const } : passage,
      score: (distance === 0 ? 200 : distance <= 900 ? 30 : 0) + matches,
    }
  }).sort((a, b) => b.score - a.score || a.passage.number - b.passage.number)

  let budget = MAX_EVIDENCE
  return ranked.flatMap(({ passage }) => {
    // Measure the serialized text so quotes and escapes count toward the request limit.
    const cost = JSON.stringify(passage).length + 1
    if (cost > budget) return []
    budget -= cost
    return [passage]
  }).sort((a, b) => a.number - b.number)
}

export function resolveManuscriptQuotes(value: unknown, passages: Passage[]): string[] {
  if (!value || typeof value !== 'object' || !('passageNumbers' in value) || !Array.isArray(value.passageNumbers)) return []
  const numbers = new Set(value.passageNumbers.slice(0, 3).filter(Number.isInteger))
  return passages.filter(passage => numbers.has(passage.number)).map(passage => passage.text)
}
