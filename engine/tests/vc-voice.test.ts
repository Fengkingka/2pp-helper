import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
function setup() {
  const root:any={setTimeout,clearTimeout,Blob,AbortController,FormData,navigator:{mediaDevices:{}},fetch:vi.fn(),URL:{createObjectURL:vi.fn(()=> 'blob:vc'),revokeObjectURL:vi.fn()},Audio:class{},cancelAnimationFrame(){}};
  for (const f of ['interview-demo','interview-conversation','vc-voice']) {
    const p=fileURLToPath(new URL(`../../site/assets/js/${f}.js`,import.meta.url)); if(existsSync(p)) runInNewContext(readFileSync(p,'utf8'),{window:root});
  }
  expect(root.VcVoice,'VC speech wrapper missing').toBeDefined(); return root;
}
describe('VC speech composition',()=>{
  it('gates recording and microphone tracks while retaining chunks across answer segments',async()=>{
    const r=setup(); const track={enabled:true,stop:vi.fn()};
    r.navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]});
    r.MediaRecorder=class {state='inactive';mimeType='audio/webm';ondataavailable:any;onstop:any;static isTypeSupported(){return true} start(){this.state='recording'} pause(){this.state='paused'} resume(){this.state='recording'} stop(){this.state='inactive';this.ondataavailable({data:new Blob(['last'])});this.onstop?.()}};
    const v=new r.VcVoice.Voice({}, {mode:'browser',language:'en'});
    await v.openMic(); expect(v.input.recorder.state).toBe('paused');expect(track.enabled).toBe(false);
    v.listen();expect(v.input.recorder.state).toBe('recording');expect(track.enabled).toBe(true);
    v.input.recorder.ondataavailable({data:new Blob(['first'])});
    await v.stopListening(true);expect(v.input.recorder.state).toBe('paused');expect(track.enabled).toBe(false);
    v.listen();expect(v.input.chunks).toHaveLength(1);await v.stopListening(true);
    const blob=await v.closeMic();expect(await blob.text()).toBe('firstlast');expect(track.stop).toHaveBeenCalledOnce();
  });
  it('records without browser recognition and separates media support from subtitles',()=>{
    const r=setup();r.navigator.mediaDevices.getUserMedia=vi.fn();r.MediaRecorder=class{};
    expect(r.VcVoice.Voice.supported()).toBe(true);expect(r.VcVoice.Voice.recognitionSupported()).toBe(false);
    const v=new r.VcVoice.Voice({}, {mode:'browser',language:'en'});expect(()=>v.listen()).not.toThrow();
  });
  it('browser ASR can use cloud TTS and sends only a whitelisted speaker',async()=>{
    const r=setup(); r.fetch.mockResolvedValue({ok:true,blob:async()=>new Blob(['sound'])});
    const player:any={play:vi.fn(async function(this:any){this.onplaying?.();this.onended?.();}),pause:vi.fn(),removeAttribute:vi.fn(),load:vi.fn()}; r.Audio=class{constructor(){return player}};
    const v=new r.VcVoice.Voice({}, {mode:'browser',cloudTts:true,endpoint:'/api/speech.php',language:'zh-HK'});
    expect(await v.speak('你好','legal')).toBe(true);
    expect(JSON.parse(r.fetch.mock.calls[0][1].body)).toEqual({action:'speak',language:'zh-HK',text:'你好',speaker:'legal'});
    await expect(v.speak('bad','arbitrary')).rejects.toThrow();
  });
  it('cancels late cloud synthesis without creating playback',async()=>{
    const r=setup(); let release:any; r.fetch.mockImplementation(()=>new Promise(resolve=>{release=resolve}));
    const v=new r.VcVoice.Voice({}, {mode:'browser',cloudTts:true,endpoint:'/api/speech.php',language:'en'});
    const speaking=v.speak('hello','vision'); v.cancelSpeech(); release({ok:true,blob:async()=>new Blob(['sound'])});
    expect(await speaking).toBe(false); expect(r.URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('browser voice selection never chooses Mandarin for Cantonese',()=>{
    const r=setup(); const candidates=[{lang:'zh-CN'},{lang:'en-US'},{lang:'yue-HK'},{lang:'zh-HK'}];
    expect(r.VcVoice.eligible(candidates,'zh-HK')).toEqual(candidates.slice(2));
    expect(r.VcVoice.eligible([{lang:'zh-CN'}],'zh-HK')).toEqual([]);
  });
});
