const SHEET_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';

const OUT_START = 4400;
const OUT_END   = 15100;
const IN_START  = 650;
const IN_END    = 1210;
const PO_END    = 3910;

function pNum(v){if(v==null||v===''||v==='-')return null;const n=parseFloat(String(v).replace(/[₱,\s]/g,''));return isNaN(n)?null:n;}
function pInt(v){if(v==null||v===''||v==='-')return 0;const n=parseInt(String(v).replace(/[^-0-9]/g,''),10);return isNaN(n)?0:n;}
function clean(v){return v==null?'':String(v).replace(/^-$/,'').trim();}
function fmtExp(v){
  if(!v)return'';const s=String(v).trim();
  const mdy=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(mdy)return mdy[1]+'/'+mdy[3];
  if(s.match(/^\d{1,2}\/\d{4}$/))return s;
  return s;
}
function serialMK(s){
  if(!s||typeof s!=='number'||s<1)return null;
  const d=new Date((s-25569)*86400000);
  return isNaN(d)?null:d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
}
function serialExp(s){
  if(!s||typeof s!=='number'||s<1)return'';
  const d=new Date((s-25569)*86400000);
  return isNaN(d)?'':(d.getUTCMonth()+1)+'/'+d.getUTCFullYear();
}
function encR(tab,r){return encodeURIComponent(`'${tab}'!${r}`);}

let KEY='';

