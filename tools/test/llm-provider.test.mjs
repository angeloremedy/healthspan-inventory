/* The model door: provider choice, retry on 429, cross-provider fallback, free-tier scrub flag.
   Run from the repo root: node tools/test/llm-provider.test.mjs */
import { llm, provider, isFreeTier, isHardQuestion } from '../../netlify/functions/lib/llm.mjs';
const calls=[];
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);
  const body=JSON.parse(opt.body);
  if(url.includes('generativelanguage')){
    if(url.includes('gemini-flash-latest')&&calls.filter(c=>c.includes('gemini-flash-latest')).length===1)return {ok:false,status:429,text:async()=>'quota'};
    if(url.includes('gemini-flash-latest'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'gemini says '+body.contents.length+' turns, sys='+(!!body.systemInstruction)}]}}]})};
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'lite'}]}}]})};}
  return {ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})};};
process.env.GEMINI_API_KEY='g';process.env.ANTHROPIC_API_KEY='a';
let ok=0,fail=0;const t=(n,c,x)=>{c?ok++:fail++;console.log((c?'PASS ':'FAIL ')+n+(x?' → '+x:''));};
t('defaults to gemini when a Gemini key exists',provider()==='gemini'&&isFreeTier());
const r=await llm({system:'S',messages:[{role:'user',content:'q1'},{role:'assistant',content:'a1'},{role:'user',content:'q2'}],maxTokens:100});
t('429 → retried once → Flash answers',r.provider==='gemini'&&r.model==='gemini-flash-latest'&&/3 turns, sys=true/.test(r.text),r.text+' | '+r.error);
t('two Flash calls, nothing else',calls.length===2,calls.join(','));
calls.length=0;
globalThis.fetch=async(url,opt)=>{calls.push(url.split('?')[0]);if(url.includes('generativelanguage'))return {ok:false,status:500,text:async()=>'boom'};return {ok:true,json:async()=>({content:[{type:'text',text:'claude says'}]})};};
const r2=await llm({system:'S',messages:[{role:'user',content:'q'}]});
t('Gemini down → Flash x2, Lite, then Claude',r2.provider==='anthropic'&&r2.text==='claude says'&&calls.length===4,calls.join(','));
process.env.GEMINI_PAID='1';t('paid flag lifts the scrub',!isFreeTier());delete process.env.GEMINI_PAID;
process.env.AI_PROVIDER='anthropic';calls.length=0;
const r3=await llm({system:'S',messages:[{role:'user',content:'q'}],smart:true});
t('AI_PROVIDER=anthropic goes to Claude first',r3.provider==='anthropic'&&r3.model==='claude-sonnet-5'&&calls.length===1);
delete process.env.GEMINI_API_KEY;delete process.env.ANTHROPIC_API_KEY;delete process.env.AI_PROVIDER;
const r4=await llm({messages:[{role:'user',content:'q'}]});t('no keys → clear error',/not configured/.test(r4.error),r4.error);
t('hard-question heuristic',isHardQuestion('why did sales drop?')&&!isHardQuestion('stock of TD040'));
console.log(ok+'/'+(ok+fail)+' passed');process.exit(fail?1:0);
