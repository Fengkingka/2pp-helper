/* Pure helpers shared by the browser and integration checks. */
(function(root){
  'use strict';
  const fields=['name','problem','audience','solution','revenue','marketSize','differentiator','validation','query','competitionQuery','geo'];
  const cleanProposal=p=>Object.fromEntries(fields.map(k=>[k,typeof p?.[k]==='string'?p[k]:'']));
  function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  const signature=d=>JSON.stringify([cleanProposal(d.proposal),d.evidence||[],!!d.fetchSources]);
  function records(value){return Array.isArray(value)?value.filter(r=>r&&r.schema===1&&typeof r.id==='string'&&r.proposal&&r.score&&Array.isArray(r.evidence)&&Array.isArray(r.findings)&&Array.isArray(r.experiments)).slice(0,12):[];}
  function markdown(r){
    const lines=['# FitCheck — '+(r.proposal.name||'Proposal'),'','Generated: '+r.createdAt,'AI status: '+r.aiStatus,'Evidence readiness: '+r.score.value+'/100 ('+r.score.rubric+')','This score measures documentation coverage, not proven product-market fit or a success probability.','',r.summary,''];
    for(const k of fields.filter(k=>!['query','competitionQuery','geo'].includes(k)))lines.push('## '+k,r.proposal[k]||'—','');
    lines.push('## Findings');for(const f of r.findings)lines.push('### '+f.level+' · '+f.title,f.detail,'Basis: '+f.basis,...(f.citations||[]).map(c=>'['+c.id+'] '+c.quote),'');
    lines.push('## Suggested revisions (not yet adopted)');for(const x of r.rewrites||[])lines.push(x.field+': '+x.text,x.why,'');
    lines.push('## Validation experiments');for(const x of r.experiments)lines.push(x.title+' ('+x.days+' days)',x.method,x.success_criterion,'');
    lines.push('## Source status');for(const s of Object.values(r.sources||{}))lines.push(s.name+': '+s.status+'; retrieved '+s.count+'; checked '+(s.checkedAt||'—'));
    lines.push('','## Evidence snapshots (review accuracy and permissions before sharing)');for(const e of r.evidence)lines.push('['+e.id+'] '+e.title,'Source: '+e.provider+' | '+e.origin+' | Date: '+(e.date||'unknown')+' | Retrieved: '+(e.retrievedAt||'not fetched'),e.url,e.summary,'');
    return lines.join('\n');
  }
  const api={fields,cleanProposal,safeURL,signature,records,markdown};root.FitCheckCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
