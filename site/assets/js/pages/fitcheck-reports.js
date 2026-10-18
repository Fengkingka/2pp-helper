(function(){
  'use strict';
  const {el,store,BASE}=TP,{L}=V32;
  function render(){
    const box=document.getElementById('fitcheck-report-index'),list=FitCheckCore.records(store.get('fitcheckReports',[]));
    box.replaceChildren(el('h2',{},L('FitCheck 提案驗證報告','FitCheck validation reports')),
      el('p',{class:'hint'},L('獨立保留最多 12 份；證據準備度不是能力評分或創業成功率。','Up to 12 reports are stored separately. Evidence readiness is not an ability score or startup success probability.')),
      ...list.map(r=>el('a',{class:'btn',href:BASE+'startup/fitcheck.php?report='+encodeURIComponent(r.id)},(r.proposal.name||'FitCheck')+' · V'+r.revision+' · '+r.score.value+'/100')),
      el('a',{href:BASE+'startup/fitcheck.php'},L('開始新檢查 →','Start a check →')));
  }
  render();document.addEventListener('tp:languagechange',render);
})();
