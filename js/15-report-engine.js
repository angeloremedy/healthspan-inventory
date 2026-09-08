/* ── REPORT ENGINE — the NetSuite "saved search" replacement, part 1 ─────────────
   Pure functions, no DOM, no Supabase: one file that runs in the browser (the
   builder previews with it) AND in the scheduled Netlify function (which runs the
   same definition against the same sources at 6am and drops the CSV). Because both
   sides share this file, a report can never come out different on a schedule than
   it did on screen.

   A DEFINITION is plain JSON:
     { source:'orders', columns:['date','account','total'],
       filters:[{col:'status',op:'=',val:'fulfilled'},{col:'date',op:'last',val:30}],
       group:{by:'account', aggs:[{fn:'sum',col:'total'},{fn:'count'}]},   // optional
       sort:{col:'total',dir:'desc'}, limit:500 }

   SOURCES name the datasets HQ already holds. Each lists its columns (with type),
   which roles may read it, whether a specialist sees only their own rows (and by
   which column), and which columns are COSTS — those are stripped for anyone who
   is not admin, finance or the warehouse, the same rule as every other page. */
const RPT_SOURCES = {
  stock:      { label: 'Stock on hand (master sheet)', roles: ['admin','manager','sales','finance','supply_chain','marketing'],
                cols: { sku:'text', name:'text', line:'text', category:'text', supplier:'text', received:'num', sold:'num', stock:'num', price:'num', batch:'text', expiry:'text', bin:'text' } },
  batches:    { label: 'Batches & expiry', roles: ['admin','manager','sales','finance','supply_chain','marketing'],
                cols: { sku:'text', name:'text', batch:'text', expiry:'text', qty:'num', bin:'text' } },
  sales:      { label: 'Sales lines (Shopify, recent)', roles: ['admin','manager','sales','finance','supply_chain','marketing'], own: 'specialist',
                cols: { order:'text', date:'date', specialist:'text', customer:'text', internal:'num', sku:'text', qty:'num', amount:'num' } },
  orders:     { label: 'HQ orders', roles: ['admin','manager','sales','finance','supply_chain'], own: 'spec', costs: ['delivery_cost'],
                cols: { num:'num', date:'date', account:'text', spec:'text', status:'text', total:'num', paid:'num', balance:'num', pay_status:'text', terms_days:'num', dr_no:'text', source:'text', courier:'text', delivery_cost:'num', dispatched_at:'date', delivered_at:'date', fulfilled_at:'date', created_at:'date' } },
  order_lines:{ label: 'HQ order lines', roles: ['admin','manager','sales','finance','supply_chain'], own: 'spec',
                cols: { order_id:'text', date:'date', account:'text', spec:'text', status:'text', sku:'text', name:'text', qty:'num', price:'num', amount:'num', is_free:'bool', deal:'text' } },
  accounts:   { label: 'Accounts (CRM)', roles: ['admin','manager','sales','finance','supply_chain','marketing'], own: 'owner_tag',
                cols: { name:'text', owner_tag:'text', tier:'text', stage:'text', status:'text', region:'text', city:'text', clinic_type:'text', specialty:'text', contact_person:'text', phone:'text', email:'text', credit_limit:'num', lto_expiry:'date', prc_expiry:'date', updated_at:'date' } },
  visits:     { label: 'Visits & calls', roles: ['admin','manager','sales','finance','supply_chain','marketing'], own: 'spec',
                cols: { date:'date', spec:'text', account:'text', type:'text', outcome:'text', status:'text', notes:'text' } },
  quotes:     { label: 'Quotations', roles: ['admin','manager','sales','finance'], own: 'spec',
                cols: { num:'num', date:'date', account:'text', spec:'text', status:'text', total:'num', expiry:'date', lost_reason:'text' } },
  payments:   { label: 'Payments received', roles: ['admin','finance'],
                cols: { date:'date', account:'text', order_label:'text', amount:'num', method:'text', ref:'text', created_name:'text' } },
  pos:        { label: 'Purchase orders (with costs)', roles: ['admin','finance','supply_chain'], costs: ['fx_total','amount_paid','peso_value','fx_rate','landed_cost'],
                cols: { id:'num', supplier:'text', status:'text', eta:'date', currency:'text', terms:'text', fx_total:'num', amount_paid:'num', peso_value:'num', fx_rate:'num', landed_cost:'num', created_at:'date' } },
  fin_requests:{ label: 'Finance forms', roles: ['admin','finance'],
                cols: { kind:'text', num:'num', date_requested:'date', requester_name:'text', payee:'text', purpose:'text', amount:'num', fund_class:'text', status:'text', step:'num', team:'text', currency:'text' } },
  shipments:  { label: 'Inbound shipments (Receiving)', roles: ['admin','manager','supply_chain','finance'], costs: ['invoice_total','fx_rate','landed_total','landed_total_fees'],
                cols: { id:'num', supplier:'text', po_id:'num', ref:'text', status:'text', carrier:'text', tracking_no:'text', etd:'date', eta:'date', arrived_at:'date', received_at:'date', customs_status:'text', terms_days:'num', currency:'text', invoice_total:'num', fx_rate:'num', landed_total:'num', landed_total_fees:'num' } },
  complaints: { label: 'Complaints & supplier claims', roles: ['admin','manager','sales','finance','supply_chain','marketing'],
                cols: { direction:'text', account:'text', supplier:'text', po_ref:'text', kind:'text', sku:'text', batch:'text', description:'text', status:'text', resolution:'text', created_name:'text', created_at:'date', closed_at:'date' } },
  serials:    { label: 'Equipment serials', roles: ['admin','manager','supply_chain'],
                cols: { sku:'text', serial:'text', batch:'text', status:'text', holder:'text', warranty_end:'date', sold_ref:'text', created_at:'date' } },
  loans:      { label: 'Demo / loaners', roles: ['admin','manager','supply_chain','sales'],
                cols: { serial:'text', sku:'text', account:'text', out_date:'date', due_date:'date', status:'text', returned_at:'date', out_name:'text' } }
};
const RPT_OPS = { text: ['=','!=','contains','not contains','starts','empty','not empty','in'], num: ['=','!=','>','>=','<','<=','empty','not empty'], date: ['=','>=','<=','last','this month','last month','this year','empty','not empty'], bool: ['is true','is false'] };
const RPT_AGGS = ['count','sum','avg','min','max'];
const RPT_COST_ROLES = ['admin','finance','supply_chain','super'];

