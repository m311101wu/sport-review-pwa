const $=s=>document.querySelector(s);const video=$('#video'),stage=$('#videoStage'),canvas=$('#drawingCanvas'),ctx=canvas.getContext('2d');let url=null,markers=[],tool='select',drawing=false,start=null,anglePoints=[],drawings=[];let fps=30,loopStart=null,zoom=1,pointers=new Map(),pinchDistance=0,pinchZoom=1,calibrationMode=null,calibrationPoints=[],calibrations={wheelbase:null,shoe:null};let stepEvents=[],pendingFoot=null,singleFootSamples=[],singleFootRows=[];
const buttons=['#playBtn','#prevFrameBtn','#nextFrameBtn','#frameStepSelect','#speedSelect','#loopBtn','#timeline','#addMarkerBtn','#exportBtn','#leftStepBtn','#rightStepBtn','#pointStepBtn','#clearStepsBtn','#exportAnalysisBtn','#audioAnalyzeBtn','#refreshSingleFootBtn'];
let currentVideoFile=null;
function fmt(t=0){const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor(t%1*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`}function enable(){buttons.forEach(s=>$(s).disabled=false);$('#wheelbaseBtn').disabled=false;$('#shoeBtn').disabled=false}function resize(){const r=stage.getBoundingClientRect(),d=devicePixelRatio||1;canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);render()}function update(){$('#timeline').value=video.currentTime||0;$('#timeLabel').textContent=`${fmt(video.currentTime)} / ${fmt(video.duration)}`}
$('#videoInput').onchange=e=>{const f=e.target.files[0];if(!f)return;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);video.src=url;stage.classList.add('loaded');$('#emptyState').style.display='none';enable();video.playbackRate=1};video.onloadedmetadata=()=>{$('#timeline').max=video.duration;resize();update()};video.ontimeupdate=()=>{if(loopStart!==null&&video.currentTime>=video.duration)video.currentTime=loopStart;update()};$('#timeline').oninput=e=>{video.currentTime=+e.target.value;render()};$('#playBtn').onclick=()=>{video.paused?video.play():video.pause();$('#playBtn').textContent=video.paused?'播放':'暫停'};$('#speedSelect').onchange=e=>video.playbackRate=+e.target.value;$('#frameStepSelect').onchange=e=>fps=+e.target.value;function step(n){video.pause();video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+n/fps));render()}$('#prevFrameBtn').onclick=()=>step(-1);$('#nextFrameBtn').onclick=()=>step(1);$('#loopBtn').onclick=()=>{loopStart=loopStart===null?video.currentTime:null;$('#loopBtn').textContent=loopStart===null?'循環：關':'循環：開'};
document.addEventListener('keydown',e=>{if(!video.duration)return;const el=e.target;if(el&&(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(el.tagName)||el.isContentEditable))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();step(e.key==='ArrowLeft'?-1:1);return}if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();addStep(e.key==='ArrowUp'?'right':'left')}});
$('#addMarkerBtn').onclick=()=>{$('#markerForm').classList.remove('hidden');$('#markerNote').focus()};$('#cancelMarkerBtn').onclick=()=>$('#markerForm').classList.add('hidden');$('#saveMarkerBtn').onclick=()=>{const note=$('#markerNote').value.trim()||'未填寫備註';markers.push({time:video.currentTime,type:$('#markerType').value,note});markers.sort((a,b)=>a.time-b.time);$('#markerNote').value='';$('#markerForm').classList.add('hidden');renderMarkers()};function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function renderMarkers(){const box=$('#markerList');box.innerHTML=markers.length?'':'<div class="empty-list">還沒有標記。</div>';markers.forEach((m,i)=>{const el=document.createElement('div');el.className='marker';el.innerHTML=`<span class="marker-time">${fmt(m.time)}</span><div><div class="marker-type">${m.type}</div><div class="marker-note">${esc(m.note)}</div></div><button class="marker-delete" title="刪除">×</button>`;el.onclick=()=>{video.currentTime=m.time;render()};el.querySelector('.marker-delete').onclick=e=>{e.stopPropagation();markers.splice(i,1);renderMarkers()};box.appendChild(el)})}
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{const t=b.dataset.tool;if(t==='clear'){drawings=[];anglePoints=[];render();return}tool=t;document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active',x===b))});function distance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}function applyZoom(){const value=Math.min(4,Math.max(1,zoom));video.style.transform=`scale(${value})`;canvas.style.transform=`scale(${value})`;canvas.style.transformOrigin='center center'}function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom}}
function updateCalibrationStatus(message){const box=$('#calibrationStatus');if(message){box.textContent=message;return}const w=calibrations.wheelbase,s=calibrations.shoe;if(!w&&!s){box.textContent='尚未設定比例尺';return}let text=[];if(w)text.push(`軸距：${w.cm} cm`);if(s)text.push(`鞋長：${s.cm} cm`);if(w&&s){const diff=Math.abs((w.cmPerPixel-s.cmPerPixel)/w.cmPerPixel*100);text.push(`差異：${diff.toFixed(1)}%｜${diff<=5?'校正一致':'差異較大，請檢查拍攝角度或重新標記'}`)}box.textContent=text.join('　')}
function finishCalibration(){const cm=+(calibrationMode==='wheelbase'?$('#wheelbaseCm').value:$('#shoeLengthCm').value);if(!cm||calibrationPoints.length!==2){updateCalibrationStatus('請先輸入公分數值，再點選兩端');return}const px=Math.hypot(calibrationPoints[1].x-calibrationPoints[0].x,calibrationPoints[1].y-calibrationPoints[0].y);calibrations[calibrationMode]={cm,px,cmPerPixel:cm/px};calibrationMode=null;calibrationPoints=[];updateCalibrationStatus();render()}['wheelbase','shoe'].forEach(kind=>{$(`#${kind}Btn`).onclick=()=>{calibrationMode=kind;calibrationPoints=[];tool='select';updateCalibrationStatus(`請在畫面點選${kind==='wheelbase'?'滑步車軸距':'鞋子外觀長度'}的兩端`)}});
canvas.onpointerdown=e=>{pointers.set(e.pointerId,e);canvas.setPointerCapture?.(e.pointerId);if(pointers.size===2){drawing=false;const p=[...pointers.values()];pinchDistance=distance(p[0],p[1]);pinchZoom=zoom;return}const p=point(e);if(calibrationMode){calibrationPoints.push(p);if(calibrationPoints.length===2)finishCalibration();else updateCalibrationStatus('已選第一端，請再點選另一端');return}if(tool==='select')return;drawing=true;start=p;if(tool==='angle'){anglePoints.push(start);if(anglePoints.length===3){const[a,b,c]=anglePoints,ab=[a.x-b.x,a.y-b.y],cb=[c.x-b.x,c.y-b.y],den=Math.hypot(...ab)*Math.hypot(...cb),ratio=den?Math.max(-1,Math.min(1,(ab[0]*cb[0]+ab[1]*cb[1])/den)):1,deg=Math.acos(ratio)*180/Math.PI;drawings.push({kind:'angle',a,b,c,label:`${deg.toFixed(1)}°`});anglePoints=[];drawing=false;render()}}};canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,e);if(pointers.size===2){const p=[...pointers.values()];if(pinchDistance)zoom=pinchZoom*distance(p[0],p[1])/pinchDistance;applyZoom()}};canvas.onpointerup=canvas.onpointercancel=e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinchDistance=0;if(!drawing)return;const end=point(e);if(tool==='line'||tool==='arrow')drawings.push({kind:tool,a:start,b:end});drawing=false;render()};
function render(){ctx.clearRect(0,0,canvas.width,canvas.height);drawings.forEach(d=>{ctx.strokeStyle='#62e6bd';ctx.fillStyle='#62e6bd';ctx.lineWidth=3;ctx.beginPath();if(d.kind==='angle'){ctx.moveTo(d.a.x,d.a.y);ctx.lineTo(d.b.x,d.b.y);ctx.lineTo(d.c.x,d.c.y);ctx.stroke();ctx.fillStyle='#f7d774';ctx.font='bold 17px sans-serif';[['A',d.a],['B',d.b],['C',d.c]].forEach(([l,p])=>ctx.fillText(l,p.x+8,p.y-8));ctx.fillStyle='#62e6bd';ctx.fillText(d.label,d.b.x+8,d.b.y+24)}else{ctx.moveTo(d.a.x,d.a.y);ctx.lineTo(d.b.x,d.b.y);ctx.stroke();if(d.kind==='arrow'){const ang=Math.atan2(d.b.y-d.a.y,d.b.x-d.a.x);ctx.beginPath();ctx.moveTo(d.b.x,d.b.y);ctx.lineTo(d.b.x-14*Math.cos(ang-.5),d.b.y-14*Math.sin(ang-.5));ctx.lineTo(d.b.x-14*Math.cos(ang+.5),d.b.y-14*Math.sin(ang+.5));ctx.closePath();ctx.fill()}}});if(calibrationPoints.length){ctx.fillStyle='#f7d774';ctx.strokeStyle='#f7d774';ctx.font='bold 17px sans-serif';calibrationPoints.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.fillText(i?'B':'A',p.x+9,p.y-9)});if(calibrationPoints.length===2){ctx.beginPath();ctx.moveTo(calibrationPoints[0].x,calibrationPoints[0].y);ctx.lineTo(calibrationPoints[1].x,calibrationPoints[1].y);ctx.stroke()}}}window.onresize=resize;
$('#exportBtn').onclick=()=>{const data={title:$('#sessionTitle').value,note:$('#overallNote').value,calibration:{wheelbaseCm:calibrations.wheelbase?.cm||null,shoeLengthCm:calibrations.shoe?.cm||null},markers:markers.map(m=>({...m,time:fmt(m.time)})),stepEvents,audioAnalysis:window.lastAudioAnalysis||null};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='運動復盤摘要.json';a.click()};

