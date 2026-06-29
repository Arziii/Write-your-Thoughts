import { IpcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { dbGet, dbAll } from '../database/init'
import TurndownService from 'turndown'
import HTMLtoDOCX from 'html-to-docx'
import Epub from 'epub-gen-memory'

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

export function registerExportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('export:book', async (event, data: { bookId: string; format: string; authorName?: string; includeToc?: boolean; fontFamily?: string; fontSize?: number; lineSpacing?: number; margin?: number }) => {
    try {
      const book = dbGet('SELECT * FROM books WHERE id = ?', [data.bookId])
      if (!book) throw new Error('Book not found')

      const chapters = dbAll('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_order ASC', [data.bookId])
      
      const authorName = data.authorName?.trim() || (book.author_name as string) || 'Unknown Author'
      const title = (book.title as string) || 'Untitled'
      
      const includeToc = data.includeToc ?? false
      const fontFamily = data.fontFamily || 'Times New Roman'
      const fontSize = data.fontSize || 12
      const lineSpacing = data.lineSpacing || 1.5
      const margin = data.margin || 1

      const defaultPath = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${data.format}`
      
      let filters: { name: string; extensions: string[] }[] = []
      if (data.format === 'pdf') filters = [{ name: 'PDF Document', extensions: ['pdf'] }]
      if (data.format === 'docx') filters = [{ name: 'Word Document', extensions: ['docx'] }]
      if (data.format === 'epub') filters = [{ name: 'EPUB eBook', extensions: ['epub'] }]
      if (data.format === 'md') filters = [{ name: 'Markdown File', extensions: ['md'] }]

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `Export ${data.format.toUpperCase()}`,
        defaultPath,
        filters
      })

      if (canceled || !filePath) return { success: false, canceled: true }

      // Generate HTML string of the entire book
      let htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>`
      
      // Title Page for DOCX / MD
      htmlContent += `<div style="text-align: center; page-break-after: always; margin-top: 40vh;">`
      htmlContent += `<h1 style="font-size: 42pt; font-weight: normal; margin-bottom: 1em; line-height: 1.2;">${title}</h1>`
      htmlContent += `<p style="font-size: 16pt; font-style: italic;">${authorName}</p>`
      htmlContent += `</div>`

      if (includeToc && data.format !== 'epub') {
        htmlContent += `<div style="page-break-after: always;">`
        htmlContent += `<h2>Table of Contents</h2>`
        htmlContent += `<ul>`
        chapters.forEach((chap: any, index: number) => {
          htmlContent += `<li><a href="#chapter-${index}">${chap.title}</a></li>`
        })
        htmlContent += `</ul>`
        htmlContent += `</div>`
      }

      chapters.forEach((chap: any, index: number) => {
        const cleanedContent = cleanManuscriptHTML(chap.content, chap.title)
        
        htmlContent += `<div class="chapter-container">`
        htmlContent += `<h1 id="chapter-${index}">${chap.title}</h1>`
        htmlContent += cleanedContent
        htmlContent += `</div>`
        if (index < chapters.length - 1 && data.format !== 'epub') {
          htmlContent += `<hr class="chapter-break" />`
        }
      })
      htmlContent += `</body></html>`

      if (data.format === 'md') {
        const turndownService = new TurndownService({ headingStyle: 'atx', hr: '* * *' })
        const mdContent = turndownService.turndown(htmlContent)
        writeFileSync(filePath, mdContent, 'utf-8')

      } else if (data.format === 'docx') {
        const buffer = await HTMLtoDOCX(htmlContent, null, {
          title: title,
          creator: authorName,
          description: (book.description as string) || '',
          font: fontFamily
        })
        writeFileSync(filePath, buffer)

      } else if (data.format === 'epub') {
        const epubChapters = [
          {
            title: 'Title Page',
            content: `
              <div style="text-align: center; margin-top: 30vh;">
                <h1 style="font-size: 3em; font-weight: normal; margin-bottom: 1em;">${title}</h1>
                <p style="font-size: 1.5em; font-style: italic;">${authorName}</p>
              </div>
            `,
            excludeFromToc: true
          },
          ...chapters.map((chap: any) => ({
            title: chap.title,
            content: cleanManuscriptHTML(chap.content, chap.title)
          }))
        ]
        
        const epubCss = `
          body { font-family: "${fontFamily}", serif; line-height: ${lineSpacing}; font-size: ${fontSize}pt; text-align: left; }
          p { text-indent: 1.5em; margin: 0; }
          h1, h2, h3 { text-align: center; margin-top: 2em; margin-bottom: 2em; font-weight: normal; text-transform: uppercase; }
          p:first-of-type, h1 + p, .scene-break + p { text-indent: 0; }
          .scene-break { text-align: center; margin: 2em 0; text-indent: 0; }
          blockquote { margin: 1.5em 2em; font-style: italic; }
        `

        const buffer = await Epub({
          title: title,
          author: authorName,
          publisher: 'Write Your Thoughts',
          description: (book.description as string) || '',
          css: epubCss
        }, epubChapters)
        writeFileSync(filePath, buffer)

      } else if (data.format === 'pdf') {
        await exportPDF(title, authorName, chapters, filePath, includeToc, fontFamily, fontSize, lineSpacing, margin)
      }

      return { success: true, filePath }

    } catch (err: any) {
      console.error('[Export Error]', err)
      return { success: false, error: err.message }
    }
  })
}