function rptToday(){ return new Date(Date.now()+8*3600e3).toISOString().slice(0,10); } // Manila
function rptMonth(d){ return String(d||'').slice(0,7); }
function rptNum(v){ if(v==null||v==='')return null; const n=typeof v==='number'?v:parseFloat(String(v).replace(/[₱,\s]/g,'')); return isNaN(n)?null:n; }
function rptStr(v){ return v==null?'':String(v); }

/* the columns a role may see on a source (costs stripped) — [] when the role may not read it at all */
function rptAllowedCols(source, role){
  const S=RPT_SOURCES[source]; if(!S)return [];
  const r=role==='super'?'admin':role;
  if(!(S.roles.includes(r)||role==='super'))return [];
  const cost=RPT_COST_ROLES.includes(role);
  return Object.keys(S.cols).filter(c=>cost||!(S.costs||[]).includes(c));
}
function rptSourceAllowed(source, role){ return rptAllowedCols(source, role).length>0; }

function rptMatch(row, f, today){
  const col=f.col, op=f.op, S=f._type||'text';
  const v=row[col];
  if(op==='empty')return v==null||v==='';
  if(op==='not empty')return !(v==null||v==='');
  if(S==='bool'){ const b=v===true||v===1||v==='true'||v==='1'; return op==='is true'?b:!b; }
  if(S==='num'){ const a=rptNum(v), b=rptNum(f.val); if(a==null||b==null)return false;
    return op==='='?a===b:op==='!='?a!==b:op==='>'?a>b:op==='>='?a>=b:op==='<'?a<b:op==='<='?a<=b:false; }
  if(S==='date'){ const d=rptStr(v).slice(0,10); if(!d)return false; const t=today||rptToday();
    if(op==='=')return d===rptStr(f.val).slice(0,10);
    if(op==='>=')return d>=rptStr(f.val).slice(0,10);
    if(op==='<=')return d<=rptStr(f.val).slice(0,10);
    if(op==='last'){ const n=Math.max(1,parseInt(f.val,10)||30); const from=new Date(new Date(t+'T00:00:00Z').getTime()-(n-1)*864e5).toISOString().slice(0,10); return d>=from&&d<=t; }
    if(op==='this month')return rptMonth(d)===rptMonth(t);
    if(op==='last month'){ const y=+t.slice(0,4), m=+t.slice(5,7); const pm=new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7); return rptMonth(d)===pm; }
    if(op==='this year')return d.slice(0,4)===t.slice(0,4);
    return false; }
  const a=rptStr(v).toLowerCase(), b=rptStr(f.val).toLowerCase();
  if(op==='=')return a===b; if(op==='!=')return a!==b;
  if(op==='contains')return a.indexOf(b)>=0; if(op==='not contains')return a.indexOf(b)<0;
  if(op==='starts')return a.indexOf(b)===0;
  if(op==='in')return b.split(/[,\n]/).map(x=>x.trim()).filter(Boolean).includes(a);
  return true;
}

