/* Actual PHP + LlmClient HTTP routing, local provider fixtures and jsdom UI flows.
   No user credentials or paid external APIs are used. Layout is not verified by jsdom. */
const {JSDOM,VirtualConsole}=require('../../engine/node_modules/jsdom');
const {spawn}=require('node:child_process'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),site=path.join(root,'site'),base='http://127.0.0.1:8793';
let mode='ok',calls=[],checks=0,dom,win,doc,printed=0,downloads=[];const saved={},session={},errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const provider=http.createServer((req,res)=>{let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{
 const data=JSON.parse(raw);calls.push({url:req.url,auth:req.headers.authorization,data});
 if(mode==='failure'){res.writeHead(503);res.end('{"error":"fixture unavailable"}');return;}
 if(mode==='malformed'){res.end(JSON.stringify({choices:[{message:{content:'not valid JSON'}}]}));return;}
 const extracting=data.messages[0].content.startsWith('Extract a startup');
 const input=JSON.parse(data.messages[1].content),e=input.evidence?.[0];
 const content=extracting?{name:'InvoicePilot',problem:'Shop owners lose time chasing unpaid invoices.',audience:'Independent retailers in Hong Kong',solution:'A weekly follow-up dashboard.',revenue:'HKD 99 per month; untested.',marketSize:'Unknown; research needed.',differentiator:'Cantonese reminders.',validation:'Five exploratory interviews.',query:'invoice software',competitionQuery:'invoice software',geo:'HK'}:
 {summary:'Pricing needs a paid pilot before development.',findings:[e?{level:'warning',title:'Small interview sample',detail:'This sample does not establish market-wide demand.',basis:'evidence',citations:[{id:e.id,quote:e.summary.slice(0,40)}]}:{level:'risk',title:'No customer evidence',detail:'Interview customers before building.',basis:'hypothesis',citations:[]}],rewrites:[{field:'audience',text:'Independent Hong Kong retailers chasing invoices every week.',why:'Focus on a concrete workflow.'}],experiments:[{title:'Paid pilot',method:'Offer a clear pilot to ten retailers.',success_criterion:'Two paid commitments in 14 days; revise if unmet.',days:14}]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}));
});});
const env={...process.env,LLM_MODE:'live',LLM_BASE_URL:'http://127.0.0.1:8794/v1',LLM_API_KEY:'fixture-key',LLM_MODEL_CHAT:'fixture-chat',LLM_TIMEOUT:'5',RATE_LIMIT_FITCHECK_PER_HOUR:'0',FITCHECK_SERPAPI_KEY:'0',FITCHECK_CRUNCHBASE_KEY:'0',FITCHECK_REDDIT_CLIENT_ID:'0',FITCHECK_REDDIT_CLIENT_SECRET:'0',FITCHECK_REDDIT_USER_AGENT:'0'};
let server;
function ok(value,name){assert.ok(value,name);checks++;console.log('PASS '+name);}
async function wait(fn,name){for(let i=0;i<200;i++){if(fn())return;await delay(20);}throw Error('Timeout: '+name+' / '+doc?.querySelector('#fc-status')?.textContent);}
function snapshot(){if(!win)return;Object.keys(saved).forEach(k=>delete saved[k]);Object.keys(win.localStorage).forEach(k=>saved[k]=win.localStorage.getItem(k));Object.keys(session).forEach(k=>delete session[k]);Object.keys(win.sessionStorage).forEach(k=>session[k]=win.sessionStorage.getItem(k));dom.window.close();}
async function visit(route){snapshot();const res=await fetch(base+route);assert.equal(res.status,200);const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/navigation/.test(e.message))errors.push(e.message);});dom=new JSDOM(await res.text(),{url:base+route,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});win=dom.window;doc=win.document;
 Object.entries(saved).forEach(([k,v])=>win.localStorage.setItem(k,v));Object.entries(session).forEach(([k,v])=>win.sessionStorage.setItem(k,v));
 win.fetch=(url,opts)=>fetch(new URL(url,win.location.href),opts);win.confirm=()=>true;win.print=()=>printed++;win.HTMLElement.prototype.scrollIntoView=function(){};win.scrollTo=()=>{};win.matchMedia=()=>({matches:false,addEventListener(){}});win.URL.createObjectURL=()=> 'blob:test';win.URL.revokeObjectURL=()=>{};win.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
 win.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
 for(const script of [...doc.querySelectorAll('script[src]')]){const file=path.join(site,new URL(script.src).pathname);win.eval(fs.readFileSync(file,'utf8')+(file.endsWith('/engine.js')?'\nwindow.Engine=Engine;':'')+'\n//# sourceURL='+file);}
 await delay(30);
}
function field(selector,value,event='input'){const n=doc.querySelector(selector);assert.ok(n,selector);n.value=value;n.dispatchEvent(new win.Event(event,{bubbles:true}));}
const click=selector=>{assert.ok(doc.querySelector(selector),selector);doc.querySelector(selector).click();};
function button(text){const n=[...doc.querySelectorAll('button')].find(x=>x.textContent===text);assert.ok(n,'button '+text);n.click();}
const get=k=>win.TP.store.get(k);
async function post(body,headers={'Content-Type':'application/json'}){return fetch(base+'/api/fitcheck.php',{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});}
(async()=>{
 await new Promise(r=>provider.listen(8794,'127.0.0.1',r));server=spawn(process.env.PHP_PATH||'php',['-S','127.0.0.1:8793','router.php'],{cwd:site,env,stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/')).ok)break;}catch{}await delay(25);}
 const redirect=await fetch(base+'/startup/black-swan.php',{redirect:'manual'});ok(redirect.status===302&&redirect.headers.get('location')==='fitcheck.php','legacy route redirects to FitCheck');
 const module=await fetch(base+'/assets/js/vendor/pdfjs/pdf.mjs');ok(module.ok&&module.headers.get('content-type').includes('javascript'),'local PDF module has a browser-compatible MIME type');
 ok((await fetch(base+'/api/fitcheck.php')).status===405,'GET cannot trigger paid analysis');
 ok((await post('{}',{'Content-Type':'text/plain'})).status===415,'non-JSON POST rejected');
 ok((await post('not JSON')).status===400,'invalid JSON rejected');
 ok((await post('x'.repeat(262145))).status===413,'oversized request rejected');
 ok((await post({proposal:{}})).status===400,'incomplete proposal rejected before provider call');
 ok(calls.length===0,'invalid requests never invoke the AI provider');
 await visit('/startup/fitcheck.php');win.TPI18n.setLanguage('en');
 field('#fc-import-text','Retailers in Hong Kong spend time chasing overdue invoices. We propose a weekly dashboard, offered at HKD 99 per month. Market size has not been validated.');
 click('#fc-extract');await wait(()=>doc.querySelector('#fc-apply-extraction'),'AI extraction review');
 ok(doc.querySelector('#fc-problem').value==='','AI extraction is reviewed before replacing form fields');
 click('#fc-apply-extraction');ok(doc.querySelector('#fc-name').value==='InvoicePilot'&&get('fitcheckDraft').proposal.marketSize.includes('Unknown'),'reviewed extraction fills the form and preserves uncertainty');
 click('#fc-add-evidence');
 const inputs=doc.querySelectorAll('.fc-evidence input'),summary=doc.querySelector('.fc-evidence textarea');
 inputs[0].value='Interview sample';inputs[0].dispatchEvent(new win.Event('input',{bubbles:true}));summary.value='Five shop owners described weekly invoice chasing; a small exploratory sample.';summary.dispatchEvent(new win.Event('input',{bubbles:true}));inputs[1].value='https://example.test/research';inputs[1].dispatchEvent(new win.Event('input',{bubbles:true}));inputs[2].value=new Date().toISOString().slice(0,10);inputs[2].dispatchEvent(new win.Event('input',{bubbles:true}));
 const originalAudience=doc.querySelector('#fc-audience').value;
 win.TPI18n.setLanguage('zh-HK');ok(doc.querySelector('#fc-audience').value===originalAudience&&doc.querySelector('.fc-evidence textarea').value.startsWith('Five'),'language switch preserves proposal and evidence');win.TPI18n.setLanguage('en');
 click('#fc-analyze');await wait(()=>get('fitcheckReports')?.length===1,'first report');
 const first=get('fitcheckReports')[0];ok(first.aiStatus==='live'&&first.score.value===40,'actual LlmClient fixture request produces a scored evidence report');
 ok(calls.at(-1).url==='/v1/chat/completions'&&calls.at(-1).auth==='Bearer fixture-key'&&calls.at(-1).data.model==='fixture-chat','existing AI settings are used on the server');
 ok(doc.querySelector('#fc-report').textContent.includes('[E1]')&&doc.querySelector('#fc-report a[href="https://example.test/research"]'),'report contains traceable source citations');
 ok(!doc.body.innerHTML.includes('fixture-key'),'private API key never reaches rendered HTML');
 click('[data-experiment]');ok(get('actions')[0].source==='fitcheck:'+first.id,'validation experiment joins the existing action list');
 click('[data-rewrite]');ok(get('fitcheckDraft').proposal.audience.includes('every week'),'AI suggestion applies only after explicit click');
 ok(doc.querySelector('#fc-report').textContent.includes('Your draft changed'),'report is clearly stale after applying a rewrite');
 click('#fc-print');ok(printed===1,'PDF export invokes print-to-PDF');
 button('Download proposal & report');ok(downloads.includes('fitcheck-report-v1.md'),'proposal and report text exports');
 click('#fc-edit-recheck');ok(doc.querySelector('#fc-audience').value.includes('every week'),'Edit & re-check preserves an applied rewrite');
 click('#fc-undo');ok(doc.querySelector('#fc-audience').value===originalAudience,'applied rewrite can be undone');
 field('#fc-audience','Independent retailers with at least 20 invoices monthly.');click('#fc-analyze');await wait(()=>get('fitcheckReports')?.length===2,'revision');
 const second=get('fitcheckReports')[0];ok(second.revision===2&&second.parentId===first.id&&get('fitcheckReports')[1].proposal.audience===originalAudience,'re-check creates an immutable revision with parent linkage');
 await visit('/startup/fitcheck.php?report='+first.id);ok(doc.querySelector('#fc-report').textContent.includes('V1'),'old report survives reload and opens by URL');
 click('#fc-edit-recheck');ok(get('fitcheckDraft').parentId===first.id&&doc.querySelector('#fc-audience').value===originalAudience,'continue from historical version restores its proposal');
 mode='failure';click('#fc-analyze');await wait(()=>get('fitcheckReports')?.length===3,'failed provider fallback');
 ok(get('fitcheckReports')[0].aiStatus==='failed'&&doc.querySelector('#fc-report').textContent.includes('AI failed; checklist report'),'provider outage still generates an honest checklist report');
 await visit('/reports.php');ok(doc.querySelectorAll('#fitcheck-report-index a').length===4,'FitCheck versions appear in My reports without altering legacy report schemas');
 await visit('/startup/fitcheck.php');field('#fc-import-text','This text is long enough for extraction but the provider will return invalid JSON.');mode='malformed';click('#fc-extract');await wait(()=>doc.querySelector('#fc-status').textContent.includes('could not extract'),'extraction error');ok(get('fitcheckDraft').text.includes('long enough')&&doc.querySelector('#fc-problem').value,'failed extraction keeps the previous draft');
 mode='ok';field('#fc-problem','<img src=x onerror="window.PWNED=1"> A customer problem');click('#fc-analyze');await wait(()=>get('fitcheckReports')?.length===4,'safe report');ok(!win.PWNED&&!doc.querySelector('#fc-report img'),'proposal HTML is rendered as text');
 const realProject=get('fitcheckDraft').projectId;win.sessionStorage.setItem('tp:demoMode','1');await visit('/startup/fitcheck.php');ok(get('fitcheckDraft').projectId!==realProject&&!get('fitcheckReports')?.length,'demo uses separate FitCheck drafts and reports');win.sessionStorage.removeItem('tp:demoMode');await visit('/startup/fitcheck.php');ok(get('fitcheckDraft').projectId===realProject&&get('fitcheckReports').length===4,'returning from demo restores real data');
 const C=require('../assets/js/fitcheck-core.js');const exported=C.markdown(first);ok(exported.includes('Evidence readiness: 40/100')&&exported.includes('https://example.test/research')&&exported.includes('not proven product-market fit'),'text export includes score limits and provenance');
 ok(errors.length===0,'all FitCheck page scripts execute without uncaught errors: '+errors.join('\n'));
 console.log('RESULT '+checks+' integration checks passed');
})().catch(e=>{console.error(e.stack);console.error('UI',doc?.querySelector('#fc-status')?.textContent);console.error('Page errors',errors);process.exitCode=1;}).finally(()=>{snapshot();server?.kill();provider.close();});