async function batchFetch(ranges,formatted){
  const params=ranges.map(r=>`ranges=${encR(r.t,r.r)}`).join('&');
  const render=formatted?'FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING':'UNFORMATTED_VALUE';
  const url=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?key=${KEY}&${params}&valueRenderOption=${render}`;
  const resp=await fetch(url);
  if(!resp.ok){const txt=await resp.text();throw new Error(`Sheets ${resp.status}: ${txt.slice(0,200)}`);}
  return(await resp.json()).valueRanges.map(vr=>vr.values||[]);
}

export default async function handler(request,context){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if(request.method!=='POST')return new Response('Method not allowed',{status:405});

  KEY=Deno.env.get('GOOGLE_API_KEY')||'';
  if(!KEY)return new Response(JSON.stringify({error:'GOOGLE_API_KEY not set'}),{status:500,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});

  try{
    // Two parallel batches — total ~75K cells, well within 10s timeout
    const [fmtResults, rawResults] = await Promise.all([

      // BATCH A — formatted display strings, small (~10K cells)
      batchFetch([
        {t:'Product Database', r:'A1:K200'},   // 2,200 cells
        {t:'Shelf Life',       r:'A1:L600'},   // 7,200 cells
        {t:'Price',            r:'A1:E200'},   // 1,000 cells
      ], true),

      // BATCH B — raw numbers + serial dates (~65K cells)
      batchFetch([
        {t:'Inventory Overview',         r:'A1:J1001'},                          // 10,010 cells — stock totals
        {t:'Sending Inventory (OUT)',    r:`A${OUT_START}:A${OUT_END}`},          // 10,700 cells — SKU only
        {t:'Sending Inventory (OUT)',    r:`D${OUT_START}:D${OUT_END}`},          // 10,700 cells — QTY only
        {t:'Sending Inventory (OUT)',    r:`G${OUT_START}:H${OUT_END}`},          // 21,400 cells — Date + Customer
        {t:'Receiving Inventory (IN)',   r:`A${IN_START}:G${IN_END}`},            //  3,920 cells — 2025+ IN
        {t:'Pull-out Orders (INTERNAL)', r:`A2:C${PO_END}`},                      // 11,730 cells — full PO for shrinkage
      ], false),
    ]);

    const [dbRows, shelfRows, priceRows] = fmtResults;
    const [ovRows, outSKU, outQTY, outDateCust, inRows, poRows] = rawResults;

    // ── Prices ──
    const prices={};
    for(const row of dbRows.slice(1)){const sku=clean(row[0]);const p=pNum(row[5]);if(sku&&p>0)prices[sku]=p;}
    for(const row of priceRows.slice(1)){const sku=clean(row[0]);const p=pNum(row[4]);if(sku&&p>0&&!prices[sku])prices[sku]=p;}

    // ── Master (bin, batch, expiry) ──
    const master={};
    for(const row of dbRows.slice(1)){
      const sku=clean(row[0]);if(!sku||sku==='SKU')continue;
      master[sku]={batch:clean(row[6]),expiry:fmtExp(row[7]),bin:clean(row[9])};
    }

    // ── Products from Inventory Overview ──
    // UNFORMATTED: SKU(0) Name(1) Line(2) Category(3) Received(4) Sold(5) Stock(6) ?(7) ?(8) ExpirySerial(9)
    const products=[];
    for(const row of ovRows.slice(1)){
      const sku=clean(row[0]);if(!sku||sku==='SKU')continue;
      if(typeof row[6]==='string'&&row[6].toLowerCase().includes('inventory'))continue;
      const stock=pInt(row[6]);
      const line=clean(row[2]);
      const rawCat=clean(row[3]);
      const category=rawCat==='MKT Samples'?'MKT SAMPLES':rawCat==='SKINPEN  MKT'?'SKINPEN MKT':rawCat||line||'Other';
      const m=master[sku]||{};
      products.push({sku,name:clean(row[1]),line,category,
        received:pInt(row[4]),sold:pInt(row[5]),stock,
        price:prices[sku]??null,
        batch:m.batch||'',expiry:m.expiry||serialExp(row[9]),bin:m.bin||''});
    }

    // ── Shelf Life → FEFO batches ──
    const batches=[];
    for(const row of shelfRows.slice(2)){
      const name=clean(row[2]);const expiry=fmtExp(clean(row[5]));
      if(!name||!expiry)continue;
      batches.push({skuCode:clean(row[1]),name,line:clean(row[3]),batch:clean(row[4]),
        expiry,monthsLeft:pNum(row[6]),qty:pInt(row[7]),soh:pInt(row[9]),tag:clean(row[10])});
    }
    batches.sort((a,b)=>{
      const pa=a.expiry.match(/^(\d{1,2})\/(\d{4})$/),pb=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
      return(pa?new Date(+pa[2],+pa[1]-1,1):new Date(9999,0,1))-(pb?new Date(+pb[2],+pb[1]-1,1):new Date(9999,0,1));
    });

    // ── Monthly movement + velocity + branch transfers ──
    const now=new Date();
    const months=[];
    let mdate=new Date(now.getFullYear(),now.getMonth(),1);
    for(let i=0;i<13;i++){months.unshift(mdate.getFullYear()+'-'+String(mdate.getMonth()+1).padStart(2,'0'));mdate=new Date(mdate.getFullYear(),mdate.getMonth()-1,1);}
    const monthlyIn=Object.fromEntries(months.map(m=>[m,0]));
    const monthlyOut=Object.fromEntries(months.map(m=>[m,0]));
    const skuMO={};
    const lastSaleSerial={};
    const branchTransfers=[];

    const BMAP={
      'APRIL GERALDEZ':'BGC','APRIL':'BGC','REMEDY BGC':'BGC','ANGELA DACONES':'BGC','ANGELA':'BGC',
      'REMEDY VERTIS':'Vertis North','VERTIS':'Vertis North','MICH':'Vertis North',
      'REMEDY GH':'GH Mall','GH MALL':'GH Mall',
    };

    // outSKU[i]=[SKU], outQTY[i]=[QTY], outDateCust[i]=[DateSerial, Customer]
    const outLen=Math.min(outSKU.length,outQTY.length,outDateCust.length);
    for(let i=0;i<outLen;i++){
      const sku=clean(outSKU[i]?.[0]);
      const qty=pInt(outQTY[i]?.[0]);
      const dateS=outDateCust[i]?.[0];   // col G
      const cust=outDateCust[i]?.[1]||''; // col H
      if(!sku||qty<=0)continue;
      const mk=serialMK(dateS);
      if(mk){
        if(monthlyOut[mk]!==undefined)monthlyOut[mk]+=qty;
        if(!skuMO[sku])skuMO[sku]={};
        skuMO[sku][mk]=(skuMO[sku][mk]||0)+qty;
        if(!lastSaleSerial[sku]||dateS>lastSaleSerial[sku])lastSaleSerial[sku]=dateS;
      }
      const custUp=String(cust).trim().toUpperCase();
      let branch=null;
      for(const[kw,br]of Object.entries(BMAP)){if(custUp.includes(kw)){branch=br;break;}}
      if(branch&&dateS){
        const yr=Math.floor((dateS-25569)/365.25)+1970;
        if(yr>=2025)branchTransfers.push({branch,sku,name:sku,qty,dateSerial:dateS,batch:'',expiry:'',order:'',line:''});
      }
    }
    branchTransfers.sort((a,b)=>(b.dateSerial||0)-(a.dateSerial||0));

    // Receiving IN 2025+: SKU(0) ?(1) Batch(2) QTY(3) ?(4) ?(5) DateSerial(6)
    for(const row of inRows){
      const mk=serialMK(row[6]);const qty=pInt(row[3]);
      if(mk&&monthlyIn[mk]!==undefined&&qty>0)monthlyIn[mk]+=qty;
    }

    // Pull-out for shrinkage: SKU(0) Name(1) ServedQTY(2)
    const pulloutTotal={};
    for(const row of poRows){
      const sku=clean(row[0]);const qty=pInt(row[2]);
      if(sku&&qty>0)pulloutTotal[sku]=(pulloutTotal[sku]||0)+qty;
    }

    // ── Enrich products ──
    const last6=months.slice(-6);
    for(const p of products){
      const mo=skuMO[p.sku]||{};
      const avgVel=last6.reduce((a,m)=>a+(mo[m]||0),0)/6;
      p.velocity=Math.round(avgVel*10)/10;
      p.monthsOfStock=avgVel>0&&p.stock>0?Math.round((p.stock/avgVel)*10)/10:null;
      const ls=lastSaleSerial[p.sku];
      if(ls){const ld=new Date((ls-25569)*86400000);p.daysSinceLastSale=Math.round((now-ld)/86400000);p.lastSaleDate=ld.toISOString().slice(0,10);}
      else{p.daysSinceLastSale=p.sold>0?999:null;p.lastSaleDate=p.sold>0?'Before 2025':null;}
      p.agedBucket=p.daysSinceLastSale===null?null:p.daysSinceLastSale>180?'dead':p.daysSinceLastSale>90?'slow':p.daysSinceLastSale>30?'aging':'active';
      p.shrinkage=p.received>0?p.received-p.sold-(pulloutTotal[p.sku]||0)-p.stock:0;
      p.shrinkageValue=Math.abs(p.shrinkage)*(p.price||0);
    }

    // ── Value by line ──
    const valueByLine={};
    for(const p of products){if(p.stock>0&&p.price)valueByLine[p.line]=(valueByLine[p.line]||0)+p.stock*p.price;}

    // ── Cash in expiring stock ──
    const cashExpiring={expired:0,lt30:0,lt90:0,lt180:0};
    const expiringItems=[];
    for(const b of batches){
      if(!b.expiry||b.soh<=0)continue;
      const pm=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);if(!pm)continue;
      const days=Math.round((new Date(+pm[2],+pm[1]-1,1)-now)/86400000);
      const price=prices[b.skuCode]||0;const value=b.soh*price;
      const bucket=days<0?'expired':days<=30?'lt30':days<=92?'lt90':days<=183?'lt180':null;
      if(bucket){cashExpiring[bucket]+=value;expiringItems.push({name:b.name,skuCode:b.skuCode,batch:b.batch,expiry:b.expiry,days,soh:b.soh,price,value,bucket});}
    }
    expiringItems.sort((a,b)=>b.value-a.value);

    // ── Branch expiry summary ──
    const bExp={};
    for(const t of branchTransfers){
      if(!bExp[t.branch])bExp[t.branch]={};
      const k=t.sku+'|'+t.batch;
      if(!bExp[t.branch][k])bExp[t.branch][k]={sku:t.sku,name:t.name,batch:t.batch,expiry:t.expiry,qty:0,line:t.line};
      bExp[t.branch][k].qty+=t.qty;
    }
    const branchExpirySummary={};
    for(const[br,items]of Object.entries(bExp)){
      branchExpirySummary[br]=Object.values(items).filter(i=>i.expiry).sort((a,b)=>{
        const pa=a.expiry.match(/^(\d{1,2})\/(\d{4})$/),pb=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
        return(pa?new Date(+pa[2],+pa[1]-1,1):new Date(9999,0,1))-(pb?new Date(+pb[2],+pb[1]-1,1):new Date(9999,0,1));
      });
    }

    if(products.length<5)throw new Error(`Only ${products.length} products — check sheet sharing`);

    return new Response(JSON.stringify({
      products,batches,monthlyIn,monthlyOut,months,valueByLine,
      cashExpiring,expiringItems:expiringItems.slice(0,100),
      branchTransfers:branchTransfers.slice(0,300),
      branchExpirySummary,synced:new Date().toISOString(),
    }),{status:200,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});

  }catch(err){
    return new Response(JSON.stringify({error:err.message}),{status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }
}
export const config={path:'/api/sync'};