/* run a definition over rows for a role. Returns { cols:[{key,label,type}], rows:[[...]], total, truncated } */
function rptRun(def, rows, role, opts){
  opts=opts||{}; const today=opts.today||rptToday();
  const S=RPT_SOURCES[def.source]; if(!S)return {cols:[],rows:[],total:0,error:'Unknown source'};
  const allowed=rptAllowedCols(def.source, role); if(!allowed.length)return {cols:[],rows:[],total:0,error:'Your role cannot read this source'};
  let data=rows||[];
  // a specialist sees only their own rows
  if(S.own&&role==='sales'&&opts.ownTag){ const tag=String(opts.ownTag).toLowerCase(); data=data.filter(r=>rptStr(r[S.own]).toLowerCase()===tag); }
  // filters (only on columns the role may see)
  const filters=(def.filters||[]).filter(f=>f&&f.col&&allowed.includes(f.col)).map(f=>Object.assign({},f,{_type:S.cols[f.col]||'text'}));
  data=data.filter(r=>filters.every(f=>rptMatch(r,f,today)));
  const total=data.length;
  let cols, out;
  if(def.group&&def.group.by&&allowed.includes(def.group.by)){
    const by=def.group.by; const aggs=(def.group.aggs||[{fn:'count'}]).filter(a=>a.fn==='count'||(a.col&&allowed.includes(a.col)&&S.cols[a.col]==='num'));
    const g={}; for(const r of data){ const k=rptStr(r[by]); (g[k]||(g[k]=[])).push(r); }
    cols=[{key:by,label:by,type:S.cols[by]}].concat(aggs.map(a=>({key:a.fn+(a.col?'_'+a.col:''),label:a.fn==='count'?'count':a.fn+' of '+a.col,type:'num'})));
    out=Object.keys(g).map(k=>{ const rs=g[k]; return [k].concat(aggs.map(a=>{ if(a.fn==='count')return rs.length; const ns=rs.map(r=>rptNum(r[a.col])).filter(n=>n!=null); if(!ns.length)return null;
      if(a.fn==='sum')return Math.round(ns.reduce((x,y)=>x+y,0)*100)/100; if(a.fn==='avg')return Math.round(ns.reduce((x,y)=>x+y,0)/ns.length*100)/100; if(a.fn==='min')return Math.min.apply(null,ns); if(a.fn==='max')return Math.max.apply(null,ns); return null; })); });
  } else {
    const want=(def.columns||[]).filter(c=>allowed.includes(c)); const keys=want.length?want:allowed.slice(0,8);
    cols=keys.map(k=>({key:k,label:k,type:S.cols[k]}));
    out=data.map(r=>keys.map(k=>{ const v=r[k]; return v==null?null:(S.cols[k]==='num'?rptNum(v):S.cols[k]==='date'?rptStr(v).slice(0,10):v); }));
  }
  // sort
  if(def.sort&&def.sort.col){ const i=cols.findIndex(c=>c.key===def.sort.col); if(i>=0){ const dir=def.sort.dir==='desc'?-1:1; const num=cols[i].type==='num';
    out.sort((a,b)=>{ const x=a[i],y=b[i]; if(x==null&&y==null)return 0; if(x==null)return 1; if(y==null)return -1; return (num?(x-y):String(x).localeCompare(String(y)))*dir; }); } }
  const limit=Math.max(1,Math.min(20000,parseInt(def.limit,10)||5000));
  const truncated=out.length>limit; if(truncated)out=out.slice(0,limit);
  return {cols,rows:out,total,truncated};
}

