const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N = value => value == null ? '—' : Number(value).toLocaleString('zh-CN');
const D = seconds => seconds ? new Date(seconds * 1000).toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '未采到';
const DZ = (seconds, zone) => new Date(seconds * 1000).toLocaleString('zh-CN', {timeZone:zone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const USD = value => value == null ? '未录入' : '$' + Number(value).toFixed(2);

function table(headers, rows) {
  if (!rows.length) return '<div class="empty">暂无可显示的数据</div>';
  return '<div class="tablewrap"><table><thead><tr>' + headers.map(x => '<th>' + esc(x) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function card(label, value, note) {
  return '<div class="card"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></div>';
}

const isLocalManager = ['127.0.0.1', 'localhost'].includes(location.hostname);
let trialTab = 'new';
let currentTrial = null;
function videoTone(views) {
  return views >= 1000 ? ['prism', '突破 1,000'] : views >= 600 ? ['gold', '达到 600'] :
    views >= 200 ? ['normal', '达到 200'] : ['low', '低于 200'];
}
function trialVideo(v) {
  const [tone, label] = videoTone(v.views);
  const fresh = v.last_seen === v.last_sample;
  return '<div class="trial-video '+tone+'"><div class="trial-video-top"><span class="tier-label">'+label+'</span><strong>'+N(v.views)+'</strong></div>'+
    '<a class="pid" target="_blank" rel="noopener" href="'+esc(v.url)+'">PID '+esc(v.pid)+'</a>'+
    '<div class="trial-video-meta">发布 '+D(v.published_at)+' · 24 小时播放 '+(v.views_24h == null ? '待采样' : N(v.views_24h))+
    (fresh ? '' : ' · 当前暂不可见或未更新')+'</div></div>';
}
function trialAccount(a) {
  const state = a.fail_streak ? '采集异常 '+a.fail_streak+' 次' : !a.active ? '已停采' : '采集中';
  const decision = a.decision === 'promoted' ? '已晋升' : a.decision === 'eliminated' ? '已淘汰' :
    a.candidate_reason ? '待淘汰' : '观察中';
  const avg = a.average_views == null ? '—' : N(a.average_views);
  const tierName = a.grade === 'prism' ? '棱彩 · 有 1,000' : a.grade === 'gold' ? '金色 · 有 600' :
    a.grade === 'low' ? '低播放' : a.grade === 'normal' ? '普通' : '待采样';
  const extended = a.trial_ends_at && a.trial_ends_at - a.trial_started_at >= 72*3600;
  const actions = !isLocalManager ? '' : '<div class="trial-actions">'+
    (a.decision !== 'promoted' ? '<button type="button" data-decision="promoted" data-account-id="'+a.account_id+'">晋升为留下来的号</button>' : '')+
    (!a.decision && !extended ? '<button type="button" data-decision="extend" data-account-id="'+a.account_id+'">再观察 1 天</button>' : '')+
    (a.decision !== 'eliminated' ? '<button class="danger-quiet" type="button" data-decision="eliminated" data-account-id="'+a.account_id+'">淘汰并停采</button>' : '')+'</div>';
  return '<details class="trial-account '+a.grade+'"><summary><div class="trial-account-title"><span class="phone">#'+a.account_no+'</span><span class="trial-user">@'+esc(a.username)+'</span><span class="tier-badge">'+tierName+'</span><span class="trial-state">'+decision+'</span></div>'+
    '<div class="trial-summary"><span>平均 <b>'+avg+'</b></span><span>≥200 <b>'+a.at_least_200+'/'+a.sample_count+'</b></span><span>≥600 <b>'+a.at_least_600+'</b></span><span>≥1,000 <b>'+a.at_least_1000+'</b></span></div></summary>'+
    '<div class="trial-inside">'+(a.candidate_reason ? '<p class="trial-reason">'+esc(a.candidate_reason)+'；仅供判断，未自动淘汰。</p>' : '')+
    '<div class="trial-meta">'+esc(state)+' · 最近成功 '+D(a.last_ok)+' · '+(a.trial_ends_at ? '观察到 '+D(a.trial_ends_at)+(extended ? '（已延长）' : '') : '已晋升，持续监测')+'</div>'+
    '<div class="trial-videos">'+(a.videos.length ? a.videos.map(trialVideo).join('') : '<div class="empty">尚未采到本次试跑的视频；这不是 0 播放。</div>')+'</div>'+actions+'</div></details>';
}
function renderTrial(data) {
  currentTrial = data;
  const accounts = data.accounts || [];
  const promoted = accounts.filter(a => a.group === 'promoted');
  const candidate = accounts.filter(a => a.group === 'candidate');
  const observing = accounts.filter(a => a.group === 'trial');
  const eliminated = accounts.filter(a => a.group === 'eliminated');
  $('#newCount').textContent = '('+(candidate.length+observing.length)+')';
  $('#promotedCount').textContent = '('+promoted.length+')';
  document.querySelectorAll('[data-trial-tab]').forEach(b => {
    const active = b.dataset.trialTab === trialTab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  if (trialTab === 'promoted') {
    $('#trialContent').innerHTML = promoted.length ? promoted.map(trialAccount).join('') :
      '<div class="empty">还没有手动晋升的账号。你选中的号会出现在这里，试跑到期也不会自动停采。</div>';
    return;
  }
  $('#trialContent').innerHTML =
    (candidate.length ? '<div class="trial-group"><h3>待淘汰 <small>'+candidate.length+' 个 · 需要你确认</small></h3>'+candidate.map(trialAccount).join('')+'</div>' : '')+
    '<div class="trial-group"><h3>继续观察 <small>'+observing.length+' 个 · 按手机编号</small></h3>'+
    (observing.length ? observing.map(trialAccount).join('') : '<div class="empty">目前没有继续观察的新号</div>')+'</div>'+
    (eliminated.length ? '<details class="trial-eliminated"><summary>已淘汰 · '+eliminated.length+' 个（历史保留）</summary>'+eliminated.map(trialAccount).join('')+'</details>' : '');
}

async function decideTrial(accountId, decision) {
  if (!isLocalManager) return;
  const a = currentTrial?.accounts.find(x => x.account_id === accountId);
  if (!a) return;
  if (decision === 'eliminated' && !confirm('淘汰 #'+a.account_no+' @'+a.username+' 并停止采集？历史视频不会删除。')) return;
  const msg = $('#trialMessage');
  msg.hidden = false; msg.textContent = '正在保存…';
  try {
    const response = await fetch('/api/trial/decision', {method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({account_id:accountId,decision})});
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '保存失败');
    msg.textContent = decision === 'promoted' ? '已晋升，公开看板正在同步。' :
      decision === 'extend' ? '已延长至 72 小时，公开看板正在同步。' : '已淘汰并停采，公开看板正在同步。';
    const next = await fetch('/data/trial.json',{cache:'no-store'});
    if (next.ok) renderTrial(await next.json());
  } catch (error) { msg.textContent = '未保存：'+error.message; }
}
$('#trialContent').addEventListener('click', event => {
  const button = event.target.closest('[data-decision]');
  if (button) decideTrial(Number(button.dataset.accountId), button.dataset.decision);
});
document.querySelectorAll('[data-trial-tab]').forEach(button => button.addEventListener('click', () => {
  trialTab = button.dataset.trialTab;
  if (currentTrial) renderTrial(currentTrial);
}));

function renderAccounts(data, board) {
  const byId = new Map(board.accounts.map(a => [a.account_id, a]));
  const accounts = data.accounts;
  const end = Math.max(0, ...accounts.map(a => Number(a.trial_ends_at || 0)));
  const reached = accounts.reduce((n, a) => n + (byId.get(a.account_id)?.videos.length || 0), 0);
  const sampled = accounts.filter(a => a.last_ok && a.last_ok >= a.trial_started_at).length;
  const active = accounts.filter(a => a.active).length;
  $('#trialNote').textContent = end ? '本批观察到 '+D(end)+'（北京时间）；到期自动停采，历史结果继续保留。' : '按手机编号查看采集和单条播放。';
  $('#batchMetrics').innerHTML = card('本批账号', N(accounts.length), '按手机编号排序') +
    card('已采到数据', N(sampled)+' / '+N(accounts.length), '首次成功采集过的账号') +
    card('单条 ≥1,000', N(reached), '按 PID 去重') +
    card('仍在采集', N(active), '到期自动停采');
  $('#accounts').innerHTML = accounts.map(a => {
    const detail = byId.get(a.account_id);
    const hits = detail?.videos.length || 0;
    const stale = a.last_ok && data.generated_at - a.last_ok > 3600;
    const state = !a.active ? '已结束' : a.fail_streak ? '采集失败 '+a.fail_streak+' 次' : stale ? '采集延迟' : '采集中';
    const stateClass = !a.active ? 'neutral' : a.fail_streak || stale ? 'warn' : 'good';
    const peak = a.best_views == null ? '—' : N(a.best_views);
    return '<div class="account-row panel"><div class="account-name"><span class="phone">#'+a.account_no+'</span> <a href="https://www.tiktok.com/@'+encodeURIComponent(a.username)+'" target="_blank" rel="noopener">@'+esc(a.username)+'</a><span class="state '+stateClass+'">'+esc(state)+'</span></div>'+
      '<div class="account-facts"><span>最高单条 <b>'+peak+'</b></span><span>≥1,000 <b>'+N(hits)+' 条</b></span><span>最近采集 <b>'+D(a.last_ok)+'</b></span></div></div>';
  }).join('') || '<div class="empty">尚无本批账号数据</div>';
}

function renderYesterday(data) {
  const videos = data.yesterday.videos.filter(v => v.new).sort((a,b) => b.views - a.views);
  const hours = [...data.yesterday.bins].filter(h => h.intervals > 0).sort((a,b) => b.growth - a.growth);
  const at = n => videos.filter(v => v.views >= n).length;
  $('#yesterdayMetrics').innerHTML =
    card('昨日可比播放增长', N(data.yesterday.growth), '全账号、连续采样') +
    card('昨日增长最快时段', hours.length ? hours[0].label+'–'+String((Number(hours[0].label.slice(0,2))+1)%24).padStart(2,'0')+':00' : '无数据', hours.length ? '北京时间 · 增加 '+N(hours[0].growth)+' 播放' : '无连续采样') +
    card('当前 ≥3500', N(at(3500)), '截至最新采集') +
    card('当前 ≥5000', N(at(5000)), '截至最新采集');
  const row = v => ['<span class="phone">#'+v.account_no+'</span> '+esc(v.username),
    D(v.published_at), '<a class="pid" target="_blank" rel="noopener" href="'+esc(v.url)+'">'+esc(v.video_id)+'</a>', N(v.views)];
  $('#yesterdayVideos').innerHTML = '<h3>播放最高的昨日新视频</h3>' + table(['手机 / 账号','发布时间','PID','当前播放'], videos.slice(0,6).map(row)) +
    (videos.length > 6 ? '<details><summary>查看其余 '+(videos.length-6)+' 条</summary>'+table(['手机 / 账号','发布时间','PID','当前播放'],videos.slice(6).map(row))+'</details>' : '');
  const hourRows = list => table(['北京时刻','美东时刻','美西时刻','播放净增长','可比采样段'],list.map(h=>[
    DZ(h.start,'Asia/Shanghai'),DZ(h.start,'America/New_York'),DZ(h.start,'America/Los_Angeles'),N(h.growth),N(h.intervals)]));
  $('#yesterdayHours').innerHTML = '<h3>昨天哪个时段涨得最快</h3><p class="muted">同一个观看增长小时，换算成三地当地钟点；不是最佳发布时间，也不代表观众所在地。采集间隔过长的不计入。</p>' +
    hourRows(hours.slice(0,5)) + (hours.length>5 ? '<details><summary>查看全部 24 小时</summary>'+hourRows([...hours].sort((a,b)=>a.start-b.start))+'</details>' : '');
}

function renderPosting(data) {
  const p = data.posting;
  if (!p) {
    $('#posting').innerHTML = '<div class="empty">发布时间对比正在生成</div>';
    $('#tags').innerHTML = '<div class="empty">首轮文案数据待采集</div>';
    return;
  }
  const hit = s => s.hit5000 + ' / ' + s.videos + '（' + s.hit5000_rate + '%）';
  const zoneTable = (title, slots, field) => '<h3>'+esc(title)+'</h3>' + table(['当地发布时间段','视频数','24小时播放中位数','首日 ≥3500','首日 ≥5000'],slots.map(s=>[
    '<span class="phone">'+esc(s[field])+'</span>',N(s.videos),N(s.median_24h)+'<br><small>'+s.sampled+' 条有近24小时快照</small>',s.hit3500+' / '+s.videos,hit(s)]));
  $('#posting').innerHTML = '<p class="muted">可比较视频 '+p.videos+' 条；其中 '+p.sampled_24h+' 条有 24 小时附近的播放快照。首日达 5000 的总样本为 '+p.slots.reduce((n,s)=>n+s.hit5000,0)+' 条，少量达标时不直接判定“最佳时间”。</p>' +
    zoneTable('北京时间',p.slots,'slot') + zoneTable('美东时间',p.slots_et || [],'slot_et') + zoneTable('美西时间',p.slots_pt || [],'slot_pt');
  $('#postingMethod').textContent = p.method + ' 另有 '+p.excluded_late_capture+' 条视频首次采到过晚，未参加时间段比较。账号、内容和标签会影响结果，暂不把时间段差异当作因果结论。';
  $('#tags').innerHTML = p.tag_groups.length ? table(['首次采到的标签组合','视频数','24小时播放中位数','首日 ≥5000'],p.tag_groups.map(s=>[
    esc(s.tags),N(s.videos),N(s.median_24h),hit(s)])) : '<p class="muted">从现在开始自动保留新视频首次采到的标签。旧视频已被修改过的原标签无法可靠追溯，不会拿当前的 #tiktok #fyp #movie 冒充测试标签。</p>';
}

function renderLive(board) {
  const accounts = board.accounts.filter(a => a.videos.length);
  $('#liveNote').textContent = '近 '+board.lookback_days+' 天、各号最新 15 条中的单条 ≥1,000；按手机排序，按发布时间从新到旧。隐藏后仍按 PID 保留上次记录。';
  $('#live').innerHTML = accounts.length ? accounts.map(a => '<details class="panel"><summary><span class="phone">#'+a.account_no+'</span> '+esc(a.username)+' · '+a.videos.length+' 条 ≥1000</summary>' +
    table(['PID / 发布时间','当前播放','约24小时变化','达标首次检测'],a.videos.map(v=>[
      '<a class="pid" target="_blank" rel="noopener" href="'+esc(v.url)+'">'+esc(v.video_id)+'</a><br><small>'+D(v.published_at)+'</small>',
      N(v.views)+'<br><small>'+esc(v.tracking_state)+'</small>',N(v.daily_delta)+(v.daily_percent==null?'':' / '+v.daily_percent+'%'),
      [1000,3500,5000].map(k=>k+': '+D(v.thresholds[k])).join('<br>')])) + '</details>').join('') : '<div class="empty">这批账号尚未采到单条 ≥1,000 的视频；上方仍显示各号目前的最高播放和采集状态。</div>';
}

function renderRevenue(data) {
  const accounts = data.accounts;
  const known = accounts.filter(a => a.amount != null);
  const total = known.reduce((n,a) => n + Number(a.amount), 0);
  $('#revenueMetrics').innerHTML = card('已录入累计收益合计',known.length ? USD(total) : '未录入','覆盖 '+known.length+' / '+accounts.length+' 个本批账号');
  $('#rewards').innerHTML = table(['手机 / 账号','累计收益（USD）','最近核对'],accounts.map(a=>[
    '<span class="phone">#'+a.account_no+'</span> '+esc(a.username),USD(a.amount),a.checked_at ? D(a.checked_at) : '未核对']));
}

function renderWeek(data) {
  const p = data.week;
  $('#week').innerHTML = '<div class="grid">'+card('本周可比播放净增长',N(p.growth),'按连续采样计算')+
    card('本周首次检测 ≥1000',N(p.hit1000),'按 PID 去重')+card('本周首次检测 ≥3500',N(p.hit3500),'按 PID 去重')+
    card('本周首次检测 ≥5000',N(p.hit5000),'按 PID 去重')+'</div>'+
    table(['账号','可比播放净增长','发布数'],p.accounts.slice(0,8).map(a=>['#'+a.account_no+' '+esc(a.username),N(a.growth),N(a.published)]))+
    '<p class="muted">'+esc(data.method)+'</p>';
}

function renderHealth(data) {
  $('#health').innerHTML = table(['手机 / 账号','最近采集成功','连续失败'],data.accounts.map(a=>['#'+a.account_no+' '+esc(a.username),D(a.last_ok),N(a.fail_streak)]));
  const age = Math.max(0, Date.now()/1000 - data.generated_at);
  $('#status').textContent = '最近采集 '+D(data.latest_sample)+' · 看板更新 '+D(data.generated_at)+ (age > 3*3600 ? ' · 更新延迟，请稍后重试' : ' · 约每2小时更新');
}

async function load() {
  try {
    const [insights,board,trial] = await Promise.all([fetch('data/insights.json',{cache:'no-store'}),fetch('data/board.json',{cache:'no-store'}),fetch('data/trial.json',{cache:'no-store'})]);
    if (!insights.ok || !board.ok || !trial.ok) throw new Error('看板数据暂不可用');
    const [data,live,trialData] = await Promise.all([insights.json(),board.json(),trial.json()]);
    renderTrial(trialData); renderLive(live); renderYesterday(data); renderPosting(data); renderRevenue(data); renderWeek(data); renderHealth(data);
    $('#error').style.display = 'none';
  } catch (error) {
    $('#error').style.display = 'block'; $('#error').textContent = '数据读取失败：'+error.message;
    $('#status').textContent = '本次未能读取公开快照';
  }
}
$('#refresh').onclick = () => location.reload();
load();
setInterval(load, 10 * 60 * 1000);
