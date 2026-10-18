(function(){
  'use strict';
  const {$,el,store,profile,api,fmt,BASE}=TP,{L}=V32;
  const company=profile.startup(), finance=Engine.calc.migrateFinancial(company), projection=Engine.calc.projectFinancial(finance);
  const signature=JSON.stringify(finance);
  let draft=store.get('vcDraft');
  if(!draft || draft.signature!==signature)draft={signature,pitch:'',answers:['','',''],feedback:null};
  let busy=false;
  const questions=()=>[
    L('你的客戶是誰？你有甚麼實際證據證明他們願意付費？請分清已觀察到的事實和待驗證假設。','Who is the customer, and what real evidence shows willingness to pay? Separate observed facts from assumptions.'),
    projection.fundingGap>0?L('你的 12 個月情景出現資金缺口 '+fmt.hk(projection.fundingGap)+'。你會先修改哪項決定？代價是甚麼？','Your 12-month scenario has a funding gap of '+fmt.hk(projection.fundingGap)+'. Which decision would you change first, and what would you give up?'):L('在需求低於預期時，你如何保留現金？甚麼指標會觸發減少開支或延後招聘？','If demand is weaker than expected, how will you preserve cash? What signal would trigger spending cuts or delayed hiring?'),
    L('未來 30 日你會做哪個最小測試？寫出可觀察的成功條件、停止條件和負責人。','What is the smallest test you will run in the next 30 days? State observable success and stop criteria, and who owns it.')];
  function save(){store.set('vcDraft',draft);}
  function render(){
    const q=questions();
    $('#vc-context').replaceChildren(el('h3',{},L('本次公司情景','Company scenario')),el('p',{},company.name||L('我的公司','My company')),el('p',{},L('投入資金：','Starting capital: ')+fmt.hk(finance.capital)),el('p',{},L('額外資金需求：','Additional funding needed: ')+fmt.hk(projection.fundingGap)),el('p',{},L('首月收入假設：','Month-1 revenue assumption: ')+fmt.hk(finance.monthlyRevenue)),el('p',{class:'hint'},L('數字由程式計算；問答不代表投資意向或投資評級。按下回饋時，簡介、回答及此處摘要會送至 AI 供應商（如已設定）。','Numbers are calculated by code. This is not an investment decision or rating. Requesting feedback sends your pitch, answers and this summary to the configured AI provider.')),el('a',{class:'btn btn-sm',href:BASE+'startup/index.php'},L('修改公司設定','Edit company assumptions')));
    const form=el('form',{class:'stack',style:{'--gap':'18px'}});
    function answer(label,value,set,max){const n=el('textarea',{class:'textarea',rows:4,maxlength:max,required:true});n.value=value;n.addEventListener('input',()=>{set(n.value);draft.feedback=null;document.getElementById("vc-feedback")?.remove();save();});return el('label',{class:'field'},[el('b',{},label),n]);}
    form.append(answer(L('用幾句話介紹你的公司','Introduce your company in a few sentences'),draft.pitch,v=>draft.pitch=v,1500));
    q.forEach((text,i)=>form.append(answer((i+1)+'. '+text,draft.answers[i],v=>draft.answers[i]=v,2000)));
    const button=el('button',{type:'submit',class:'btn btn-coral',disabled:busy},busy?L('整理回饋中…','Preparing feedback…'):L('取得教練回饋','Get coaching feedback'));
    const status=el('p',{class:'hint',role:'status'});form.append(button,status);
    form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(!draft.pitch.trim()||draft.answers.some(x=>!x.trim()))return;busy=true;button.disabled=true;status.textContent=L('正在整理…','Working…');
      try{const result=await api('llm.php',{task:'founder_feedback',pitch:draft.pitch,questions:q,answers:draft.answers,financialSummary:{capital:finance.capital,monthlyRevenue:finance.monthlyRevenue,fundingGap:Math.round(projection.fundingGap)}});draft.feedback=result;save();}
      catch(error){status.textContent=error.message;busy=false;button.disabled=false;return;}
      busy=false;render();});
    $('#vc-session').replaceChildren(form);
    if(draft.feedback){const f=draft.feedback;$('#vc-session').append(el('div',{id:'vc-feedback',class:'assumption-note stack'},[el('b',{},f.source==='ai'?L('AI 教練回饋','AI coaching feedback'):L('基本反思指引（未有 AI 評估）','Basic reflection guide (no AI assessment)')),el('p',{class:'vc-answer'},f.feedback),V32.actionButton(f.nextAction,'founder-vc')]));}
  }
  document.addEventListener('tp:languagechange',render);render();
})();