function rptCSV(res){
  const q=v=>{ if(v==null)return ''; const s=String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  return [res.cols.map(c=>q(c.label)).join(',')].concat(res.rows.map(r=>r.map(q).join(','))).join('\n');
}

/* is a schedule due on a given Manila date? sched = {freq:'daily'|'weekly'|'monthly', dow:1..7 (Mon=1), dom:1..28|'last'} */
function rptDue(sched, dateISO){
  if(!sched||!sched.freq)return false; const d=new Date((dateISO||rptToday())+'T00:00:00Z');
  if(sched.freq==='daily')return true;
  if(sched.freq==='weekly'){ const dow=d.getUTCDay()||7; return dow===(parseInt(sched.dow,10)||1); }
  if(sched.freq==='monthly'){ const dom=d.getUTCDate(); if(sched.dom==='last'){ const n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); return dom===n; } return dom===(parseInt(sched.dom,10)||1); }
  return false;
}
function rptSchedText(s){ if(!s||!s.freq)return 'not scheduled'; if(s.freq==='daily')return 'every day, 6am'; if(s.freq==='weekly')return 'every '+(['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][parseInt(s.dow,10)||1])+', 6am'; if(s.freq==='monthly')return (s.dom==='last'?'last day of the month':'day '+(parseInt(s.dom,10)||1)+' of the month')+', 6am'; return 'not scheduled'; }

/* flatteners shared by both sides: raw HQ payloads → the row shapes the sources describe */
function rptFlattenSales(recent){ const out=[]; for(const o of (recent||[])){ for(const l of (o.ls||[])){ out.push({order:o.n,date:o.dt,specialist:o.t||'',customer:o.c||'',internal:o.x?1:0,sku:l[0],qty:l[1],amount:l[2]}); } } return out; }
function rptFlattenOrderLines(orders, lines){ const by={}; (orders||[]).forEach(o=>by[String(o.id)]=o); return (lines||[]).map(l=>{ const o=by[String(l.order_id)]||{}; return {order_id:l.order_id,date:o.date,account:o.account,spec:o.spec,status:o.status,sku:l.sku,name:l.name,qty:l.qty,price:l.price,amount:l.amount,is_free:l.is_free,deal:l.deal}; }); }
function rptFlattenBatches(batches){ return (batches||[]).map(b=>({sku:b.skuCode||b.sku,name:b.name||'',batch:b.batch,expiry:b.expiry,qty:b.soh!=null?b.soh:b.qty,bin:b.bin||''})); }

if(typeof module!=='undefined'&&module.exports){ module.exports={RPT_SOURCES,RPT_OPS,RPT_AGGS,RPT_COST_ROLES,rptAllowedCols,rptSourceAllowed,rptRun,rptCSV,rptDue,rptSchedText,rptFlattenSales,rptFlattenOrderLines,rptFlattenBatches,rptToday}; }
