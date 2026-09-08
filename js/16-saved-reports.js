/* ── SAVED REPORTS (Sales analytics → Saved reports) ─────────────────────────────
   The reporting layer: pick a source, tick columns, add filters, group and sort,
   see the result at once, save it under a name, export it as CSV, and — the part
   NetSuite people miss — put it on a schedule. A scheduled report runs at 6am
   Manila in a Netlify function with the SAME engine (js/15), the CSV lands in
   HQ's own storage, and the owner (plus anyone they add) gets a bell notification
   with a download link. Nothing is e-mailed anywhere; nothing leaves HQ.

   Permissions: every source has its own role list, a specialist sees only their
   own rows on the sources that carry a specialist, and cost columns are stripped
   for anyone who is not admin, finance or the warehouse — in the browser AND in
   the scheduled run (the run uses the owner's role, looked up fresh). A shared
   report is visible to everyone who can read its source; the run is still filtered
   by the role of the person opening it. */
let RPT_LIST=null, RPT_RUNS=null, RPT_CUR=null, RPT_RES=null, RPT_ROWS_CACHE={};
function rptRole(){ return (typeof isSuper==='function'&&isSuper())?'super':(ROLE||'viewer'); }
function rptMyTag(){ return (ROLE==='sales'&&SBPROFILE&&SBPROFILE.specialist_tag)||''; }
function rptCanBuild(){ return !!SBUSER&&ROLE!=='viewer'; }
function rptBlank(){ return {id:null,name:'',def:{source:'',columns:[],filters:[],group:null,sort:null,limit:1000},shared:false,schedule:null,recipients:[]}; }

