import { IpcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { dbGet, dbAll } from '../database/init'
import TurndownService from 'turndown'
import HTMLtoDOCX from 'html-to-docx'
import Epub from 'epub-gen-memory'

export function registerExportHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('export:book', async (event, data: { bookId: string; format: string; authorName?: string }) => {
    try {
      const book = dbGet('SELECT * FROM books WHERE id = ?', [data.bookId])
      if (!book) throw new Error('Book not found')

      const chapters = dbAll('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_order ASC', [data.bookId])
      
      const authorName = data.authorName?.trim() || (book.author_name as string) || 'Unknown Author'
      const title = (book.title as string) || 'Untitled'

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
      chapters.forEach((chap: any, index: number) => {
        htmlContent += `<div class="chapter-container">`
        htmlContent += `<h1>${chap.title}</h1>`
        htmlContent += chap.content
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
          font: 'Times New Roman'
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
            content: chap.content
          }))
        ]
        const buffer = await Epub({
          title: title,
          author: authorName,
          publisher: 'Write Your Thoughts',
          description: (book.description as string) || '',
          css: `body { font-family: "Times New Roman", serif; line-height: 1.5; }`
        }, epubChapters)
        writeFileSync(filePath, buffer)

      } else if (data.format === 'pdf') {
        await exportPDF(title, authorName, chapters, filePath)
      }

      return { success: true, filePath }

    } catch (err: any) {
      console.error('[Export Error]', err)
      return { success: false, error: err.message }
    }
  })
}

async function exportPDF(title: string, authorName: string, chapters: any[], filePath: string): Promise<void> {
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
        margin: 1in 1in 1in 1.25in;
      }
      body {
        font-family: "Times New Roman", serif;
        font-size: 12pt;
        line-height: 1.5;
        color: black;
        background: white;
        margin: 0;
        padding: 0;
        widows: 2;
        orphans: 2;
      }
      p {
        text-align: left;
        margin: 0;
        text-indent: 0.5in;
      }
      h1 {
        font-family: "Times New Roman", serif;
        font-weight: bold;
        font-size: 18pt;
        text-align: center;
        text-transform: uppercase;
        margin-top: 0;
        margin-bottom: 2em;
        page-break-before: always;
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
        font-size: 12pt;
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
    chapters.forEach((chap: any) => {
      bodyHtml += `<div class="chapter-container">`
      bodyHtml += `<h1>${chap.title}</h1>`
      bodyHtml += chap.content
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
          <div style="font-family: 'Times New Roman', serif; font-size: 9pt; width: 100%; text-align: center; margin-bottom: 20px;">
            <span class="title"></span>
          </div>
        `
        const footerTemplate = `
          <div style="font-family: 'Times New Roman', serif; font-size: 10pt; width: 100%; text-align: center; margin-top: 20px;">
            <span class="pageNumber"></span>
          </div>
        `

        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: false,
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
          margins: {
            top: 1,      // Handled by @page margin in CSS but printToPDF needs these to place headers
            bottom: 1,
            left: 1.25,
            right: 1
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
