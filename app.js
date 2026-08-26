const API_URL='https://script.google.com/macros/s/AKfycbzufjfh35KTaxfBel76R5KsIpY4ar-BpKSKGb-GVUIeTqmMGOkcqb45JC_wz8QxMY51/exec';
const PROJECT_KEY='lav_0ElBvC4JhJd38Yvv';
let CONTENTS=[],ACTIONS=[],TEAM=[],state={},current=0,currentView='approval',modalContent=null,loadingAction=false;
const $=s=>document.querySelector(s),tabs=$('#tabs'),grid=$('#grid'),person=$('#person'),toast=$('#toast');
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function note(t){toast.textContent=t;toast.classList.add('show');clearTimeout(note.t);note.t=setTimeout(()=>toast.classList.remove('show'),2200)}
function view(fid){return `https://drive.google.com/file/d/${fid}/view?usp=sharing`}
function preview(fid){return `https://drive.google.com/file/d/${fid}/preview`}
function thumb(fid){return `https://drive.google.com/thumbnail?id=${fid}&sz=w1200`}
function fmtDate(d){if(!d)return '—';let [y,m,day]=d.split('-').map(Number);return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}
function formatMonth(y,m){return new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())}
function actionLabel(a){if(a.action==='APROVADO')return 'Conteúdo aprovado';if(a.action==='ALTERACAO')return `Alteração solicitada${a.feedback?' — '+a.feedback:''}`;if(a.action==='MUDANCA_DATA')return `Mudança de data solicitada para ${fmtDate(a.requestedDate)}${a.reason?' — '+a.reason:''}`;return a.action}
function rebuild(){
  state={};
  CONTENTS.forEach(c=>{state[c.id]={status:c.initialStatus==='aprovado'?'ok':c.initialStatus==='alteracao'?'rev':'',history:[],requestedDate:'',dateReason:''}});
  ACTIONS.forEach(a=>{
    if(!state[a.contentId])state[a.contentId]={status:'',history:[],requestedDate:'',dateReason:''};
    if(a.action==='APROVADO')state[a.contentId].status='ok';
    if(a.action==='ALTERACAO')state[a.contentId].status='rev';
    if(a.action==='MUDANCA_DATA'){state[a.contentId].requestedDate=a.requestedDate||'';state[a.contentId].dateReason=a.reason||''}
    state[a.contentId].history.push(a);
  });
  const map=new Map();
  CONTENTS.forEach(c=>{
    if(!map.has(c.person))map.set(c.person,{name:c.person,area:c.area||'Conteúdos',contents:[]});
    map.get(c.person).contents.push({id:c.id,title:c.title,fid:c.videoId,coverId:c.coverId||c.videoId,date:c.date,caption:c.caption,version:c.version});
  });
  TEAM=[...map.values()];
  if(current>=TEAM.length)current=0;
}
async function loadData({quiet=false}={}){
  try{
    if(!quiet)$('#systemNotice').innerHTML='<b>V1 real:</b> conectando ao histórico central...';
    const res=await fetch(`${API_URL}?key=${encodeURIComponent(PROJECT_KEY)}&_=${Date.now()}`,{cache:'no-store'});
    const data=await res.json();
    if(!data.ok)throw new Error(data.error||'Falha no servidor');
    CONTENTS=data.contents||[];ACTIONS=data.actions||[];rebuild();
    $('#systemNotice').innerHTML=`<b>V1 real:</b> aprovações, alterações e pedidos de data ficam registrados centralmente. Alterações e mudanças de data geram aviso automático para a equipe.`;
    renderApproval();metrics();if(currentView==='calendar')renderCalendar();
  }catch(err){
    console.error(err);
    $('#systemNotice').innerHTML='<b>Não foi possível conectar ao histórico central.</b> Atualize a página. Se persistir, avise a equipe antes de enviar uma revisão.';
    if(!quiet)note('Falha ao carregar o portal');
  }
}
function setView(v){currentView=v;$('#approvalView').classList.toggle('hidden',v!=='approval');$('#calendarView').classList.toggle('hidden',v!=='calendar');$('#navApproval').classList.toggle('on',v==='approval');$('#navCalendar').classList.toggle('on',v==='calendar');$('#heroText').textContent=v==='approval'?'Assista ao vídeo, confira a capa e a legenda. Aprove ou envie uma solicitação de alteração.':'Veja quando cada conteúdo está planejado para sair e solicite mudança de data quando necessário.';if(v==='calendar')renderCalendar();window.scrollTo({top:0,behavior:'smooth'})}
function renderTabs(){tabs.innerHTML=TEAM.map((p,i)=>`<button class="tab ${i===current?'on':''}" onclick="current=${i};renderApproval()">${esc(p.name.split(' ')[0])} · ${p.contents.length}</button>`).join('')}
function allContents(){return TEAM.flatMap(p=>p.contents.map(c=>({...c,person:p})))}
function metrics(){let all=allContents(),a=all.filter(x=>state[x.id]?.status==='ok').length,r=all.filter(x=>state[x.id]?.status==='rev').length;$('#total').textContent=all.length;$('#approved').textContent=a;$('#revisions').textContent=r}
function historyHtml(id){let h=(state[id]?.history||[]).slice(-4).reverse();if(!h.length)return '';return `<div class="history"><div class="label">Histórico desta revisão</div>${h.map(x=>`<div class="history-row ${x.action==='APROVADO'?'ok':'rev'}"><span class="history-dot"></span><span>${esc(actionLabel(x))}<br><small>${esc(x.timestamp||'')}</small></span></div>`).join('')}</div>`}
async function postAction(payload){
  if(loadingAction)return false;
  loadingAction=true;
  try{
    await fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({...payload,projectKey:PROJECT_KEY})});
    return true;
  }catch(err){console.error(err);note('Não foi possível enviar. Verifique sua internet.');return false}
  finally{loadingAction=false}
}
function optimisticAction(contentId,action,extra={}){
  const c=CONTENTS.find(x=>x.id===contentId);if(!c)return;
  ACTIONS.push({eventId:'local-'+Date.now(),timestamp:'enviado agora',contentId,person:c.person,title:c.title,action,feedback:extra.feedback||'',plannedDate:c.date,requestedDate:extra.requestedDate||'',reason:extra.reason||'',version:c.version,statusAfter:action==='APROVADO'?'aprovado':action==='ALTERACAO'?'alteracao':'data_solicitada'});rebuild();renderApproval();metrics();if(currentView==='calendar')renderCalendar();
  setTimeout(()=>loadData({quiet:true}),1500);
}
async function setStatus(id,status){
  let ta=document.querySelector(`[data-id="${id}"] textarea`),feedback=(ta?.value||'').trim();
  if(status==='rev'&&!feedback){ta.focus();note('Descreva a alteração primeiro');return}
  const action=status==='ok'?'APROVADO':'ALTERACAO';
  const ok=await postAction({action,contentId:id,feedback});if(!ok)return;
  optimisticAction(id,action,{feedback});note(status==='ok'?'Conteúdo aprovado ✓':'Alteração enviada para a equipe');
}
function loadVideo(btn,fid){let box=btn.parentElement,iframe=document.createElement('iframe');iframe.src=preview(fid);iframe.allow='autoplay; fullscreen';iframe.allowFullscreen=true;box.prepend(iframe);btn.remove()}
function renderApproval(){
  if(!TEAM.length){tabs.innerHTML='';person.innerHTML='';grid.innerHTML='';return}
  renderTabs();let p=TEAM[current];person.innerHTML=`<h2>${esc(p.name)}</h2><p>${esc(p.area)}</p>`;
  grid.innerHTML=p.contents.map(c=>{let s=state[c.id]||{},label=s.status==='ok'?'Aprovado':s.status==='rev'?'Alteração solicitada':'Aguardando revisão',cls=s.status||'';return `<article class="card" data-id="${esc(c.id)}"><div class="head"><div><div class="kicker">${esc(c.id)} · v${esc(c.version||'1')}</div><h3>${esc(c.title)}</h3></div><span class="status ${cls}">${label}</span></div><div class="media"><div class="video"><button class="play" onclick="loadVideo(this,'${esc(c.fid)}')"><span><i>▶</i><strong>Assistir vídeo</strong><small>O Drive é carregado somente ao tocar</small></span></button><a class="drive" target="_blank" href="${view(c.fid)}">Drive ↗</a></div><div class="cover"><img src="${thumb(c.coverId)}" loading="lazy" onerror="this.style.display='none'"><div class="cover-fallback">CAPA</div></div></div><div class="body"><div class="label">Legenda</div><div class="caption">${esc(c.caption||'Legenda ainda não cadastrada.')}</div><div class="label" style="margin-top:16px">Solicitar alteração</div><textarea placeholder="Ex.: aos 00:18, retirar essa frase..."></textarea><div class="actions"><button class="act approve" ${s.status==='ok'?'disabled':''} onclick="setStatus('${esc(c.id)}','ok')">${s.status==='ok'?'✓ Aprovado':'✓ Aprovar'}</button><button class="act" onclick="setStatus('${esc(c.id)}','rev')">Pedir alteração</button></div>${historyHtml(c.id)}</div></article>`}).join('')
}
function calItem(x){let s=state[x.id]||{},cls=s.status||'',dateNote=s.requestedDate?` · nova data solicitada: ${fmtDate(s.requestedDate)}`:'';return `<div class="calitem ${cls}" onclick="openModal('${esc(x.id)}')"><span class="cal-status"></span><div class="cal-thumb"><img src="${thumb(x.coverId)}" loading="lazy"></div><div class="cal-info"><b>${esc(x.person.name.split(' ')[0])} · ${esc(x.title)}</b><small>${s.status==='ok'?'Aprovado':s.status==='rev'?'Alteração solicitada':'Aguardando aprovação'}${esc(dateNote)}</small></div></div>`}
function renderCalendar(){
  let items=allContents();if(!items.length){$('#calendar').innerHTML='';$('#agenda').innerHTML='';return}
  let base=(items.map(x=>x.date).filter(Boolean).sort()[0]||new Date().toISOString().slice(0,10)),[year,month]=base.split('-').map(Number);$('#calendarTitle').textContent=formatMonth(year,month);
  let days=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'],out=days.map(d=>`<div class="dow">${d}</div>`),first=new Date(year,month-1,1),leading=(first.getDay()+6)%7,lastDay=new Date(year,month,0).getDate();for(let i=0;i<leading;i++)out.push('<div class="day out"></div>');
  for(let d=1;d<=lastDay;d++){let date=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dayItems=items.filter(x=>x.date===date);out.push(`<div class="day"><div class="daynum">${d}</div>${dayItems.map(calItem).join('')}</div>`)}$('#calendar').innerHTML=out.join('');
  let grouped={};items.forEach(x=>(grouped[x.date]=grouped[x.date]||[]).push(x));$('#agenda').innerHTML=Object.keys(grouped).sort().map(d=>`<div class="agenda-day"><div class="agenda-date">${fmtDate(d)}</div>${grouped[d].map(x=>{let s=state[x.id]||{};return `<div class="agenda-card" onclick="openModal('${esc(x.id)}')"><div class="agenda-thumb"><img src="${thumb(x.coverId)}"></div><div><b>${esc(x.person.name)} · ${esc(x.title)}</b><small>${s.status==='ok'?'🟢 Aprovado':s.status==='rev'?'🟠 Alteração solicitada':'⚪ Aguardando aprovação'}</small>${s.requestedDate?`<small>📅 Nova data solicitada: ${fmtDate(s.requestedDate)}</small>`:''}</div></div>`}).join('')}</div>`).join('')
}
function openModal(id){modalContent=allContents().find(x=>x.id===id);if(!modalContent)return;let s=state[id]||{};$('#modalImg').src=thumb(modalContent.coverId);$('#modalId').textContent=id;$('#modalTitle').textContent=modalContent.title;$('#modalMeta').textContent=modalContent.person.name+' · '+(s.status==='ok'?'Aprovado':s.status==='rev'?'Alteração solicitada':'Aguardando aprovação');$('#modalPlanned').textContent=fmtDate(modalContent.date)+(s.requestedDate?' · nova data já solicitada: '+fmtDate(s.requestedDate):'');$('#newDate').value=s.requestedDate||modalContent.date;$('#dateReason').value='';$('#modal').classList.add('show')}
function closeModal(){$('#modal').classList.remove('show');modalContent=null}
async function requestDate(){if(!modalContent)return;let d=$('#newDate').value,reason=$('#dateReason').value.trim();if(!d){note('Escolha uma nova data');return}if(d===modalContent.date){note('Escolha uma data diferente da planejada');return}let id=modalContent.id;$('#dateRequestBtn').disabled=true;const ok=await postAction({action:'MUDANCA_DATA',contentId:id,requestedDate:d,reason});$('#dateRequestBtn').disabled=false;if(!ok)return;optimisticAction(id,'MUDANCA_DATA',{requestedDate:d,reason});closeModal();note('Solicitação de nova data enviada')}
loadData();