(function(){
  'use strict';
  const {$,el,store,api,language}=TP,{L,clone}=V32,C=FitCheckCore;
  const config=JSON.parse($('#fitcheck-config').textContent);
  const id=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const fresh=()=>({projectId:id(),proposal:C.cleanProposal({name:store.get('startup')?.name||'',geo:'HK'}),evidence:[],text:'',fetchSources:true,parentId:null});
  let draft=store.get('fitcheckDraft')||fresh();
  draft={...fresh(),...draft,proposal:C.cleanProposal(draft.proposal),evidence:Array.isArray(draft.evidence)?draft.evidence.slice(0,10):[]};
  let history=C.records(store.get('fitcheckReports',[]));
  const requested=new URLSearchParams(location.search).get('report');
  let report=history.find(r=>r.id===requested)||history.find(r=>r.projectId===draft.projectId)||null;
  let tab=requested&&report?'report':'editor',busy=false,message='',candidate=null,undo=null;
  const labels={name:['產品名稱','Product name'],problem:['客戶痛點','Customer problem'],audience:['目標客戶','Target audience'],solution:['解決方案','Solution'],revenue:['收費與收入模式','Pricing & revenue model'],marketSize:['市場規模假設','Market-size assumption'],differentiator:['差異化優勢','Differentiator'],validation:['已有驗證／下一步假設','Validation so far / next assumption'],query:['公開市場關鍵字','Public market keyword'],competitionQuery:['競爭者搜尋詞（選填）','Competitor search phrase (optional)'],geo:['搜尋地區','Search region']};
  const categories={problem:['痛點','Problem'],demand:['需求','Demand'],competition:['競爭','Competition'],pricing:['付費','Pricing'],market:['市場規模','Market size']};
  const textLabel=k=>L(...(labels[k]||categories[k]||[k,k]));
  const categoryLabel=k=>L(...(categories[k]||[k,k]));
  const sText={not_configured:['未設定','Not connected'],not_requested:['本次未查詢','Not requested'],query_needed:['需要關鍵字','Keyword needed'],retrieved:['已取得資料','Data retrieved'],no_results:['沒有搜尋結果','No search results'],unavailable:['連接失敗／權限不足','Unavailable / access denied']};
  const aiText=s=>({live:L('AI 分析完成','AI analysis complete'),failed:L('AI 未能完成；已產生規則檢查報告','AI failed; checklist report generated'),not_configured:L('未連接 AI；這是規則檢查報告','AI not connected; checklist report'),configuration_error:L('AI 設定未完整；這是規則檢查報告','AI configuration incomplete; checklist report')}[s]||s);
  const button=(label,fn,primary=false,attrs={})=>el('button',{type:'button',class:'btn'+(primary?' btn-primary':''),onclick:fn,...attrs},label);
  const pill=(label,kind='')=>el('span',{class:'fc-pill '+kind},label);
  const card=(title,children=[],step='')=>el('section',{class:'fc-card fc-stack'},[step?el('span',{class:'fc-step'},step):null,title?el('h2',{},title):null,...children]);
  function status(text){message=text;$('#fc-status').textContent=text;}
  function save(){store.set('fitcheckDraft',draft);if(!store.persistent)status(L('瀏覽器無法持久儲存。離開前請下載報告及草稿備份。','Browser storage is unavailable. Download reports and a draft backup before leaving.'));}
  function show(which){tab=which;render();}
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));el('a',{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function backup(){download('fitcheck-backup.json',JSON.stringify({schema:1,draft,history},null,2),'application/json');}
  function field(k,help='',required=false){
    const short=['name','query','competitionQuery','geo'].includes(k);
    const input=el(short?'input':'textarea',{id:'fc-'+k,name:k,class:'input',maxlength:k==='geo'?2:short?100:1600,required,rows:3});
    input.value=draft.proposal[k];
    input.addEventListener('input',()=>{draft.proposal[k]=input.value;save();});
    return el('label',{class:'fc-field'+(['solution','marketSize','validation'].includes(k)?' fc-wide':'')},[el('b',{},textLabel(k)+(required?' *':'')),input,help?el('span',{class:'hint'},help):null]);
  }
  function render(){
    $('#fc-tabs').replaceChildren(...[['editor',L('01  提案與證據','01  Proposal & evidence')],['report',L('02  診斷報告','02  Diagnostic report')],['history',L('03  版本記錄','03  Check history')]].map(([key,title])=>button(title,()=>show(key),false,{'aria-current':tab===key?'page':null,disabled:busy})));
    $('#fc-editor').hidden=tab!=='editor';$('#fc-report').hidden=tab!=='report';$('#fc-history').hidden=tab!=='history';$('#fc-status').textContent=message;
    if(tab==='editor')renderEditor();if(tab==='report')renderReport();if(tab==='history')renderHistory();
    V32.translate();
  }
  function sourceCards(sources,reportMode=false){
    return Object.entries(sources).map(([key,s])=>el('div',{class:'fc-source'},[
      el('b',{},s.name),pill(reportMode?L(...(sText[s.status]||['未知','Unknown'])):s.configured?L('已設定；分析時嘗試連接','Configured; connection checked on analysis'):L('未連接','Not connected'),reportMode?s.status==='retrieved'?'good':'warning':s.configured?'good':'warning'),
      reportMode?el('span',{class:'hint'},s.count+L(' 項記錄',' records')+' · '+(s.checkedAt?new Date(s.checkedAt).toLocaleString():L('未查詢','Not queried'))):null,
      el('span',{class:'hint'},key==='trends'?L('Google Trends 經 SerpApi 提供相對搜尋指數；不是搜尋量或市場規模。','Google Trends via SerpApi supplies relative interest, not search volume or market size.'):key==='competition'?L('Google 搜尋關鍵字配對只提供候選競爭者。','Google keyword matches are candidate competitors.'):L('Hacker News 貼文是少量個別觀察，並非代表整體市場的情緒調查。','A few Hacker News posts are anecdotes, not a representative sentiment survey.')),
    ]));
  }
  function renderEditor(){
    const importText=el('textarea',{id:'fc-import-text',class:'input',rows:6,maxlength:20000,'aria-label':L('提案文字','Proposal text'),placeholder:L('貼上你的提案，或匯入 TXT／PDF。最多 20,000 字元。','Paste a proposal or import TXT/PDF. Maximum 20,000 characters.')});importText.value=draft.text||'';importText.oninput=()=>{draft.text=importText.value;candidate=null;save();};
    const upload=el('input',{id:'fc-upload',type:'file',accept:'.txt,.md,.pdf,text/plain,application/pdf',class:'input','aria-label':L('匯入提案','Import proposal'),onchange:e=>importFile(e.target.files?.[0])});
    const importer=card(L('從現有提案開始','Start with an existing proposal'),[
      el('p',{class:'hint'},L('可選：TXT／文字型 PDF，最多 5 MB、30 頁。不支援掃描 OCR 或 PPTX；簡報請先匯出 PDF。PDF 在瀏覽器擷取文字，原檔不會上傳。','Optional: TXT or text-based PDF, up to 5 MB / 30 pages. Scanned PDFs and PPTX are unsupported; export slides to PDF first. PDF text is extracted in your browser; the original file is not uploaded.')),
      upload,importText,button(L('AI 整理成表格','Extract fields with AI'),extract,false,{id:'fc-extract',disabled:!config.aiConfigured}),
      !config.aiConfigured?el('p',{class:'hint'},L('未連接 AI 時可直接填寫下方表格；仍可產生缺口檢查報告。','Without AI, complete the guided form below to generate a coverage checklist.')):null,
    ],'IMPORT / OPTIONAL');
    if(candidate){
      importer.append(el('div',{class:'fc-subtle'},L('AI 擷取草稿：請先核對。套用後會保留未擷取到的原有欄位。','Review the AI extraction. Applying it replaces only non-empty extracted fields.')),
        ...C.fields.filter(k=>candidate[k]).map(k=>el('p',{},[el('b',{},textLabel(k)+': '),candidate[k]])),
        button(L('套用並檢查欄位','Apply and review fields'),()=>{undo=clone(draft.proposal);for(const k of C.fields)if(candidate[k])draft.proposal[k]=candidate[k];candidate=null;save();render();},true,{id:'fc-apply-extraction'}));
    }
    const form=el('form',{id:'fc-form',class:'fc-stack'});
    const fields=el('div',{class:'fc-grid'},[
      field('name'),field('audience',L('誰付錢、在哪裡、在甚麼情境遇到問題？','Who pays, where are they, and in what situation?'),true),
      field('problem',L('描述最近一次真實痛點、現有做法及代價。','Describe a recent problem, current workaround and its cost.'),true),
      field('revenue',L('誰付費、價格、收費頻率及待驗證假設。','Who pays, how much, how often, and what remains untested?'),true),
      field('solution',L('描述核心使用流程，以及為何比現有做法更好。','Describe the core workflow and why it improves the current workaround.'),true),
      field('marketSize',L('寫明 TAM / SAM / SOM、地區、年份、貨幣及計算方法；未知可填「待驗證」。','Include TAM / SAM / SOM, geography, year, currency and calculation. If unknown, enter “Unvalidated”.'),true),
      field('differentiator',L('與替代方案有何不同？沒有資料時請寫成假設。','How is it different from alternatives? Mark untested ideas as hypotheses.')),
      field('validation',L('例如：訪談樣本、試用轉換、預售結果及日期。','For example: interview samples, pilot conversions, pre-sales and dates.')),
    ]);
    const main=card(L('定義你的提案','Define your proposal'),[fields],'01 / PROPOSAL');
    if(undo)main.append(button(L('復原上次套用','Undo last applied change'),()=>{draft.proposal=undo;undo=null;save();render();},false,{id:'fc-undo'}));
    const evidence=card(L('帶入可追溯的證據','Bring traceable evidence'),[
      el('p',{class:'hint'},L('加入訪談觀察、政府數據或競爭者資料。手動內容會標為「你提供，未獨立核實」；網址只作出處，不會自動讀取網頁。最多 10 項。','Add interview observations, government data or competitor research. Manual records are labelled founder-supplied and unverified. Links are references; pages are not fetched automatically. Up to 10 records.')),
      el('div',{id:'fc-evidence-rows'},draft.evidence.map((e,i)=>evidenceEditor(e,i))),
      button(L('＋ 新增證據','＋ Add evidence'),()=>{draft.evidence.push({category:'problem',title:'',summary:'',url:'',date:''});save();render();},false,{id:'fc-add-evidence',disabled:draft.evidence.length>=10}),
    ],'02 / EVIDENCE');
    const sourceFields=el('div',{class:'fc-grid'},[field('query',L('只傳送這個關鍵字給市場資料供應商。','Only this keyword is sent to market-data providers.')),field('competitionQuery'),field('geo',L('兩位地區碼，例如 HK、US；留空為全球。只適用 Trends。','Two-letter code, e.g. HK or US; blank means worldwide. Applies to Trends only.'))]);
    const check=el('input',{id:'fc-fetch',type:'checkbox'});check.checked=!!draft.fetchSources;check.onchange=()=>{draft.fetchSources=check.checked;save();};
    const sources=card(L('市場資料連接','Market-data connections'),[...sourceCards(config.sources),sourceFields,
      el('label',{class:'fc-check'},[check,L('本次查詢已設定的資料來源（可能使用供應商配額）','Query configured sources for this check (may consume provider quota)')]),
      el('p',{class:'hint'},L('沒有 API 存取權時，可手動加入證據並繼續分析。未連接或查無結果，均不代表不存在競爭或需求。','Without API access, add evidence manually and continue. A disconnected source or empty search does not mean no competition or demand.')),
    ]);
    const submit=el('button',{id:'fc-analyze',class:'btn btn-primary',type:'submit'},L('分析提案 →','Analyze proposal →'));
    form.append(main,evidence,el('div',{class:'fc-subtle'},L('按「分析」會把表格內容及證據送至已設定的 AI 供應商。匯入的全文只在按「AI 整理」時送出。草稿及最多 12 份報告保存在此瀏覽器；請移除不必要的個人或機密資料。','Analyze sends the form and evidence to your configured AI provider. Imported full text is sent only when you select Extract fields. Drafts and up to 12 reports stay in this browser; remove unnecessary personal or confidential details.')),
      el('div',{class:'fc-actions'},[submit,button(L('下載備份','Download backup'),backup),button(L('新提案','New proposal'),()=>{if(confirm(L('開始新提案？現有報告會保留，未分析草稿將重設。','Start a new proposal? Saved reports remain; the current draft will reset.'))){draft=fresh();report=null;candidate=null;undo=null;save();status('');render();}},false,{id:'fc-new'})]));
    form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())analyze();};
    const wrapper=el('fieldset',{disabled:busy,style:{border:'0',padding:'0',margin:'0',minWidth:'0'}});
    wrapper.append(el('div',{class:'fc-layout'},[el('div',{class:'fc-stack'},[importer,form]),el('aside',{class:'fc-stack'},[
      card(L('每次檢查，少一個盲點。','One check. Fewer blind spots.'),[el('p',{},L('先界定客戶與痛點，再補上證據。報告會指出缺口、提出可修改的文字及下一個驗證實驗。','Define the customer and problem, then add evidence. Your report highlights gaps, editable suggestions and the next experiment.')),pill(config.aiConfigured?L('AI 已設定，待連線確認','AI configured; connection not yet tested'):L('規則檢查模式','Checklist mode'),config.aiConfigured?'good':'warning')]),sources,
      card(L('分數代表甚麼？','What does the score mean?'),[el('p',{class:'hint'},L('證據準備度只量度五類資料的完整性及日期。較高分不代表正面證據、已達產品市場契合或較高成功率。負面證據同樣能提高準備度。','Evidence readiness measures documentation coverage and dates across five categories. A higher score does not mean positive evidence, established product-market fit or a higher success probability. Negative evidence can also increase readiness.'))]),
    ])]));
    $('#fc-editor').replaceChildren(wrapper);
  }
  function evidenceEditor(e,i){
    const select=el('select',{class:'select','aria-label':L('證據類別','Evidence category')},Object.keys(categories).map(k=>el('option',{value:k},categoryLabel(k))));select.value=e.category;select.onchange=()=>{e.category=select.value;save();};
    const input=(key,title,type='text')=>{const n=el(key==='summary'?'textarea':'input',{class:'input',type:key==='summary'?null:type,maxlength:key==='summary'?1400:key==='url'?1000:180,required:['title','summary'].includes(key),max:type==='date'?new Date().toISOString().slice(0,10):null,rows:key==='summary'?3:null});n.value=e[key]||'';n.oninput=()=>{e[key]=n.value;save();};return el('label',{class:'fc-field'},[el('b',{},title),n]);};
    return el('div',{class:'fc-evidence'},[el('div',{class:'spread'},[select,button(L('移除','Remove'),()=>{draft.evidence.splice(i,1);save();render();},false,{'aria-label':L('移除證據 ','Remove evidence ')+(i+1)})]),input('title',L('來源／訪談標題 *','Source / interview title *')),input('summary',L('具體觀察及樣本限制 *','Observation and sample limitations *')),el('div',{class:'fc-grid'},[input('url',L('來源網址（可選）','Source URL (optional)'),'url'),input('date',L('資料日期（非今天的查閱日期）','Evidence date (not today’s access date)'),'date')])]);
  }
  async function run(label,work){if(busy)return;busy=true;status(label);render();try{await work();}catch(e){status(e.message||L('未能完成。草稿已保留。','Unable to complete. Your draft is retained.'));}finally{busy=false;render();}}
  async function extract(){
    if((draft.text||'').trim().length<30){status(L('請先匯入或貼上至少 30 個字元。','Import or paste at least 30 characters first.'));return;}
    const lang=language(),text=draft.text;
    await run(L('AI 正在整理提案，請稍候…','AI is extracting your proposal…'),async()=>{const response=await api('fitcheck.php',{action:'extract',text},lang);candidate=C.cleanProposal(response.proposal);status(L('已整理成草稿，請核對後套用。','Extraction ready. Review it before applying.'));});
  }
  async function importFile(file){
    if(!file)return;
    await run(L('正在擷取檔案文字…','Reading proposal text…'),async()=>{
      if(file.size>5*1024*1024)throw Error(L('檔案超過 5 MB。請縮小檔案或貼上文字。','The file exceeds 5 MB. Reduce it or paste text.'));
      let text='';
      if(/\.pdf$/i.test(file.name)){
        const pdfjs=await import('../vendor/pdfjs/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',new URL(document.querySelector('script[src*="pages/fitcheck.js"]').src)).href;
        const base=new URL('../vendor/pdfjs/',new URL(document.querySelector('script[src*="pages/fitcheck.js"]').src)).href;
        const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',useWasm:false});
        task.onPassword=()=>{void task.destroy();};
        let pdf;
        try{pdf=await task.promise;if(pdf.numPages>30)throw Error(L('PDF 超過 30 頁。請只匯入提案重點。','PDF exceeds 30 pages. Import a shorter proposal.'));for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();text+=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('')+'\n';if(text.length>20000)break;}}
        finally{await task.destroy();}
        if(text.trim().length<30)throw Error(L('未能擷取足夠文字。掃描或受保護 PDF 請先轉為文字。','Not enough extractable text. Convert scanned or protected PDFs to text first.'));
      }else if(/\.(txt|md)$/i.test(file.name)){text=await file.text();}else throw Error(L('請使用 TXT、MD 或文字型 PDF。','Use TXT, MD or a text-based PDF.'));
      if(text.length>20000)throw Error(L('文字超過 20,000 字元。請縮短後重試；原有草稿已保留。','Text exceeds 20,000 characters. Shorten it and retry; your previous draft is retained.'));
      draft.text=text;candidate=null;save();status(L('文字已載入。請檢查內容，再用 AI 整理或自行填寫表格。','Text loaded. Review it, then extract fields with AI or complete the form yourself.'));
    });
  }
  async function analyze(){
    const snapshot=clone(draft),lang=language();
    if(snapshot.fetchSources&&Object.values(config.sources).some(s=>s.configured)&&!snapshot.proposal.query.trim()){status(L('請填寫公開市場關鍵字，或取消資料查詢。','Enter a public market keyword or turn off source lookup.'));return;}
    await run(L('正在查詢證據及分析提案…可能需要約一分鐘。','Retrieving evidence and analyzing… this may take about a minute.'),async()=>{
      const r=await api('fitcheck.php',{action:'analyze',proposal:snapshot.proposal,evidence:snapshot.evidence,fetchSources:snapshot.fetchSources},lang);
      if(!C.records([r]).length)throw Error(L('報告格式不完整，請重試。','Incomplete report. Please retry.'));
      const related=history.filter(x=>x.projectId===snapshot.projectId);
      r.projectId=snapshot.projectId;r.revision=Math.max(0,...related.map(x=>x.revision||0))+1;r.parentId=snapshot.parentId||related[0]?.id||null;r.fetchSources=snapshot.fetchSources;r.inputFingerprint=C.signature(snapshot);
      history=[r,...history].slice(0,12);store.set('fitcheckReports',history);report=r;draft.parentId=r.id;save();tab='report';status(aiText(r.aiStatus));
    });
  }
  function editReport(r){
    if(draft.projectId===r.projectId&&draft.parentId===r.id){show('editor');status(L('已保留目前草稿及套用的修改。檢查後可重新分析。','Your current draft and applied changes are preserved. Review and re-check when ready.'));return;}
    draft={projectId:r.projectId||id(),proposal:clone(r.proposal),evidence:clone(r.evidence.filter(e=>e.origin==='user').map(({category,title,summary,url,date})=>({category,title,summary,url,date}))),fetchSources:r.fetchSources!==false,text:'',parentId:r.id};candidate=null;undo=null;save();show('editor');status(L('已載入此版本。修改後重新分析會產生新報告。','Version loaded. Edit and re-check to create a new report.'));
  }
  function renderReport(){
    const box=$('#fc-report');box.className='fc-stack';
    if(!report){box.replaceChildren(card(L('你的第一份 FitCheck 報告','Your first FitCheck report'),[el('p',{},L('完成提案表格並按「分析提案」後，報告會出現在這裡。','Complete your proposal and select Analyze proposal to create a report.')),button(L('返回提案','Go to proposal'),()=>show('editor'),true)]));return;}
    const r=report,previous=history.find(x=>x.id===r.parentId&&x.projectId===r.projectId),stale=r.projectId===draft.projectId&&r.inputFingerprint!==C.signature(draft);
    const actions=el('div',{class:'fc-actions no-print'},[
      button(L('修改並重查','Edit & re-check'),()=>editReport(r),true,{id:'fc-edit-recheck'}),button(L('列印／儲存 PDF','Print / save PDF'),()=>window.print(),false,{id:'fc-print'}),
      button(L('下載提案與報告','Download proposal & report'),()=>download('fitcheck-report-v'+r.revision+'.md',C.markdown(r),'text/markdown')),
      button(L('下載 JSON','Download JSON'),()=>download('fitcheck-report-v'+r.revision+'.json',JSON.stringify(r,null,2),'application/json')),
    ]);
    const score=card('',[el('div',{class:'fc-scorecard'},[el('div',{class:'fc-score'},[r.score.value,el('small',{},' /100')]),el('div',{},[el('span',{class:'eyebrow'},'FITCHECK · V'+r.revision),el('h2',{},L('證據準備度','Evidence readiness')),el('p',{class:'hint'},L('不代表已達產品市場契合或成功概率。','Not established product-market fit or a success probability.'))])]),
      el('h3',{},r.proposal.name||L('未命名提案','Untitled proposal')),el('p',{class:'hint'},new Date(r.createdAt).toLocaleString()+' · '+(r.language==='en'?'English':'繁體中文')),pill(aiText(r.aiStatus),r.aiStatus==='live'?'good':'warning'),
      stale?el('div',{class:'fc-subtle'},L('草稿已修改。這份報告仍對應下方的原始提案，請重新分析更新結果。','Your draft changed. This report still describes the proposal snapshot below. Re-check to update it.')):null,
      previous?el('p',{},L('較上一版準備度：','Readiness change from parent version: ')+(r.score.value-previous.score.value>=0?'+':'')+(r.score.value-previous.score.value)+L(' 分；這不表示市場契合改善。',' points; this does not establish better product-market fit.')):null,
      el('p',{},r.summary),
      el('div',{class:'fc-dimensions'},r.score.dimensions.map(d=>el('div',{class:'fc-dimension'},[categoryLabel(d.category),el('b',{},d.points+'/20'),el('span',{},d.evidenceCount+L(' 項證據',' records'))]))),
      el('details',{},[el('summary',{},L('評分方法與限制','Scoring method and limits')),el('p',{class:'hint'},L('每類最多 20 分：相關提案欄位有內容 +5；有至少一項證據記錄 +10；其中一項資料日期在過去 365 日內 +5。五類共 100 分。這是資料完整性規則，不評估證據是否正面、真實或具代表性；手動與 API 證據均可計分。查閱日期不會代替原始資料日期。','Each category: relevant proposal field present +5; at least one evidence record +10; a record dated within 365 days +5. Five categories total 100. These rules measure documentation, not whether evidence is positive, true or representative. Manual and API records both count. Retrieval dates do not substitute for original evidence dates.'))]),actions,
    ]);
    const byId=Object.fromEntries(r.evidence.map(e=>[e.id,e]));
    const basis={coverage:['資料覆蓋檢查','Coverage check'],proposal:['提案內容 · AI 解讀','Proposal · AI interpretation'],evidence:['證據 · AI 解讀，待核對','Evidence · AI interpretation, review required'],hypothesis:['待測試假設','Hypothesis to test']};
    const findings=card(L('風險、警示與優勢','Risks, warnings & strengths'),r.findings.map(f=>el('section',{class:'fc-finding '+f.level},[
      pill(f.level==='risk'?L('高優先風險','Priority risk'):f.level==='strength'?L('優勢／已有基礎','Strength / foundation'):L('需要留意','Warning'),f.level==='strength'?'good':'warning'),el('h3',{},f.title),el('p',{},f.detail),el('span',{class:'hint'},L(...(basis[f.basis]||basis.hypothesis))),
      ...(f.citations||[]).map(c=>el('blockquote',{},[el('a',{href:'#fc-source-'+c.id},'['+c.id+'] '+(byId[c.id]?.title||'')),el('div',{},c.quote)])),
    ])));
    const rewrites=card(L('讓提案更具體','Make your proposal more specific'),[el('p',{class:'hint'},L('以下是待審閱的修改草稿，未自動加入提案。套用後請核對數字及承諾，再重新分析。','These are draft suggestions, not automatically adopted. Review figures and commitments after applying, then re-check.')),
      ...(r.rewrites||[]).map(x=>el('div',{class:'fc-stack'},[el('h3',{},textLabel(x.field)),el('p',{class:'fc-rewrite'},x.text),el('p',{class:'hint'},x.why),button(L('套用到草稿','Apply to draft'),()=>{if(draft.projectId!==r.projectId||draft.parentId!==r.id){status(L('請先按「修改並重查」載入此版本，再套用。','Select Edit & re-check to load this version before applying suggestions.'));return;}undo=clone(draft.proposal);draft.proposal[x.field]=x.text;save();status(L('已套用到草稿。可返回提案檢查或復原，再重新分析。','Applied to draft. Review or undo in Proposal, then re-check.'));render();},false,{class:'btn no-print','data-rewrite':x.field})])),
      !r.rewrites?.length?el('p',{class:'fc-missing'},L('目前沒有 AI 改寫。請按驗證實驗補充證據，再重新分析。','No AI rewrites are available. Collect evidence with the experiments below and re-check.')):null,
    ]);
    const experiments=card(L('下一步：用實驗縮小不確定性','Next: reduce uncertainty with experiments'),r.experiments.map(x=>el('div',{class:'fc-evidence'},[el('h3',{},x.title),el('p',{},x.method),el('p',{class:'fc-subtle'},x.success_criterion),el('span',{class:'hint'},x.days+L(' 日 · 建議門檻，請按情況調整',' days · proposed threshold; adapt before testing')),button(L('加入行動清單','Add to action list'),()=>V32.addAction(x.title+' — '+x.method+' '+x.success_criterion,{source:'fitcheck:'+r.id,days:x.days}),false,{class:'btn no-print','data-experiment':''})])));
    const evidence=card(L('證據與資料來源','Evidence & provenance'),[...sourceCards(r.sources,true),el('p',{class:'hint'},L('資料為此報告時間的快照。請開啟來源核對內容、日期及授權；AI 引用吻合原文並不保證其推論正確。','Records are snapshots from the time of this report. Open sources to review content, dates and permissions. A matching AI quote does not guarantee a valid inference.')),
      ...r.evidence.map(e=>el('section',{class:'fc-evidence',id:'fc-source-'+e.id},[el('h3',{},'['+e.id+'] '+e.title),pill(e.origin==='user'?L('你提供 · 未獨立核實','Founder supplied · unverified'):L('API 取得 · 待核對相關性','API retrieved · relevance needs review'),e.origin==='user'?'warning':'good'),el('p',{class:'hint'},e.provider+' · '+categoryLabel(e.category)+' · '+L('資料日期：','Evidence date: ')+(e.date||L('未知','Unknown'))+(e.retrievedAt?' · '+L('查閱：','Fetched: ')+new Date(e.retrievedAt).toLocaleString():'')),el('p',{class:'fc-original'},e.summary),C.safeURL(e.url)?el('a',{href:C.safeURL(e.url),target:'_blank',rel:'noopener noreferrer'},e.url):el('span',{class:'hint'},L('未提供公開連結','No public link supplied')),
        e.series?.length?el('details',{},[el('summary',{},L('查看搜尋指數（0–100）','View interest index (0–100)')),el('table',{class:'fc-table'},[el('caption',{},L('相對搜尋指數，非實際搜尋量','Relative interest, not absolute search volume')),el('thead',{},el('tr',{},[el('th',{},L('日期','Date')),el('th',{},L('指數','Index'))])),el('tbody',{},e.series.map(p=>el('tr',{},[el('td',{},p.date),el('td',{},p.value)])))])]):null])),
      !r.evidence.length?el('p',{class:'fc-missing'},L('沒有市場證據。本次僅能檢查提案與資料缺口。','No market evidence is available. This check covers proposal and documentation gaps only.')):null,
    ]);
    const proposal=card(L('本次分析的提案快照','Proposal snapshot for this check'),C.fields.filter(k=>!['query','competitionQuery','geo'].includes(k)).map(k=>el('div',{},[el('h3',{},textLabel(k)),el('p',{class:'fc-original'},r.proposal[k]||'—')])));
    box.replaceChildren(score,findings,rewrites,experiments,evidence,proposal);
  }
  function renderHistory(){
    $('#fc-history').replaceChildren(card(L('每次修改，都留下脈絡。','Keep the context of every revision.'),[
      el('p',{class:'hint'},L('此瀏覽器最多保留 12 份報告。版本差異反映證據與提案更新，不代表已驗證的商業進步。','This browser keeps up to 12 reports. Changes reflect updated proposals and evidence, not validated business progress.')),
      ...history.map(r=>el('div',{class:'fc-evidence'},[el('div',{class:'spread'},[el('h3',{},(r.proposal.name||'FitCheck')+' · V'+r.revision),pill(r.score.value+'/100')]),el('p',{class:'hint'},new Date(r.createdAt).toLocaleString()+' · '+aiText(r.aiStatus)),el('div',{class:'fc-actions'},[button(L('開啟報告','Open report'),()=>{report=r;show('report');}),button(L('以此版本繼續','Continue from this version'),()=>editReport(r)),button(L('刪除','Delete'),()=>{if(confirm(L('刪除此報告快照？此操作不能復原。','Delete this report snapshot? This cannot be undone.'))){history=history.filter(x=>x.id!==r.id);store.set('fitcheckReports',history);if(report?.id===r.id)report=null;render();}})])])),
      !history.length?el('p',{},L('尚未有報告。','No reports yet.')):null,button(L('下載草稿與報告備份','Download draft & report backup'),backup),
    ]));
  }
  document.addEventListener('tp:languagechange',render);
  save();render();
})();
