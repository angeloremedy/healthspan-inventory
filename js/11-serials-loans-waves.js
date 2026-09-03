/* ══════════════════ js/11 — typeahead · serials · loaners · waves · CRM activity ══════════════════
   Loaded after js/10 (classic script, global scope, order matters — index.html). */

/* ── TYPEAHEAD — replaces native <datalist> on the big pickers ──
   iPadOS Safari struggles with <datalist> once it holds hundreds of options: the
   suggestion overlay eats keystrokes and the cursor jumps mid-word, which is what
   made the CRM form near-untypable on the iPad. This is a plain filtered dropdown —
   no native widget, ten matches, tap or arrow-enter to pick. */
function attachTypeahead(el,getOpts){
  if(!el)return;
  el.removeAttribute('list');el.setAttribute('autocomplete','off');
  el.setAttribute('autocorrect','off');el.setAttribute('autocapitalize','off');el.setAttribute('spellcheck','false');
  const host=el.parentNode;
  if(host&&getComputedStyle(host).position==='static')host.style.position='relative';
  let box=null,hi=-1,cur=[];
  const close=()=>{if(box){box.remove();box=null;}hi=-1;cur=[];};
  const pick=v=>{el.value=v;el._taPicked=true;close();
    // both events, like the native datalist did: oninput handlers (the deal
    // pricing selector on New order) and onchange handlers both have to fire
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:false}));};
  const paint=()=>{
    if(!cur.length){close();return;}
    if(!box){
      box=document.createElement('div');
      box.style.cssText='position:absolute;z-index:60;left:0;right:0;background:var(--sf);border:1px solid var(--bd);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:260px;overflow-y:auto';
      box.style.top=(el.offsetTop+el.offsetHeight+4)+'px';
      host.appendChild(box);
    }
    box.innerHTML=cur.map((v,i)=>'<div data-i="'+i+'" style="padding:10px 12px;font-size:14px;cursor:pointer;border-bottom:1px solid var(--bd);'+(i===hi?'background:var(--sf2)':'')+'">'+esc(v)+'</div>').join('');
    box.querySelectorAll('[data-i]').forEach(n=>{
      // mousedown, not click: the input's blur would close the box first.
      // Touch: select on touchEND only if the finger did not move — a drag is a
      // scroll of the list, and this feature exists BECAUSE of the iPad.
      n.addEventListener('mousedown',e=>{e.preventDefault();pick(cur[+n.dataset.i]);});
      let moved=false;
      n.addEventListener('touchstart',()=>{moved=false;},{passive:true});
      n.addEventListener('touchmove',()=>{moved=true;},{passive:true});
      n.addEventListener('touchend',e=>{if(!moved){e.preventDefault();pick(cur[+n.dataset.i]);}},{passive:false});
    });
  };
  el.addEventListener('input',()=>{
    if(el._taPicked){el._taPicked=false;return;}   // the pick's own input event
    const q=el.value.trim().toLowerCase();hi=-1;
    if(q.length<1){close();return;}
    const opts=getOpts()||[];
    const starts=[],has=[];
    for(const o of opts){
      const l=String(o).toLowerCase();
      if(l.startsWith(q))starts.push(o);else if(l.includes(q))has.push(o);
      if(starts.length>=10)break;
    }
    cur=starts.concat(has).slice(0,10);
    paint();
  });
  el.addEventListener('keydown',e=>{
    if(!box)return;
    if(e.key==='ArrowDown'){hi=Math.min(cur.length-1,hi+1);paint();e.preventDefault();}
    else if(e.key==='ArrowUp'){hi=Math.max(0,hi-1);paint();e.preventDefault();}
    else if(e.key==='Enter'&&hi>=0){pick(cur[hi]);e.preventDefault();}
    else if(e.key==='Escape')close();
  });
  el.addEventListener('blur',()=>setTimeout(close,200));
}
/* the account list every picker shares (sheet + Shopify names, pull-outs excluded) */
function acctNames(){
  return [...new Set([...Object.keys((SHOPIFY&&SHOPIFY.customers)||{}),...(CUSTOMERS||[]).map(c=>c.name)])]
    .filter(a=>a&&!/pull\s*-?\s*out/i.test(a)).sort();
}

