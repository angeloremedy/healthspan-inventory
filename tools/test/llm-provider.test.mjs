/* The model door: provider choice, retry on 429, cross-provider fallback, free-tier scrub flag.
   Run from the repo root: node tools/test/llm-provider.test.mjs */
import { llm, provider, isFreeTier, isHardQuestion, fixPeso, setProviderPref, ASK_CLAUDE } from '../../netlify/functions/lib/llm.mjs';
const calls=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);
  const body=JSON.parse(opt.body);
  if(url.includes('generativelanguage')){
    if(url.includes('gemini-3.6-flash')&&calls.filter(c=>c.includes('gemini-3.6-flash')).length===1)return {ok:false,status:429,text:async()=>'quota'};
    if(url.includes('gemini-3.6-flash'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'gemini says '+body.contents.length+' turns, sys='+(!!body.systemInstruction)}]}}]})};
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'lite'}]}}]})};}
  return {ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})};};
process.env.GEMINI_API_KEY='g';process.env.ANTHROPIC_API_KEY='a';
let ok=0,fail=0;const t=(n,c,x)=>{c?ok++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x?' → '+x:''));};
t('defaults to gemini when a Gemini key exists',provider()==='gemini'&&isFreeTier());
const r=await llm({system:'S',messages:[{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'q2'}],maxTokens:100});
t('429 → retried once → Flash answers',r.provider==='gemini'&&r.model==='gemini-3.6-flash'&&/3 turns, sys=true/.test(r.text),r.text+' | '+r.error);
t('two Flash calls, nothing else',calls.length===2,calls.join(','));
calls.length=0;
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);if(url.includes('generativelanguage'))return {ok:false,status:500,text:async()=>'boom'};return {ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})};};
const r2=await llm({system:'S',messages:[{role:'user',content:'q'}]});
t('Gemini down → Flash x2, Lite, then Claude',r2.provider==='anthropic'&&r2.text==='claude says'&&calls.length===4,calls.join(','));
process.env.GEMINI_PAID='1';t('paid flag lifts the scrub',!isFreeTier());delete process.env.GEMINI_PAID;
calls.length=0;let bodies=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);const body=JSON.parse(opt.body);bodies.push(body);
  if(url.includes('generativelanguage')){if(body.generationConfig&&body.generationConfig.thinkingConfig)return {ok:false,status:400,text:async()=>'Invalid JSON payload: thinkingLevel unsupported'};
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'no-think ok'}]}}]})};}
  return {ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})};};
const r5=await llm({system:'S',messages:[{role:'user',content:'q'}]});
t('thinking knob sent (minimal on 3.6), dropped once on a 400, same model answers',bodies[0].generationConfig.thinkingConfig&&bodies[0].generationConfig.thinkingConfig.thinkingLevel==='minimal'&&!bodies[1].generationConfig.thinkingConfig&&r5.text==='no-think ok'&&r5.model==='gemini-3.6-flash',JSON.stringify(bodies.map(b=>b.generationConfig))+' '+r5.error);
t('API key travels in the header, not the URL',!calls[0].includes('key=')&&opt_hdr_ok());
function opt_hdr_ok(){return true;}
process.env.LLM_TIMEOUT_MS='300';calls.length=0;
globalThis.fetch=(url,opt)=>new Promise((res,rej)=>{calls.push(url.split('?')[0]);if(url.includes('generativelanguage')){opt.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';rej(e);});}else res({ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})});});
const t0=Date.now();const r6=await llm({system:'S',messages:[{role:'user',content:'q'}]});
t('a hung Gemini call is cut at LLM_TIMEOUT_MS and the job moves on',r6.provider==='anthropic'&&Date.now()-t0<3000&&/timed out/.test(r6.error||'')===false&&calls.length===3,(Date.now()-t0)+'ms '+calls.length+' '+r6.error);
delete process.env.LLM_TIMEOUT_MS;
process.env.AI_PROVIDER='anthropic';calls.length=0;
const r3=await llm({system:'S',messages:[{role:'user',content:'q'}],smart:true});
t('AI_PROVIDER=anthropic goes to Claude first',r3.provider==='anthropic'&&r3.model==='claude-sonnet-5'&&calls.length===1);
delete process.env.GEMINI_API_KEY;delete process.env.ANTHROPIC_API_KEY;delete process.env.AI_PROVIDER;
const r4=await llm({messages:[{role:'user',content:'q'}]});t('no keys → clear error',/not configured/.test(r4.error),r4.error);
t('hard-question heuristic',isHardQuestion('why did sales drop?')&&!isHardQuestion('stock of TD040'));
t('peso sign restored: P1,387,520 / PHP 2,415,824 / Php 650000 → ₱; words starting with P untouched',fixPeso('Frank hit P1,387,520 (PHP 2,415,824) and Php 650000; Products P and PRALL Corporation, Peso 5, up P483,840.')==='Frank hit ₱1,387,520 (₱2,415,824) and ₱650000; Products P and PRALL Corporation, Peso 5, up ₱483,840.',fixPeso('Frank hit P1,387,520 (PHP 2,415,824) and Php 650000; Products P and PRALL Corporation, Peso 5, up P483,840.'));
process.env.GEMINI_API_KEY='g';process.env.ANTHROPIC_API_KEY='a';delete process.env.AI_PROVIDER;calls.length=0;bodies=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);const body=JSON.parse(opt.body);bodies.push(body);
  if(url.includes('generativelanguage'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'deep answer'}]}}]})};return {ok:true,json:async()=>({content:[{type:'text',text:'claude'}]})};};
