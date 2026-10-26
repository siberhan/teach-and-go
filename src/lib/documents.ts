// Document limit, checked in the browser before anything is sent.
export const MAX_BYTES = 20 * 1024 * 1024
export const MAX_PAGES = 100
export const TOO_LONG = 'Document too long — upload only the curriculum pages (max 100 pages / 20 MB).'

// Rough PDF page count: counts page objects in the file.
export async function pdfPageCount(file: Blob): Promise<number> {
  const text = new TextDecoder('latin1').decode(await file.arrayBuffer())
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length
}

export async function checkDocument(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) return TOO_LONG
  if (file.type === 'application/pdf' && (await pdfPageCount(file)) > MAX_PAGES) return TOO_LONG
  if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) return 'Send a PDF or an image.'
  return null
}
