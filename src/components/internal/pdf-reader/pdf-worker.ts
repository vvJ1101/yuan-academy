'use client'

import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// Task 5 must import the rendering components from this module so the worker
// configuration and React-PDF renderers keep the module ordering guaranteed.
export { Document, Page, pdfjs }
