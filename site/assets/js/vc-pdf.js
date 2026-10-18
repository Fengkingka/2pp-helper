/** Read text locally; no file upload, rendering, persistence or external resources. */
(function (root) {
  'use strict';
  async function extract(file, pdfjs, valid = () => true, signal) {
    if (!file || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('PDF size exceeds 10 MB.');
    if (file.type && file.type !== 'application/pdf') throw new Error('Select a PDF file.');
    let task; let doc; let cancelled = false; let rejectCancel;
    const cancellation = new Promise((_, reject) => { rejectCancel = reject; });
    const cancel = () => { cancelled = true; void task?.destroy(); rejectCancel(new Error('PDF extraction cancelled.')); };
    const pending = (promise) => Promise.race([promise, cancellation]);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      if (signal?.aborted) { cancelled = true; throw new Error('PDF extraction cancelled.'); }
      const data = new Uint8Array(await pending(file.arrayBuffer()));
      if (!valid()) throw new Error('PDF extraction cancelled.');
      task = pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true, enableXfa: false });
      task.onPassword = () => { task.destroy(); };
      doc = await pending(task.promise);
      if (doc.numPages > 30) throw new Error('PDF exceeds 30 pages.');
      const parts = [];
      for (let i = 1; i <= doc.numPages; i++) {
        if (!valid()) throw new Error('PDF extraction cancelled.');
        const page = await pending(doc.getPage(i));
        try { const content = await pending(page.getTextContent()); parts.push(content.items.map((item) => item.str || '').join(' ')); }
        finally { page.cleanup(); }
        if (parts.join('\n').length >= 12000) break;
      }
      const text = parts.join('\n').trim().slice(0, 12000);
      if (!text) throw new Error('No selectable text found. Paste relevant text instead.');
      if (!valid()) throw new Error('PDF extraction cancelled.');
      return text;
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (!cancelled && task) await task.destroy();
    }
  }
  async function load(base) {
    const pdfjs = await import(new URL(base + 'assets/js/pdf.min.mjs', root.document.baseURI).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(base + 'assets/js/pdf.worker.min.mjs', root.document.baseURI).href;
    return pdfjs;
  }
  root.VcPdf = { extract, load };
})(window);