async function exportPDF(title: string, authorName: string, chapters: any[], filePath: string, includeToc: boolean, fontFamily: string, fontSize: number, lineSpacing: number, margin: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // Prepare PDF optimized HTML
    const css = `
      @page {
        size: A4;
        margin: ${margin}in ${margin}in ${margin}in ${margin + 0.25}in;
      }
      body {
        font-family: "${fontFamily}", serif;
        font-size: ${fontSize}pt;
        line-height: ${lineSpacing};
        color: black;
        background: white;
        margin: 0;
        padding: 0;
        widows: 2;
        orphans: 2;
      }
      p {
        text-align: justify;
        margin: 0;
        text-indent: 0.5in;
      }
      p:first-of-type, h1 + p, h2 + p, .scene-break + p {
        text-indent: 0;
      }
      .scene-break {
        text-align: center;
        margin: 2em 0;
        text-indent: 0;
      }
      blockquote {
        margin: 1.5em 2em;
        font-style: italic;
      }
      h1, h2 {
        font-family: "${fontFamily}", serif;
        font-weight: bold;
        text-align: center;
        text-transform: uppercase;
        margin-top: 0;
        margin-bottom: 2em;
        page-break-before: always;
      }
      h1 {
        font-size: ${fontSize + 6}pt;
      }
      h2 {
        font-size: ${fontSize + 4}pt;
      }
      /* First chapter no page break before */
      .chapter-container:first-of-type h1 {
        page-break-before: auto;
      }
      hr {
        border: none;
        text-align: center;
        margin: 2em 0;
      }
      hr::after {
        content: '* * *';
        font-size: ${fontSize}pt;
        letter-spacing: 0.5em;
      }
      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1em auto;
      }
      a {
        color: black;
        text-decoration: underline;
      }
      .title-page {
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        page-break-after: always;
      }
      .book-title {
        font-size: 42pt;
        font-weight: normal;
        text-align: center;
        margin-bottom: 1em;
        line-height: 1.2;
      }
      .author-name {
        font-size: 16pt;
        font-style: italic;
        text-align: center;
      }
    `

    let bodyHtml = `
      <div class="title-page">
        <div class="book-title">${title}</div>
        <div class="author-name">${authorName}</div>
      </div>
    `

    if (includeToc) {
      bodyHtml += `<div style="page-break-after: always;">`
      bodyHtml += `<h2>Table of Contents</h2>`
      bodyHtml += `<div style="text-align: left;">`
      chapters.forEach((chap: any, index: number) => {
        bodyHtml += `<p style="text-indent: 0; margin-bottom: 0.5em;"><a href="#chapter-${index}" style="text-decoration: none;">${chap.title}</a></p>`
      })
      bodyHtml += `</div>`
      bodyHtml += `</div>`
    }

    chapters.forEach((chap: any, index: number) => {
      const cleanedContent = cleanManuscriptHTML(chap.content, chap.title)
      bodyHtml += `<div class="chapter-container">`
      bodyHtml += `<h1 id="chapter-${index}">${chap.title}</h1>`
      bodyHtml += cleanedContent
      bodyHtml += `</div>`
    })

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>${css}</style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    win.webContents.on('did-finish-load', async () => {
      try {
        const headerTemplate = `
          <div style="font-family: '${fontFamily}', serif; font-size: 9pt; width: 100%; text-align: center; margin-bottom: 20px;">
            <span class="title"></span>
          </div>
        `
        const footerTemplate = `
          <div style="font-family: '${fontFamily}', serif; font-size: 10pt; width: 100%; text-align: center; margin-top: 20px;">
            <span class="pageNumber"></span>
          </div>
        `

        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: false,
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
          margins: {
            top: margin,
            bottom: margin,
            left: margin + 0.25,
            right: margin
          },
          pageSize: 'A4',
          preferCSSPageSize: true
        })

        writeFileSync(filePath, pdfBuffer)
        win.close()
        resolve()
      } catch (err) {
        win.close()
        reject(err)
      }
    })
  })
}