function scaleCmPerPixel(){return calibrations.wheelbase?.cmPerPixel||calibrations.shoe?.cmPerPixel||null}
function addStep(foot){stepEvents.push({time:video.currentTime,foot});renderStepAnalysis()}
function renderContactMarkers(){const box=$('#stepEventMarkers');if(!box)return;box.innerHTML='';const duration=video.duration||0;if(!duration)return;stepEvents.forEach((e,i)=>{const b=document.createElement('button');b.type='button';b.className=`step-event-marker ${e.foot==='right'?'right':''} ${e.needsReview?'review':''}`;b.style.left=`${Math.max(0,Math.min(100,e.time/duration*100))}%`;b.dataset.label=`${e.foot==='left'?'左腳':'右腳'} ${fmt(e.time)}${e.needsReview?'（待確認）':''}`;b.title=`${b.dataset.label}｜單擊跳轉，雙擊刪除`;b.setAttribute('aria-label',`跳到${b.dataset.label}`);b.onclick=()=>{video.pause();video.currentTime=e.time;render();update()};b.ondblclick=ev=>{ev.preventDefault();ev.stopPropagation();stepEvents.splice(i,1);renderStepAnalysis()};box.appendChild(b)})}
function renderStepAnalysis(){stepEvents.sort((a,b)=>a.time-b.time);const scale=scaleCmPerPixel();const last={left:null,right:null};const rows=stepEvents.map((e,i)=>{const prev=last[e.foot];e.cycle=prev?e.time-prev.time:null;e.distance=prev&&scale&&e.x!=null&&prev.x!=null?Math.hypot(e.x-prev.x,e.y-prev.y)/scale:null;last[e.foot]=e;return e});const intervals=rows.slice(1).map((e,i)=>e.time-rows[i].time).filter(x=>x>0);const cycles=rows.map(e=>e.cycle).filter(Boolean);const distances=rows.map(e=>e.distance).filter(Boolean);const cadence=intervals.length?60/ (intervals.reduce((a,b)=>a+b,0)/intervals.length):null;const stat=[rows.length,cadence?cadence.toFixed(1):'—',cycles.length?(cycles.reduce((a,b)=>a+b,0)/cycles.length).toFixed(2)+' s':'—',distances.length?(distances.reduce((a,b)=>a+b,0)/distances.length).toFixed(1)+' cm':'—'];document.querySelectorAll('#analysisStats b').forEach((el,i)=>el.textContent=stat[i]);const tbody=$('#stepTable');tbody.innerHTML=rows.length?rows.map((e,i)=>`<tr class="step-row" data-time="${e.time}" data-index="${i}"><td>${i+1}</td><td>${e.foot==='left'?'左':'右'}</td><td>${fmt(e.time)}</td><td>${e.cycle?e.cycle.toFixed(2)+' s':'—'}</td><td>${e.distance?e.distance.toFixed(1)+' cm':'—'}</td><td><button type="button" class="step-delete" title="刪除此腳部標記" aria-label="刪除此腳部標記">×</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">尚未記錄落地</td></tr>';tbody.querySelectorAll('.step-row').forEach(row=>{row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()};row.querySelector('.step-delete').onclick=e=>{e.stopPropagation();stepEvents.splice(+row.dataset.index,1);renderStepAnalysis()}});$('#exportAnalysisBtn').disabled=!rows.length;renderContactMarkers()}
function selectedSingleFoot(){return document.querySelector('input[name="singleFoot"]:checked')?.value||'right'}
function calculateSingleFootRows(){const foot=selectedSingleFoot(),samples=singleFootSamples.filter(s=>s[foot]),contacts=stepEvents.filter(e=>e.foot===foot).sort((a,b)=>a.time-b.time),scale=scaleCmPerPixel(),rows=[];for(let i=0;i<contacts.length-1;i++){const contact=contacts[i],next=contacts[i+1],segment=samples.filter(s=>s.t>=contact.time&&s.t<=next.time&&s[foot]);if(segment.length<2)continue;const base=contact.y,threshold=Math.max(3,(canvas.clientHeight||360)*.018),takeoff=segment.find(s=>s.t>contact.time+.03&&s[foot].y<base-threshold);if(!takeoff)continue;const minY=Math.min(...segment.map(s=>s[foot].y)),heightPx=Math.max(0,base-minY);rows.push({index:rows.length+1,foot,contact:contact.time,takeoff:takeoff.t,stance:takeoff.t-contact.time,flight:next.time-takeoff.t,cycle:next.time-contact.time,heightPx,heightCm:scale?heightPx*scale:null})}return rows}
function renderSingleFootAnalysis(){singleFootRows=calculateSingleFootRows();const status=$('#singleFootStatus'),tbody=$('#singleFootTable');if(!singleFootSamples.length){status.textContent='請先按「自動分析影片＋聲音」';tbody.innerHTML='<tr><td colspan="7" class="empty-cell">尚未產生單腳數據</td></tr>';$('#exportSingleFootBtn').disabled=true;return}const scale=scaleCmPerPixel(),unit=scale?'cm':'px（請先校正比例尺）';status.textContent=(selectedSingleFoot()==='right'?'右腳':'左腳')+'｜共 '+singleFootRows.length+' 個有效週期｜高度單位：'+unit;const avg=k=>singleFootRows.length?singleFootRows.reduce((a,r)=>a+r[k],0)/singleFootRows.length:null;$('#singleContactCount').textContent=singleFootRows.length||'—';$('#singleStanceAvg').textContent=avg('stance')==null?'—':avg('stance').toFixed(3)+' s';$('#singleFlightAvg').textContent=avg('flight')==null?'—':avg('flight').toFixed(3)+' s';const h=scale?avg('heightCm'):avg('heightPx');$('#singleHeightAvg').textContent=h==null?'—':h.toFixed(1)+' '+(scale?'cm':'px');tbody.innerHTML=singleFootRows.length?singleFootRows.map(r=>'<tr class="single-row" data-time="'+r.contact+'"><td>'+r.index+'</td><td>'+fmt(r.contact)+'</td><td>'+fmt(r.takeoff)+'</td><td>'+r.stance.toFixed(3)+' s</td><td>'+r.flight.toFixed(3)+' s</td><td>'+r.cycle.toFixed(3)+' s</td><td>'+((scale?r.heightCm:r.heightPx).toFixed(1))+' '+(scale?'cm':'px')+'</td></tr>').join(''):'<tr><td colspan="7" class="empty-cell">找不到完整的接地→離地→下一次接地週期，請確認腳踝在畫面中清楚可見。</td></tr>';tbody.querySelectorAll('.single-row').forEach(row=>row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()});$('#exportSingleFootBtn').disabled=!singleFootRows.length}
const originalCanvasDown=canvas.onpointerdown;canvas.onpointerdown=e=>{if(pendingFoot){const r=canvas.getBoundingClientRect();const p={x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};stepEvents.push({time:video.currentTime,foot:pendingFoot,x:p.x,y:p.y,takeoff:null});activeTakeoffFoot=pendingFoot;pendingFoot=null;$('#analysisHint').textContent='已記錄點地；再按同一個方向鍵記錄離地';renderStepAnalysis();render();return}originalCanvasDown(e)};
$('#leftStepBtn').onclick=()=>addStep('left');$('#rightStepBtn').onclick=()=>addStep('right');$('#pointStepBtn').onclick=()=>{pendingFoot=prompt('要記錄哪一腳？輸入 left 或 right','left')?.toLowerCase()==='right'?'right':'left';$('#analysisHint').textContent=`請點選${pendingFoot==='left'?'左':'右'}腳落地位置`};$('#clearStepsBtn').onclick=()=>{stepEvents=[];renderStepAnalysis()};document.querySelectorAll('input[name="analysisMode"]').forEach(r=>r.onchange=()=>$('#analysisHint').textContent=`目前模式：${r.checked&&r.value==='cycles'?'步態週期':'步數／步頻'}`);$('#exportAnalysisBtn').onclick=()=>{const rows=stepEvents.map((e,i)=>({index:i+1,foot:e.foot,time:e.time,cycle_s:e.cycle||'',distance_cm:e.distance||''}));const csv=['index,foot,time_s,cycle_s,distance_cm',...rows.map(r=>`${r.index},${r.foot},${r.time.toFixed(3)},${r.cycle_s},${r.distance_cm}`)].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='步頻步態數據.csv';a.click()};
document.querySelectorAll('input[name="singleFoot"]').forEach(r=>r.addEventListener('change',renderSingleFootAnalysis));$('#refreshSingleFootBtn')?.addEventListener('click',renderSingleFootAnalysis);$('#exportSingleFootBtn')?.addEventListener('click',()=>{const scale=scaleCmPerPixel(),csv=['index,foot,contact_s,takeoff_s,stance_s,flight_s,cycle_s,height_'+(scale?'cm':'px'),...singleFootRows.map(r=>[r.index,r.foot,r.contact.toFixed(3),r.takeoff.toFixed(3),r.stance.toFixed(3),r.flight.toFixed(3),r.cycle.toFixed(3),(scale?r.heightCm:r.heightPx).toFixed(1)].join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='單腳離地數據.csv';a.click()});

async function seekTo(t){if(Math.abs(video.currentTime-t)<.002)return;await new Promise(resolve=>{const done=()=>{video.removeEventListener('seeked',done);resolve()};video.addEventListener('seeked',done);video.currentTime=t})}
let waveformData=null,liveAudioContext=null,liveAnalyser=null,liveAudioSource=null,liveWaveformTimer=null,liveWaveformBins=[],waveformZoom=1,waveformFileKey=null;
const waveformCanvas=$('#audioWaveform'),waveformCtx=waveformCanvas?.getContext('2d');
function drawWaveform(){
  if(!waveformCanvas||!waveformCtx)return;
  updateWaveformControls?.();
  const wrap=waveformCanvas.parentElement,r=waveformCanvas.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(1,(wrap?.clientWidth||r.width)*waveformZoom),h=Math.max(1,r.height),mid=h/2;
  waveformCanvas.style.width=`${w}px`;
  waveformCanvas.width=w*d;waveformCanvas.height=h*d;waveformCtx.setTransform(d,0,0,d,0,0);waveformCtx.clearRect(0,0,w,h);
  waveformCtx.fillStyle='#0a1424';waveformCtx.fillRect(0,0,w,h);
  waveformCtx.strokeStyle='rgba(142,165,204,.18)';waveformCtx.lineWidth=1;waveformCtx.beginPath();waveformCtx.moveTo(0,mid);waveformCtx.lineTo(w,mid);waveformCtx.stroke();
  if(!waveformData?.length){waveformCtx.fillStyle='#7184a4';waveformCtx.font='12px sans-serif';waveformCtx.fillText('尚未產生音訊波形',12,18);return}
  const values=waveformData.map(v=>Math.max(0,Math.min(1,Number(v)||0))),step=w/Math.max(1,values.length-1),scale=h*.43;
  const grad=waveformCtx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#78a9ff');grad.addColorStop(.5,'#62e6bd');grad.addColorStop(1,'#78a9ff');
  // Draw a continuous, mirrored waveform instead of separate bars.
  waveformCtx.beginPath();values.forEach((v,i)=>{const x=i*step,y=mid-v*scale;i?waveformCtx.lineTo(x,y):waveformCtx.moveTo(x,y)});for(let i=values.length-1;i>=0;i--){const x=i*step,y=mid+values[i]*scale;waveformCtx.lineTo(x,y)}waveformCtx.closePath();waveformCtx.fillStyle=grad;waveformCtx.globalAlpha=.72;waveformCtx.fill();waveformCtx.globalAlpha=1;
  waveformCtx.beginPath();values.forEach((v,i)=>{const x=i*step,y=mid-v*scale;i?waveformCtx.lineTo(x,y):waveformCtx.moveTo(x,y)});waveformCtx.strokeStyle='#9ac2ff';waveformCtx.lineWidth=1.4;waveformCtx.stroke();
  if(video.duration){waveformCtx.fillStyle='#ff5f7a';waveformCtx.fillRect(Math.max(0,video.currentTime/video.duration*w-1),0,2,h)}
}
function seekFromWaveform(e){if(!video.duration)return;const r=waveformCanvas.getBoundingClientRect();video.pause();video.currentTime=Math.max(0,Math.min(video.duration,(e.clientX-r.left)/r.width*video.duration));render();update()}
waveformCanvas?.addEventListener('pointerdown',e=>{waveformCanvas.setPointerCapture?.(e.pointerId);seekFromWaveform(e)});waveformCanvas?.addEventListener('pointermove',e=>{if(e.buttons)seekFromWaveform(e)});
async function buildWaveform(){if(!url||!waveformCtx)return;const status=$('#waveformStatus');status.textContent='正在產生音訊波形…';waveformData=null;drawWaveform();let audioContext=null;try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('此瀏覽器不支援音訊解碼');const arrayBuffer=currentVideoFile?await currentVideoFile.arrayBuffer():await (await fetch(url)).arrayBuffer();audioContext=new AudioCtx();const buffer=await audioContext.decodeAudioData(arrayBuffer.slice(0));if(!buffer.numberOfChannels)throw new Error('影片沒有音軌');const channel=buffer.getChannelData(0),bins=Math.min(1400,Math.max(240,Math.floor(waveformCanvas.clientWidth||720))),size=Math.max(1,Math.floor(channel.length/bins));waveformData=Array.from({length:bins},(_,i)=>{let peak=0;for(let j=i*size;j<Math.min(channel.length,(i+1)*size);j++)peak=Math.max(peak,Math.abs(channel[j]));return peak});const max=Math.max(...waveformData,1);waveformData=waveformData.map(v=>v/max);status.textContent=`已產生音訊波形｜${fmt(video.duration)}`;drawWaveform()}catch(err){console.warn('waveform failed',err);status.textContent=err.message.includes('沒有音軌')?'此影片沒有可讀取的音軌，請確認錄影時有開啟收音':'iPhone 暫時無法解碼此影片音訊，請試用原始 MP4/MOV 檔';drawWaveform()}finally{if(audioContext)try{await audioContext.close()}catch{}}}
async function buildWaveform(){if(!url||!waveformCtx)return;const status=$('#waveformStatus');const fileKey=currentVideoFile?`${currentVideoFile.name}:${currentVideoFile.size}:${currentVideoFile.lastModified}`:url;if(waveformFileKey!==fileKey){waveformFileKey=fileKey;waveformData=null;liveWaveformBins=[];waveformZoom=1}status.textContent='正在產生音訊波形…';drawWaveform();let audioContext=null;try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('此瀏覽器不支援音訊解碼');const arrayBuffer=currentVideoFile?await currentVideoFile.arrayBuffer():await (await fetch(url)).arrayBuffer();audioContext=new AudioCtx();const buffer=await audioContext.decodeAudioData(arrayBuffer.slice(0));if(!buffer.numberOfChannels)throw new Error('影片沒有音軌');const channel=buffer.getChannelData(0),bins=Math.min(1400,Math.max(240,Math.floor(waveformCanvas.clientWidth||720))),size=Math.max(1,Math.floor(channel.length/bins));waveformData=Array.from({length:bins},(_,i)=>{let peak=0;for(let j=i*size;j<Math.min(channel.length,(i+1)*size);j++)peak=Math.max(peak,Math.abs(channel[j]));return peak});const max=Math.max(...waveformData,1);waveformData=waveformData.map(v=>v/max);liveWaveformBins=waveformData.slice();status.textContent=`已產生音訊波形｜${fmt(video.duration)}`;drawWaveform()}catch(err){console.warn('離線音訊解碼失敗，改用原生播放即時分析',err);startLiveWaveform(status)}finally{if(audioContext)try{await audioContext.close()}catch{}}}
function startLiveWaveform(status){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx){status.textContent='此瀏覽器不支援音訊波形分析，但影片仍可播放';drawWaveform();return}
  try{
    if(!liveAudioContext)liveAudioContext=new AudioCtx();
    if(!liveAnalyser){
      liveAnalyser=liveAudioContext.createAnalyser();liveAnalyser.fftSize=1024;liveAnalyser.smoothingTimeConstant=.65;
      liveAudioSource=liveAudioContext.createMediaElementSource(video);liveAudioSource.connect(liveAnalyser);liveAnalyser.connect(liveAudioContext.destination);
    }
    status.textContent='iPhone 改用播放時即時產生波形；請按播放後等待波形累積';
    const bins=Math.min(1400,Math.max(240,Math.floor(waveformCanvas.clientWidth||720)));
    // Do not reset an already accumulated waveform when playback starts again.
    // Only a new video or the explicit 清空 button is allowed to clear it.
    if(liveWaveformBins.length!==bins)liveWaveformBins=Array.from({length:bins},()=>0);
    waveformData=liveWaveformBins;drawWaveform();
  }catch(err){console.warn('即時音訊分析初始化失敗',err);status.textContent='影片可播放，但此瀏覽器暫時無法產生波形';drawWaveform()}
}
function sampleLiveWaveform(){
  if(!liveAnalyser||video.paused||!video.duration)return;
  try{
    if(liveAudioContext.state==='suspended')liveAudioContext.resume();
    const data=new Uint8Array(liveAnalyser.fftSize);liveAnalyser.getByteTimeDomainData(data);let peak=0;
    for(const v of data)peak=Math.max(peak,Math.abs(v-128)/128);
    const index=Math.max(0,Math.min(liveWaveformBins.length-1,Math.floor(video.currentTime/video.duration*liveWaveformBins.length)));
    liveWaveformBins[index]=Math.max(liveWaveformBins[index]||0,peak);waveformData=liveWaveformBins;drawWaveform();
  }catch(err){console.warn('即時波形取樣失敗',err)}
}
$('#videoInput').addEventListener('change',e=>{currentVideoFile=e.target.files[0]||null;setTimeout(buildWaveform,150)});
video.addEventListener('loadedmetadata',drawWaveform);
video.addEventListener('timeupdate',drawWaveform);
video.addEventListener('play',()=>{if(liveAudioContext?.state==='suspended')liveAudioContext.resume();if(!liveWaveformTimer)liveWaveformTimer=setInterval(sampleLiveWaveform,60)});
video.addEventListener('pause',()=>{if(liveWaveformTimer){clearInterval(liveWaveformTimer);liveWaveformTimer=null}});
video.addEventListener('ended',()=>{if(liveWaveformTimer){clearInterval(liveWaveformTimer);liveWaveformTimer=null}if(waveformData?.length){const status=$('#waveformStatus');if(status?.textContent.startsWith('iPhone'))status.textContent='音訊波形已保留，可重播查看'}});
function updateWaveformControls(){const has=Boolean(waveformData?.length);const out=$('#waveformZoomOut'),inn=$('#waveformZoomIn'),clear=$('#waveformClearBtn');if(out)out.disabled=!has||waveformZoom<=1;if(inn)inn.disabled=!has||waveformZoom>=8;if(clear)clear.disabled=!has;const label=$('#waveformZoomLabel');if(label)label.textContent=`${Math.round(waveformZoom*100)}%`}
$('#waveformZoomIn')?.addEventListener('click',()=>{waveformZoom=Math.min(8,waveformZoom*1.5);drawWaveform();updateWaveformControls()});
$('#waveformZoomOut')?.addEventListener('click',()=>{waveformZoom=Math.max(1,waveformZoom/1.5);drawWaveform();updateWaveformControls()});
$('#waveformClearBtn')?.addEventListener('click',()=>{waveformData=null;liveWaveformBins=[];waveformZoom=1;const status=$('#waveformStatus');if(status)status.textContent='波形已清空；按播放重新累積';drawWaveform();updateWaveformControls()});
async function detectAudioBeats(){
  if(!url)return[];
  const response=await fetch(url),arrayBuffer=await response.arrayBuffer();
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('此瀏覽器不支援音訊分析');
  const audioContext=new AudioCtx();
  const buffer=await audioContext.decodeAudioData(arrayBuffer.slice(0));
  const channels=buffer.numberOfChannels,frames=buffer.length,sampleRate=buffer.sampleRate,windowSize=1024;
  const envelope=[];
  for(let start=0;start<frames;start+=windowSize){let sum=0,count=0;for(let i=start;i<Math.min(frames,start+windowSize);i++){let v=0;for(let ch=0;ch<channels;ch++)v+=buffer.getChannelData(ch)[i]||0;v/=channels;sum+=v*v;count++}envelope.push({t:start/sampleRate,v:Math.sqrt(sum/Math.max(1,count))})}
  await audioContext.close();
  if(envelope.length<5)return[];
  const sorted=envelope.map(e=>e.v).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length*.5)]||0;
  const deviations=envelope.map(e=>Math.abs(e.v-median)).sort((a,b)=>a-b),mad=deviations[Math.floor(deviations.length*.7)]||0;
  const threshold=median+Math.max(mad*1.8,median*.28);
  const candidates=[];
  for(let i=2;i<envelope.length-2;i++){
    const e=envelope[i];if(e.v<threshold||e.v<envelope[i-1].v||e.v<envelope[i+1].v)continue;
    const previous=candidates.at(-1);if(previous&&e.t-previous.t<.18){if(e.v>previous.level)candidates[candidates.length-1]={t:e.t,level:e.v};else continue}else candidates.push({t:e.t,level:e.v});
  }
  return candidates.map(e=>e.t);
}
function summarizeAudioRhythm(beats,poseEvents=[]){
  const intervals=beats.slice(1).map((t,i)=>t-beats[i]).filter(x=>x>=.18&&x<=2.5);
  if(!intervals.length)return{beats:beats.length,bpm:null,stability:null,matchRate:null};
  const sorted=[...intervals].sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
  const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  const sd=Math.sqrt(intervals.reduce((a,b)=>a+(b-mean)**2,0)/intervals.length);
  let matchRate=null;if(poseEvents.length){const matched=poseEvents.filter(e=>beats.some(t=>Math.abs(t-e.t)<.18)).length;matchRate=matched/poseEvents.length*100}
  return{beats:beats.length,bpm:60/median,stability:Math.max(0,100-sd/median*100),matchRate};
}
async function runAudioAnalysis(poseEvents=[]){
  const status=$('#audioStatus');status.textContent='正在分析影片聲音節奏…';
  const beats=await detectAudioBeats(),summary=summarizeAudioRhythm(beats,poseEvents);window.lastAudioAnalysis=summary;
  if(!summary.bpm){status.textContent='未找到穩定腳步聲；保留影像分析結果。';return summary}
  const match=summary.matchRate==null?'':`｜影像對上 ${summary.matchRate.toFixed(0)}%`;
  status.textContent=`聲音節奏：${summary.bpm.toFixed(1)} 步／分｜穩定度 ${summary.stability.toFixed(0)}%${match}`;return summary;
}
function cleanAutomaticEvents(candidates){
  // Pose landmarks can wobble at the bottom of the stride and create two
  // detections for the same foot.  Remove only close duplicates. Do not
  // force alternation: occlusion can legitimately hide the other foot.
  const sorted=[...candidates].sort((a,b)=>a.t-b.t);
  const cleaned=[];
  const MIN_EVENT_GAP=.18;
  const MIN_SAME_FOOT_GAP=.42;
  for(const candidate of sorted){
    const previous=cleaned.at(-1);
    if(!previous){cleaned.push(candidate);continue}
    const gap=candidate.t-previous.t;
    if(gap<MIN_EVENT_GAP)continue;
    if(candidate.foot===previous.foot){
      if(gap<MIN_SAME_FOOT_GAP){
        // Keep the more pronounced landing and discard the duplicate.
        if((candidate.score||0)>=(previous.score||0)||candidate.y>previous.y)cleaned[cleaned.length-1]=candidate;
        continue;
      }
      // A longer same-foot gap may be a real cycle after the other foot was
      // hidden. Keep it and let the audio rhythm / review flag decide.
      candidate.needsReview=true;
      cleaned.push(candidate);
      continue;
    }
    cleaned.push(candidate);
  }
  return cleaned;
}
$('#audioAnalyzeBtn').onclick=async()=>{if(!video.duration)return;const btn=$('#audioAnalyzeBtn');btn.disabled=true;try{await runAudioAnalysis(stepEvents)}catch(err){console.error(err);$('#audioStatus').textContent='聲音分析不可用，已保留影像分析結果。'}finally{btn.disabled=false}};

// Editor-style multi-track timeline and editable A/B/C angle handles.
let editorTimelineZoom=1, angleDrag=null;
function editorTimelineWidth(){return Math.max(666,(video.duration||0)*100*editorTimelineZoom)}
function timelinePercent(time){return video.duration?Math.max(0,Math.min(100,time/video.duration*100)):0}
function positionTimelinePlayhead(){
  const playhead=$('#timelinePlayhead');
  if(!playhead||!video.duration)return;
  const body=$('#frameTrack');
  const width=body?.getBoundingClientRect().width||editorTimelineWidth();
  playhead.style.left=`${54+(video.currentTime||0)/video.duration*width}px`;
}
function jumpFromTimeline(event, body){
  if(!video.duration)return;
  const rect=body.getBoundingClientRect(), x=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
  video.pause();video.currentTime=(x/rect.width)*video.duration;render();update();
}
function addTimelineEvent(body,time,kind,label,draggable=false,onMove=null){
  if(!body||!video.duration)return;
  const b=document.createElement('button');b.type='button';b.className=`timeline-event ${kind}`;b.dataset.time=String(time);b.style.left=`${timelinePercent(time)}%`;b.title=label;b.setAttribute('aria-label',label);
  b.onclick=e=>{e.stopPropagation();video.pause();video.currentTime=+(b.dataset.time||time);render();update()};
  if(draggable){let moving=false;b.onpointerdown=e=>{e.stopPropagation();moving=true;b.setPointerCapture?.(e.pointerId)};b.onpointermove=e=>{if(!moving)return;const r=body.getBoundingClientRect(),t=Math.max(0,Math.min(video.duration,(e.clientX-r.left)/r.width*video.duration));b.dataset.time=String(t);b.style.left=`${timelinePercent(t)}%`;onMove?.(t)};b.onpointerup=b.onpointercancel=e=>{moving=false;b.releasePointerCapture?.(e.pointerId);onMove?.(null)}}
  body.appendChild(b)
}
function refreshEditorTimeline(){
  const root=$('#editorTimeline');if(!root||!video.duration)return;
  const width=editorTimelineWidth();document.querySelectorAll('.track-body,.timeline-ruler').forEach(el=>el.style.width=`${width}px`);
  const ruler=$('#timelineRuler');ruler.innerHTML='';const tickCount=Math.max(2,Math.ceil(video.duration));
  for(let i=0;i<=tickCount;i++){const t=Math.min(video.duration,i);const tick=document.createElement('span');tick.className='ruler-tick';tick.style.left=`${timelinePercent(t)}%`;tick.textContent=fmt(t).slice(0,5);ruler.appendChild(tick)}
  ['frameTrack','leftTrack','rightTrack','angleTrack','noteTrack'].forEach(id=>{$(`#${id}`).innerHTML=''});
  const frameBody=$('#frameTrack');if(frameBody){for(let i=0;i<Math.min(160,Math.ceil(video.duration*30));i++){const t=i/30;if(t>video.duration)break;const mark=document.createElement('span');mark.className='frame-tick';mark.style.cssText=`position:absolute;left:${timelinePercent(t)}%;top:9px;height:10px;border-left:1px solid rgba(160,180,215,.28)`;frameBody.appendChild(mark)}frameBody.onclick=e=>jumpFromTimeline(e,frameBody)}
  stepEvents.forEach((item,i)=>{const body=item.foot==='left'?$('#leftTrack'):$('#rightTrack');addTimelineEvent(body,item.time,`${item.foot==='left'?'left':'right'} ${item.needsReview?'review':''}`,`${item.foot==='left'?'左腳':'右腳'} ${fmt(item.time)}${item.needsReview?'（待確認）':''}`,true,t=>{if(t===null){item.time=+((body.querySelectorAll('.timeline-event')[i]||{}).dataset?.time||item.time);renderStepAnalysis()}else item.time=t})});
  drawings.forEach((d,i)=>{if(d.time==null)d.time=video.currentTime;const body=$('#angleTrack');if(d.kind==='angle')addTimelineEvent(body,d.time,'angle',`角度 ${d.label} ${fmt(d.time)}`,true,t=>{if(t!==null)d.time=t;else refreshEditorTimeline()})});
  markers.forEach((m,i)=>addTimelineEvent($('#noteTrack'),m.time,'note',`${m.type} ${fmt(m.time)}`,true,t=>{if(t!==null)m.time=t;else renderMarkers()}));
  positionTimelinePlayhead();
  const label=$('#editorTimeLabel');if(label)label.textContent=fmt(video.currentTime||0);const zoomLabel=$('#timelineZoomLabel');if(zoomLabel)zoomLabel.textContent=`${Math.round(editorTimelineZoom*100)}%`;
  const scroll=$('#timelineScroll');if(scroll)scroll.querySelectorAll('.track-body').forEach(body=>body.onclick=e=>{if(e.target===body)jumpFromTimeline(e,body)});
}
function recalcAngle(d){const ab=[d.a.x-d.b.x,d.a.y-d.b.y],cb=[d.c.x-d.b.x,d.c.y-d.b.y],den=Math.hypot(...ab)*Math.hypot(...cb),ratio=den?Math.max(-1,Math.min(1,(ab[0]*cb[0]+ab[1]*cb[1])/den)):1;d.label=`${(Math.acos(ratio)*180/Math.PI).toFixed(1)}°`}
const baseRenderForHandles=render;render=function(){baseRenderForHandles();drawings.filter(d=>d.kind==='angle').forEach(d=>{[['A',d.a],['B',d.b],['C',d.c]].forEach(([label,p])=>{ctx.beginPath();ctx.fillStyle='#f7d774';ctx.strokeStyle='#0b1220';ctx.lineWidth=2;ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#0b1220';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,p.x,p.y);ctx.textAlign='start';ctx.textBaseline='alphabetic'})});refreshEditorTimeline()};
const previousTimelineDown=canvas.onpointerdown,previousTimelineMove=canvas.onpointermove,previousTimelineUp=canvas.onpointerup;
canvas.onpointerdown=e=>{if(tool==='select'){const p=point(e);for(let i=drawings.length-1;i>=0;i--){const d=drawings[i];if(d.kind!=='angle')continue;for(const key of ['a','b','c']){if(Math.hypot(p.x-d[key].x,p.y-d[key].y)<20){angleDrag={d,key};canvas.setPointerCapture?.(e.pointerId);return}}}}previousTimelineDown(e)};
canvas.onpointermove=e=>{if(angleDrag){const p=point(e);angleDrag.d[angleDrag.key]=p;recalcAngle(angleDrag.d);render();return}previousTimelineMove(e)};
canvas.onpointerup=e=>{if(angleDrag){angleDrag=null;canvas.releasePointerCapture?.(e.pointerId);render();return}previousTimelineUp(e)};
const oldUpdate=update;update=function(){oldUpdate();positionTimelinePlayhead();const l=$('#editorTimeLabel');if(l)l.textContent=fmt(video.currentTime||0)};
const oldRenderMarkers=renderMarkers;renderMarkers=function(){oldRenderMarkers();refreshEditorTimeline()};
const oldRenderStepAnalysis=renderStepAnalysis;renderStepAnalysis=function(){oldRenderStepAnalysis();refreshEditorTimeline()};
$('#timelineZoomIn')?.addEventListener('click',()=>{editorTimelineZoom=Math.min(10,editorTimelineZoom*1.25);refreshEditorTimeline()});$('#timelineZoomOut')?.addEventListener('click',()=>{editorTimelineZoom=Math.max(.5,editorTimelineZoom/1.25);refreshEditorTimeline()});

// Drag anywhere on the editor timeline to scrub the main video. The event
// markers keep their own click/drag behavior and are excluded here.
let timelineScrubbing=false;
function scrubEditorTimeline(e){
  if(!video.duration)return;
  const body=$('#frameTrack')||e.currentTarget;
  const r=body.getBoundingClientRect();
  const x=Math.max(0,Math.min(r.width,e.clientX-r.left));
  video.pause();video.currentTime=x/r.width*video.duration;update();render();
}
$('#timelineScroll')?.addEventListener('pointerdown',e=>{
  if(e.target.closest('.timeline-event'))return;
  timelineScrubbing=true;e.currentTarget.setPointerCapture?.(e.pointerId);scrubEditorTimeline(e);
});
$('#timelineScroll')?.addEventListener('pointermove',e=>{if(timelineScrubbing)scrubEditorTimeline(e)});
$('#timelineScroll')?.addEventListener('pointerup',e=>{timelineScrubbing=false;e.currentTarget.releasePointerCapture?.(e.pointerId)});
$('#timelineScroll')?.addEventListener('pointercancel',()=>{timelineScrubbing=false});

// Side-by-side video comparison. The main video remains the source of truth
// for seeking, playback, slow motion and frame stepping.
const compareInput=$('#compareVideoInput'),comparePrimary=$('#comparePrimary'),compareVideo=$('#compareVideo');
let compareUrl=null,compareLoaded=false,compareSyncing=false;
function alignValue(id,fallback=0){const n=Number($(id)?.value);return Number.isFinite(n)&&n>=0?n:fallback}
function compareTime(){if(!compareLoaded||!video.duration)return;const primaryStart=Math.min(video.duration,alignValue('#primaryAlignTime'));const compareStart=Math.min(compareVideo.duration||0,alignValue('#compareAlignTime'));const elapsed=Math.max(0,(video.currentTime||0)-primaryStart);const t=Math.max(0,Math.min(compareVideo.duration||0,compareStart+elapsed));for(const v of [comparePrimary]){if(v&&Math.abs((v.currentTime||0)-(video.currentTime||0))>.03){try{v.currentTime=video.currentTime}catch{}}}if(compareVideo&&Math.abs((compareVideo.currentTime||0)-t)>.03){try{compareVideo.currentTime=t}catch{}}const label=$('#compareTimeLabel');if(label)label.textContent=`主片 ${fmt(video.currentTime)}｜對比片 ${fmt(t)}｜起點 ${fmt(primaryStart)} / ${fmt(compareStart)}`}
function compareVisibility(on){$('#compareEmpty')?.classList.toggle('hidden',on);$('#compareStage')?.classList.toggle('hidden',!on);$('#compareControls')?.classList.toggle('hidden',!on)}
compareInput?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(compareUrl)URL.revokeObjectURL(compareUrl);compareUrl=URL.createObjectURL(file);compareLoaded=false;compareVideo.src=compareUrl;comparePrimary.src=url||'';compareVisibility(false);const label=$('#compareTimeLabel');if(label)label.textContent='正在載入對比影片…'});
compareVideo?.addEventListener('loadedmetadata',()=>{compareLoaded=true;compareVisibility(true);compareTime()});
compareVideo?.addEventListener('error',()=>{compareLoaded=false;compareVisibility(false);const label=$('#compareTimeLabel');if(label)label.textContent='對比影片格式無法讀取，請改用原始 MP4/MOV'});
video.addEventListener('loadedmetadata',()=>{if(compareLoaded&&comparePrimary)comparePrimary.src=url||'';compareTime()});
video.addEventListener('timeupdate',compareTime);video.addEventListener('seeking',compareTime);
video.addEventListener('play',()=>{if(!compareLoaded)return;compareTime();comparePrimary.play().catch(()=>{});compareVideo.play().catch(()=>{})});
video.addEventListener('pause',()=>{if(!compareLoaded)return;comparePrimary.pause();compareVideo.pause()});
$('#comparePlayBtn')?.addEventListener('click',()=>{if(!compareLoaded)return;compareTime();video.play().catch(()=>{});comparePrimary.play().catch(()=>{});compareVideo.play().catch(()=>{})});
$('#comparePauseBtn')?.addEventListener('click',()=>{video.pause();comparePrimary?.pause();compareVideo?.pause()});
$('#compareSyncBtn')?.addEventListener('click',()=>{if(!compareLoaded)return;const primaryStart=Math.min(video.duration,alignValue('#primaryAlignTime'));const compareStart=Math.min(compareVideo.duration||0,alignValue('#compareAlignTime'));video.pause();video.currentTime=primaryStart;compareVideo.currentTime=compareStart;comparePrimary.currentTime=primaryStart;compareTime();render();update()});
$('#setPrimaryAlignBtn')?.addEventListener('click',()=>{$('#primaryAlignTime').value=(video.currentTime||0).toFixed(3);compareTime()});
$('#setCompareAlignBtn')?.addEventListener('click',()=>{$('#compareAlignTime').value=(compareVideo.currentTime||0).toFixed(3);compareTime()});
['#primaryAlignTime','#compareAlignTime'].forEach(id=>$(id)?.addEventListener('input',compareTime));

// Manual ↑/↓ foot marks are valid input for the single-foot report too.
// Keep the report useful even when no pose samples were generated: contact
// times and same-foot cycles remain available, while unavailable pose fields
// are shown as — instead of being silently discarded.
function calculateSingleFootRows(){
  const foot=selectedSingleFoot();
  const samples=singleFootSamples.filter(s=>s[foot]);
  const contacts=stepEvents.filter(e=>e.foot===foot).sort((a,b)=>a.time-b.time);
  const scale=scaleCmPerPixel();
  return contacts.map((contact,i)=>{
    const next=contacts[i+1];
    let takeoff=null,stance=null,flight=null,heightPx=null,heightCm=null;
    if(next&&samples.length){
      const segment=samples.filter(s=>s.t>=contact.time&&s.t<=next.time&&s[foot]);
      if(segment.length>=2){
        const base=contact.y??segment[0][foot].y;
        const threshold=Math.max(3,(canvas.clientHeight||360)*.018);
        const found=segment.find(s=>s.t>contact.time+.03&&s[foot].y<base-threshold);
        if(found){
          takeoff=found.t;
          stance=takeoff-contact.time;
          flight=next.time-takeoff;
          const minY=Math.min(...segment.map(s=>s[foot].y));
          heightPx=Math.max(0,base-minY);
          heightCm=scale?heightPx*scale:null;
        }
      }
    }
    return {index:i+1,foot,contact:contact.time,takeoff,stance,flight,cycle:i?contact.time-contacts[i-1].time:null,heightPx,heightCm};
  });
}
function displayTime(t){return t==null?'—':fmt(t)}
function displaySeconds(t){return t==null?'—':`${t.toFixed(3)} s`}
function renderSingleFootAnalysis(){
  singleFootRows=calculateSingleFootRows();
  const status=$('#singleFootStatus'),tbody=$('#singleFootTable');
  const foot=selectedSingleFoot();
  const hasData=singleFootRows.length>0;
  status.textContent=hasData?`${foot==='right'?'右腳':'左腳'}｜共 ${singleFootRows.length} 個標記（手動標記也會列入）`:'請先按 ↑／↓ 標記，或執行自動分析';
  const avg=k=>{const values=singleFootRows.map(r=>r[k]).filter(v=>Number.isFinite(v));return values.length?values.reduce((a,b)=>a+b,0)/values.length:null};
  $('#singleContactCount').textContent=hasData?singleFootRows.length:'—';
  $('#singleStanceAvg').textContent=displaySeconds(avg('stance'));
  $('#singleFlightAvg').textContent=displaySeconds(avg('flight'));
  tbody.innerHTML=hasData?singleFootRows.map(r=>`<tr class="single-row" data-time="${r.contact}"><td>${r.index}</td><td>${r.foot==='left'?'左':'右'}</td><td>${fmt(r.contact)}</td><td>${displayTime(r.takeoff)}</td><td>${displaySeconds(r.stance)}</td><td>${displaySeconds(r.flight)}</td><td>${displaySeconds(r.cycle)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">尚未產生單腳數據</td></tr>';
  tbody.querySelectorAll('.single-row').forEach(row=>row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()});
  if($('#exportSingleFootBtn'))$('#exportSingleFootBtn').disabled=!hasData;
}
function renderAlternateAnalysis(){
  const events=[...stepEvents].sort((a,b)=>a.time-b.time);
  const switches=events.slice(1).map((e,i)=>e.foot!==events[i].foot?e.time-events[i].time:null).filter(v=>v!=null&&v>0);
  const groups=[];
  for(let i=0;i<events.length-2;i++){
    const a=events[i],b=events[i+1],c=events[i+2];
    if(a.foot===c.foot&&a.foot!==b.foot)groups.push({a,b,c,ab:b.time-a.time,bc:c.time-b.time,total:c.time-a.time});
  }
  const avg=v=>v.length?v.reduce((a,b)=>a+b,0)/v.length:null;
  $('#alternateSwitchAvg').textContent=displaySeconds(avg(switches));
  $('#alternateCycleAvg').textContent=displaySeconds(avg(groups.map(g=>g.total)));
  $('#alternateCount').textContent=groups.length;
  $('#alternateStatus').textContent=groups.length?`已找到 ${groups.length} 組左↔右↔左交替`:'等待左→右→左（或右→左→右）標記';
  const tbody=$('#alternateTable');
  tbody.innerHTML=groups.length?groups.map((g,i)=>`<tr class="alternate-row" data-time="${g.a.time}"><td>${i+1}</td><td>${g.a.foot==='left'?'左→右→左':'右→左→右'}</td><td>${fmt(g.a.time)}</td><td>${fmt(g.b.time)}</td><td>${fmt(g.c.time)}</td><td>${displaySeconds(g.ab)}</td><td>${displaySeconds(g.bc)}</td><td>${displaySeconds(g.total)}</td></tr>`).join(''):'<tr><td colspan="8" class="empty-cell">請依序標記左腳→右腳→左腳</td></tr>';
  tbody.querySelectorAll('.alternate-row').forEach(row=>row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()});
}
renderStepAnalysis=renderStepAnalysisWithTakeoff;

// Contact/takeoff timing controls: the same direction key toggles the foot
// state. First ↑/↓ marks contact; the next same key marks takeoff.
let activeTakeoffFoot=null;
function addStep(foot){
  const now=video.currentTime;
  const pending=[...stepEvents].reverse().find(e=>e.foot===foot&&!Number.isFinite(e.takeoff)&&e.time<now);
  activeTakeoffFoot=foot;
  if(pending){
    pending.takeoff=now;
    $('#analysisHint').textContent=`已記錄${foot==='left'?'左':'右'}腳離地`;
  }else{
    stepEvents.push({time:now,foot,takeoff:null});
    $('#analysisHint').textContent=`已記錄${foot==='left'?'左':'右'}腳點地；再按一次${foot==='left'?'↓':'↑'}記錄離地`;
  }
  renderStepAnalysis();
}

function renderContactMarkers(){
  const box=$('#stepEventMarkers');if(!box)return;
  box.innerHTML='';const duration=video.duration||0;if(!duration)return;
  const add=(time,foot,takeoff=false)=>{
    const b=document.createElement('button');b.type='button';b.className=`step-event-marker ${foot==='right'?'right':''} ${takeoff?'takeoff-marker':''}`;
    b.style.left=`${Math.max(0,Math.min(100,time/duration*100))}%`;
    b.dataset.label=`${foot==='left'?'左腳':'右腳'} ${takeoff?'離地':'點地'} ${fmt(time)}`;
    b.title=`${b.dataset.label}｜單擊跳轉`;
    b.setAttribute('aria-label',`跳到${b.dataset.label}`);
    b.onclick=()=>{video.pause();video.currentTime=time;render();update()};box.appendChild(b);
  };
  stepEvents.forEach(e=>{add(e.time,e.foot,false);if(Number.isFinite(e.takeoff))add(e.takeoff,e.foot,true)});
}

function calculateSingleFootRows(){
  const foot=selectedSingleFoot();
  const events=stepEvents.slice().sort((a,b)=>a.time-b.time);
  const contacts=foot==='both'?events:events.filter(e=>e.foot===foot);
  return contacts.map((contact,i)=>{
    const eventIndex=events.indexOf(contact);
    const previousSame=events.slice(0,eventIndex).reverse().find(e=>e.foot===contact.foot);
    const nextOpposite=events.slice(eventIndex+1).find(e=>e.foot!==contact.foot);
    const takeoff=Number.isFinite(contact.takeoff)?contact.takeoff:null;
    return {index:i+1,foot:contact.foot,contact:contact.time,takeoff,stance:takeoff==null?null:takeoff-contact.time,flight:takeoff==null||!nextOpposite?null:nextOpposite.time-takeoff,cycle:previousSame?contact.time-previousSame.time:null,heightPx:null,heightCm:null};
  });
}
function renderSingleFootAnalysis(){
  singleFootRows=calculateSingleFootRows();
  const status=$('#singleFootStatus'),tbody=$('#singleFootTable'),foot=selectedSingleFoot(),hasData=singleFootRows.length>0;
  const label=foot==='both'?'雙腳':foot==='right'?'右腳':'左腳';
  status.textContent=hasData?`${label}｜共 ${singleFootRows.length} 個標記`:'請先按 ↑／↓ 標記，或執行自動分析';
  const avg=k=>{const v=singleFootRows.map(r=>r[k]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null};
  $('#singleContactCount').textContent=hasData?singleFootRows.length:'—';
  $('#singleStanceAvg').textContent=displaySeconds(avg('stance'));
  $('#singleFlightAvg').textContent=displaySeconds(avg('flight'));
  tbody.innerHTML=hasData?singleFootRows.map(r=>`<tr class="single-row" data-time="${r.contact}"><td>${r.index}</td><td>${r.foot==='left'?'左':'右'}</td><td>${fmt(r.contact)}</td><td>${displayTime(r.takeoff)}</td><td>${displaySeconds(r.stance)}</td><td>${displaySeconds(r.flight)}</td><td>${displaySeconds(r.cycle)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">尚未產生單腳數據</td></tr>';
  tbody.querySelectorAll('.single-row').forEach(row=>row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()});
  if($('#exportSingleFootBtn'))$('#exportSingleFootBtn').disabled=!hasData;
}

function appendTakeoffTimelineEvents(){
  if(!video.duration)return;
  stepEvents.forEach(item=>{
    if(!Number.isFinite(item.takeoff))return;
    const body=item.foot==='left'?$('#leftTrack'):$('#rightTrack');
    addTimelineEvent(body,item.takeoff,`takeoff ${item.foot}`,`${item.foot==='left'?'左':'右'}腳離地 ${fmt(item.takeoff)}`,true,t=>{if(t!==null)item.takeoff=t;else renderStepAnalysis()});
  });
}
const baseRefreshWithTakeoff=refreshEditorTimeline;
refreshEditorTimeline=function(){baseRefreshWithTakeoff();appendTakeoffTimelineEvents()};

function renderStepAnalysisWithTakeoff(){
  stepEvents.sort((a,b)=>a.time-b.time);
  const scale=scaleCmPerPixel(),last={left:null,right:null};
  const rows=stepEvents.map(e=>{const prev=last[e.foot];e.cycle=prev?e.time-prev.time:null;e.distance=prev&&scale&&e.x!=null&&prev.x!=null?Math.hypot(e.x-prev.x,e.y-prev.y)/scale:null;last[e.foot]=e;return e});
  const intervals=rows.slice(1).map((e,i)=>e.time-rows[i].time).filter(x=>x>0),cycles=rows.map(e=>e.cycle).filter(Boolean),distances=rows.map(e=>e.distance).filter(Boolean),cadence=intervals.length?60/(intervals.reduce((a,b)=>a+b,0)/intervals.length):null;
  const stat=[rows.length,cadence?cadence.toFixed(1):'—',cycles.length?(cycles.reduce((a,b)=>a+b,0)/cycles.length).toFixed(2)+' s':'—',distances.length?(distances.reduce((a,b)=>a+b,0)/distances.length).toFixed(1)+' cm':'—'];
  document.querySelectorAll('#analysisStats b').forEach((el,i)=>el.textContent=stat[i]);
  const startTime=rows.length?rows[0].time:null,endTime=rows.length?rows[rows.length-1].time:null,third=startTime!=null&&endTime>startTime?(endTime-startTime)/3:null;
  const periodIntervals=[[],[],[]],periodCycles=[[],[],[]];
  if(third){
    rows.slice(1).forEach((e,i)=>{const midpoint=(rows[i].time+e.time)/2;const bucket=Math.min(2,Math.floor((midpoint-startTime)/third));if(e.time>rows[i].time)periodIntervals[bucket].push(e.time-rows[i].time)});
    rows.forEach(e=>{if(!Number.isFinite(e.cycle))return;const midpoint=e.time-e.cycle/2;const bucket=Math.min(2,Math.floor((midpoint-startTime)/third));periodCycles[bucket].push(e.cycle)});
  }
  const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  [['#periodEarlyCadence','#periodEarlyCycle'],['#periodMiddleCadence','#periodMiddleCycle'],['#periodLateCadence','#periodLateCycle']].forEach((ids,i)=>{const intervalMean=mean(periodIntervals[i]),cycleMean=mean(periodCycles[i]);$(ids[0]).textContent=intervalMean?`${(60/intervalMean).toFixed(1)} spm`:'—';$(ids[1]).textContent=cycleMean?`${cycleMean.toFixed(3)} s`:'—'});
  const tbody=$('#stepTable');
  tbody.innerHTML=rows.length?rows.map((e,i)=>`<tr class="step-row" data-time="${e.time}" data-index="${i}"><td>${i+1}</td><td>${e.foot==='left'?'左':'右'}</td><td>${fmt(e.time)}</td><td>${displayTime(e.takeoff)}</td><td>${e.cycle?e.cycle.toFixed(2)+' s':'—'}</td><td>${e.distance?e.distance.toFixed(1)+' cm':'—'}</td><td><button type="button" class="step-delete" title="刪除此腳部標記">×</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">尚未記錄落地</td></tr>';
  tbody.querySelectorAll('.step-row').forEach(row=>{row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()};row.querySelector('.step-delete').onclick=e=>{e.stopPropagation();stepEvents.splice(+row.dataset.index,1);renderStepAnalysis()}});
  $('#exportAnalysisBtn').disabled=!rows.length;renderContactMarkers();renderSingleFootAnalysis();renderAlternateAnalysis();refreshEditorTimeline();
}
const baseRenderStepAnalysisWithTimeline=renderStepAnalysis;
renderStepAnalysis=function(){baseRenderStepAnalysisWithTimeline();renderSingleFootAnalysis();renderAlternateAnalysis()};

// Show directional transition timing separately. A symmetric full cycle can
// hide an important left-to-right versus right-to-left imbalance.
function renderAlternateAnalysis(){
  const events=[...stepEvents].sort((a,b)=>a.time-b.time);
  const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const leftRight=[],rightLeft=[],groups=[];
  for(let i=1;i<events.length;i++){
    const d=events[i].time-events[i-1].time;
    if(!(d>0)||events[i].foot===events[i-1].foot)continue;
    if(events[i-1].foot==='left')leftRight.push(d);else rightLeft.push(d);
  }
  for(let i=0;i<events.length-2;i++){
    const a=events[i],b=events[i+1],c=events[i+2];
    if(a.foot===c.foot&&a.foot!==b.foot)groups.push({a,b,c,ab:b.time-a.time,bc:c.time-b.time,total:c.time-a.time});
  }
  const lr=avg(leftRight),rl=avg(rightLeft),diff=lr!=null&&rl!=null?Math.abs(lr-rl):null,percent=diff!=null?diff/Math.min(lr,rl)*100:null;
  $('#alternateLeftRight').textContent=displaySeconds(lr);
  $('#alternateRightLeft').textContent=displaySeconds(rl);
  $('#alternateDiff').textContent=diff==null?'—':`${diff.toFixed(3)} s (${percent.toFixed(1)}%)`;
  $('#alternateCycleAvg').textContent=displaySeconds(avg(groups.map(g=>g.total)));
  $('#alternateCount').textContent=groups.length;
  $('#alternateStatus').textContent=groups.length?`左→右 ${displaySeconds(lr)}｜右→左 ${displaySeconds(rl)}｜差異 ${diff==null?'—':`${diff.toFixed(3)} s`}`:'等待左→右→左（或右→左→右）標記';
  const tbody=$('#alternateTable');
  tbody.innerHTML=groups.length?groups.map((g,i)=>`<tr class="alternate-row" data-time="${g.a.time}"><td>${i+1}</td><td>${g.a.foot==='left'?'左→右→左':'右→左→右'}</td><td>${fmt(g.a.time)}</td><td>${fmt(g.b.time)}</td><td>${fmt(g.c.time)}</td><td>${displaySeconds(g.ab)}</td><td>${displaySeconds(g.bc)}</td><td>${g.ab>g.bc?'第1→2':'第2→3'}</td><td>${displaySeconds(g.total)}</td></tr>`).join(''):'<tr><td colspan="9" class="empty-cell">請依序標記左腳→右腳→左腳</td></tr>';
  tbody.querySelectorAll('.alternate-row').forEach(row=>row.onclick=()=>{video.pause();video.currentTime=+row.dataset.time;render();update()});
}
// Export every analysis result in one AI-friendly CSV. Each row declares its
// record type so event timing and left/right transition timing coexist.
function exportCompleteAnalysisCsv(){
  const events=[...stepEvents].sort((a,b)=>a.time-b.time);
  const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const scale=scaleCmPerPixel();
  const columns=['record_type','index','sequence','foot','contact_s','takeoff_s','stance_s','flight_s','cycle_s','distance_cm','from_foot','to_foot','interval_s','full_cycle_s','longer_segment'];
  const esc=value=>{const s=value==null?'':String(value);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
  const n=value=>Number.isFinite(value)?value.toFixed(3):'';
  const last={left:null,right:null};
  const rows=[];
  events.forEach((e,i)=>{
    const previous=last[e.foot];
    const cycle=previous?e.time-previous.time:null;
    const distance=previous&&scale&&e.x!=null&&previous.x!=null?Math.hypot(e.x-previous.x,e.y-previous.y)/scale:null;
    const nextOpposite=events.slice(i+1).find(next=>next.foot!==e.foot);
    const flight=Number.isFinite(e.takeoff)&&nextOpposite?nextOpposite.time-e.takeoff:null;
    rows.push(['event',i+1,'',e.foot,n(e.time),n(e.takeoff),Number.isFinite(e.takeoff)?n(e.takeoff-e.time):'',n(flight),n(cycle),n(distance),'','','','','']);
    last[e.foot]=e;
  });
  const leftRight=[],rightLeft=[],groups=[];
  for(let i=1;i<events.length;i++){
    const interval=events[i].time-events[i-1].time;
    if(!(interval>0)||events[i].foot===events[i-1].foot)continue;
    const from=events[i-1].foot,to=events[i].foot;
    (from==='left'?leftRight:rightLeft).push(interval);
    rows.push(['transition',i,'','', '', '', '', '', '', '',from,to,n(interval),'','']);
  }
  for(let i=0;i<events.length-2;i++){
    const a=events[i],b=events[i+1],c=events[i+2];
    if(a.foot===c.foot&&a.foot!==b.foot)groups.push({a,b,c,ab:b.time-a.time,bc:c.time-b.time,total:c.time-a.time});
  }
  groups.forEach((g,i)=>rows.push(['alternating_cycle',i+1,`${g.a.foot}->${g.b.foot}->${g.c.foot}`,'',n(g.a.time),'','','','', '',g.a.foot,g.b.foot,n(g.ab),n(g.total),g.ab>g.bc?'第1→2':'第2→3']));
  const summaryRow=(name,value)=>[name,value,...Array(13).fill('')];
  const intervals=events.slice(1).map((e,i)=>e.time-events[i].time).filter(v=>v>0);
  const startTime=events.length?events[0].time:null,endTime=events.length?events[events.length-1].time:null,third=startTime!=null&&endTime>startTime?(endTime-startTime)/3:null;
  const periodIntervals=[[],[],[]],periodCycles=[[],[],[]],cycleLast={left:null,right:null};
  events.forEach((e,i)=>{
    if(third&&i>0){const interval=e.time-events[i-1].time;if(interval>0){const midpoint=(events[i-1].time+e.time)/2;const bucket=Math.min(2,Math.floor((midpoint-startTime)/third));periodIntervals[bucket].push(interval)}}
    const previous=cycleLast[e.foot];
    if(third&&previous){const cycle=e.time-previous.time;const midpoint=(previous.time+e.time)/2;const bucket=Math.min(2,Math.floor((midpoint-startTime)/third));periodCycles[bucket].push(cycle)}
    cycleLast[e.foot]=e;
  });
  const periodSummary=[];
  ['early','middle','late'].forEach((name,i)=>{
    const intervalMean=avg(periodIntervals[i]),cycleMean=avg(periodCycles[i]);
    periodSummary.push(summaryRow(`summary_${name}_cadence`,intervalMean==null?'':(60/intervalMean).toFixed(3)));
    periodSummary.push(summaryRow(`summary_${name}_cycle`,cycleMean==null?'':n(cycleMean)));
  });
  const summary=[
    summaryRow('summary_total_steps',events.length),
    summaryRow('summary_cadence',avg(intervals)==null?'':(60/avg(intervals)).toFixed(3)),
    summaryRow('summary_left_to_right',avg(leftRight)==null?'':n(avg(leftRight))),
    summaryRow('summary_right_to_left',avg(rightLeft)==null?'':n(avg(rightLeft))),
    summaryRow('summary_full_cycle',avg(groups.map(g=>g.total))==null?'':n(avg(groups.map(g=>g.total)))),
    ...periodSummary,
    summaryRow('summary_audio_bpm',window.lastAudioAnalysis?.bpm==null?'':n(window.lastAudioAnalysis.bpm)),
    summaryRow('summary_audio_stability_pct',window.lastAudioAnalysis?.stability==null?'':n(window.lastAudioAnalysis.stability)),
    summaryRow('summary_audio_match_pct',window.lastAudioAnalysis?.matchRate==null?'':n(window.lastAudioAnalysis.matchRate))
  ];
  const csv=[columns,...summary,...rows].map(row=>row.map(esc).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='完整步頻步態分析.csv';a.click();URL.revokeObjectURL(a.href);
}
const completeExport=$('#exportAnalysisBtn');
if(completeExport)completeExport.onclick=exportCompleteAnalysisCsv;
// Final binding: the takeoff-aware renderer must win over earlier wrappers.
renderStepAnalysis=renderStepAnalysisWithTakeoff;

// Automatic pose analysis has been removed. Keep the manual workflow wording
// clear for existing render paths left by older versions.
const renderSingleFootAnalysisManual=renderSingleFootAnalysis;
renderSingleFootAnalysis=()=>{
  renderSingleFootAnalysisManual();
  const status=$('#singleFootStatus');
  if(status&&status.textContent.includes('自動分析'))status.textContent='請先用 ↑／↓ 標記，再選擇左右腳';
};
