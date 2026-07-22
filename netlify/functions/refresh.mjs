const SHEET_ID='1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';
const OUT_START=4410,OUT_END=15100,IN_START=650,IN_END=1210,PO_END=3910;

function pNum(v){if(v==null||v===''||v==='-')return null;const n=parseFloat(String(v).replace(/[₱,\s]/g,''));return isNaN(n)?null:n;}
function pInt(v){if(v==null||v===''||v==='-')return 0;const n=parseInt(String(v).replace(/[^-0-9]/g,''),10);return isNaN(n)?0:n;}
function clean(v){return v==null?'':String(v).replace(/^-$/,'').trim();}
function fmtExp(v){if(!v)return'';const s=String(v).trim();const mdy=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(mdy)return mdy[1]+'/'+mdy[3];if(s.match(/^\d{1,2}\/\d{4}$/))return s;return s;}
function serialMK(s){if(!s||typeof s!=='number'||s<1)return null;const d=new Date((s-25569)*86400000);return isNaN(d)?null:d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');}
function serialExp(s){if(!s||typeof s!=='number'||s<1)return'';const d=new Date((s-25569)*86400000);return isNaN(d)?'':(d.getUTCMonth()+1)+'/'+d.getUTCFullYear();}
function encR(tab,r){return encodeURIComponent("'"+tab+"'!"+r);}

async function batchFetch(KEY,ranges,formatted){
  const params=ranges.map(r=>'ranges='+encR(r.t,r.r)).join('&');
  const render=formatted?'FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING':'UNFORMATTED_VALUE';
  const url='https://sheets.googleapis.com/v4/spreadsheets/'+SHEET_ID+'/values:batchGet?key='+KEY+'&'+params+'&valueRenderOption='+render;
  const resp=await fetch(url);
  if(!resp.ok){const txt=await resp.text();throw new Error('Sheets '+resp.status+': '+txt.slice(0,300));}
  return(await resp.json()).valueRanges.map(vr=>vr.values||[]);
}

export const handler=async(event,context)=>{
  const hdrs={
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'POST,GET,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Content-Type':'application/json',
  };
  if(event.httpMethod==='OPTIONS')return{statusCode:204,headers:hdrs,body:''};
  const KEY=process.env.GOOGLE_API_KEY||'';
  if(!KEY)return{statusCode:500,headers:hdrs,body:JSON.stringify({error:'GOOGLE_API_KEY not set'})};
  const t0=Date.now();
  try{
    const [fR,rR]=await Promise.all([
      batchFetch(KEY,[
        {t:'Product Database',r:'A1:K300'},
        {t:'Shelf Life',r:'A1:L700'},
        {t:'Price',r:'A1:E300'},
      ],true),
      batchFetch(KEY,[
        {t:'Inventory Overview',r:'A1:J1100'},
        {t:'Sending Inventory (OUT)',r:'A'+OUT_START+':A'+OUT_END},
        {t:'Sending Inventory (OUT)',r:'D'+OUT_START+':D'+OUT_END},
        {t:'Sending Inventory (OUT)',r:'G'+OUT_START+':H'+OUT_END},
        {t:'Sending Inventory (OUT)',r:'I'+OUT_START+':K'+OUT_END},
        {t:'Receiving Inventory (IN)',r:'A'+IN_START+':G'+IN_END},
        {t:'Pull-out Orders (INTERNAL)',r:'A2:C'+PO_END},
      ],false),
    ]);
    const [dbR,shR,prR]=fR;
    const [ovR,oSKU,oQTY,oDC,oIK,inR,poR]=rR;

    const prices={};
    for(const r of dbR.slice(1)){const s=clean(r[0]);const p=pNum(r[5]);if(s&&p>0)prices[s]=p;}
    for(const r of prR.slice(1)){const s=clean(r[0]);const p=pNum(r[4]);if(s&&p>0&&!prices[s])prices[s]=p;}

    const master={};
    for(const r of dbR.slice(1)){const s=clean(r[0]);if(!s||s==='SKU')continue;master[s]={batch:clean(r[6]),expiry:fmtExp(r[7]),bin:clean(r[9])};}

    const products=[];
    for(const r of ovR.slice(1)){
      const s=clean(r[0]);if(!s||s==='SKU')continue;
      if(typeof r[6]==='string'&&r[6].toLowerCase().includes('inventory'))continue;
      const stock=pInt(r[6]);const line=clean(r[2]);const rc=clean(r[3]);
      const cat=rc==='MKT Samples'?'MKT SAMPLES':rc==='SKINPEN  MKT'?'SKINPEN MKT':rc||line||'Other';
      const m=master[s]||{};
      products.push({sku:s,name:clean(r[1]),line,category:cat,received:pInt(r[4]),sold:pInt(r[5]),stock,price:prices[s]??null,batch:m.batch||'',expiry:m.expiry||serialExp(r[9]),bin:m.bin||''});
    }

    const batches=[];
    for(const r of shR.slice(2)){const n=clean(r[2]);const e=fmtExp(clean(r[5]));if(!n||!e)continue;batches.push({skuCode:clean(r[1]),name:n,line:clean(r[3]),batch:clean(r[4]),expiry:e,monthsLeft:pNum(r[6]),qty:pInt(r[7]),soh:pInt(r[9]),tag:clean(r[10])});}
    batches.sort((a,b)=>{const pa=a.expiry.match(/^(\d{1,2})\/(\d{4})$/),pb=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);return(pa?new Date(+pa[2],+pa[1]-1,1):new Date(9999,0,1))-(pb?new Date(+pb[2],+pb[1]-1,1):new Date(9999,0,1));});

    const now=new Date();
    const months=[];
    let md=new Date(now.getFullYear(),now.getMonth(),1);
    for(let i=0;i<13;i++){months.unshift(md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0'));md=new Date(md.getFullYear(),md.getMonth()-1,1);}
    const mIn=Object.fromEntries(months.map(m=>[m,0]));
    const mOut=Object.fromEntries(months.map(m=>[m,0]));
    const skuMO={},lss={},bT=[];

    const BMAP={'APRIL GERALDEZ':'BGC','APRIL':'BGC','REMEDY BGC':'BGC','ANGELA DACONES':'BGC','ANGELA':'BGC','REMEDY VERTIS':'Vertis North','VERTIS':'Vertis North','MICH':'Vertis North','REMEDY GH':'GH Mall','GH MALL':'GH Mall'};

    // Product metadata lookup for transfer enrichment
    const prodMeta={};
    for(const p of products) prodMeta[p.sku]={name:p.name,line:p.line};
    // OUT columns I:K -> [0]=batch, [1]=expiry, [2]=order ref (adjust indices here if sheet layout differs)
    function outExpiry(v){
      if(v==null||v==='')return'';
      if(typeof v==='number')return serialExp(v);
      return fmtExp(clean(v));
    }

    const ol=Math.min(oSKU.length,oQTY.length,oDC.length);
    for(let i=0;i<ol;i++){
      const s=clean(oSKU[i]?.[0]);const q=pInt(oQTY[i]?.[0]);const ds=oDC[i]?.[0];const cu=String(oDC[i]?.[1]||'');
      if(!s||q<=0)continue;
      const mk=serialMK(ds);
      if(mk){if(mOut[mk]!==undefined)mOut[mk]+=q;if(!skuMO[s])skuMO[s]={};skuMO[s][mk]=(skuMO[s][mk]||0)+q;if(!lss[s]||ds>lss[s])lss[s]=ds;}
      const cup=cu.trim().toUpperCase();let br=null;
      for(const[kw,b] of Object.entries(BMAP)){if(cup.includes(kw)){br=b;break;}}
      if(br&&ds){
        const yr=Math.floor((ds-25569)/365.25)+1970;
        if(yr>=2025){
          const ik=oIK[i]||[];
          const meta=prodMeta[s]||{};
          bT.push({branch:br,sku:s,name:meta.name||s,qty:q,dateSerial:ds,batch:clean(ik[0]),expiry:outExpiry(ik[1]),order:clean(ik[2]),line:meta.line||''});
        }
      }
    }
    bT.sort((a,b)=>(b.dateSerial||0)-(a.dateSerial||0));

    for(const r of inR){const mk=serialMK(r[6]);const q=pInt(r[3]);if(mk&&mIn[mk]!==undefined&&q>0)mIn[mk]+=q;}

    const pt={};
    for(const r of poR){const s=clean(r[0]);const q=pInt(r[2]);if(s&&q>0)pt[s]=(pt[s]||0)+q;}

    const l6=months.slice(-6);
    const comp=months.slice(0,12); // 12 complete months, excludes current partial month
    const curKey=months[12];

    function seasonalIdx(mo){
      // month-of-year index from all complete-month history; null if too little signal
      const entries=Object.entries(mo).filter(([k])=>k<curKey);
      if(entries.length<10)return null;
      const mean=entries.reduce((a,[,v])=>a+v,0)/entries.length;
      if(mean<=0.5)return null;
      const sum={},cnt={};
      for(const[k,v] of entries){const m=+k.slice(5);sum[m]=(sum[m]||0)+v;cnt[m]=(cnt[m]||0)+1;}
      const idx=[];
      for(let m=1;m<=12;m++)idx[m-1]=cnt[m]?Math.round(Math.min(3,Math.max(0.3,(sum[m]/cnt[m])/mean))*100)/100:1;
      return idx;
    }
    function simStockout(stock,fcM){
      if(stock==null)return null;
      if(stock<=0)return 0;
      let rem=stock,days=0,d=new Date(now);
      for(let k=0;k<12;k++){
        const y=d.getFullYear(),m=d.getMonth();
        const dim=new Date(y,m+1,0).getDate();
        const daily=(k<fcM.length?fcM[k]:fcM[fcM.length-1])/dim;
        const dRem=k===0?dim-d.getDate()+1:dim;
        if(daily>0&&rem<=daily*dRem){return days+Math.ceil(rem/daily);}
        rem-=daily*dRem;days+=dRem;d=new Date(y,m+1,1);
      }
      return null; // beyond 12 months
    }

    for(const p of products){
      const mo=skuMO[p.sku]||{};
      const av=l6.reduce((a,m)=>a+(mo[m]||0),0)/6;
      p.velocity=Math.round(av*10)/10;

      // Trend: last 3 complete months vs prior 3
      const g3=arr=>arr.reduce((a,m)=>a+(mo[m]||0),0)/3;
      const last3=g3(comp.slice(-3)),prior3=g3(comp.slice(-6,-3));
      let tr=prior3>0?last3/prior3:(last3>0?1.3:1);
      tr=Math.min(2.5,Math.max(0.4,tr));
      const growth=Math.min(1.25,Math.max(0.85,Math.pow(tr,1/3)));
      p.trend=Math.round(tr*100)/100;
      p.trendFlag=(last3>=1||prior3>=1)?(tr>=1.15?'up':tr<=0.85?'down':'flat'):'flat';

      // Seasonality: month-of-year weighting
      const idx=seasonalIdx(mo);
      p.seasonal=!!idx;
      const sIdx=idx||Array(12).fill(1);
      // Base = deseasonalized average of last 6 complete months
      const base6=comp.slice(-6);
      const base=base6.reduce((a,m)=>a+(mo[m]||0)/sIdx[(+m.slice(5))-1],0)/6;

      // 6-month forecast, trend compounding capped at 4 months out
      const curM=now.getMonth(); // 0-based
      p.fcM=[];
      for(let k=0;k<6;k++){
        const cal=(curM+k)%12;
        p.fcM.push(Math.round(base*sIdx[cal]*Math.pow(growth,Math.min(k,4))*10)/10);
      }
      p.velAdj=p.fcM[0];

      // Demand variability (coefficient of variation) over complete-month history.
      // Trim leading zeros so a SKU launched mid-history isn't penalised for months it didn't exist.
      const compVals=comp.map(m=>mo[m]||0);
      const fi=compVals.findIndex(v=>v>0);
      const series=fi<0?[]:compVals.slice(fi);
      const dn=series.length;
      let dmean=null,dstd=null,dcv=null,dzero=null,dclass='insufficient';
      if(dn>=1){
        dmean=series.reduce((a,v)=>a+v,0)/dn;
        dstd=dn>=2?Math.sqrt(series.reduce((a,v)=>a+(v-dmean)*(v-dmean),0)/(dn-1)):0;
        dzero=series.filter(v=>v===0).length/dn;
        if(dmean>0)dcv=dstd/dmean;
        if(dn<3||dmean<=0)dclass='insufficient';
        else if(dzero>=0.5)dclass='lumpy';       // intermittent / spiky demand
        else if(dcv<0.5)dclass='steady';
        else if(dcv<=1.0)dclass='variable';
        else dclass='lumpy';
      }
      p.demandN=dn;
      p.demandMean=dmean!=null?Math.round(dmean*10)/10:null;   // units/mo
      p.demandStd=dstd!=null?Math.round(dstd*100)/100:null;    // units/mo std dev
      p.cv=dcv!=null?Math.round(dcv*100)/100:null;
      p.zeroShare=dzero!=null?Math.round(dzero*100)/100:null;
      p.demandClass=dclass;

      // Stockout projection
      p.daysToStockout=simStockout(p.stock,p.fcM);
      p.stockoutDate=p.daysToStockout!=null?new Date(now.getTime()+p.daysToStockout*864e5).toISOString().slice(0,10):null;

      p.monthsOfStock=av>0&&p.stock>0?Math.round((p.stock/av)*10)/10:null;
      const ls=lss[p.sku];
      if(ls){const ld=new Date((ls-25569)*86400000);p.daysSinceLastSale=Math.round((now-ld)/86400000);p.lastSaleDate=ld.toISOString().slice(0,10);}
      else{p.daysSinceLastSale=p.sold>0?999:null;p.lastSaleDate=p.sold>0?'Before 2025':null;}
      p.agedBucket=p.daysSinceLastSale===null?null:p.daysSinceLastSale>180?'dead':p.daysSinceLastSale>90?'slow':p.daysSinceLastSale>30?'aging':'active';
      p.shrinkage=p.received>0?p.received-p.sold-(pt[p.sku]||0)-p.stock:0;
      p.shrinkageValue=Math.abs(p.shrinkage)*(p.price||0);
    }

    // ABC classification by 6-month consumption value
    const priced=products.map(p=>p.price).filter(v=>v>0).sort((a,b)=>a-b);
    const medPrice=priced.length?priced[Math.floor(priced.length/2)]:0;
    const scored=products.map(p=>{
      const mo=skuMO[p.sku]||{};
      const units=comp.slice(-6).reduce((a,m)=>a+(mo[m]||0),0);
      return {p,score:units*(p.price||medPrice)};
    }).sort((a,b)=>b.score-a.score);
    const totScore=scored.reduce((a,x)=>a+x.score,0);
    let cum=0;
    for(const x of scored){
      cum+=x.score;
      x.p.abcShare=totScore>0?Math.round(x.score/totScore*10000)/100:0;
      x.p.abc=x.score<=0?'C':(cum/totScore<=0.80?'A':cum/totScore<=0.95?'B':'C');
    }

    // Expiry-vs-demand collision: FEFO depletion vs adjusted velocity
    const velBySku={};
    for(const p of products)velBySku[p.sku]=p.velAdj||0;
    const colGroups={};
    for(const b of batches){
      if(b.soh<=0)continue;
      const pm=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
      if(!pm)continue;
      (colGroups[b.skuCode]=colGroups[b.skuCode]||[]).push({b,pm});
    }
    const collisions=[];
    for(const[sku,list] of Object.entries(colGroups)){
      const daily=(velBySku[sku]||0)/30.44;
      let ahead=0;
      for(const{b,pm} of list){ // batches[] is already FEFO-sorted
        const expEnd=new Date(+pm[2],+pm[1],0); // last day of expiry month
        const dte=Math.max(0,Math.round((expEnd-now)/864e5));
        const sellable=Math.max(0,daily*dte-ahead);
        const projSold=Math.min(b.soh,sellable);
        const projExpired=Math.round(b.soh-projSold);
        const price=prices[sku]||0;
        collisions.push({sku,name:b.name,batch:b.batch,expiry:b.expiry,daysToExpiry:dte,soh:b.soh,stockAhead:Math.round(ahead),daily:Math.round(daily*100)/100,price,projExpired,writeOff:Math.round(projExpired*price)});
        ahead+=b.soh;
      }
    }
    collisions.sort((a,b)=>b.writeOff-a.writeOff||b.projExpired-a.projExpired);

    const vbl={};
    for(const p of products){if(p.stock>0&&p.price)vbl[p.line]=(vbl[p.line]||0)+p.stock*p.price;}

    const ce={expired:0,lt30:0,lt90:0,lt180:0};const ei=[];
    for(const b of batches){
      if(!b.expiry||b.soh<=0)continue;
      const pm=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);if(!pm)continue;
      const days=Math.round((new Date(+pm[2],+pm[1]-1,1)-now)/86400000);
      const price=prices[b.skuCode]||0;const value=b.soh*price;
      const bkt=days<0?'expired':days<=30?'lt30':days<=92?'lt90':days<=183?'lt180':null;
      if(bkt){ce[bkt]+=value;ei.push({name:b.name,skuCode:b.skuCode,batch:b.batch,expiry:b.expiry,days,soh:b.soh,price,value,bucket:bkt});}
    }
    ei.sort((a,b)=>b.value-a.value);

    const bExp={};
    for(const t of bT){if(!bExp[t.branch])bExp[t.branch]={};const k=t.sku+'|'+t.batch;if(!bExp[t.branch][k])bExp[t.branch][k]={sku:t.sku,name:t.name,batch:t.batch,expiry:t.expiry,qty:0,line:t.line};bExp[t.branch][k].qty+=t.qty;}
    const bes={};
    for(const[br,items] of Object.entries(bExp)){bes[br]=Object.values(items).filter(i=>i.expiry).sort((a,b)=>{const pa=a.expiry.match(/^(\d{1,2})\/(\d{4})$/),pb=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);return(pa?new Date(+pa[2],+pa[1]-1,1):new Date(9999,0,1))-(pb?new Date(+pb[2],+pb[1]-1,1):new Date(9999,0,1));});}

    const elapsed=((Date.now()-t0)/1000).toFixed(1);
    return{
      statusCode:200,
      headers:hdrs,
      body:JSON.stringify({products,batches,monthlyIn:mIn,monthlyOut:mOut,months,valueByLine:vbl,cashExpiring:ce,expiringItems:ei.slice(0,100),branchTransfers:bT.slice(0,300),branchExpirySummary:bes,collisions:collisions.slice(0,400),synced:new Date().toISOString(),elapsed}),
    };

  }catch(err){
    return{statusCode:500,headers:hdrs,body:JSON.stringify({error:err.message})};
  }
};