async function rptLoadList(force){
  if(RPT_LIST&&!force)return RPT_LIST;
  try{const {data,error}=await SB.from('saved_reports').select('*').order('updated_at',{ascending:false}).limit(300);if(error)throw error;RPT_LIST=data||[];window._rptErr='';}
  catch(e){RPT_LIST=RPT_LIST||[];window._rptErr=e.message||String(e);}
  return RPT_LIST;
}
async function rptLoadRuns(reportId){
  try{const {data}=await SB.from('report_runs').select('id,report_id,ran_at,rows,status,error,by_name').eq('report_id',reportId).order('id',{ascending:false}).limit(20);RPT_RUNS=data||[];}catch(e){RPT_RUNS=[];}
  return RPT_RUNS;
}
/* the rows behind a source, from what the browser already holds or one Supabase read */
async function rptRows(source){
  if(RPT_ROWS_CACHE[source]&&(Date.now()-RPT_ROWS_CACHE[source].at)<60000)return RPT_ROWS_CACHE[source].rows;
  let rows=[];
  try{
    if(source==='stock')rows=(DATA||[]).map(p=>({sku:p.sku,name:p.name,line:p.line,category:p.category,supplier:p.supplier,received:p.received,sold:p.sold,stock:(typeof stk==='function'?stk(p):p.stock),price:p.price,batch:p.batch,expiry:p.expiry,bin:p.bin}));
    else if(source==='batches')rows=rptFlattenBatches(BATCHES||[]);
    else if(source==='sales'){if(!SHOPIFY&&typeof loadShopify==='function')await loadShopify();rows=rptFlattenSales((SHOPIFY&&SHOPIFY.recent)||[]);}
    else if(source==='order_lines'){const [a,b]=await Promise.all([SB.from('orders').select('id,date,account,spec,status').is('deleted_at',null).limit(5000),SB.from('order_lines').select('*').limit(20000)]);rows=rptFlattenOrderLines(a.data||[],b.data||[]);}
    else if(source==='orders'){const {data}=await SB.from('orders').select('*').is('deleted_at',null).order('id',{ascending:false}).limit(5000);rows=data||[];}
    else if(source==='fin_requests'){const {data}=await SB.from('fin_requests').select('*').order('id',{ascending:false}).limit(5000);rows=data||[];}
    else {const {data,error}=await SB.from(source).select('*').limit(5000);if(error)throw error;rows=data||[];}
  }catch(e){window._rptRowsErr=e.message||String(e);}
  RPT_ROWS_CACHE[source]={rows,at:Date.now()};
  return rows;
}
async function rptPreview(){
  const C=RPT_CUR;if(!C||!C.def.source)return;
  const box=$('rpt-preview');if(box)box.innerHTML='<div class="mu" style="padding:10px">Running…</div>';
  const rows=await rptRows(C.def.source);
  RPT_RES=rptRun(C.def,rows,rptRole(),{ownTag:rptMyTag()});
  rptPaintPreview();
}
function rptPaintPreview(){
  const box=$('rpt-preview');if(!box)return;const R=RPT_RES;
  if(!R){box.innerHTML='<div class="mu" style="padding:10px">Pick a source to see rows.</div>';return;}
  if(R.error){box.innerHTML='<div class="empty">'+esc(R.error)+'</div>';return;}
  const show=R.rows.slice(0,200);
  const fmt=(v,t)=>v==null?'<span class="mu">—</span>':t==='num'?(Number.isInteger(v)?v.toLocaleString('en-PH'):Number(v).toLocaleString('en-PH',{maximumFractionDigits:2})):esc(String(v));
  box.innerHTML='<div class="mu" style="font-size:11.5px;margin:0 0 6px">'+R.total.toLocaleString('en-PH')+' row'+(R.total===1?'':'s')+' match'+(RPT_CUR.def.group&&RPT_CUR.def.group.by?' → '+R.rows.length+' group'+(R.rows.length===1?'':'s'):'')+(R.truncated?' · capped at '+RPT_CUR.def.limit:'')+(show.length<R.rows.length?' · showing the first 200 here, the export has all':'')+'</div>'+
    '<div class="tcard"><div class="tscroll" style="max-height:420px"><table><thead><tr>'+R.cols.map(c=>'<th'+(c.type==='num'?' class="r"':'')+' style="cursor:pointer" onclick="rptSortBy(\''+jsq(c.key)+'\')" title="Sort">'+esc(c.label)+(RPT_CUR.def.sort&&RPT_CUR.def.sort.col===c.key?(RPT_CUR.def.sort.dir==='desc'?' ▾':' ▴'):'')+'</th>').join('')+'</tr></thead><tbody>'+
    (show.length?show.map(r=>'<tr>'+r.map((v,i)=>'<td'+(R.cols[i].type==='num'?' class="r"':'')+' style="font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+fmt(v,R.cols[i].type)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+R.cols.length+'" class="mu">No rows match.</td></tr>')+
    '</tbody></table></div></div>';
}
function rptSortBy(col){const d=RPT_CUR.def;d.sort=(d.sort&&d.sort.col===col)?{col,dir:d.sort.dir==='asc'?'desc':'asc'}:{col,dir:'asc'};rptPreview();rptPaintBuilder();}

/* ── the builder ── */
function rptSet(path,val){ // 'def.source' / 'name' / 'def.limit'…
  const C=RPT_CUR;const parts=path.split('.');let o=C;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];o[parts[parts.length-1]]=val;
  if(path==='def.source'){C.def.columns=[];C.def.filters=[];C.def.group=null;C.def.sort=null;RPT_RES=null;}
  rptPaintBuilder();if(path==='def.source'||path==='def.limit')rptPreview();
}
function rptToggleCol(c){const d=RPT_CUR.def;const i=d.columns.indexOf(c);if(i>=0)d.columns.splice(i,1);else d.columns.push(c);rptPaintBuilder();rptPreview();}
function rptFilterAdd(){RPT_CUR.def.filters.push({col:'',op:'=',val:''});rptPaintBuilder();}
function rptFilterSet(i,k,v){const f=RPT_CUR.def.filters[i];if(!f)return;f[k]=v;if(k==='col'){const t=(RPT_SOURCES[RPT_CUR.def.source]||{cols:{}}).cols[v]||'text';f.op=RPT_OPS[t][0];f.val='';}rptPaintBuilder();rptPreview();}
function rptFilterDrop(i){RPT_CUR.def.filters.splice(i,1);rptPaintBuilder();rptPreview();}
function rptGroupSet(by){RPT_CUR.def.group=by?{by,aggs:(RPT_CUR.def.group&&RPT_CUR.def.group.aggs)||[{fn:'count'}]}:null;RPT_CUR.def.sort=null;rptPaintBuilder();rptPreview();}
function rptAggAdd(){if(!RPT_CUR.def.group)return;RPT_CUR.def.group.aggs.push({fn:'sum',col:''});rptPaintBuilder();}
function rptAggSet(i,k,v){const a=RPT_CUR.def.group&&RPT_CUR.def.group.aggs[i];if(!a)return;a[k]=v;rptPaintBuilder();rptPreview();}
function rptAggDrop(i){RPT_CUR.def.group.aggs.splice(i,1);rptPaintBuilder();rptPreview();}
function rptSchedSet(k,v){const C=RPT_CUR;if(k==='freq'){C.schedule=v?{freq:v,dow:1,dom:1}:null;}else if(C.schedule)C.schedule[k]=v;rptPaintBuilder();}
function rptRecipToggle(uid){const C=RPT_CUR;C.recipients=C.recipients||[];const i=C.recipients.indexOf(uid);if(i>=0)C.recipients.splice(i,1);else C.recipients.push(uid);rptPaintBuilder();}

function rptPaintBuilder(){
  const el=$('rpt-builder');if(!el||!RPT_CUR)return;
  const C=RPT_CUR,d=C.def,role=rptRole(),S=RPT_SOURCES[d.source],allowed=d.source?rptAllowedCols(d.source,role):[];
  const inp='style="background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font-size:12.5px;font:inherit"';
  const mine=!C.id||C.owner_id===(SBUSER&&SBUSER.id)||roleIn('admin')||(typeof isSuper==='function'&&isSuper());
  const srcOpts=Object.keys(RPT_SOURCES).filter(k=>rptSourceAllowed(k,role));
  let h='<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:10px">'+
    '<div style="flex:1;min-width:220px"><div class="mu" style="font-size:10.5px;font-weight:600">REPORT NAME</div><input value="'+esc(C.name)+'" placeholder="e.g. Open AR over 60 days" oninput="RPT_CUR.name=this.value" '+inp.replace('style="','style="width:100%;box-sizing:border-box;')+(mine?'':' disabled')+'></div>'+
    '<div><div class="mu" style="font-size:10.5px;font-weight:600">SOURCE</div><select onchange="rptSet(\'def.source\',this.value)" '+inp+(mine?'':' disabled')+'><option value="">— choose —</option>'+srcOpts.map(k=>'<option value="'+k+'"'+(k===d.source?' selected':'')+'>'+esc(RPT_SOURCES[k].label)+'</option>').join('')+'</select></div>'+
    '<div><div class="mu" style="font-size:10.5px;font-weight:600">ROW CAP</div><select onchange="rptSet(\'def.limit\',+this.value)" '+inp+'>'+[500,1000,5000,20000].map(n=>'<option value="'+n+'"'+((+d.limit||1000)===n?' selected':'')+'>'+n.toLocaleString()+'</option>').join('')+'</select></div>'+
    '</div>';
  if(S){
    const own=S.own&&role==='sales';
    h+='<div class="mu" style="font-size:11.5px;margin-bottom:8px">'+(own?'You see your own rows on this source. ':'')+((S.costs||[]).length&&!RPT_COST_ROLES.includes(role)?'Cost columns are not part of this source for your role. ':'')+'</div>';
    /* columns */
    h+='<div class="mu" style="font-size:10.5px;font-weight:600;margin-bottom:4px">COLUMNS '+(d.group&&d.group.by?'<span style="font-weight:400">(grouped — the group column and its totals are the columns)</span>':'<span style="font-weight:400">(none ticked = the first eight)</span>')+'</div>'+
      '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">'+allowed.map(c=>'<span class="pill '+(d.columns.includes(c)?'pbl':'pgy')+'" style="cursor:pointer" onclick="rptToggleCol(\''+jsq(c)+'\')">'+esc(c)+'</span>').join('')+'</div>';
    /* filters */
    h+='<div class="mu" style="font-size:10.5px;font-weight:600;margin-bottom:4px">FILTERS <span style="font-weight:400">(all must match)</span></div>';
    h+=(d.filters||[]).map((f,i)=>{const t=S.cols[f.col]||'text';const ops=RPT_OPS[t]||RPT_OPS.text;const needsVal=!/empty|is true|is false|this month|last month|this year/.test(f.op||'');
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:5px">'+
      '<select onchange="rptFilterSet('+i+',\'col\',this.value)" '+inp+'><option value="">— column —</option>'+allowed.map(c=>'<option value="'+c+'"'+(c===f.col?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      '<select onchange="rptFilterSet('+i+',\'op\',this.value)" '+inp+'>'+ops.map(o=>'<option'+(o===f.op?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>'+
      (needsVal?'<input value="'+esc(f.val==null?'':f.val)+'" placeholder="'+(f.op==='last'?'days':f.op==='in'?'a, b, c':t==='date'?'YYYY-MM-DD':'value')+'" onchange="rptFilterSet('+i+',\'val\',this.value)" '+inp+' style="min-width:140px">':'')+
      '<a href="#" class="lnk" onclick="rptFilterDrop('+i+');return false" style="color:var(--rd);font-size:11.5px">remove</a></div>';}).join('')+
      '<a href="#" class="abtn" onclick="rptFilterAdd();return false">+ Add filter</a>';
    /* group + sort */
    const numCols=allowed.filter(c=>S.cols[c]==='num');
    h+='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin-top:12px">'+
      '<div><div class="mu" style="font-size:10.5px;font-weight:600">GROUP BY</div><select onchange="rptGroupSet(this.value)" '+inp+'><option value="">— none (one row per record) —</option>'+allowed.map(c=>'<option value="'+c+'"'+(d.group&&d.group.by===c?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
      (d.group&&d.group.by?'<div style="margin-top:6px">'+(d.group.aggs||[]).map((a,i)=>'<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><select onchange="rptAggSet('+i+',\'fn\',this.value)" '+inp+'>'+RPT_AGGS.map(f=>'<option'+(f===a.fn?' selected':'')+'>'+f+'</option>').join('')+'</select>'+
        (a.fn!=='count'?'<select onchange="rptAggSet('+i+',\'col\',this.value)" '+inp+'><option value="">— number column —</option>'+numCols.map(c=>'<option value="'+c+'"'+(c===a.col?' selected':'')+'>'+esc(c)+'</option>').join('')+'</select>':'')+
        '<a href="#" class="lnk" onclick="rptAggDrop('+i+');return false" style="color:var(--rd);font-size:11px">✕</a></div>').join('')+'<a href="#" class="lnk" onclick="rptAggAdd();return false" style="color:var(--ac);font-size:11.5px">+ total</a></div>':'')+'</div>'+
      '<div><div class="mu" style="font-size:10.5px;font-weight:600">SORT</div><span class="mu" style="font-size:11.5px">'+(d.sort&&d.sort.col?esc(d.sort.col)+' '+(d.sort.dir==='desc'?'▾ descending':'▴ ascending'):'click a column header in the preview')+'</span></div>'+
    '</div>';
    /* schedule + sharing */
    const sc=C.schedule||{};
    h+='<div class="panel" style="padding:10px 12px;margin-top:14px;background:var(--sf2)"><div class="phd" style="margin-bottom:6px">Schedule &amp; sharing</div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+
      '<select onchange="rptSchedSet(\'freq\',this.value)" '+inp+(mine?'':' disabled')+'><option value=""'+(!sc.freq?' selected':'')+'>Not scheduled — run by hand</option><option value="daily"'+(sc.freq==='daily'?' selected':'')+'>Every day</option><option value="weekly"'+(sc.freq==='weekly'?' selected':'')+'>Every week</option><option value="monthly"'+(sc.freq==='monthly'?' selected':'')+'>Every month</option></select>'+
      (sc.freq==='weekly'?'<select onchange="rptSchedSet(\'dow\',+this.value)" '+inp+'>'+['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((n,i)=>'<option value="'+(i+1)+'"'+((+sc.dow||1)===i+1?' selected':'')+'>'+n+'</option>').join('')+'</select>':'')+
      (sc.freq==='monthly'?'<select onchange="rptSchedSet(\'dom\',this.value)" '+inp+'>'+[1,5,10,15,20,25,'last'].map(v=>'<option value="'+v+'"'+(String(sc.dom||1)===String(v)?' selected':'')+'>'+(v==='last'?'last day':'day '+v)+'</option>').join('')+'</select>':'')+
      (sc.freq?'<span class="mu" style="font-size:11.5px">runs at 6am Manila · '+esc(rptSchedText(sc))+' · the CSV lands in HQ and you get a bell notification</span>':'')+
      '</div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px"><label style="font-size:12px;display:flex;gap:5px;align-items:center"><input type="checkbox" '+(C.shared?'checked':'')+(mine?'':' disabled')+' onchange="RPT_CUR.shared=this.checked"> Shared — everyone who may read this source sees the report (each still gets only their own rows)</label></div>'+
      '</div>';
  }
  el.innerHTML=h;
}
async function rptSave(){
  const C=RPT_CUR;if(!C)return;
  if(!C.name.trim())return uiAlert('Give the report a name.');
  if(!C.def.source)return uiAlert('Pick a source.');
  const row={name:C.name.trim(),def:C.def,shared:!!C.shared,schedule:C.schedule&&C.schedule.freq?C.schedule:null,recipients:C.recipients||[],updated_at:new Date().toISOString()};
  try{
    let res;
    if(C.id)res=await SB.from('saved_reports').update(row).eq('id',C.id).select().single();
    else res=await SB.from('saved_reports').insert(Object.assign(row,{owner_id:SBUSER.id,owner_name:(SBPROFILE&&SBPROFILE.name)||''})).select().single();
    if(res.error)throw res.error;
    RPT_CUR=Object.assign(rptBlank(),res.data);audit('report.save',{id:res.data.id,name:row.name,source:C.def.source,scheduled:!!row.schedule});
    await rptLoadList(true);renderSavedReports(true);
  }catch(e){uiAlert('Could not save: '+(e.message||e)+(/saved_reports/.test(String(e.message))?' — run the saved-reports SQL from SUPABASE-SETUP.md.':''));}
}
async function rptOpen(id){const L=await rptLoadList();const r=L.find(x=>x.id===id);if(!r)return;RPT_CUR=Object.assign(rptBlank(),r);RPT_RES=null;await rptLoadRuns(id);renderSavedReports(true);rptPreview();}
function rptNew(){RPT_CUR=rptBlank();RPT_RES=null;RPT_RUNS=[];renderSavedReports(true);}
async function rptDuplicate(){const C=RPT_CUR;if(!C)return;RPT_CUR=Object.assign(rptBlank(),{name:C.name+' (copy)',def:JSON.parse(JSON.stringify(C.def))});renderSavedReports(true);rptPreview();}
async function rptDelete(){const C=RPT_CUR;if(!C||!C.id||!await uiConfirm('Delete “'+C.name+'”? Past runs are removed with it.'))return;
  try{const {error}=await SB.from('saved_reports').delete().eq('id',C.id);if(error)throw error;audit('report.delete',{id:C.id,name:C.name});RPT_CUR=null;await rptLoadList(true);renderSavedReports(true);}catch(e){uiAlert('Could not delete: '+(e.message||e));}}
function rptExport(){if(!RPT_RES||!RPT_CUR)return;const csv=rptCSV(RPT_RES);const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);a.download='healthspan_'+(RPT_CUR.name||'report').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'_'+todayISO()+'.csv';a.click();audit('report.export',{name:RPT_CUR.name,rows:RPT_RES.rows.length});}
async function rptRunNow(){ // a server-side run, exactly as the schedule would do it — proves the schedule before waiting for 6am
  const C=RPT_CUR;if(!C||!C.id)return uiAlert('Save the report first.');
  const b=$('rpt-runnow');if(b){b.textContent='Running…';b.disabled=true;}
  try{const r=await fetch('/.netlify/functions/report-run',{method:'POST',headers:await sbAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({id:C.id})});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));
    await rptLoadRuns(C.id);renderSavedReports(true);}
  catch(e){uiAlert('The run failed: '+(e.message||e));if(b){b.textContent='Run on the server now';b.disabled=false;}}
}
async function rptDownloadRun(runId){
  try{const r=await fetch('/.netlify/functions/report-run?id='+encodeURIComponent(runId),{headers:await sbAuthHeaders()});if(!r.ok){const j=await r.json().catch(()=>({}));throw new Error(j.error||('HTTP '+r.status));}
    const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(r.headers.get('x-filename')||'report.csv');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  catch(e){uiAlert('Could not download: '+(e.message||e));}
}

async function renderSavedReports(cheap){
  if(!cheap)loadingHint();
  if(!SB||!SBUSER){$('content').innerHTML='<div class="empty" style="margin-top:40px">Sign in first.</div>';return;}
  const L=await rptLoadList(!cheap);
  if(currentView!=='savedreports')return;
  const me=(SBUSER&&SBUSER.id)||'',role=rptRole();
  const visible=L.filter(r=>(r.owner_id===me||r.shared||roleIn('admin')||role==='super')&&rptSourceAllowed(r.def&&r.def.source,role));
  const mine=visible.filter(r=>r.owner_id===me),shared=visible.filter(r=>r.owner_id!==me);
  const item=r=>'<div class="ni'+(RPT_CUR&&RPT_CUR.id===r.id?' active':'')+'" style="padding:7px 9px" onclick="rptOpen('+r.id+')"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+esc(r.name)+'</span>'+(r.schedule&&r.schedule.freq?'<span title="'+esc(rptSchedText(r.schedule))+'" style="font-size:10px;margin-left:4px">⏰</span>':'')+'</div>';
  const C=RPT_CUR;const canEdit=!!C&&(!C.id||C.owner_id===me||roleIn('admin')||role==='super');
  $('content').innerHTML=
    '<div class="viewdesc">Build a report once, run it whenever, or put it on a schedule: pick a source, tick the columns, add filters, group and total, and save. Scheduled reports run at 6am Manila and drop a CSV into HQ with a bell notification — the NetSuite “saved search”, without NetSuite. Every report respects the same permissions as the pages: specialists see their own rows, and cost figures never appear for roles that do not see them elsewhere.</div>'+
    (window._rptErr?'<div class="viewdesc" style="border-color:var(--am)">Saved reports table not reachable ('+esc(window._rptErr)+') — run the saved-reports SQL from SUPABASE-SETUP.md.</div>':'')+
    '<div class="rptwrap" style="display:grid;grid-template-columns:240px 1fr;gap:14px;align-items:start">'+
      '<div class="panel" style="padding:10px">'+(rptCanBuild()?'<a href="#" class="abtn t-gr" style="display:block;text-align:center;margin-bottom:8px" onclick="rptNew();return false">+ New report</a>':'')+
        '<div class="mu" style="font-size:10.5px;font-weight:600;margin:6px 0 3px">MINE ('+mine.length+')</div>'+(mine.length?mine.map(item).join(''):'<div class="mu" style="font-size:11.5px;padding:4px 9px">None yet.</div>')+
        '<div class="mu" style="font-size:10.5px;font-weight:600;margin:10px 0 3px">SHARED WITH ME ('+shared.length+')</div>'+(shared.length?shared.map(item).join(''):'<div class="mu" style="font-size:11.5px;padding:4px 9px">Nothing shared.</div>')+
      '</div>'+
      '<div>'+(C?
        '<div class="panel" style="padding:14px 16px;margin-bottom:12px"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><div class="phd" style="margin:0;flex:1">'+(C.id?esc(C.name):'New report')+(C.id&&C.owner_name?' <span class="mu" style="font-weight:400;font-size:11px">by '+esc(C.owner_name)+'</span>':'')+'</div>'+
          (canEdit?'<a href="#" class="abtn t-gr" onclick="rptSave();return false">Save</a>':'')+'<a href="#" class="abtn" onclick="rptPreview();return false">Refresh preview</a><a href="#" class="abtn" onclick="rptExport();return false">Export CSV</a>'+
          (C.id?'<button id="rpt-runnow" class="abtn" onclick="rptRunNow()" title="Runs on the server with your role, exactly as the schedule would">Run on the server now</button>':'')+
          (C.id&&rptCanBuild()?'<a href="#" class="abtn" onclick="rptDuplicate();return false">Duplicate</a>':'')+(C.id&&canEdit?'<a href="#" class="abtn t-rd" onclick="rptDelete();return false">Delete</a>':'')+'</div>'+
          '<div id="rpt-builder"></div></div>'+
        '<div class="panel" style="padding:12px 14px;margin-bottom:12px"><div class="phd">Preview</div><div id="rpt-preview"></div></div>'+
        (C.id?'<div class="panel" style="padding:12px 14px"><div class="phd">Runs on the server</div>'+((RPT_RUNS||[]).length?'<div class="tscroll"><table><thead><tr><th>When</th><th>By</th><th class="r">Rows</th><th>Status</th><th></th></tr></thead><tbody>'+
          RPT_RUNS.map(x=>'<tr><td class="mu" style="font-size:11.5px">'+esc(new Date(x.ran_at).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}))+'</td><td class="mu" style="font-size:11.5px">'+esc(x.by_name||'schedule')+'</td><td class="r">'+(x.rows==null?'—':x.rows.toLocaleString())+'</td><td>'+(x.status==='ok'?'<span class="pill pgr">ready</span>':'<span class="pill prd" title="'+esc(x.error||'')+'">failed</span>')+'</td><td>'+(x.status==='ok'?'<a href="#" onclick="rptDownloadRun('+x.id+');return false" style="color:var(--ac);font-size:12px">download CSV</a>':'<span class="mu" style="font-size:11px">'+esc((x.error||'').slice(0,80))+'</span>')+'</td></tr>').join('')+
          '</tbody></table></div>':'<div class="mu" style="font-size:12px">No server runs yet'+(C.schedule&&C.schedule.freq?' — the first one is '+esc(rptSchedText(C.schedule))+'.':'.')+'</div>')+'</div>':'')
        :'<div class="empty" style="margin-top:40px">'+(rptCanBuild()?'Pick a report on the left, or start a new one.':'Reports shared with you appear on the left.')+'</div>')+
      '</div></div>';
  if(C){rptPaintBuilder();rptPaintPreview();}
}