/* ── SERIAL NUMBERS — one row per physical unit (equipment) ── */
let SERIALS=null;
async function loadSerials(force){
  if(SERIALS&&!force)return SERIALS;
  try{const {data,error}=await SB.from('serials').select('*').order('id',{ascending:false}).limit(2000);
    if(error)throw error;SERIALS=data||[];window._serErr=null;}catch(e){SERIALS=SERIALS||[];window._serErr=e.message||String(e);}
  return SERIALS;
}
function canSerials(){return roleIn('admin','supply_chain')||(typeof isSuper==='function'&&isSuper());}
async function renderSerials(){
  loadingHint();
  await loadSerials(true);
  const f=window._serF||'all';
  const rows=(SERIALS||[]).filter(s=>f==='all'||s.status===f);
  const n=st=>(SERIALS||[]).filter(s=>s.status===st).length;
  const pill=st=>st==='in_stock'?'<span class="pill pgr">in stock</span>':st==='on_loan'?'<span class="pill pam">on loan</span>':st==='sold'?'<span class="pill pbl">sold</span>':'<span class="pill prd">disposed</span>';
  const tabs=[['all','All ('+(SERIALS||[]).length+')'],['in_stock','In stock ('+n('in_stock')+')'],['on_loan','On loan ('+n('on_loan')+')'],['sold','Sold ('+n('sold')+')'],['disposed','Disposed ('+n('disposed')+')']];
  const fld='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:16px"';
  const flbl='style="font-size:11px;color:var(--tx3);font-weight:600"';
  $('content').innerHTML=
    '<div class="tabs" style="margin-bottom:12px">'+tabs.map(([k,l])=>'<div class="tab'+(f===k?' active':'')+'" onclick="window._serF=\''+k+'\';renderSerials()">'+l+'</div>').join('')+'</div>'+
    (canSerials()?'<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Add serials — at receiving, or to register existing equipment</div>'+
      '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px"><div><label '+flbl+'>SKU / EQUIPMENT</label>'+
      '<input id="ser-sku" placeholder="Start typing — e.g. INVESTA, INTHERA, SkinPen" '+fld+'></div>'+
      '<div><label '+flbl+'>BATCH (OPTIONAL)</label><input id="ser-batch" '+fld+'></div></div>'+
      '<label '+flbl.replace('style="','style="display:block;margin-top:8px;')+'>SERIAL NUMBERS — one per line</label>'+
      '<textarea id="ser-list" rows="3" placeholder="SN-2026-0001&#10;SN-2026-0002" '+fld+'></textarea>'+
      '<div style="display:flex;gap:10px;align-items:center;margin-top:8px"><button onclick="serAdd()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer">Add serials</button><span id="ser-msg" class="mu" style="font-size:12px"></span></div></div>':'')+
    (rows.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Serial</th><th>SKU</th><th>Product</th><th>Batch</th><th>Status</th><th>Ref / note</th><th>Added</th>'+(canSerials()?'<th></th>':'')+'</tr></thead><tbody>'+
      rows.map(s=>{const p=DATA.find(x=>x.sku===s.sku);
        return '<tr><td style="font-weight:700">'+esc(s.serial)+'</td><td class="mu" style="font-size:11px">'+esc(s.sku)+'</td>'+
        '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc((p&&p.name)||'—')+'</td><td class="mu">'+esc(s.batch||'—')+'</td>'+
        '<td>'+pill(s.status)+'</td><td class="mu" style="font-size:11.5px;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(s.sold_ref||s.note||'')+'</td>'+
        '<td class="mu" style="font-size:11px">'+esc((s.created_at||'').slice(0,10))+(s.created_name?' · '+esc(s.created_name):'')+'</td>'+
        (canSerials()?'<td style="white-space:nowrap">'+
          (s.status==='in_stock'?'<a href="#" onclick="serMark('+s.id+',\'sold\');return false" style="color:var(--bl);font-size:11.5px">sold</a> · <a href="#" onclick="serMark('+s.id+',\'disposed\');return false" style="color:var(--rd);font-size:11.5px">dispose</a>':'')+
          (s.status==='sold'||s.status==='disposed'?'<a href="#" onclick="serMark('+s.id+',\'in_stock\');return false" style="color:var(--gr);font-size:11.5px">back to stock</a>':'')+
          '</td>':'')+'</tr>';}).join('')+
      '</tbody></table></div><div class="tfooter"><span>One row per physical unit. Consumables stay batch-tracked — serials are for equipment (lasers, devices). On-loan units are managed from Demo / loaners; a check-out and a return move the status here automatically.</span></div></div>'
      :'<div class="empty" style="margin-top:30px">'+(window._serErr?'Could not load serials — '+esc(window._serErr)+'. If the table does not exist yet, run the SQL block from SUPABASE-SETUP.md.':'No serials'+(f==='all'?' yet — add the equipment units above':' with this status')+'.')+'</div>');
  attachTypeahead($('ser-sku'),()=>DATA.map(p=>p.sku+' — '+p.name));
}
async function serAdd(){
  const msg=$('ser-msg');
  const skuRaw=($('ser-sku')&&$('ser-sku').value||'').trim();
  const sku=(skuRaw.split(' — ')[0]||'').trim();
  const batch=($('ser-batch')&&$('ser-batch').value||'').trim()||null;
  const list=($('ser-list')&&$('ser-list').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(!sku||!list.length){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick the SKU and give at least one serial.';}return;}
  try{
    const rows=list.map(serial=>({sku,serial,batch,created_by:(SBUSER&&SBUSER.id)||null,created_name:(SBPROFILE&&SBPROFILE.name)||''}));
    const {error}=await SB.from('serials').insert(rows);
    if(error)throw new Error(/duplicate/i.test(error.message)?'One of those serials already exists for this SKU.':error.message);
    audit('serial.add',{sku,n:rows.length});
    if(msg){msg.style.color='var(--gr)';msg.textContent=rows.length+' serial'+(rows.length>1?'s':'')+' added.';}
    if($('ser-list'))$('ser-list').value='';
    keepScroll();renderSerials();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not add: '+(e.message||e);}}
}
async function serMark(id,status){
  const s=(SERIALS||[]).find(x=>x.id===id);if(!s)return;
  let ref=null;
  if(status==='sold'){ref=prompt('Order / DR reference for the sale of '+s.serial+':');if(ref===null)return;}
  if(status==='disposed'&&!confirm('Mark '+s.serial+' disposed?'))return;
  try{
    // guard on the CURRENT status so a console call cannot stomp an open loan,
    // and check the row count — RLS answers a refused update with 0 rows, no error
    const expect=status==='in_stock'?['sold','disposed']:['in_stock'];
    const {data:up,error}=await SB.from('serials').update({status,sold_ref:status==='sold'?(ref||'').trim()||null:null,updated_at:new Date().toISOString()})
      .eq('id',id).in('status',expect).select('id');
    if(error)throw new Error(error.message);
    if(!up||!up.length)throw new Error('No change — the unit is not in a state that allows this (refresh the page).');
    audit('serial.'+status,{serial:s.serial,sku:s.sku,ref});
    keepScroll();renderSerials();
  }catch(e){alert('Could not update: '+(e.message||e));}
}

/* ── DEMO / LOANER UNITS — a serial checked out to a clinic ── */
let LOANS=null;
async function loadLoans(force){
  if(LOANS&&!force)return LOANS;
  try{const {data,error}=await SB.from('loans').select('*').order('id',{ascending:false}).limit(1000);
    if(error)throw error;LOANS=data||[];}catch(e){LOANS=LOANS||[];}
  return LOANS;
}
function canLoans(){return roleIn('admin','supply_chain','manager')||(typeof isSuper==='function'&&isSuper());}
const loanNo=id=>docNo('loan',id);
async function renderLoans(){
  loadingHint();
  await Promise.all([loadLoans(true),loadSerials(true)]);
  const today=new Date().toISOString().slice(0,10);
  const out=(LOANS||[]).filter(l=>l.status==='out');
  const past=(LOANS||[]).filter(l=>l.status!=='out').slice(0,60);
  const overdue=out.filter(l=>l.due_date&&l.due_date<today);
  const free=(SERIALS||[]).filter(s=>s.status==='in_stock');
  const days=l=>l.due_date?Math.round((new Date(today)-new Date(l.due_date))/864e5):null;
  const fld='style="width:100%;box-sizing:border-box;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:11px;font-size:16px"';
  const flbl='style="font-size:11px;color:var(--tx3);font-weight:600"';
  const flblT='style="font-size:11px;color:var(--tx3);font-weight:600;display:block;margin-top:8px"';
  $('content').innerHTML=
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met am"><div class="met-lbl">Out on loan</div><div class="met-val">'+out.length+'</div><div class="met-sub">units with clinics now</div><div class="met-bar"></div></div>'+
    '<div class="met rd"><div class="met-lbl">Overdue</div><div class="met-val">'+overdue.length+'</div><div class="met-sub">past their due-back date</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Available to lend</div><div class="met-val">'+free.length+'</div><div class="met-sub">serialized units in stock</div><div class="met-bar"></div></div>'+
    '<div class="met bl"><div class="met-lbl">Converted to sales</div><div class="met-val">'+(LOANS||[]).filter(l=>l.status==='converted').length+'</div><div class="met-sub">demos that closed</div><div class="met-bar"></div></div>'+
    '</div>'+
    (canLoans()?'<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Check a unit out</div>'+
      (free.length?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      '<div><label '+flbl+'>UNIT</label><select id="ln-ser" '+fld+'>'+
        free.map(s=>{const p=DATA.find(x=>x.sku===s.sku);return '<option value="'+s.id+'">'+esc(s.serial)+' — '+esc((p&&p.name)||s.sku)+'</option>';}).join('')+'</select></div>'+
      '<div><label '+flbl+'>DUE BACK</label><input id="ln-due" type="date" value="'+new Date(Date.now()+30*864e5).toISOString().slice(0,10)+'" '+fld+'></div></div>'+
      '<label '+flblT+'>ACCOUNT / CLINIC</label>'+
      '<input id="ln-acct" placeholder="Start typing…" '+fld+'>'+
      '<label '+flblT+'>CONDITION / NOTES AT CHECK-OUT</label>'+
      '<input id="ln-cond" placeholder="e.g. complete with 595 handpiece, minor scuff on case" '+fld+'>'+
      '<div style="display:flex;gap:10px;align-items:center;margin-top:10px"><button onclick="loanOut()" style="background:var(--ac);color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer">Check out</button><span id="ln-msg" class="mu" style="font-size:12px"></span></div>'
      :'<div class="mu" style="font-size:12.5px">No serialized units in stock — add serials first (Logistics → Serial numbers).</div>')+'</div>':'')+
    (out.length?'<div class="tcard" style="margin-bottom:14px"><div class="tscroll"><table><thead><tr><th>Loan</th><th>Serial</th><th>Product</th><th>Account</th><th>Out</th><th>Due back</th><th>Status</th>'+(canLoans()?'<th></th>':'')+'</tr></thead><tbody>'+
      out.sort((a,b)=>(a.due_date||'9999')<(b.due_date||'9999')?-1:1).map(l=>{const p=DATA.find(x=>x.sku===l.sku);const d=days(l);
        return '<tr><td style="font-weight:700">'+esc(loanNo(l.id))+'</td><td style="font-weight:600">'+esc(l.serial)+'</td>'+
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc((p&&p.name)||l.sku)+'</td>'+
        '<td style="font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(l.account)+'</td>'+
        '<td class="mu">'+esc(l.out_date||'')+(l.out_name?'<br><span style="font-size:10.5px">'+esc(l.out_name)+'</span>':'')+'</td>'+
        '<td style="font-weight:600;color:'+(d!==null&&d>0?'var(--rd)':'var(--tx)')+'">'+esc(l.due_date||'—')+(d!==null&&d>0?'<br><span style="font-size:10.5px">'+d+'d overdue</span>':'')+'</td>'+
        '<td>'+(d!==null&&d>0?'<span class="pill prd">overdue</span>':'<span class="pill pam">out</span>')+'</td>'+
        (canLoans()?'<td style="white-space:nowrap"><a href="#" onclick="loanReturn('+l.id+');return false" style="color:var(--gr);font-size:11.5px;font-weight:600">return</a> · <a href="#" onclick="loanConvert('+l.id+');return false" style="color:var(--bl);font-size:11.5px;font-weight:600">→ sale</a></td>':'')+'</tr>';}).join('')+
      '</tbody></table></div><div class="tfooter"><span>Overdue loans ping whoever checked the unit out, nightly, once per loan · returning puts the serial back in stock · converting marks it sold against the order you name</span></div></div>':'')+
    (past.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Loan</th><th>Serial</th><th>Account</th><th>Out</th><th>Closed</th><th>Outcome</th><th>Condition in</th></tr></thead><tbody>'+
      past.map(l=>'<tr><td class="mu">'+esc(loanNo(l.id))+'</td><td style="font-weight:600">'+esc(l.serial)+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">'+esc(l.account)+'</td>'+
        '<td class="mu">'+esc(l.out_date||'')+'</td><td class="mu">'+esc(l.returned_at||'')+'</td>'+
        '<td>'+(l.status==='converted'?'<span class="pill pbl">sold'+(l.converted_ref?' · '+esc(l.converted_ref):'')+'</span>':'<span class="pill pgr">returned</span>')+'</td>'+
        '<td class="mu" style="font-size:11.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(l.cond_in||'—')+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>Last '+past.length+' closed loans</span></div></div>':
      (out.length?'':'<div class="empty" style="margin-top:30px">Nothing on loan.</div>'));
  attachTypeahead($('ln-acct'),acctNames);
}
async function loanOut(){
  const msg=$('ln-msg');
  const sid=+(($('ln-ser')&&$('ln-ser').value)||0);
  const account=($('ln-acct')&&$('ln-acct').value||'').trim();
  const due=($('ln-due')&&$('ln-due').value)||null;
  const cond=($('ln-cond')&&$('ln-cond').value||'').trim()||null;
  const s=(SERIALS||[]).find(x=>x.id===sid);
  if(!s||!account){if(msg){msg.style.color='var(--rd)';msg.textContent='Pick the unit and the account.';}return;}
  try{
    // the serial leaves stock first; a 0-row update means someone beat us to it
    const {data:up,error:e1}=await SB.from('serials').update({status:'on_loan',updated_at:new Date().toISOString()}).eq('id',sid).eq('status','in_stock').select('id');
    if(e1)throw new Error(e1.message);
    if(!up||!up.length)throw new Error('That unit is no longer in stock — refresh and pick another.');
    const {data:ln,error:e2}=await SB.from('loans').insert({serial_id:sid,sku:s.sku,serial:s.serial,account,due_date:due,cond_out:cond,
      out_by:(SBUSER&&SBUSER.id)||null,out_name:(SBPROFILE&&SBPROFILE.name)||''}).select().single();
    if(e2){
      const {data:rb}=await SB.from('serials').update({status:'in_stock',updated_at:new Date().toISOString()}).eq('id',sid).eq('status','on_loan').select('id');
      throw new Error(e2.message+((!rb||!rb.length)?' — AND the unit could not be put back in stock; an admin should check '+s.serial:''));
    }
    audit('loan.out',{loan:loanNo(ln.id),serial:s.serial,account,due});
    if(msg){msg.style.color='var(--gr)';msg.textContent=loanNo(ln.id)+' — '+s.serial+' checked out to '+account+'.';}
    keepScroll();renderLoans();
  }catch(e){if(msg){msg.style.color='var(--rd)';msg.textContent='Could not check out: '+(e.message||e);}}
}
async function loanReturn(id){
  const l=(LOANS||[]).find(x=>x.id===id);if(!l)return;
  const cond=prompt('Condition at return of '+l.serial+' (from '+l.account+'):','complete, good condition');
  if(cond===null)return;
  try{
    const today=new Date().toISOString().slice(0,10);
    const {data:up,error}=await SB.from('loans').update({status:'returned',returned_at:today,cond_in:(cond||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',id).eq('status','out').select('id');
    if(error)throw new Error(error.message);
    if(!up||!up.length)throw new Error('This loan is already closed — refresh.');
    const {data:sr}=await SB.from('serials').update({status:'in_stock',updated_at:new Date().toISOString()}).eq('id',l.serial_id).eq('status','on_loan').select('id');
    if(!sr||!sr.length)alert('The loan is closed, but the serial did not move back to stock (permissions or state). Tell the warehouse or an admin to check '+l.serial+'.');
    audit('loan.return',{loan:loanNo(id),serial:l.serial,cond});
    keepScroll();renderLoans();
  }catch(e){alert('Could not record the return: '+(e.message||e));}
}
async function loanConvert(id){
  const l=(LOANS||[]).find(x=>x.id===id);if(!l)return;
  const ref=prompt('The demo closed — order / DR reference for the sale of '+l.serial+' to '+l.account+':');
  if(ref===null)return;
  try{
    const today=new Date().toISOString().slice(0,10);
    const {data:up,error}=await SB.from('loans').update({status:'converted',returned_at:today,converted_ref:(ref||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',id).eq('status','out').select('id');
    if(error)throw new Error(error.message);
    if(!up||!up.length)throw new Error('This loan is already closed — refresh.');
    const {data:sr}=await SB.from('serials').update({status:'sold',sold_ref:(ref||'').trim()||null,updated_at:new Date().toISOString()}).eq('id',l.serial_id).eq('status','on_loan').select('id');
    if(!sr||!sr.length)alert('The loan is converted, but the serial did not move to sold (permissions or state). Tell the warehouse or an admin to check '+l.serial+'.');
    audit('loan.convert',{loan:loanNo(id),serial:l.serial,account:l.account,ref});
    keepScroll();renderLoans();
  }catch(e){alert('Could not convert: '+(e.message||e));}
}

/* ── WAVE PICKING — several orders, one walk of the warehouse ── */
const waveNo=id=>docNo('wave',id);
async function waveRelease(){
  const ids=[...document.querySelectorAll('.wv-pick:checked')].map(c=>c.value);
  if(ids.length<2){alert('Pick at least two orders — a single order already has its own pick list.');return;}
  try{
    const {data,error}=await SB.from('waves').insert({order_ids:ids,created_by:(SBUSER&&SBUSER.id)||null,created_name:(SBPROFILE&&SBPROFILE.name)||''}).select().single();
    if(error)throw new Error(error.message);
    audit('wave.release',{wave:waveNo(data.id),orders:ids.length});
    showWavePick(data.id);
  }catch(e){alert('Could not release the wave: '+(e.message||e));}
}
async function showWavePick(waveId){
  currentView='wavepick';
  $('ptitle').textContent='Wave pick list';
  $('content').innerHTML='<div class="empty" style="margin-top:40px">Preparing…</div>';
  let w=null;try{const {data}=await SB.from('waves').select('*').eq('id',waveId).maybeSingle();w=data;}catch(e){}
  if(!w){$('content').innerHTML='<div class="empty" style="margin-top:40px">Wave not found.</div>';return;}
  const ids=(w.order_ids||[]).map(String);
  const orders=[];
  for(const id of ids){
    let o=null;try{const {data}=await SB.from('orders').select('*,order_lines(*)').eq('id',id).maybeSingle();o=data;}catch(e){}
    if(o)orders.push(o);
  }
  if(!orders.length){$('content').innerHTML='<div class="empty" style="margin-top:40px">None of this wave\'s orders could be loaded.</div>';return;}
  const binOf={},nameOf={};DATA.forEach(p=>{binOf[p.sku]=p.bin||'';nameOf[p.sku]=p.name;});
  // merge lines across the wave: one pull per SKU, tagged per order
  const merged={};
  for(const o of orders)for(const l of (o.order_lines||[])){
    const m=merged[l.sku]||(merged[l.sku]={sku:l.sku,name:l.name||nameOf[l.sku]||l.sku,qty:0,per:[]});
    m.qty+=l.qty||0;m.per.push({o:ordLabel(o),q:l.qty||0});
  }
  const rows=Object.values(merged).sort((a,b)=>String(binOf[a.sku]||'ZZZ').localeCompare(String(binOf[b.sku]||'ZZZ')));
  const alloc=(sku,qty)=>{
    const bs=(BATCHES||[]).filter(b=>b.skuCode===sku&&b.soh>0);
    const out=[];let need=qty;
    for(const b of bs){if(need<=0)break;const take=Math.min(need,b.soh);out.push({batch:b.batch||'—',expiry:b.expiry||'—',take});need-=take;}
    if(need>0)out.push({batch:'⚠ short by '+need,expiry:'',take:need});
    return out;
  };
  const pend=o=>o.status==='pending'&&!o.deleted_at;
  const body=rows.map(m=>{
    const a=alloc(m.sku,m.qty);
    return a.map((b,i)=>'<tr>'+(i===0?'<td rowspan="'+a.length+'">'+esc(binOf[m.sku]||'—')+'</td><td rowspan="'+a.length+'"><b>'+esc(m.name)+'</b><br><span style="font-size:10.5px;color:#555">'+m.per.map(x=>esc(x.o)+'×'+x.q).join(' · ')+'</span></td><td rowspan="'+a.length+'">'+esc(m.sku)+'</td><td rowspan="'+a.length+'" style="text-align:center"><b>'+m.qty+'</b></td>':'')+
      '<td>'+esc(b.batch)+'</td><td>'+esc(b.expiry)+'</td><td style="text-align:center">'+b.take+'</td><td style="width:40px"></td></tr>').join('');
  }).join('');
  $('content').innerHTML=
    '<div class="no-print" style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;align-items:center">'+
    '<a href="#" onclick="showView(\'fulfillq\',null);return false" style="color:var(--ac);font-size:12.5px">← Back to the queue</a><span style="flex:1"></span>'+
    '<button onclick="window.print()" style="background:var(--ac);color:#fff;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">🖨 Print</button></div>'+
    '<div class="no-print panel" style="padding:12px 16px;margin-bottom:12px"><div class="phd">Confirm per order once its share is picked</div>'+
      orders.map(o=>'<div class="drow"><span class="dlbl"><b>'+esc(ordLabel(o))+'</b> · '+esc(o.account||'')+'</span><span class="dval">'+
        (pend(o)?'<button onclick="wvConfirm(\''+esc(String(o.id))+'\')" style="background:var(--gr);color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:11.5px;font-weight:600;cursor:pointer">✓ Confirm picked</button>':'<span class="pill pgr">'+esc(o.status)+'</span>')+'</span></div>').join('')+'</div>'+
    '<div class="printdoc">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start"><div>'+hsLogo(34,'#00168F')+'<div style="font-size:19px;font-weight:800;margin-top:5px">HEALTHSPAN GLOBAL, INC.</div><div style="font-size:12px;color:#555">Wave pick list — one walk, '+orders.length+' orders</div></div>'+
    '<div style="text-align:right;font-size:12px"><b style="font-size:15px">'+esc(waveNo(w.id))+'</b><br>Released: '+esc((w.created_at||'').slice(0,10))+(w.created_name?'<br>By: '+esc(w.created_name):'')+'</div></div>'+
    '<div style="font-size:12.5px;margin:10px 0"><b>Orders:</b> '+orders.map(o=>esc(ordLabel(o))+' ('+esc(o.account||'—')+')').join(' · ')+'</div>'+
    '<table><thead><tr><th>Bin</th><th>Product — per-order split</th><th>SKU</th><th>Total</th><th>Batch (FEFO)</th><th>Expiry</th><th>Pull</th><th>✓</th></tr></thead><tbody>'+body+'</tbody></table>'+
    '<div style="display:flex;gap:40px;margin-top:36px;font-size:12px">'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Picked by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Sorted into orders by · date</div>'+
    '<div style="flex:1;border-top:1px solid #999;padding-top:4px">Checked by · date</div></div>'+
    '<div style="font-size:10px;color:#777;margin-top:14px">Rows sorted by bin so the walk is one pass · pull the TOTAL per SKU, then split by the per-order tags · batches suggested FEFO from live stock at print time — if another list printed today claims the same batch, the earlier pull wins and the next batch follows</div>'+
    '</div>';
}

/* confirm one of the wave's orders, then repaint the wave so it shows as done */
async function wvConfirm(orderId){
  await confirmPick(orderId);
  if(window._waveId)showWavePick(window._waveId);
}

/* ── CRM ACTIVITY — visits & calls per specialist, for Marj and marketing ── */
async function renderCrmStats(){
  loadingHint();
  await loadVisits(true);
  const periods=[['7d','7 days'],['mtd','This month'],['30d','30 days'],['3m','3 months'],['all','All (≈4 months)']];
  const per=window._crmP||'mtd';
  const today=new Date().toISOString().slice(0,10);
  const from=per==='7d'?new Date(Date.now()-7*864e5).toISOString().slice(0,10)
    :per==='mtd'?today.slice(0,8)+'01'
    :per==='30d'?new Date(Date.now()-30*864e5).toISOString().slice(0,10)
    :per==='3m'?new Date(Date.now()-90*864e5).toISOString().slice(0,10):'0000';
  const vs=(VISITS||[]).filter(v=>v.status!=='planned'&&(v.date||'')>=from&&(v.date||'')<=today);
  const CALL=/call|viber|follow-?up/i;
  const S={},disp={};
  for(const v of vs){
    const raw=specCanon(v.spec||'');if(!raw||INTERNAL_TAG.test(raw))continue;
    const k=raw.toLowerCase();if(!disp[k])disp[k]=raw;
    const e=S[k]||(S[k]={visits:0,calls:0,demos:0,ordered:0,fu:0,accts:new Set(),days:new Set()});
    if(CALL.test(v.type||''))e.calls++;else e.visits++;
    if(/demo/i.test(v.type||''))e.demos++;
    if(v.outcome==='Ordered')e.ordered++;
    if(v.outcome==='Follow-up needed')e.fu++;
    if(v.account)e.accts.add(custNorm(v.account));
    if(v.date)e.days.add(v.date);
  }
  const rows=Object.keys(S).map(k=>{const e=S[k];const tot=e.visits+e.calls;
    return {n:disp[k],visits:e.visits,calls:e.calls,demos:e.demos,tot,ordered:e.ordered,fu:e.fu,
      accts:e.accts.size,days:e.days.size,perDay:e.days.size?tot/e.days.size:0,
      hit:tot?e.ordered/tot*100:0};}).sort((a,b)=>b.tot-a.tot);
  const T=rows.reduce((a,r)=>({v:a.v+r.visits,c:a.c+r.calls,o:a.o+r.ordered,t:a.t+r.tot}),{v:0,c:0,o:0,t:0});
  // weekly trend, all specialists together (Mondays)
  const wk={},wkKey=d=>{const dt=new Date(d);dt.setDate(dt.getDate()-((dt.getDay()+6)%7));return dt.toISOString().slice(0,10);};
  for(const v of (VISITS||[]).filter(v=>v.status!=='planned'))if(v.date)wk[wkKey(v.date)]=(wk[wkKey(v.date)]||0)+1;
  const wks=Object.keys(wk).sort().slice(-13);
  $('content').innerHTML=
    '<div class="tabs" style="margin-bottom:12px">'+periods.map(([k,l])=>'<div class="tab'+(per===k?' active':'')+'" onclick="window._crmP=\''+k+'\';renderCrmStats()">'+l+'</div>').join('')+'</div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl"><div class="met-lbl">Field visits</div><div class="met-val">'+T.v+'</div><div class="met-sub">clinic visits, demos, deliveries</div><div class="met-bar"></div></div>'+
    '<div class="met pu"><div class="met-lbl">Calls / follow-ups</div><div class="met-val">'+T.c+'</div><div class="met-sub">phone & Viber touches</div><div class="met-bar"></div></div>'+
    '<div class="met gr"><div class="met-lbl">Ended in an order</div><div class="met-val">'+(T.t?Math.round(T.o/T.t*100):0)+'%</div><div class="met-sub">'+T.o+' of '+T.t+' contacts</div><div class="met-bar"></div></div>'+
    '<div class="met am"><div class="met-lbl">Specialists active</div><div class="met-val">'+rows.length+'</div><div class="met-sub">logged activity in the period</div><div class="met-bar"></div></div>'+
    '</div>'+
    '<div class="panel" style="padding:14px 16px;margin-bottom:14px"><div class="phd">Visits + calls per week — all specialists (13 weeks)</div><div class="cw" style="height:180px"><canvas id="crmWk"></canvas></div></div>'+
    (rows.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Specialist</th><th style="text-align:right">Visits</th><th style="text-align:right">Calls</th><th style="text-align:right">Demos</th><th style="text-align:right">Total contacts</th><th style="text-align:right">Active days</th><th style="text-align:right">Contacts/day</th><th style="text-align:right">Accounts touched</th><th style="text-align:right">→ Ordered</th><th style="text-align:right">Follow-ups opened</th></tr></thead><tbody>'+
      rows.map(r=>'<tr onclick="openSpecDrawer(\''+jsq(r.n)+'\')" style="cursor:pointer"><td style="font-weight:700">'+esc(specDisplay(r.n))+'</td>'+
        '<td class="r" style="font-weight:600">'+r.visits+'</td><td class="r">'+r.calls+'</td><td class="r">'+(r.demos||'—')+'</td>'+
        '<td class="r" style="font-weight:700">'+r.tot+'</td><td class="r mu">'+r.days+'</td><td class="r">'+r.perDay.toFixed(1)+'</td>'+
        '<td class="r">'+r.accts+'</td><td class="r" style="font-weight:600;color:'+(r.hit>=30?'var(--gr)':r.hit>=15?'var(--am)':'var(--tx)')+'">'+r.ordered+' ('+r.hit.toFixed(0)+'%)</td>'+
        '<td class="r mu">'+r.fu+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>From the in-app visit log · calls = call / follow-up / Viber quick-log types · visits = everything else (clinic visits, demos, deliveries, events) · planned visits excluded until done · tap a specialist for their full drawer</span></div></div>'
      :'<div class="empty" style="margin-top:30px">No logged activity in this period. Visits appear here the moment a specialist logs them.</div>');
  try{
    if(window._crmWk)window._crmWk.destroy();
    window._crmWk=new Chart($('crmWk'),{data:{labels:wks.map(x=>x.slice(5)),datasets:[{type:'bar',label:'Contacts',data:wks.map(x=>wk[x]||0),backgroundColor:'rgba(37,99,235,0.55)',borderRadius:3}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
  }catch(e){}
}


/* ── MY PROFILE — every user has one, not just the specialists ──
   Identity, the things waiting on YOU, what you have filed, and the quick
   actions that were previously buried in the footer / phone menu. Specialists
   additionally get a link to their full sales page. */
async function renderMyProfile(){
  loadingHint();
  const who=(SBPROFILE&&SBPROFILE.name)||(SBUSER&&SBUSER.email)||'';
  const email=(SBUSER&&SBUSER.email)||'';
  const roleLbl=ROLE==='sales'?'Product specialist':ROLE==='manager'?'Sales manager':ROLE==='supply_chain'?'Supply chain / warehouse':ROLE==='finance'?'Finance':ROLE==='marketing'?'Marketing':ROLE==='viewer'?'Viewer':ROLE==='it'?'IT — specialist accounts':'Admin';
  const tag=(SBPROFILE&&SBPROFILE.specialist_tag)||'';
  const uid=(SBUSER&&SBUSER.id)||'';
  // everything that is mine, in parallel
  let reqs=[],myLoans=[],fus=0,myVisits=0;
  const [qr,ql]=await Promise.all([
    SB.from('fin_requests').select('id,kind,num,status,amount,created_at,step').eq('requester_id',uid).order('id',{ascending:false}).limit(15),
    SB.from('loans').select('*').eq('out_by',uid).eq('status','out').order('due_date'),
    loadVisits()
  ]).catch(()=>[{},{}]);
  reqs=(qr&&qr.data)||[];myLoans=(ql&&ql.data)||[];
  try{
    const mine=v=>tag&&specCanon(v.spec||'').toLowerCase()===specCanon(tag).toLowerCase();
    fus=(VISITS||[]).filter(v=>mine(v)&&v.status!=='planned'&&v.outcome==='Follow-up needed'&&!v.fu_done).length;
    const mo=new Date().toISOString().slice(0,7);
    myVisits=(VISITS||[]).filter(v=>mine(v)&&v.status!=='planned'&&(v.date||'').slice(0,7)===mo).length;
  }catch(e){}
  // (fin requests, loans and visits arrived in one wave above)
  const today=new Date().toISOString().slice(0,10);
  const stPill=r=>r.status==='approved'?'<span class="pill pgr">approved</span>':r.status==='rejected'?'<span class="pill prd">rejected</span>':r.status==='cancelled'?'<span class="pill" style="background:var(--sf2);color:var(--tx3)">cancelled</span>':'<span class="pill pam">pending · step '+(r.step||1)+'</span>';
  $('content').innerHTML=
    '<div class="panel" style="padding:18px;margin-bottom:14px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">'+
      '<div style="width:56px;height:56px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">'+esc((who||'?').trim().charAt(0).toUpperCase())+'</div>'+
      '<div style="flex:1;min-width:200px"><div style="font-size:18px;font-weight:800">'+esc(who)+'</div>'+
      '<div class="mu" style="font-size:12.5px">'+esc(roleLbl)+(tag?' · tag: '+esc(tag):'')+(email?' · '+esc(email):'')+'</div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button onclick="openChangePassword()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:9px;padding:9px 14px;font-size:12.5px;cursor:pointer">Change password</button>'+
      '<button onclick="downloadManual()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:9px;padding:9px 14px;font-size:12.5px;cursor:pointer">📖 My manual</button>'+
      '<button onclick="favOpen()" style="background:var(--sf2);color:var(--tx);border:1px solid var(--bd);border-radius:9px;padding:9px 14px;font-size:12.5px;cursor:pointer">★ Favourites</button>'+
      (tag?'<button onclick="showSpecPage(\''+jsq(tag)+'\')" style="background:var(--ac);color:#fff;border:none;border-radius:9px;padding:9px 14px;font-size:12.5px;font-weight:600;cursor:pointer">My sales page →</button>':'')+
      '</div></div>'+
    '<div class="metrics" style="margin-bottom:14px">'+
    '<div class="met bl" onclick="showView(\'voucher\',null)" style="cursor:pointer"><div class="met-lbl">My finance requests</div><div class="met-val">'+reqs.filter(r=>r.status==='pending').length+'</div><div class="met-sub">still pending of my last '+reqs.length+'</div><div class="met-bar"></div></div>'+
    (tag?'<div class="met gr" onclick="showView(\'followups\',null)" style="cursor:pointer"><div class="met-lbl">Open follow-ups</div><div class="met-val">'+fus+'</div><div class="met-sub">'+myVisits+' visits logged this month</div><div class="met-bar"></div></div>':'')+
    (myLoans.length?'<div class="met am" onclick="showView(\'loans\',null)" style="cursor:pointer"><div class="met-lbl">Loaners I checked out</div><div class="met-val">'+myLoans.length+'</div><div class="met-sub">'+myLoans.filter(l=>l.due_date&&l.due_date<today).length+' overdue</div><div class="met-bar"></div></div>':'')+
    '</div>'+
    (reqs.length?'<div class="tcard"><div class="tscroll"><table><thead><tr><th>Request</th><th>Form</th><th style="text-align:right">Amount</th><th>Status</th><th>Filed</th></tr></thead><tbody>'+
      reqs.map(r=>'<tr><td style="font-weight:700">'+esc(FIN_NO(r.kind,r.num))+'</td>'+
        '<td>'+esc((FIN_SPEC[r.kind]&&FIN_SPEC[r.kind].title)||r.kind)+'</td>'+
        '<td class="r" style="font-weight:600">'+fmtPeso(r.amount||0)+'</td>'+
        '<td>'+stPill(r)+'</td><td class="mu">'+esc((r.created_at||'').slice(0,10))+'</td></tr>').join('')+
      '</tbody></table></div><div class="tfooter"><span>Your last '+reqs.length+' finance forms — open the form\u2019s page to see or cancel a pending one</span></div></div>'
      :'<div class="empty" style="margin-top:20px">No finance requests filed yet. Everything you file — vouchers, expense reports, reimbursements — will show here with its status.</div>');
}
