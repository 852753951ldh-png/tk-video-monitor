const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>n==null?'—':Number(n).toLocaleString('zh-CN'), D=t=>t?new Date(t*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'未采到';
const money=n=>n==null?'未核对':'$'+Number(n).toFixed(2), STATES={unknown:'待确认',joined:'已加入',not_joined:'未加入',pending:'申请中',paused:'已暂停'};
let data,board,period='yesterday';
function table(head,rows){return '<div class="tablewrap"><table><thead><tr>'+head.map(t=>'<th>'+t+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function card(name,value,note){return '<div class="card"><small>'+name+'</small><strong>'+value+'</strong><small>'+note+'</small></div>'}
function renderPeriod(){const p=data[period], prior=data[period==='yesterday'?'previous_day':'previous_week'],day=period==='yesterday';
 $('#periodTitle').textContent=day?'昨日详细分析':'本周总结';$('#range').textContent=D(p.start)+' 至 '+D(p.end-1)+' · 北京时间';
 $('#metrics').innerHTML=card('已观测播放净增长',N(p.growth),prior.growth!=null?'前一可比期间 '+N(prior.growth):'对照期数据不足')+card('期间发布视频',N(p.published),'按发布时间统计')+card('首次检测 ≥3500',N(p.hit3500),'按 PID 去重')+card('首次检测 ≥5000',N(p.hit5000),'按 PID 去重');
 $('#method').textContent=data.method+(p.gaps?' 本期有 '+N(p.gaps)+' 个采样间隔超过 45 分钟，增长可能低估。':'');
 $('#chartTitle').textContent=day?'昨天哪个时段增长最快':'本周每天新增播放';
 const max=Math.max(1,...p.bins.map(b=>Math.abs(b.growth||0)));$('#chart').innerHTML=p.bins.map(b=>'<div class="column"><div style="height:'+Math.max(2,Math.abs(b.growth||0)/max*135)+'px;min-height:3px;border-radius:4px 4px 0 0;width:100%;background:'+(b.growth==null?'#cbd5e1':'#6684e7')+'" title="'+esc(b.label+'：'+N(b.growth))+'" role="img" aria-label="'+esc(b.label+' 增长 '+N(b.growth))+'"></div><small>'+esc(day?b.label.slice(0,2):b.label)+'</small></div>').join('');
 const top=[...p.bins].filter(b=>b.growth!=null).sort((a,b)=>b.growth-a.growth).slice(0,3);$('#fastest').innerHTML=top.length?top.map(b=>'<div class="rank"><span>'+esc(b.label)+'</span><b class="up">'+N(b.growth)+'</b></div>').join(''):'<div class="empty">暂无可比采样</div>';
 $('#ranking').innerHTML=table(['手机 / 账号','期间增长','发布数','可比视频','3500 / 5000'],p.accounts.map(a=>['<span class="phone">#'+a.account_no+'</span> '+esc(a.username),N(a.growth),N(a.published),N(a.observed),a.hit3500+' / '+a.hit5000]));
 $('#videos').innerHTML=table(['手机 / PID','发布','期间增长','当前播放','首次检测 1000 / 3500 / 5000'],p.videos.map(v=>['<span class="phone">#'+v.account_no+'</span> '+esc(v.username)+'<br><a class="pid" href="'+esc(v.url)+'" target="_blank" rel="noopener">'+esc(v.video_id)+'</a>',D(v.published_at),N(v.growth)+(v.gaps?'<br><small>有采样缺口</small>':''),N(v.views),[1000,3500,5000].map(k=>k+': '+D(v.thresholds[k])).join('<br>')]));
}
function renderOther(){
 $('#live').innerHTML=board.accounts.map(a=>'<details class="panel"><summary><span class="phone">#'+a.account_no+'</span> '+esc(a.username)+' · '+a.videos.length+' 条达标视频</summary>'+table(['PID / 发布时间','播放量','约24小时变化','1000 / 3500 / 5000 首次检测'],a.videos.map(v=>['<a class="pid" href="'+esc(v.url)+'" target="_blank" rel="noopener">'+esc(v.video_id)+'</a><br><small>'+D(v.published_at)+'</small>',N(v.views)+'<br><small>'+esc(v.tracking_state)+'</small>',N(v.daily_delta)+(v.daily_percent==null?'':' / '+v.daily_percent+'%'),[1000,3500,5000].map(k=>D(v.thresholds[k])).join('<br>')]))+'</details>').join('');
 const a=data.accounts,queue=a.filter(x=>x.best_views>=1000&&x.program!=='joined').sort((x,y)=>(y.best_views||0)-(x.best_views||0));
 $('#opportunity').innerHTML=queue.length?table(['手机 / 账号','近7天单条最高播放','计划状态'],queue.map(x=>['#'+x.account_no+' '+esc(x.username),N(x.best_views),'<span class="badge bad">'+STATES[x.program]+'</span>'])):'<p class="muted">暂无待核对账号。</p>';
 $('#rewards').innerHTML=table(['手机 / 账号','累计收益（USD）','核对时间'],a.map(x=>['<span class="phone">#'+x.account_no+'</span> '+esc(x.username)+(x.test?'<br><small>测试赛道</small>':''),money(x.amount),D(x.checked_at)]));
 $('#health').innerHTML=table(['手机 / 账号','最后采集成功'],a.map(x=>['#'+x.account_no+' '+esc(x.username),D(x.last_ok)]));
 $('#status').textContent='最近采集 '+D(data.latest_sample)+' · 公开快照 '+D(data.generated_at);
}
async function load(){try{const [r,b]=await Promise.all([fetch('data/insights.json',{cache:'no-store'}),fetch('data/board.json',{cache:'no-store'})]);if(!r.ok||!b.ok)throw Error('公开数据暂不可用');[data,board]=await Promise.all([r.json(),b.json()]);renderPeriod();renderOther();$('#error').style.display='none'}catch(e){$('#error').style.display='block';$('#error').textContent='数据读取失败：'+e.message;$('#status').textContent='公开快照暂不可用'}}
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(x=>x.classList.toggle('active',x===b));if(data)renderPeriod()});
$('#refresh').onclick=()=>location.reload();load();
