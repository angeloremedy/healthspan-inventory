/* ── ORG CHART (Company → Org chart) ──────────────────────────────────────────
   Healthspan Global's organisational chart, as the People team keeps it (the
   Healthspan page of the "Remedy/Healthspan Org Chart" Canva design, read
   2026-09-18). Every name is a button: it opens the person's card — title, who
   they report to, who reports to them, their level — and, where HQ has a page
   for the person, the way to it (a product specialist's sales page; Team &
   access for those who may open it). Open to every role: it carries no cost,
   no pay, nothing but names, titles and the reporting line.
   Two layouts: the tree (wide screens, scrolls sideways) and the outline (phones,
   or the List toggle) — same data, same buttons. Until the HR module owns people
   records, the data lives here; edit ORG_PEOPLE and rebuild. */
const ORG_UPDATED='2026-09-18';
// level → legend swatch. founder | manager | lead | associate | consultant | intern | vacant
const ORG_LEVEL={founder:{lbl:'Co-Founders',bg:'#00168F',fg:'#fff',bd:'#00168F'},manager:{lbl:'Managers',bg:'#FFE58A',fg:'#3a2e00',bd:'#E5C445'},lead:{lbl:'Leads',bg:'#FFB459',fg:'#3a2000',bd:'#E0912A'},associate:{lbl:'Associates',bg:'#DCE7FF',fg:'#10245E',bd:'#9DB4F0'},consultant:{lbl:'Part-Timers / Consultants',bg:'#F9D9DF',fg:'#5a1e2a',bd:'#E6A4B2'},intern:{lbl:'Interns',bg:'#F0F0F4',fg:'#333',bd:'#C8C8D2'},vacant:{lbl:'Vacant',bg:'#E3F6E5',fg:'#1f5b2a',bd:'#8CCB99'}};
// boss: the id of the person reported to; 'exec' = the two co-founders jointly. spec: the Shopify specialist tag HQ knows the person by.
const ORG_PEOPLE=[
  {id:'paul',name:'Paul Rivera',title:'Managing Director, Co-Founder',boss:null,level:'founder'},
  {id:'april',name:'Dra. April Geraldez-Rivera',title:'Medical Director, Co-Founder',boss:null,level:'founder'},
  // ── reporting to the co-founders
  {id:'alexis',name:'Alexis Catapang',title:'Group Finance Manager',boss:'exec',level:'manager'},
  {id:'agnes',name:'Agnes Fernando',title:'Group People Operations Sr. Manager',boss:'exec',level:'manager'},
  {id:'ivy',name:'Ivy Buenaobra-Cano',title:'Group Office Manager & Executive Assistant',boss:'exec',level:'associate'},
  {id:'justine',name:'Felicilda, Mary Justine R.',title:'Group IT Operations Associate',boss:'exec',level:'associate'},
  {id:'angelo',name:'Mojica, Angelo Brylle A.',title:'Group AI Engineer',boss:'exec',level:'associate'},
  {id:'maria',name:'Maria Drake Brockman',title:'Marketing Associate',boss:'exec',level:'associate'},
  {id:'miyahra',name:'Miyahra Lopez',title:'Medical Liaison',boss:'exec',level:'consultant'},
  {id:'marj',name:'Marjorie Sy',title:'Country Sales Head',boss:'exec',level:'manager'},
  // ── finance
  {id:'kristal',name:'Kristal Laurente',title:'Finance Lead',boss:'alexis',level:'lead'},
  {id:'julia',name:'Julia Razo',title:'Accounting Associate',boss:'kristal',level:'associate'},
  {id:'dazthyn',name:'Dazthyn Jumawid',title:'Accounting Associate',boss:'kristal',level:'associate'},
  {id:'sean',name:'Sean Carey',title:'Accounting Associate',boss:'kristal',level:'associate'},
  {id:'kathleen',name:'Kathleen Ivy Batiancila',title:'Bookkeeper',boss:'kristal',level:'associate'},
  {id:'gladys',name:'Gladys Royales',title:'Group Procurement Officer',boss:'alexis',level:'associate'},
  {id:'jerome',name:'Jerome Matias',title:'Group Facilities Officer',boss:'alexis',level:'associate'},
  // ── people operations
  {id:'emelyn',name:'Emelyn Jore',title:'Group People Operations Jr. Manager',boss:'agnes',level:'manager'},
  {id:'aiko',name:'Aiko Gonzales',title:'Group Sr. People Operations Associate',boss:'emelyn',level:'associate'},
  {id:'bernadette',name:'Bernadette Sison',title:'Group Sr. People Operations Associate',boss:'emelyn',level:'associate'},
  {id:'nerissa',name:'Nerissa Ramos',title:'Group People Operations Associate',boss:'emelyn',level:'associate'},
  {id:'angela',name:'Angela Ibon',title:'Group People Operations Associate',boss:'emelyn',level:'associate'},
  {id:'mich',name:'Mich Fariñas',title:'Group People Operations Associate',boss:'emelyn',level:'associate'},
  // ── AI
  {id:'ceferino',name:'Jumao-as, Ceferino',title:'Group AI Intern',boss:'angelo',level:'intern'},
  // ── marketing (group)
  {id:'jeanne',name:'Jeanne Tecson',title:'Marketing Intern',boss:'maria',level:'intern'},
  {id:'patricia',name:'Patricia Fugen',title:'Multimedia Associate',boss:'maria',level:'associate'},
  {id:'carmen',name:'Carmen Melo',title:'Content Creator',boss:'maria',level:'associate'},
  {id:'nadine',name:'Nadine Bayot',title:'Graphic Designer',boss:'maria',level:'associate'},
  // ── sales, under the Country Sales Head
  {id:'verna',name:'Vernadette Arco',title:'Supply Chain Manager',boss:'marj',level:'manager'},
  {id:'joemar',name:'Joemar Clemencio',title:'Logistics and Operations Associate',boss:'verna',level:'associate'},
  {id:'rose',name:'Rose Camba',title:'Logistics and Operations Associate',boss:'verna',level:'associate'},
  {id:'angelie',name:'Angelie Alejandria',title:'Logistics and Operations Associate',boss:'verna',level:'associate'},
  {id:'floyd',name:'Floyd Esperida',title:'Field Service Technician',boss:'verna',level:'associate'},
  {id:'camille',name:'Camille Nim',title:'Regulatory Affairs Specialist',boss:'verna',level:'associate'},
  {id:'maricris',name:'Maricris Libatique',title:'Product Marketing Manager',boss:'marj',level:'manager'},
  {id:'marichu',name:'Marichu Vanguardia',title:'Brand Manager - Mesoestetic',boss:'maricris',level:'manager'},
  {id:'anamarie',name:'Anamarie Fox',title:'Sales and Marketing Coordinator',boss:'maricris',level:'associate'},
  {id:'ruperto',name:'Ruperto Dela Cruz Jr.',title:'Sales Manager',boss:'marj',level:'manager'},
  {id:'team1',name:'Team 1',title:'Product specialists',boss:'ruperto',level:'group'},
  {id:'ruth',name:'Ruth Jabonero',title:'Product Specialist',boss:'team1',level:'associate',spec:'Ruth'},
  {id:'rhas',name:'Rhas Porciuncula',title:'Product Specialist',boss:'team1',level:'associate',spec:'Rhas'},
  {id:'tin',name:'Tin Arcos',title:'Product Specialist',boss:'team1',level:'associate',spec:'Tin'},
  {id:'charmaine',name:'Charmaine Demegillo',title:'Product Specialist',boss:'team1',level:'associate',spec:'Charmaine'},
  {id:'rechel',name:'Rechel Villafuerte',title:'Product Specialist',boss:'team1',level:'associate',spec:'Rechel'},
  {id:'joy',name:'Joy Estabillo',title:'Product Specialist',boss:'team1',level:'associate',spec:'Joy'},
  {id:'reynold',name:'Reynold Julius Ramos',title:'Product Specialist',boss:'team1',level:'associate',spec:'RJ'},
  {id:'jonathan',name:'Jonathan Yu',title:'Product Specialist',boss:'team1',level:'associate',spec:'Jonathan'},
  {id:'team2',name:'Team 2',title:'Specialists & machines',boss:'ruperto',level:'group'},
  {id:'abigael',name:'Abigael Rodriguez',title:'Product Specialist',boss:'team2',level:'associate',spec:'Abigael'},
  {id:'frank',name:'Frank Villaverde',title:'Machine Specialist',boss:'team2',level:'associate'},
  {id:'kris',name:'Kris Cyra Real',title:'Machine Specialist',boss:'team2',level:'associate'},
  {id:'orland',name:'Orland Reyes',title:'Machine Specialist (GMA)',boss:'team2',level:'associate'},
  {id:'vacant-cebu',name:'Vacant',title:'Machine Specialist (Cebu)',boss:'team2',level:'vacant'},
  {id:'ladylane',name:'Ladylane Asaytuno',title:'Key Accounts Manager',boss:'marj',level:'manager'},
  {id:'pinky',name:'Pinky Bravo',title:'Key Accounts Manager',boss:'marj',level:'manager'}
];
let ORG_SEL=null,ORG_MODE=null,ORG_Q='';
function orgById(id){return ORG_PEOPLE.find(p=>p.id===id)||null;}
function orgKids(id){return ORG_PEOPLE.filter(p=>p.boss===id);}
function orgBossOf(p){if(!p||!p.boss)return [];if(p.boss==='exec')return ORG_PEOPLE.filter(x=>x.level==='founder');const b=orgById(p.boss);if(!b)return [];return b.level==='group'?orgBossOf(b):[b];}
function orgTeamOf(p){const b=p&&p.boss?orgById(p.boss):null;return b&&b.level==='group'?b:null;}
function orgReports(id){const out=[];for(const k of orgKids(id)){if(k.level==='group')out.push(...orgKids(k.id));else out.push(k);}return out;}
function orgMode(){if(ORG_MODE)return ORG_MODE;return (typeof window!=='undefined'&&window.innerWidth<900)?'list':'tree';}
function orgMatch(p){if(!ORG_Q)return true;const q=ORG_Q.toLowerCase();return (p.name+' '+p.title).toLowerCase().includes(q);}
function orgNode(p){
  const L=ORG_LEVEL[p.level]||ORG_LEVEL.associate;const hit=ORG_Q&&orgMatch(p);const sel=ORG_SEL===p.id;
  if(p.level==='group')return '<div class="org-grp">'+esc(p.name)+'</div>';
  return '<a href="#" class="lnk org-node'+(sel?' sel':'')+(ORG_Q&&!hit?' dim':'')+'" style="background:'+L.bg+';color:'+L.fg+';border-color:'+(sel?'var(--tx)':L.bd)+(p.level==='vacant'?';border-style:dashed':'')+'" onclick="orgSelect(\''+jsq(p.id)+'\');return false" title="'+esc(p.title)+'"><span class="org-nm">'+esc(p.name)+'</span><span class="org-tt">'+esc(p.title)+'</span></a>';
}
function orgTree(id){
  const kids=orgKids(id);if(!kids.length)return '';
  // a run of leaves (nobody under them) stacks vertically under the parent, as on the People team's chart
  if(kids.length>2&&kids.every(k=>!orgKids(k.id).length&&k.level!=='group'))return '<div class="org-stack">'+kids.map(orgNode).join('')+'</div>';
  return '<ul>'+kids.map(k=>'<li>'+orgNode(k)+orgTree(k.id)+'</li>').join('')+'</ul>';
}
function orgList(id,depth){
  const kids=orgKids(id);if(!kids.length)return '';
  return kids.map(k=>'<div class="org-li" style="margin-left:'+(depth*18)+'px">'+orgNode(k)+'</div>'+orgList(k.id,depth+1)).join('');
}
function orgCard(p){
  const bosses=orgBossOf(p),team=orgTeamOf(p),reps=orgReports(p.id);const L=ORG_LEVEL[p.level]||ORG_LEVEL.associate;
  const chip=x=>'<a href="#" class="abtn" onclick="orgSelect(\''+jsq(x.id)+'\');return false">'+esc(x.name)+'</a>';
  let acts='';
  if(p.spec&&typeof viewAllowed==='function'&&viewAllowed('spec')&&typeof showSpecPage==='function')acts+='<a href="#" class="abtn t-gr" onclick="showSpecPage(\''+jsq(p.spec)+'\');return false">Sales page</a>';
  if(typeof viewAllowed==='function'&&viewAllowed('users'))acts+='<a href="#" class="abtn" onclick="showView(\'users\');return false">Team &amp; access</a>';
  return '<div class="panel org-card" style="padding:14px 16px;margin-bottom:12px"><div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">'+
    '<div style="min-width:220px;flex:1"><div style="font-size:16px;font-weight:700">'+esc(p.name)+'</div><div class="mu" style="margin-top:2px">'+esc(p.title)+'</div>'+
    '<div style="margin-top:6px"><span class="pill" style="background:'+L.bg+';color:'+L.fg+';border:1px solid '+L.bd+'">'+esc(({founder:'Co-Founder',manager:'Manager',lead:'Lead',associate:'Associate',consultant:'Part-timer / Consultant',intern:'Intern',vacant:'Vacant'})[p.level]||p.level)+'</span>'+(team?' <span class="pill pgy">'+esc(team.name)+'</span>':'')+'</div></div>'+
    '<div style="min-width:200px"><div class="mu" style="font-size:11px;margin-bottom:3px">Reports to</div>'+(bosses.length?bosses.map(chip).join(' '):'<span class="mu">—</span>')+'</div>'+
    '<div style="min-width:220px;flex:1"><div class="mu" style="font-size:11px;margin-bottom:3px">Direct reports'+(reps.length?' · '+reps.length:'')+'</div>'+(reps.length?reps.map(chip).join(' '):'<span class="mu">—</span>')+'</div>'+
    (acts?'<div style="display:flex;gap:6px;flex-wrap:wrap;align-self:center">'+acts+'</div>':'')+
    '<a href="#" class="abtn" style="align-self:flex-start" onclick="orgSelect(null);return false">✕</a></div></div>';
}
function renderOrgChart(){
  const c=$('content');
  const mode=orgMode();const sel=ORG_SEL?orgById(ORG_SEL):null;
  const founders=ORG_PEOPLE.filter(p=>p.level==='founder');
  let h='<div class="viewdesc">Who reports to whom across Healthspan Global — names, titles and the reporting line, as the People team keeps it (updated '+esc(ORG_UPDATED)+'). Tap a name to see the person\'s card: who they report to, who reports to them, and their pages in HQ.</div>';
  if(sel)h+=orgCard(sel);
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><input id="org-q" placeholder="Find a name or title…" value="'+esc(ORG_Q)+'" oninput="orgFilter(this.value)" style="font:inherit;padding:6px 9px;border-radius:8px;border:1px solid var(--bd);background:var(--sf);color:var(--tx);min-width:220px">'+
    '<a href="#" class="abtn'+(mode==='tree'?' t-gr':'')+'" onclick="orgSetMode(\'tree\');return false">Tree</a><a href="#" class="abtn'+(mode==='list'?' t-gr':'')+'" onclick="orgSetMode(\'list\');return false">List</a>'+
    '<span class="mu" style="font-size:11px;margin-left:auto">'+ORG_PEOPLE.filter(p=>p.level!=='group'&&p.level!=='vacant').length+' people · '+Object.keys(ORG_LEVEL).map(k=>'<span class="org-sw" style="background:'+ORG_LEVEL[k].bg+';border-color:'+ORG_LEVEL[k].bd+'"></span>'+esc(ORG_LEVEL[k].lbl)).join(' · ')+'</span></div>';
  if(mode==='tree'){
    h+='<div class="panel" style="padding:16px 14px;overflow:auto"><div class="org-tree"><ul class="org-root"><li><div class="org-exec">'+founders.map(orgNode).join('<span class="org-join"></span>')+'</div>'+orgTree('exec')+'</li></ul></div></div>';
  }else{
    h+='<div class="panel" style="padding:12px 14px">'+founders.map(f=>'<div class="org-li">'+orgNode(f)+'</div>').join('')+orgList('exec',1)+'</div>';
  }
  c.innerHTML=h;
  if(typeof upgradeButtons==='function')try{upgradeButtons();}catch(e){}
  const q=$('org-q');if(q&&ORG_Q&&document.activeElement!==q){q.focus();q.setSelectionRange(q.value.length,q.value.length);}
}
function orgSelect(id){ORG_SEL=id||null;renderOrgChart();if(id){const el=document.querySelector('.org-card');if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});}}
function orgSetMode(m){ORG_MODE=m;renderOrgChart();}
let _orgT=null;function orgFilter(v){ORG_Q=String(v||'').trim();clearTimeout(_orgT);_orgT=setTimeout(renderOrgChart,150);}
