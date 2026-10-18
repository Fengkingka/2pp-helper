import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { EvaluationReport, SessionLog } from '../lib/types';

describe.runIf(process.env.TP_BROWSER_TESTS === '1')('VC real browser controller',()=>{
  let browser:Browser, context:BrowserContext, page:Page, server:ChildProcess, base:string;
  let requests:any[], evaluations:any[], errors:string[];
  beforeAll(async()=>{
    const port=await new Promise<number>(resolve=>{const s=createServer(); s.listen(0,'127.0.0.1',()=>{const p=(s.address() as any).port;s.close(()=>resolve(p));});});
    base=`http://127.0.0.1:${port}`;
    server=spawn(process.env.PHP_PATH || 'php',['-S',`127.0.0.1:${port}`,'router.php'],{cwd:fileURLToPath(new URL('../../site',import.meta.url)),windowsHide:true,stdio:'ignore',env:{...process.env,LLM_MODE:'mock',MINIMAX_API_KEY:''}});
    for(let i=0;i<100;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,50));}}
    const executablePath=[process.env.CHROME_PATH,join(homedir(),'AppData/Local/Google/Chrome/Application/chrome.exe'),'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>p && existsSync(p));
    browser=await chromium.launch({executablePath,channel:executablePath?undefined:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  },30000);
  beforeEach(async()=>{
    context=await browser.newContext({permissions:['microphone'],viewport:{width:1360,height:1000}});
    await context.addInitScript(()=>{
      const w=window as any; w.vcHarness={recognizers:[],utterances:[],streams:[],recorders:[],recordedBytes:0};
      const Recorder=w.MediaRecorder;w.MediaRecorder=class extends Recorder{constructor(stream:MediaStream,options?:MediaRecorderOptions){super(stream,options);w.vcHarness.recorders.push(this);this.addEventListener('dataavailable',(event:BlobEvent)=>{w.vcHarness.recordedBytes+=event.data.size;});}};
      w.SpeechRecognition=class{onresult:any;onend:any;onerror:any;start(){} stop(){this.onend?.();} abort(){} constructor(){w.vcHarness.recognizers.push(this)}};
      w.SpeechSynthesisUtterance=class{constructor(public text:string){}};
      Object.defineProperty(w,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'en-US'},{lang:'zh-HK'}],cancel(){},speak(u:any){w.vcHarness.utterances.push(u);u.onstart?.();}}});
      const open=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia=async(o)=>{const s=await open(o);w.vcHarness.streams.push(s);return s};
    });
    page=await context.newPage();await page.clock.install();requests=[];evaluations=[];errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());
    await page.route('**/api/speech.php?vc=1',r=>r.fulfill({json:{provider:'browser',ready:false,shared:{en:{numbers:true,vision:true,legal:true},'zh-HK':{numbers:true,vision:true,legal:true}}}}));
    await page.route('**/api/llm.php',r=>{const p=r.request().postDataJSON();requests.push(p);const ids=['vision','numbers','legal'];return r.fulfill({json:{source:'ai',speaker:ids[(p.round-1)%3],question:p._lang==='en'?`Question ${p.round}: explain your evidence?`:`第${p.round}題：有咩證據？`}})});
    page.on('request',r=>{if(r.url().includes('/api/evaluate.php'))evaluations.push(r.postDataJSON())});
    await page.goto(base+'/startup/vc-panel.php'); await page.evaluate(()=>(window as any).TPI18n.setLanguage('en'));
  });
  afterEach(async()=>{try{expect(errors).toEqual([])}finally{await context?.close()}});
  afterAll(async()=>{await browser?.close();server?.kill()});
  async function start(voice=false){await page.locator('#pitch').fill('A workflow tool for small teams.');await page.locator('#consent').check();await page.locator('#start-voice').click();await page.waitForFunction(()=>['speaking','countdown','answering'].includes(document.querySelector('#vc-session')?.getAttribute('data-phase') || ''));if(!voice){await spoken();await endAnswer();}}
  async function answer(text='We interviewed twenty customers and will validate retention with a pilot.'){await page.locator('#vc-answer').fill(text);await page.locator('#vc-submit').click();await page.waitForFunction(()=>['speaking','completed'].includes(document.querySelector('#vc-session')?.getAttribute('data-phase') || ''));if(await page.locator('#vc-session').getAttribute('data-phase')==='speaking'){await spoken();await endAnswer();}}
  async function saved(){await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tp:reports') || '[]').length>0);return page.evaluate(()=>JSON.parse(localStorage.getItem('tp:reports') || '[]')[0]);}
  async function advanceCountdown(){for(let i=0;i<3;i++)await page.clock.fastForward(1000);await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='recording');}
  async function spoken(capture=true){await page.evaluate(()=>{const h=(window as any).vcHarness;h.utterances.at(-1)?.onend?.()});await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='countdown');if(capture)await advanceCountdown();}
  async function endAnswer(){await page.locator('#vc-answer-end').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='review');}
  async function recognize(text:string){await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='recording');await page.evaluate(text=>{const h=(window as any).vcHarness;h.recognizers.at(-1).onresult?.({results:[[{transcript:text}]]})},text);}

  it('shows a three second countdown only after playback then records automatically once',async()=>{
    await start(true);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.length)).toBe(1);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getAudioTracks().every(t=>!t.enabled)))).toBe(true);
    expect(await page.locator('#vc-answer').isEditable()).toBe(false);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    await page.evaluate(()=>(window as any).vcHarness.utterances.at(-1).onend());
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='countdown');
    for(const n of [3,2,1]) {
      expect(await page.locator('#vc-countdown').innerText()).toContain(String(n));
      expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
      expect(await page.locator('#vc-answer-start').isVisible()).toBe(false);
      await page.clock.fastForward(1000);
    }
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='recording');
    expect(await page.locator('#vc-countdown').isVisible()).toBe(false);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(1);
    await page.clock.fastForward(3000);expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(1);
  });
  it('hides text practice and text switching without removing transcript review',async()=>{
    expect(await page.locator('#start-text').isVisible()).toBe(false);
    await start(true);expect(await page.locator('#vc-text-switch').isVisible()).toBe(false);
    expect(await page.locator('#vc-answer').isVisible()).toBe(true);
  });
  it('brings the countdown into the visible mobile screen before automatic capture',async()=>{
    await page.setViewportSize({width:375,height:812});await start(true);await spoken(false);
    const box=await page.locator('#vc-countdown').boundingBox();
    expect(box).not.toBeNull();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(812);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
  it('cancels the countdown on finish and never opens late capture',async()=>{
    await start(true);
    await page.evaluate(()=>(window as any).vcHarness.utterances.at(-1).onend());
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='countdown');
    await page.clock.fastForward(1000);await page.locator('#vc-finish').click();
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='completed');
    await page.clock.fastForward(5000);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
    expect(evaluations).toEqual([]);
  });
  it('permission denial offers retry without transmitting a question or switching to text',async()=>{
    await page.evaluate(()=>{const open=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);(window as any).vcHarness.restoreMic=()=>{navigator.mediaDevices.getUserMedia=open};navigator.mediaDevices.getUserMedia=async()=>{throw Error('denied')}});
    await page.locator('#pitch').fill('A workflow tool.');await page.locator('#consent').check();await page.locator('#start-voice').click();
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='error');
    expect(requests).toHaveLength(0);expect(await page.locator('#vc-answer').isEditable()).toBe(false);
    expect(await page.locator('#vc-message').innerText()).toContain('microphone');
    await page.evaluate(()=>(window as any).vcHarness.restoreMic());await page.locator('#vc-answer-start').click();
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='speaking');expect(requests).toHaveLength(1);
  });
  it('playback failure offers replay instead of starting the countdown or recording',async()=>{
    await start(true);
    await page.evaluate(()=>(window as any).vcHarness.utterances.at(-1).onerror());
    await page.locator('#vc-replay').waitFor({state:'visible'});await page.clock.fastForward(4000);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    await page.locator('#vc-replay').click();expect(await page.evaluate(()=>(window as any).vcHarness.utterances.length)).toBe(2);
    expect(await page.locator('#vc-log .vc-turn').count()).toBe(1);
  });
  it('offers replay after failed live clarification playback and then counts down',async()=>{
    await start(true);await spoken();await recognize('We have no competitors.');await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);
    await page.evaluate(()=>(window as any).vcHarness.utterances.at(-1).onerror());await page.locator('#vc-replay').waitFor({state:'visible'});
    await page.locator('#vc-replay').click();await spoken();await recognize('Customers use spreadsheets.');
    expect(await page.locator('#vc-answer').inputValue()).toContain('We have no competitors.');
  });
  it('reopens voice for the next question after confirmed transcript recovery',async()=>{
    await start(true);await spoken();await recognize('Twenty customer interviews.');
    await page.evaluate(()=>(window as any).vcHarness.recognizers.at(-1).onerror({error:'network'}));
    await page.locator('#vc-recovery').waitFor({state:'visible'});await page.locator('#vc-recovery-confirm').check();await page.locator('#vc-submit').click();
    await page.waitForFunction(()=>document.querySelector('#vc-round')?.textContent?.includes('2 / 6'));
    await spoken();expect(await page.locator('#vc-session').getAttribute('data-capture')).toBe('recording');
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.length)).toBe(2);
  });
  it('does not overwrite recovery when recognition fails synchronously on automatic start',async()=>{
    await page.evaluate(()=>{(window as any).SpeechRecognition.prototype.start=()=>{throw Error('recognition unavailable')};});
    await start(true);await spoken(false);for(let i=0;i<3;i++)await page.clock.fastForward(1000);
    await page.locator('#vc-recovery').waitFor({state:'visible'});
    expect(await page.locator('#vc-session').getAttribute('data-capture')).toBe('review');
    expect(await page.locator('#vc-answer').isEditable()).toBe(true);
    expect(await page.locator('#vc-answer-pause').isDisabled()).toBe(true);
    expect(await page.locator('#vc-text-switch').isVisible()).toBe(false);
  });

  it('shows the supplied investor portrait centered above the question on desktop and mobile',async()=>{
    await start();
    const portrait=page.locator('#vc-avatar img');
    expect(await portrait.count()).toBe(1);
    await page.waitForFunction(()=>{const img=document.querySelector('#vc-avatar img') as HTMLImageElement;return img.complete && img.naturalWidth===1254});
    for (const width of [1360,375]) {
      await page.setViewportSize({width,height:1000});
      const image=await portrait.boundingBox();const panel=await page.locator('#vc-session').boundingBox();
      expect(image).not.toBeNull();expect(panel).not.toBeNull();
      expect(Math.abs(image!.x+image!.width/2-panel!.x-panel!.width/2)).toBeLessThan(2);
      expect(image!.height).toBeLessThanOrEqual(width===375 ? 180 : 260);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    expect(await portrait.getAttribute('alt')).toBeTruthy();
    expect(await page.evaluate(()=>!!(document.querySelector('#vc-avatar')!.compareDocumentPosition(document.querySelector('#vc-question')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    expect(await page.locator('#vc-submit').isVisible()).toBe(true);
  });

  it('automatically captures and retains one answer through pause, continue and review',async()=>{
    await page.setViewportSize({width:375,height:812});
    await start(true);expect(await page.evaluate(()=>(window as any).vcHarness.streams.length)).toBe(1);
    await spoken(false);expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    await advanceCountdown();await recognize('Twenty customer interviews.');
    expect(await page.locator('#vc-submit').isDisabled()).toBe(true);
    await page.locator('#vc-answer-pause').click();expect(await page.locator('#vc-answer').inputValue()).toBe('Twenty customer interviews.');
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getAudioTracks().every(t=>!t.enabled)))).toBe(true);
    expect(await page.evaluate(()=>(window as any).vcHarness.recorders.at(-1).state)).toBe('paused');
    expect(requests).toHaveLength(1);expect(await page.locator('[data-speaker="user"]').count()).toBe(0);
    await page.locator('#vc-answer-pause').click();await recognize('We will validate retention.');await page.locator('#vc-answer-end').click();
    expect(await page.locator('#vc-answer').inputValue()).toBe('Twenty customer interviews. We will validate retention.');
    expect(await page.locator('#vc-submit').isDisabled()).toBe(false);expect(requests).toHaveLength(1);
    expect(await page.locator('#vc-audio-box').isVisible()).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#vc-answer').fill('Edited answer for review.');await page.locator('#vc-submit').click();
    expect(await page.locator('[data-speaker="user"]').innerText()).toContain('Edited answer for review.');
    expect(await page.evaluate(()=>(window as any).vcHarness.recorders.at(-1).state)).toBe('paused');
  });

  it('requires explicit consent and a short pitch before any AI transmission',async()=>{
    expect(await page.locator('#start-voice').isDisabled()).toBe(true); await page.locator('#pitch').fill('Pitch');expect(await page.locator('#start-voice').isDisabled()).toBe(true);expect(requests).toEqual([]);
  });
  it('records without automatic subtitles when SpeechRecognition is unavailable',async()=>{
    await page.evaluate(()=>{delete (window as any).SpeechRecognition;delete (window as any).webkitSpeechRecognition;});
    await start(true);await spoken();
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='recording');
    expect(await page.locator('#vc-message').innerText()).toContain('No automatic subtitles');
    await page.locator('#vc-answer-pause').click();await page.locator('#vc-answer-pause').click();await endAnswer();
    expect(await page.locator('#vc-audio-box').isVisible()).toBe(true);await page.locator('#vc-answer').fill('Typed answer accompanying my recording.');await page.locator('#vc-finish').click();await saved();
    expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user')[0].text).toBe('Typed answer accompanying my recording.');
  });
  it('finishing while microphone permission is pending closes the late stream without listening',async()=>{
    await page.evaluate(()=>{const h=(window as any).vcHarness;const open=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(o)=>{await new Promise<void>(r=>{h.releaseMic=r});return open(o);};});
    await page.locator('#pitch').fill('A workflow tool.');await page.locator('#consent').check();await page.locator('#start-voice').click();await page.waitForFunction(()=>!!(window as any).vcHarness.releaseMic);
    await page.locator('#vc-finish').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='completed',null,{timeout:2000});
    await page.evaluate(()=>(window as any).vcHarness.releaseMic());await page.waitForFunction(()=>(window as any).vcHarness.streams.length===1);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);expect(evaluations).toEqual([]);
  });
  it('cancels countdown on pagehide without listening or retaining microphone tracks',async()=>{
    await start(true);await spoken(false);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.clock.fastForward(5000);
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  });
  it('excludes paused time from the 45 second clarification rule',async()=>{
    await page.evaluate(()=>{const h=(window as any).vcHarness;const now=performance.now.bind(performance);h.offset=0;performance.now=()=>now()+h.offset;});
    await start(true);await spoken();await recognize('Customers need simpler tools.');await page.locator('#vc-answer-pause').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='paused');
    await page.evaluate(()=>(window as any).vcHarness.offset+=50000);await page.locator('#vc-answer-pause').click();await recognize('We are testing the workflow.');expect(await page.locator('[data-clarification]').count()).toBe(0);
    await page.evaluate(()=>(window as any).vcHarness.offset+=45000);await recognize('We are testing retention.');await page.locator('[data-clarification]').waitFor();expect(await page.locator('[data-clarification]').count()).toBe(1);
  });
  it('completes six rounds, all roles, frozen contracts and private report metadata',async()=>{
    await page.locator('details summary').click();await page.locator('#deck-text').fill('PRIVATE DECK DETAIL');await start();
    for(let i=0;i<6;i++){await answer(); if(i<5)await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='answering')}
    await expect.poll(async()=>({phase:await page.locator('#vc-session').getAttribute('data-phase'),round:await page.locator('#vc-round').innerText(),answers:await page.locator('[data-speaker="user"]').count(),message:await page.locator('#vc-message').innerText()}),{timeout:4000}).toMatchObject({phase:'completed',answers:6});
    const entry=await saved(); expect(requests).toHaveLength(6);expect(new Set(requests.slice(1).flatMap(p=>p.speakers))).toEqual(new Set(['vision','numbers','legal']));
    expect(SessionLog.safeParse(evaluations[0].log).success).toBe(true);expect(EvaluationReport.safeParse(entry.report).success).toBe(true);
    expect(entry.report.metrics).toMatchObject({vcScoringVersion:1,coreRated:0,answeredRounds:6,mock:1});expect(entry.report.metrics).not.toHaveProperty('coreAverage');
    expect(JSON.stringify(entry)).not.toContain('PRIVATE DECK DETAIL');expect(entry).not.toHaveProperty('log');expect(entry).not.toHaveProperty('vcContext');
  },20000);
  it('ignores duplicate submissions and never advances an empty answer',async()=>{
    await start();await page.locator('#vc-submit').click();expect(requests).toHaveLength(1);await page.locator('#vc-answer').fill('Twenty interviews.');
    await page.evaluate(()=>{const b=document.querySelector('#vc-submit') as HTMLButtonElement;b.click();b.click()});await page.waitForFunction(()=>document.querySelector('#vc-round')?.textContent?.includes('2'));
    expect(requests).toHaveLength(2);expect(await page.locator('[data-speaker="user"]').count()).toBe(1);
  });
  it('pins setup and API/report language across interface switches and retry',async()=>{
    let calls=0;await page.route('**/api/evaluate.php',r=>++calls===1?r.fulfill({status:502,json:{error:'Retry'}}):r.fulfill({json:{scenarioId:'hostile_vc_v1',summary:'Practice',dimensions:[],metrics:{vcScoringVersion:1,coreRated:0}}}));
    await start();await page.locator('#vc-answer').fill('Twenty interviews.');await page.evaluate(()=>(window as any).TPI18n.setLanguage('zh-HK'));await page.locator('#vc-finish').click();await page.locator('#vc-retry').click();await saved();
    expect(evaluations).toHaveLength(2);expect(evaluations[0]).toEqual(evaluations[1]);expect(evaluations[0]._lang).toBe('en');expect(await page.locator('#pitch').isDisabled()).toBe(true);
  });
  it('uses one labelled clarification per round after transcript review',async()=>{
    await start();await answer('We have no competitors.');await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='answering');
    expect(await page.locator('[data-clarification]').count()).toBe(1);await answer('We have no competitors.');await page.waitForFunction(()=>document.querySelector('#vc-round')?.textContent?.includes('2'));
    expect(await page.locator('[data-clarification]').count()).toBe(1);
  });
  it('preserves browser partial speech across a live rule clarification',async()=>{
    await start(true);await spoken();await recognize('We have no competitors.');await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);await spoken();await recognize('Customers use spreadsheets instead.');
    expect(await page.locator('#vc-answer').inputValue()).toContain('We have no competitors.');expect(await page.locator('#vc-answer').inputValue()).toContain('Customers use spreadsheets instead.');
    await page.locator('#vc-finish').click();await saved();expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user')).toHaveLength(1);
  });
  it('finishing during live clarification TTS grades the retained founder answer once',async()=>{
    await start(true);await spoken();await recognize('We have no competitors.');await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);
    expect(await page.locator('#vc-session').getAttribute('data-phase')).toBe('speaking');expect(await page.locator('#vc-answer').inputValue()).toBe('We have no competitors.');
    await page.evaluate(()=>{const b=document.querySelector('#vc-finish') as HTMLButtonElement;b.click();b.click();});await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='completed');
    expect(evaluations).toHaveLength(1);expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user').map((t:any)=>t.text)).toEqual(['We have no competitors.']);
    const recognizers=await page.evaluate(()=>(window as any).vcHarness.recognizers.length);await page.evaluate(()=>(window as any).vcHarness.utterances.at(-1).onend?.());
    expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(recognizers);expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  });
  it('finishing during TTS stops microphones and prevents stale speech from reopening them',async()=>{
    await start(true);await page.locator('#vc-finish').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='completed');
    await page.evaluate(()=>(window as any).vcHarness.utterances[0].onend?.());expect(await page.evaluate(()=>(window as any).vcHarness.recognizers.length)).toBe(0);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);expect(evaluations).toEqual([]);
  });
  it('does not start without microphone recording support',async()=>{
    await page.evaluate(()=>{delete (window as any).MediaRecorder;});await page.locator('#pitch').fill('Pitch');await page.locator('#consent').check();
    expect(await page.locator('#start-voice').isDisabled()).toBe(true);expect(requests).toEqual([]);
  });
  it('drops late moderator responses after pagehide',async()=>{
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r});await page.route('**/api/llm.php',async r=>{await gate;try{await r.fulfill({json:{source:'ai',speaker:'vision',question:'LATE QUESTION'}})}catch{}});
    await page.locator('#pitch').fill('Pitch');await page.locator('#consent').check();await page.locator('#start-voice').click();await page.waitForFunction(()=>(window as any).vcHarness.streams.length===1);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));release();
    await page.waitForTimeout(100);expect(await page.locator('#vc-question').innerText()).not.toContain('LATE QUESTION');
  });
  it('finish during a pending next moderator question grades the retained answer',async()=>{
    await start();let release!:()=>void;const gate=new Promise<void>(r=>{release=r});
    await page.route('**/api/llm.php',async r=>{await gate;try{await r.fulfill({json:{source:'ai',speaker:'numbers',question:'LATE NEXT'}})}catch{}});
    await page.locator('#vc-answer').fill('Twenty customer interviews.');await page.locator('#vc-submit').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='processing');await page.locator('#vc-finish').click();release();
    await saved();expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user')).toHaveLength(1);expect(await page.locator('#vc-question').innerText()).not.toContain('LATE NEXT');
  });
  it('finish during submit-driven investor TTS cancels playback and grades once',async()=>{
    await start(true);await spoken();await recognize('Twenty customer interviews.');await endAnswer();await page.locator('#vc-submit').click();
    await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);await page.locator('#vc-finish').click();await saved();
    expect(evaluations).toHaveLength(1);expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  });
  it('starts a new countdown for a live clarification without losing the earlier answer',async()=>{
    await start(true);await spoken();await recognize('We have no competitors.');await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);
    await spoken(false);expect(await page.locator('#vc-countdown').innerText()).toContain('3');
    expect(await page.locator('#vc-answer').inputValue()).toBe('We have no competitors.');await advanceCountdown();
    await recognize('Customers use spreadsheets.');expect(await page.locator('#vc-answer').inputValue()).toContain('Customers use spreadsheets.');
  });
  it('ending in the next question countdown preserves the submitted answer and cancels capture',async()=>{
    await start(true);await spoken();await recognize('Twenty customer interviews.');await endAnswer();await page.locator('#vc-submit').click();
    await page.waitForFunction(()=>(window as any).vcHarness.utterances.length===2);await spoken(false);await page.locator('#vc-finish').click();await saved();await page.clock.fastForward(5000);
    expect(await page.locator('#vc-round').innerText()).toContain('2 / 6');expect(await page.locator('[data-speaker="user"]').count()).toBe(1);
    expect(await page.evaluate(()=>(window as any).vcHarness.streams.every((s:MediaStream)=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  });
  it('double finish during a held evaluation sends only one evaluation request',async()=>{
    let release!:()=>void;const gate=new Promise<void>(r=>{release=r});
    await page.route('**/api/evaluate.php',async r=>{await gate;try{await r.fulfill({json:{scenarioId:'hostile_vc_v1',summary:'Practice',dimensions:[],metrics:{vcScoringVersion:1,coreRated:0}}})}catch{}});
    await start();await page.locator('#vc-answer').fill('Twenty interviews.');await page.evaluate(()=>{const b=document.querySelector('#vc-finish') as HTMLButtonElement;b.click();b.click()});
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='processing');await page.waitForTimeout(100);expect(evaluations).toHaveLength(1);
    release();await saved();expect(evaluations).toHaveLength(1);
  });
  it('double finish during a held moderator cannot start two grading continuations',async()=>{
    await start();let release!:()=>void;const gate=new Promise<void>(r=>{release=r});
    await page.route('**/api/llm.php',async r=>{await gate;try{await r.fulfill({json:{source:'ai',speaker:'numbers',question:'Late question'}})}catch{}});
    await page.route('**/api/evaluate.php',async r=>{await new Promise(r=>setTimeout(r,200));try{await r.fulfill({json:{scenarioId:'hostile_vc_v1',summary:'Practice',dimensions:[],metrics:{vcScoringVersion:1,coreRated:0}}})}catch{}});
    await page.locator('#vc-answer').fill('Twenty customer interviews.');await page.locator('#vc-submit').click();await page.evaluate(()=>{const b=document.querySelector('#vc-finish') as HTMLButtonElement;b.click();b.click()});release();await saved();expect(evaluations).toHaveLength(1);
  });
  it('keeps original founder quotes through English and Chinese report rendering',async()=>{
    await page.evaluate(()=>{(window as any).TP.store.set('reports',[{id:'vc-quote',scenarioId:'hostile_vc_v1',route:'startup',title:'Hostile VC',createdAt:'2026-10-14',report:{scenarioId:'hostile_vc_v1',summary:'Practice',dimensions:[{key:'evidence',label:'Evidence',score:3,evidence:'我负责数据分析',suggestion:'Evidence described.\nState scope.'}],metrics:{vcScoringVersion:1,coreRated:1,coreAverage:3,assessed_evidence:1}}}])});
    await page.goto(base+'/reports.php?id=vc-quote');expect(await page.locator('blockquote').innerText()).toBe('「我负责数据分析」');await page.evaluate(()=>(window as any).TPI18n.setLanguage('zh-HK'));expect(await page.locator('blockquote').innerText()).toBe('「我负责数据分析」');
  });
  async function cloudStart(text:string, fail=false, held=false) {
    await page.route('**/api/speech.php?vc=1',r=>r.fulfill({json:{provider:'minimax',ready:true,shared:{en:{numbers:true,vision:true,legal:true}}}}));
    await page.reload();await page.evaluate(()=> (window as any).TPI18n.setLanguage('en'));
    await page.evaluate(({text,fail,held})=>{
      const w=window as any;w.cloudHarness={flushes:0,audio:true,speeches:[],closed:false,text};
      w.VcVoice.Voice=class {
        mode='cloud';duration=50; transcript='';static supported(){return true}static recognitionSupported(){return true}
        constructor(public callbacks:any){w.cloudHarness.callbacks=callbacks;}
        async openMic(){return true} listen(){w.cloudHarness.audio=true;} hasAudio(){return w.cloudHarness.audio}
        cancelSpeech(){} async speak(text:string,speaker:string){w.cloudHarness.speeches.push({text,speaker});return true}
        async stopListening(flush:boolean){if(!flush)return ''; w.cloudHarness.flushes++; if(held)await new Promise<void>(r=>{w.cloudHarness.release=r});if(fail)throw Error('transcription failed');w.cloudHarness.audio=false;this.callbacks.onTranscript(w.cloudHarness.text);return w.cloudHarness.text}
        async closeMic(){w.cloudHarness.closed=true;return new Blob(['recording'],{type:'audio/ogg'})}
      };
    },{text,fail,held});
    await start(true);await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-phase')==='countdown');await advanceCountdown();
  }
  it('checks clip rules only after transcription and labels the clarification',async()=>{
    await cloudStart('We have no competitors.');expect(await page.locator('[data-clarification]').count()).toBe(0);
    await endAnswer();await page.locator('#vc-submit').click();await page.waitForFunction(()=>document.querySelector('[data-clarification]')!==null);
    expect(await page.locator('#vc-message').innerText()).toContain('after clip transcription');
    expect(await page.evaluate(()=>(window as any).cloudHarness.flushes)).toBe(1);
    expect(await page.locator('#vc-answer-start').isVisible()).toBe(false);await advanceCountdown();
  });
  it('pauses and ends a cloud answer without duplicating its transcript or flushing twice',async()=>{
    await cloudStart('Twenty customers tested it.');await page.locator('#vc-answer-pause').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='paused');await endAnswer();
    expect(await page.locator('#vc-answer').inputValue()).toBe('Twenty customers tested it.');expect(await page.evaluate(()=>(window as any).cloudHarness.flushes)).toBe(1);expect(requests).toHaveLength(1);
  });
  it('continues a cloud answer with the previous segment and reviews the 60 second cap without submitting',async()=>{
    await cloudStart('Twenty customers tested it.');await page.locator('#vc-answer-pause').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='paused');
    await page.evaluate(()=>(window as any).cloudHarness.text='Next we measure retention.');await page.locator('#vc-answer-pause').click();await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='recording');
    await page.evaluate(()=>(window as any).cloudHarness.callbacks.onAnswerEnd());await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='review');
    expect(await page.locator('#vc-answer').inputValue()).toBe('Twenty customers tested it. Next we measure retention.');expect(await page.evaluate(()=>(window as any).cloudHarness.flushes)).toBe(2);expect(requests).toHaveLength(1);expect(evaluations).toEqual([]);
  });
  it('repeated End and Finish during pending transcription flush once and evaluate once',async()=>{
    await cloudStart('Twenty customers tested it.',false,true);await page.evaluate(()=>{const b=document.querySelector('#vc-answer-end') as HTMLButtonElement;b.click();b.click();});await page.waitForFunction(()=>!!(window as any).cloudHarness.release);
    await page.evaluate(()=>{const b=document.querySelector('#vc-finish') as HTMLButtonElement;b.click();b.click();});expect(evaluations).toEqual([]);await page.evaluate(()=>(window as any).cloudHarness.release());await saved();
    expect(await page.evaluate(()=>(window as any).cloudHarness.flushes)).toBe(1);expect(evaluations).toHaveLength(1);expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user').map((t:any)=>t.text)).toEqual(['Twenty customers tested it.']);
  });
  it('finish waits for pending cloud audio before grading and records the actual transcript once',async()=>{
    await cloudStart('Twenty customers tested it.',false,true);await page.locator('#vc-finish').click();
    await page.waitForFunction(()=>!!(window as any).cloudHarness.release);expect(evaluations).toEqual([]);
    await page.evaluate(()=>(window as any).cloudHarness.release());await saved();expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user').map((t:any)=>t.text)).toEqual(['Twenty customers tested it.']);
  });
  it('does not allow a hidden text switch to interrupt an active clip flush',async()=>{
    await cloudStart('Twenty customers tested it.',false,true);await page.locator('#vc-answer-end').click();await page.waitForFunction(()=>!!(window as any).cloudHarness.release);
    await page.evaluate(()=>(document.querySelector('#vc-text-switch') as HTMLButtonElement).click());await page.evaluate(()=>(window as any).cloudHarness.release());
    await page.waitForFunction(()=>document.querySelector('#vc-session')?.getAttribute('data-capture')==='review');expect(await page.locator('#vc-answer').inputValue()).toContain('Twenty customers tested it.');expect(await page.locator('[data-speaker="user"]').count()).toBe(0);
    expect(await page.evaluate(()=>(window as any).cloudHarness.closed)).toBe(false);expect(evaluations).toEqual([]);
  });
  it('finishing flushes clip text, closes capture and downloads with the actual recording MIME',async()=>{
    await cloudStart('Twenty customers tested it.');await page.locator('#vc-finish').click();await saved();
    expect(evaluations[0].log.turns.find((t:any)=>t.speaker==='user').text).toBe('Twenty customers tested it.');expect(await page.evaluate(()=>(window as any).cloudHarness.closed)).toBe(true);
    expect(await page.locator('#vc-download').getAttribute('download')).toBe('vc-microphone.ogg');
    const download=page.waitForEvent('download');await page.locator('#vc-download').click();expect(await(await download).failure()).toBeNull();
  });
  it('failed clip flush requires explicit text recovery before grading',async()=>{
    await cloudStart('not transcribed',true);await page.evaluate(()=>(window as any).cloudHarness.callbacks.onTranscript('Earlier retained segment.'));await page.locator('#vc-finish').click();await page.locator('#vc-recovery').waitFor({state:'visible'});expect(evaluations).toEqual([]);expect(await page.locator('#vc-answer').inputValue()).toBe('Earlier retained segment.');
    await page.locator('#vc-answer').fill('I reconstructed my answer.');await page.locator('#vc-finish').click();expect(evaluations).toEqual([]);
    await page.locator('#vc-recovery-confirm').check();await page.locator('#vc-finish').click();await saved();expect(evaluations[0].log.turns.filter((t:any)=>t.speaker==='user')[0].text).toBe('I reconstructed my answer.');
  });
  it('recognition failure retains partial text and real mic recording for playback/download',async()=>{
    await start(true);await spoken();await recognize('Twenty interviews were completed.');
    await page.waitForFunction(()=>(window as any).vcHarness.recordedBytes>0);
    await page.evaluate(()=>{const h=(window as any).vcHarness;h.recognizers.at(-1).onerror?.({error:'network'})});
    await page.waitForFunction(()=>document.querySelector('#vc-audio-box')?.hasAttribute('hidden')===false);
    expect(await page.locator('#vc-answer').inputValue()).toBe('Twenty interviews were completed.');
    expect(await page.locator('#vc-download').getAttribute('download')).toMatch(/\.(webm|m4a|ogg)$/);
    await page.waitForFunction(()=>(document.querySelector('#vc-audio') as HTMLAudioElement).readyState>=1);
    const download=page.waitForEvent('download');await page.locator('#vc-download').click();expect(await(await download).failure()).toBeNull();
  },15000);
  it('fits a 375px viewport and exposes all three investor identities',async()=>{
    await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.vc-investor').count()).toBe(3);await start();expect(await page.locator('#vc-answer-controls').isVisible()).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
  it('extracts a real local PDF with local worker and no raw file transmission',async()=>{
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    const stream='BT /F1 18 Tf 20 100 Td (VC deck text test) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}
    const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())});
    await page.locator('details summary').click();await page.locator('#vc-pdf').setInputFiles({name:'deck.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)});
    await expect.poll(()=>page.locator('#deck-text').inputValue(),{timeout:5000}).toContain('VC deck text test');expect(posts).toEqual([]);
  },10000);
});