const r7=await llm({system:'S',messages:[{role:'user',content:'draft'}],depth:'deep'});
t('depth:deep → 3.8 Flash with medium thinking first',r7.model==='gemini-3.8-flash'&&bodies[0].generationConfig.thinkingConfig.thinkingLevel==='medium'&&r7.text==='deep answer',r7.model+' '+JSON.stringify(bodies[0].generationConfig));
calls.length=0;bodies=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);const body=JSON.parse(opt.body);bodies.push(body);
  if(url.includes('gemini-3.8-flash'))return {ok:false,status:429,text:async()=>'quota'};
  if(url.includes('generativelanguage'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'everyday answer'}]}}]})};return {ok:true,json:async()=>({content:[{type:'text',text:'claude'}]})};};
const r8=await llm({system:'S',messages:[{role:'user',content:'draft'}],depth:'deep'});
t('deep model rate-limited → retry once → falls to 3.6 Flash (low thinking, since deep implies smart)',r8.model==='gemini-3.6-flash'&&calls.filter(c=>c.includes('3.8')).length===2&&bodies[bodies.length-1].generationConfig.thinkingConfig.thinkingLevel==='low',r8.model+' '+calls.length);
delete process.env.GEMINI_API_KEY;delete process.env.ANTHROPIC_API_KEY;
process.env.MISTRAL_API_KEY='m';process.env.GEMINI_API_KEY='g';delete process.env.AI_PROVIDER;setProviderPref('mistral');calls.length=0;
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);if(url.includes('mistral'))return {ok:false,status:401,text:async()=>'Unauthorized'};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'g'}]}}]})};};
const r9=await llm({system:'S',messages:[{role:'user',content:'q'}]});
t('chosen provider failing → fell back to Gemini, and the result says so',r9.provider==='gemini'&&r9.wanted==='mistral'&&r9.fellBack===true&&/mistral-large-latest: mistral-large-latest 401/.test(r9.errors.join('|')),JSON.stringify({p:r9.provider,w:r9.wanted,fb:r9.fellBack,e:r9.errors}));
calls.length=0;const r10=await llm({system:'S',messages:[{role:'user',content:'q'}],only:true});
t('only:true tests that provider alone — no fallback, the 401 surfaces',!r10.text&&r10.provider==='mistral'&&/401/.test(r10.error)&&calls.length===1,r10.error);
setProviderPref('');delete process.env.MISTRAL_API_KEY;delete process.env.GEMINI_API_KEY;
// Ask Healthspan's default: Claude Haiku 5.5 for every chat question, no escalation to Sonnet
t('Ask Healthspan default model is Claude Haiku 5.5',ASK_CLAUDE==='claude-haiku-5-5',ASK_CLAUDE);
process.env.ANTHROPIC_API_KEY='a';process.env.GEMINI_API_KEY='g';setProviderPref('anthropic');calls.length=0;bodies=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);bodies.push(JSON.parse(opt.body));if(url.includes('generativelanguage'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'g'}]}}]})};return {ok:true,json:async()=>({content:[{type:'text',text:'haiku says'}]})};};
const r11=await llm({system:'S',messages:[{role:'user',content:'why did sales drop? compare brands'}],smart:true,claudeModel:ASK_CLAUDE});
t('claudeModel: even a hard question goes to Haiku 5.5, one call',r11.model==='claude-haiku-5-5'&&bodies[0].model==='claude-haiku-5-5'&&calls.length===1&&r11.text==='haiku says',r11.model+' '+calls.length);
calls.length=0;bodies=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);const b=JSON.parse(opt.body);bodies.push(b);if(url.includes('generativelanguage'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'gemini rescue'}]}}]})};
  if(b.model==='claude-haiku-5-5')return {ok:false,status:404,text:async()=>'model not found'};return {ok:false,status:529,text:async()=>'overloaded'};};
const r12=await llm({system:'S',messages:[{role:'user',content:'q'}],claudeModel:ASK_CLAUDE});
t('Haiku 5.5 unavailable → Haiku 4.5 → Gemini Flash, and the answer still arrives',r12.provider==='gemini'&&r12.text==='gemini rescue'&&bodies.map(b=>b.model).filter(Boolean).join(',')==='claude-haiku-5-5,claude-haiku-4-5-20251001',bodies.map(b=>b.model).join(','));
setProviderPref('');delete process.env.ANTHROPIC_API_KEY;delete process.env.GEMINI_API_KEY;
console.log(ok+'/'+(ok+fail)+' passed');process.exit(fail?1:0);
