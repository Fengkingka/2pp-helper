/* One editable 12-month service-business model, compatible with historical simulation reports. */
(function () {
  'use strict';
  const { $,el,svg,store,profile,fmt,BASE }=TP;
  const { L }=V32;
  const calc=Engine.calc;
  let company=store.get('startup') || {name:TP.demo.active?'LedgerLite (demo)':'',industry:'Tech / SaaS',stage:'pre_seed',founderShares:10000000};
  let input=store.get('startup')?calc.migrateFinancial(company):calc.presetInput();
  let latest=null;
  const definitions=[
    ['capital','可投入資金 HK$','Starting capital HK$',0,100000000,1000],['monthlyRevenue','首月收入 HK$','Month-1 revenue HK$',0,10000000,1000],['founderSalary','創辦人月薪 HK$','Founder monthly salary HK$',0,500000,500],
    ['setupCost','一次性開辦支出 HK$','One-off setup expense HK$',0,10000000,500],['staffCount','現有員工（不包括創辦人）','Initial staff (excluding founder)',0,29,1],['staffSalary','員工平均月薪 HK$','Average staff monthly salary HK$',0,500000,500],['hireMonth','計劃招聘月份','Planned hiring month',1,12,1],['hireCount','計劃新增人數','Planned new hires',0,29,1],['hireSalary','新員工月薪 HK$','New hire monthly salary HK$',0,500000,500],
    ['rent','每月租金 HK$','Monthly rent HK$',0,1000000,100],['serverCost','每月系統費 HK$','Monthly systems cost HK$',0,1000000,100],['marketing','每月市場預算 HK$','Monthly marketing HK$',0,1000000,100],['otherCost','每月其他支出 HK$','Other monthly costs HK$',0,1000000,100],['annualFees','第 12 月專業及行政費 HK$','Month-12 professional / admin fees HK$',0,1000000,100],
    ['cogsRate','收入直接成本比例','Direct cost / revenue ratio',0,1,0.01],['growth','每月需求增長率','Monthly demand growth rate',0,1,0.01],['growthDecay','增長衰減係數','Growth decay factor',0,1,0.01],['churn','每月需求流失率','Monthly demand churn rate',0,1,0.01],['collectionDays','客戶付款延遲（日）','Customer collection delay (days)',0,90,1],['paymentDays','供應商付款延遲（日）','Supplier payment delay (days)',0,90,1],['price','單位／客戶月費 HK$','Unit / customer monthly price HK$',1,1000000,1]
  ];
  function numeric([key,zh,en,min,max,step]) {
    const n=el('input',{id:key,type:'number',class:'input num',min,max,step,required:true});n.value=input[key];
    n.addEventListener('input',()=>{const value=n.value.trim()===''?NaN:Number(n.value);n.setAttribute('aria-invalid',String(!Number.isFinite(value)||value<min||value>max));input[key]=value;update();});
    return el('label',{class:'field'},[el('span',{},L(zh,en)),n]);
  }
  function renderForm() {
    const name=el('input',{id:'name',class:'input',maxlength:60,placeholder:L('我的公司','My company')});name.value=company.name||'';name.addEventListener('input',()=>{company.name=name.value;update();});
    const industry=el('select',{id:'industry',class:'select'},[...calc.financialPresets.presets.map(p=>el('option',{value:p.id},TP.language()==='en'?p.nameEn:p.name)),el('option',{value:'custom'},L('自訂／既有公司設定','Custom / existing company'))]);industry.value=input.presetId;
    const apply=el('button',{type:'button',class:'btn btn-sm',onclick:()=>{if(industry.value==='custom')return;const capital=Number.isFinite(input.capital)?input.capital:500000;input={...calc.presetInput(industry.value),capital};company.industry=calc.financialPresets.presets.find(p=>p.id===industry.value).nameEn;renderForm();update();}},L('套用教學假設（保留資金）','Apply teaching assumptions (keep capital)'));
    const advanced=el('details',{},[el('summary',{},L('檢視及修改全部假設','Review and edit all assumptions')),el('div',{class:'form-grid',style:{marginTop:'16px'}},definitions.slice(3).map(numeric))]);
    const checkbox=(key,zh,en)=>{const n=el('input',{type:'checkbox'});n.checked=input[key];n.addEventListener('change',()=>{input[key]=n.checked;update();});return el('label',{class:'row'},[n,L(zh,en)]);};
    $('#company').replaceChildren(el('h2',{},L('公司設定','Company assumptions')),el('label',{class:'field'},[L('公司名稱（可選）','Company name (optional)'),name]),el('label',{class:'field'},[L('行業範本','Industry preset'),industry]),apply,...definitions.slice(0,3).map(numeric),advanced,
      checkbox('founderEmployee','創辦人按受僱員工計僱主 MPF','Treat founder as a covered salaried employee for employer MPF'),checkbox('taxPaidMonth12','假設第 12 月支付本年估計稅額','Assume estimated tax is paid in month 12'),
      el('p',{class:'hint'},L('未勾選付款假設時，估計稅額保留為應付稅款。這不是實際稅單或到期日。招聘由你決定，不會自動推薦。','If payment is off, estimated tax stays as a liability. This is not a tax bill or due date. Hiring is your decision, not an automatic recommendation.')),el('p',{id:'finance-error',class:'field-error',role:'alert'}),el('p',{id:'finance-save',class:'hint',role:'status'}));
  }
  function table(head,rows){return el('div',{class:'table-scroll'},el('table',{},[el('thead',{},el('tr',{},head.map(x=>el('th',{scope:'col'},x)))),el('tbody',{},rows.map(row=>el('tr',{},row.map(x=>el('td',{},String(x))))))]));}
  const money=n=>fmt.hk(n);
  const survival=r=>r.firstDepletion===0?L('開辦資金不足','Insufficient setup funding'):r.runwayMonths!==null?r.runwayMonths.toFixed(1)+L(' 個月',' months'):L('12 個月內未耗盡','No depletion within 12 months');
  function update() {
    try {
      for(const [k,,,min,max] of definitions)if(!Number.isFinite(input[k])||input[k]<min||input[k]>max)throw Error(L('請修正標示的數字；保留上一個有效結果。','Correct the marked numbers. The last valid result is retained.'));
      calc.validateFinancial(input); latest=calc.projectFinancial(input); $('#finance-error').textContent='';
    }catch(e){$('#finance-error').textContent=e.message;return;}
    company={...company,finance:{...input},cash:input.capital-input.setupCost,monthlyRevenue:input.monthlyRevenue,headcount:1+input.staffCount,avgSalary:(input.founderSalary+input.staffCount*input.staffSalary)/(1+input.staffCount),serverCost:input.serverCost,marketing:input.marketing,otherCost:input.otherCost+input.rent,price:input.price};profile.setStartup(company);
    $('#finance-save').textContent=store.persistent?L('已自動儲存。可用 FitCheck 檢查市場與收費假設。','Saved automatically. Use FitCheck to examine market and pricing assumptions.'):L('儲存不可用，請先下載資料。','Storage unavailable. Download before leaving.');
    renderResults();
  }
  function renderResults() {
    if(!latest)return;const r=latest;
    $('#startup-warning').textContent=L('教學模擬：行業數值是可修改的假設，並非已核實市場基準。模型只涵蓋服務業、無庫存、無借貸及無折舊。結果不是財務預測。','Educational simulation: industry values are editable assumptions, not verified market benchmarks. This model covers service businesses with no inventory, debt or depreciation. Results are not financial forecasts.');
    $('#financial-summary').replaceChildren(el('h2',{},L('12 個月概覽','12-month overview')),el('div',{class:'stat-grid'},[
      [L('資金可撐','Cash coverage'),survival(r)],[L('所需額外資金','Additional funding needed'),money(r.fundingGap)],
      [L('期末現金（假設繼續營運）','Ending cash (if operations continue)'),money(r.endingCash)],[L('首個營運盈餘月份','First operating surplus month'),r.firstOperatingSurplusMonth||L('未達到','Not reached')]
    ].map(([k,v])=>el('div',{class:'stat'},[el('span',{class:'k'},k),el('span',{class:'v'},String(v))]))),el('p',{class:'hint'},L('首次營運盈餘不等於收回開辦成本或持續盈利。所有未來結果均依賴假設。','A first operating surplus does not mean setup costs are recovered or profits are sustained. All future results depend on assumptions.')),
      r.firstDepletion!==null?el('p',{class:'assumption-note'},L('現金耗盡後的月份僅表示「獲得額外融資後繼續營運」的情景；負數是資金缺口，不是可動用現金。','Months after cash depletion are conditional on additional funding. Negative cash shows a funding gap, not spendable money.')):null);
    const cash=[input.capital-input.setupCost,...r.rows.map(x=>x.cashEnd)],W=640,H=240,x0=65,x1=620,y0=20,y1=210,min=Math.min(0,...cash),max=Math.max(1,...cash);
    const points=TP.linePoints(cash,{x0,x1,y0,y1,min,max,count:12});const zero=y1-(0-min)/(max-min)*(y1-y0);
    $('#financial-chart').replaceChildren(el('h3',{},L('每月現金／資金缺口','Monthly cash / funding gap')),svg('svg',{viewBox:`0 0 ${W} ${H}`,class:'v32-chart',role:'img','aria-label':L('12 個月現金走勢；下方表格有數值。','12-month cash path; values are in the table below.')},[svg('line',{x1:x0,y1:zero,x2:x1,y2:zero,stroke:'#ff8a66','stroke-dasharray':'4 4'}),svg('polyline',{points,fill:'none',stroke:'#3fe0b5','stroke-width':3}),...[[0,x0],[6,(x0+x1)/2],[12,x1]].map(([m,x])=>svg('text',{x,y:235,fill:'#aaa','font-size':13},String(m))),svg('text',{x:0,y:25,fill:'#aaa','font-size':12},Math.round(max/1000)+'k'),svg('text',{x:0,y:y1,fill:'#aaa','font-size':12},Math.round(min/1000)+'k')]),el('p',{class:'hint'},L('月份 0 已扣除一次性開辦支出。','Month 0 already deducts the one-off setup expense.')));
    const scenarios=[[L('目前設定','Current settings'),r],[L('首月需求低 20%','20% lower starting demand'),calc.projectFinancial({...input,monthlyRevenue:input.monthlyRevenue*.8})]];
    if(input.hireCount && input.hireMonth<12)scenarios.push([L('招聘延後 3 個月','Delay hiring by 3 months'),calc.projectFinancial({...input,hireMonth:Math.min(12,input.hireMonth+3)})]);
    scenarios.push([L('市場開支減半','Halve marketing spending'),calc.projectFinancial(input,[],[{month:1,changes:{marketing:input.marketing*.5}}])]);
    $('#financial-compare').replaceChildren(el('h3',{},L('比較你的決定','Compare decisions')),table([L('情景','Scenario'),L('資金可撐','Cash coverage'),L('額外資金','Funding gap'),L('全年收入','Year revenue')],scenarios.map(([name,v])=>[name,survival(v),money(v.fundingGap),money(v.totalRevenue)])),el('p',{class:'hint'},L('市場開支改動亦會影響模型需求增長。較多現金不一定代表較好的業務。','Marketing changes also affect modelled demand growth. More cash does not necessarily mean a healthier business.')));
    $('#financial-roster').replaceChildren(el('h3',{},L('人手計劃與成本','Staffing plan and cost')),table([L('人員','Team'),L('人數','Count'),L('每人月薪','Monthly salary each'),L('開始月份','Start month')],r.roster.map(x=>[x.role==='Founder'?L('創辦人','Founder'):x.role==='Initial team'?L('現有團隊','Initial team'):L('計劃招聘','Planned hires'),x.count,money(x.salary),x.startMonth])),el('p',{class:'hint'},L('MPF 按每位員工計算。聘請更多人不保證收入增加；請先比較現金和需求。','MPF is calculated per employee. Hiring does not guarantee higher sales; compare cash and demand first.')));
    $('#financial-table').replaceChildren(el('h3',{},L('每月損益與現金流','Monthly profit and cash flow')),table([L('月份','Month'),L('收入','Revenue'),'COGS',L('工資','Salaries'),'MPF','EBITDA',L('稅項支出','Tax expense'),L('淨利潤','Net income'),L('現金變動','Cash movement'),L('期末現金','Ending cash')],r.rows.map(x=>[x.month+(x.conditional?' *':''),...['revenue','cogs','labour','mpf','ebitda','taxExpense','netIncome','cashMovement','cashEnd'].map(k=>money(x[k]))])),el('p',{class:'hint'},L('* 需額外融資才能繼續的月份。開辦支出在第 0 月入帳；稅項支出與付款分開。','* Continued operations require additional funding. Setup expense is recorded in month 0; tax expense and payment are separate.')));
    const b=r.balanceSheet;
    $('#financial-balance').replaceChildren(el('h3',{},L('簡化期末對帳','Simplified closing reconciliation')),r.fundingGap?el('p',{class:'hint'},L('現金為負時，下表為未融資情景對帳，並非可持續營運的實際資產負債表。','With negative cash this is an unfunded scenario reconciliation, not an actual viable balance sheet.')):null,table([L('項目','Item'),'HK$'],[[L('現金','Cash'),money(b.cash)],[L('應收款','Receivables'),money(b.receivables)],[L('資產合計','Total assets'),money(b.assets)],[L('應付款','Payables'),money(b.payables)],[L('應付稅款','Tax payable'),money(b.taxPayable)],[L('投入資本','Contributed capital'),money(b.paidInCapital)],[L('累計損益（包括開辦支出）','Retained profit / loss (including setup)'),money(b.retainedEarnings)],[L('對帳差額','Reconciliation difference'),Math.abs(b.reconciliationError).toFixed(2)]]));
    $('#financial-sources').replaceChildren(el('h3',{},L('假設與資料來源','Assumptions and sources')),el('p',{},L('行業收入、工資、費用及增長數值全部屬團隊教學假設，沒有聲稱來自已核實市場調查。','Industry revenue, salaries, costs and growth values are team teaching assumptions; they are not presented as verified market survey data.')), ...calc.financialPresets.sources.map(s=>el('p',{},el('a',{href:s.url,target:'_blank',rel:'noopener noreferrer'},s.id==='mpf'?L('積金局：僱員供款規則','MPFA: employee contribution rules'):L('稅務局：利得稅','IRD: profits tax')))),el('p',{class:'hint'},L('假設僱員受 MPF 覆蓋、公司符合兩級制資格；不模擬暫繳稅時間、虧損結轉或稅務調整。未提供五年估值，以免把存續不確定性當作確定價值。','Assumes covered employees and a corporation eligible for two-tier tax. Provisional tax timing, loss carry-forward and tax adjustments are not modelled. A five-year valuation is omitted because business survival is uncertain.')));
    $('#startup-next').replaceChildren(el('h3',{},L('把設定帶入練習','Use this company in practice')),el('div',{class:'row'},[['fitcheck.php','FitCheck 市場驗證','FitCheck validation'],['term-sheet.php','融資條款','Term Sheet'],['b2b.php','B2B 電郵','B2B email'],['hostile-vc.php','投資者問答','Investor challenge']].map(([href,zh,en])=>el('a',{class:'btn',href:BASE+'startup/'+href},L(zh,en)))),el('button',{type:'button',class:'btn btn-sm',onclick:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({company,projection:r},null,2)],{type:'application/json'}));el('a',{href:url,download:'2pp-startup-scenario.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}},L('下載情景數據','Download scenario data')));
  }
  $('#company').addEventListener('submit',e=>e.preventDefault());
  $('#use-demo').addEventListener('click',()=>{if(!TP.demo.active){TP.demo.start();return;}input=calc.presetInput();company={name:'LedgerLite (demo)',industry:'Tech / SaaS',stage:'pre_seed',founderShares:10000000};renderForm();update();});
  document.addEventListener('tp:languagechange',()=>{renderForm();renderResults();V32.translate();});
  renderForm();update();
})();
