import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import { FileDown, CheckCircle2, Loader2 } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { Book } from '../../types'
import { cn } from '../../utils'

interface ExportModalProps {
  book: Book
  isOpen: boolean
  onClose: () => void
}

const PUBLISHER_FONTS = [
  { id: 'Times New Roman', name: 'Times New Roman (Standard)' },
  { id: 'Garamond', name: 'Garamond (Classic)' },
  { id: 'Arial', name: 'Arial (Modern/Clean)' },
  { id: 'Courier New', name: 'Courier New (Manuscript)' },
]

type ExportFormat = 'epub' | 'pdf' | 'docx' | 'md'

function cleanManuscriptHTML(html: string, chapterTitle: string): string {
  if (!html) return ''
  let cleaned = html
  
  // Remove leading empty paragraphs
  cleaned = cleaned.replace(/^(<p>(\s|&nbsp;|<br>)*<\/p>\s*)+/gi, '')
  
  // Detect and remove duplicated headings at the beginning of the text
  const firstBlockMatch = cleaned.match(/^(<(h[1-6]|p|div)[^>]*>)(.*?)(<\/\2>)/i)
  if (firstBlockMatch) {
    const innerText = firstBlockMatch[3].replace(/<[^>]+>/g, '').trim()
    const normalizedInner = innerText.toLowerCase().replace(/[^a-z0-9]/g, '')
    const normalizedTitle = chapterTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Check if it's a generic chapter title (e.g. "chapter 1", "part one") or matches the actual title
    const isGenericChapter = /^(chapter|part|prologue|epilogue)[0-9a-z]*$/i.test(normalizedInner)
    const isMatch = normalizedInner === normalizedTitle || isGenericChapter || normalizedTitle.includes(normalizedInner) || normalizedInner.includes(normalizedTitle)
    
    // Strip if it looks like a duplicated header and is short
    if (innerText.length > 0 && innerText.length < 100 && isMatch) {
      cleaned = cleaned.substring(firstBlockMatch[0].length)
    }
  }
  
  // Merge consecutive empty paragraphs into a single empty space or remove them
  cleaned = cleaned.replace(/(<p>(\s|&nbsp;|<br>)*<\/p>\s*){2,}/gi, '')
  
  // Convert scene breaks (***, ---, #) into proper ornaments
  const breakRegex = /<p[^>]*>\s*(<[^>]*>)*\s*(\* \* \*|\*\*\*|---|#)\s*(<\/[^>]*>)*\s*<\/p>/gi
  cleaned = cleaned.replace(breakRegex, '<div class="scene-break">* * *</div>')
  
  return cleaned.trim()
}

export default function ExportModal({ book, isOpen, onClose }: ExportModalProps) {
  if (!book) return null
  
  const { localUser } = useUserStore()
  const { addToast } = useToastStore()
  
  const [format, setFormat] = useState<ExportFormat>('epub')
  const [includeToc, setIncludeToc] = useState(true)
  const [fontFamily, setFontFamily] = useState('Times New Roman')
  const [fontSize, setFontSize] = useState(12)
  const [lineSpacing, setLineSpacing] = useState(1.5)
  const [margin, setMargin] = useState(1)
  
  const [isExporting, setIsExporting] = useState(false)
  const [chapters, setChapters] = useState<any[]>([])

  // Fetch chapters when the modal opens
  useEffect(() => {
    if (isOpen && book) {
      window.api.chapters.getByBook(book.id).then(chaps => setChapters(chaps || []))
    }
  }, [isOpen, book])

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const authorName = localUser?.display_name || localUser?.username || 'Unknown Author'
      const result = await window.api.export.book(book.id, authorName, {
        format,
        includeToc,
        fontFamily,
        fontSize,
        lineSpacing,
        margin
      })

      if (result.success) {
        addToast(`Exported successfully to ${result.filePath}`, 'success')
        onClose()
      } else if (!result.canceled) {
        addToast(result.error || 'Export failed', 'error')
      }
    } catch (err: any) {
      addToast(err.message || 'Export failed', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish & Export" size="full">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[400px_1fr] gap-6 min-h-0">
        
        {/* Left Column: Settings */}
        <div className="space-y-6 flex flex-col h-full min-h-0">
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-surface-200">Export Format</label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['epub', 'pdf', 'docx', 'md'] as ExportFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
                  format === f 
                    ? 'bg-accent-900/30 border-accent-600/50 text-accent-500 shadow-sm' 
                    : 'bg-surface-900 border-surface-800 text-surface-400 hover:text-surface-300 hover:border-surface-700'
                )}
              >
                <span className="text-sm font-bold uppercase tracking-wider">{f}</span>
                {format === f && <CheckCircle2 className="absolute top-1.5 right-1.5 w-3 h-3 text-accent-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Content Options */}
        <div className="space-y-3 p-4 bg-surface-900 rounded-xl border border-surface-800">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Content Options</h4>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={cn(
              "w-4 h-4 rounded border flex items-center justify-center transition-colors",
              includeToc ? "bg-accent-600 border-accent-600" : "bg-surface-800 border-surface-600 group-hover:border-surface-500"
            )}>
              {includeToc && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm text-surface-200">Include Dynamic Table of Contents</span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={includeToc} 
              onChange={(e) => setIncludeToc(e.target.checked)} 
            />
          </label>
        </div>

        {/* Typography Settings (Hidden for Markdown) */}
        {format !== 'md' && (
          <div className="space-y-4 p-4 bg-surface-900 rounded-xl border border-surface-800 animate-fade-in">
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center justify-between">
              Typography & Layout
              <span className="text-[10px] text-surface-500 lowercase normal-case bg-surface-800 px-2 py-0.5 rounded-full">Standard Publisher Specs</span>
            </h4>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-surface-400">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-600"
                >
                  {PUBLISHER_FONTS.map(font => (
                    <option key={font.id} value={font.id}>{font.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-surface-400">Font Size (pt)</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-surface-400">Line Spacing</label>
                  <select
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(Number(e.target.value))}
                    className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-600"
                  >
                    <option value={1}>Single</option>
                    <option value={1.15}>1.15</option>
                    <option value={1.5}>1.5</option>
                    <option value={2}>Double</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-surface-400">Margins (in)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full bg-surface-950 border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 focus:outline-none focus:border-accent-600"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

          </div>
          
          <div className="flex gap-3 pt-4 border-t border-surface-800 mt-auto shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || chapters.length === 0}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-accent-600 text-white hover:bg-accent-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {isExporting ? 'Exporting...' : 'Export Book'}
            </button>
          </div>
        </div>

        {/* Right Column: Live Preview */}
        <div className="bg-surface-900 rounded-xl border border-surface-800 flex flex-col h-full min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 bg-surface-950 flex justify-between items-center shrink-0">
            <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Live Preview</h4>
            {format === 'md' && <span className="text-[10px] text-surface-500">Markdown format ignores typography</span>}
          </div>
          
          <div className="flex-1 bg-surface-950/50 p-6 flex justify-center overflow-y-auto custom-scrollbar relative items-start">
            {format === 'md' ? (
              <div className="w-full h-full max-w-4xl text-left font-mono text-sm text-surface-400 whitespace-pre-wrap leading-relaxed">
                # {book.title}{'\n'}
                *{localUser?.display_name || localUser?.username || 'Unknown Author'}*{'\n\n'}
                {includeToc && `## Table of Contents\n${chapters.map((c, i) => `- [${c.title}](#chapter-${i})`).join('\n')}\n\n`}
                {chapters.length === 0 ? 'No content in this book yet.' : chapters.map((c, i) => (
                  `# ${c.title}\n\n${cleanManuscriptHTML(c.content || '', c.title).replace(/<[^>]+>/g, '')}\n\n`
                )).join('')}
              </div>
            ) : (
              <div 
                className="bg-white shadow-xl shadow-black/20 w-full max-w-[800px] origin-top shrink-0 transition-all text-black export-preview-container"
                style={{
                  fontFamily: fontFamily,
                  fontSize: `${fontSize}pt`,
                  lineHeight: lineSpacing,
                  color: 'black',
                  padding: `${margin}in`,
                  minHeight: '1000px'
                }}
              >
                <div className="text-center mb-16 mt-10">
                  <h1 style={{ fontSize: `${fontSize + 12}pt`, fontWeight: 'normal', lineHeight: 1.2, marginBottom: '1em' }}>{book.title}</h1>
                  <p style={{ fontStyle: 'italic', fontSize: `${fontSize + 4}pt` }}>{localUser?.display_name || localUser?.username || 'Unknown Author'}</p>
                </div>

                {includeToc && chapters.length > 0 && (
                  <div className="mb-16" style={{ pageBreakAfter: 'always' }}>
                    <h2 style={{ fontSize: `${fontSize + 4}pt`, fontWeight: 'bold', textAlign: 'center', marginBottom: '2em', textTransform: 'uppercase' }}>Table of Contents</h2>
                    {chapters.map((c, i) => (
                      <p key={i} style={{ marginBottom: '0.5em' }}>{c.title}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-16">
                  {chapters.length === 0 ? (
                    <p className="text-center italic text-gray-500">No chapters have been written yet.</p>
                  ) : (
                    chapters.map((chap, idx) => (
                      <div key={chap.id} style={{ pageBreakInside: 'avoid' }}>
                        <h2 style={{ fontSize: `${fontSize + 6}pt`, fontWeight: 'bold', textAlign: 'center', marginBottom: '2em', textTransform: 'uppercase' }}>
                          {chap.title}
                        </h2>
                        {/* We use a scoped div that formats paragraphs nicely. The actual content is HTML from TipTap. */}
                        <div 
                          className="preview-content"
                          dangerouslySetInnerHTML={{ __html: cleanManuscriptHTML(chap.content || '<p><em>Empty chapter</em></p>', chap.title) }} 
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <style>{`
              .export-preview-container .preview-content p {
                text-align: justify;
                margin: 0;
                text-indent: 0.5in;
              }
              .export-preview-container .preview-content p:first-of-type,
              .export-preview-container .preview-content .scene-break + p {
                text-indent: 0;
              }
              .export-preview-container .preview-content .scene-break {
                text-align: center;
                margin: 2em 0;
                text-indent: 0;
              }
              .export-preview-container .preview-content blockquote {
                margin: 1.5em 2em;
                font-style: italic;
              }
            `}</style>
          </div>
        </div>
      </div>
    </Modal>
  )
}
