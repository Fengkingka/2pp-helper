import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
function setup() {
  const root: any = {}; const file=fileURLToPath(new URL('../../site/assets/js/vc-pdf.js',import.meta.url));
  if (existsSync(file)) runInNewContext(readFileSync(file,'utf8'),{window:root});
  expect(root.VcPdf,'local PDF adapter missing').toBeDefined(); return root.VcPdf;
}
const file=(size=100)=>({size,type:'application/pdf',arrayBuffer:async()=>new ArrayBuffer(1)});
describe('Local PDF bounds and cleanup',()=>{
  it('rejects oversized files before reading or parsing',async()=>{
    const pdf=setup(); const read=vi.fn(); await expect(pdf.extract({...file(10485761),arrayBuffer:read},{})).rejects.toThrow('size'); expect(read).not.toHaveBeenCalled();
  });
  it('enforces pages, text budget and closes document resources',async()=>{
    const pdf=setup(); const destroy=vi.fn(async()=>{}); const page={getTextContent:async()=>({items:[{str:'a'.repeat(13000)}]}),cleanup:vi.fn()};
    const loader={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>page,destroy}),destroy})};
    expect((await pdf.extract(file(),loader)).length).toBe(12000); expect(destroy).toHaveBeenCalled(); expect(page.cleanup).toHaveBeenCalled();
    const tooMany={getDocument:()=>({promise:Promise.resolve({numPages:31,destroy}),destroy})};
    await expect(pdf.extract(file(),tooMany)).rejects.toThrow('pages');
  });
  it('reports scan-only, encrypted and malformed PDFs with paste recovery',async()=>{
    const pdf=setup();
    const encrypted={getDocument:()=>({promise:Promise.reject(new Error('encrypted')),destroy:async()=>{}})};
    const scan={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]}),cleanup(){}}),destroy:async()=>{}}),destroy:async()=>{}})};
    for (const loader of [encrypted,scan]) await expect(pdf.extract(file(),loader)).rejects.toThrow();
  });
  it('destroys a pending loading task immediately on abort',async()=>{
    const pdf=setup(); const abort=new AbortController(); const destroy=vi.fn(async()=>{});
    const loader={getDocument:()=>({promise:new Promise(()=>{}),destroy})};
    const pending=pdf.extract(file(),loader,()=>true,abort.signal); await new Promise(r=>setTimeout(r,0));abort.abort();
    expect(destroy).toHaveBeenCalled(); await expect(pending).rejects.toThrow('cancelled');
  });
  it('cleans up through the loading task when the PDF 6 proxy has no destroy method',async()=>{
    const pdf=setup();const destroy=vi.fn(async()=>{});
    const loader={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'Real PDF text'}]}),cleanup(){}})}),destroy})};
    expect(await pdf.extract(file(),loader)).toBe('Real PDF text');expect(destroy).toHaveBeenCalledOnce();
  });
});
