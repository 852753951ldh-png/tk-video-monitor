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

function renderYesterday(data) {
  const videos = data.yesterday.videos.filter(v => v.new).sort((a,b) => b.views - a.views);
  const hours = [...data.yesterday.bins].sort((a,b) => b.growth - a.growth);
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
  $('#live').innerHTML = accounts.length ? accounts.map(a => '<details class="panel"><summary><span class="phone">#'+a.account_no+'</span> '+esc(a.username)+' · '+a.videos.length+' 条 ≥1000</summary>' +
    table(['PID / 发布时间','当前播放','约24小时变化','达标首次检测'],a.videos.map(v=>[
      '<a class="pid" target="_blank" rel="noopener" href="'+esc(v.url)+'">'+esc(v.video_id)+'</a><br><small>'+D(v.published_at)+'</small>',
      N(v.views)+'<br><small>'+esc(v.tracking_state)+'</small>',N(v.daily_delta)+(v.daily_percent==null?'':' / '+v.daily_percent+'%'),
      [1000,3500,5000].map(k=>k+': '+D(v.thresholds[k])).join('<br>')])) + '</details>').join('') : '<div class="empty">近7天暂未采到 ≥1000 的视频</div>';
}

function renderRevenue(data) {
  const accounts = data.accounts;
  const known = accounts.filter(a => a.amount != null);
  const total = known.reduce((n,a) => n + Number(a.amount), 0);
  $('#revenueMetrics').innerHTML = card('已录入累计收益合计',USD(total),'覆盖 '+known.length+' / '+accounts.length+' 个在监控账号');
  $('#rewards').innerHTML = table(['手机 / 账号','累计收益（USD）','最近核对'],accounts.map(a=>[
    '<span class="phone">#'+a.account_no+'</span> '+esc(a.username),USD(a.amount),D(a.checked_at)]));
}

function renderWeek(data) {
  const p = data.week;
  $('#week').innerHTML = '<div class="grid">'+card('本周可比播放净增长',N(p.growth),'按连续采样计算')+
    card('本周发布',N(p.published),'按视频发布时间')+card('本周首次检测 ≥3500',N(p.hit3500),'按 PID 去重')+
    card('本周首次检测 ≥5000',N(p.hit5000),'按 PID 去重')+'</div>'+
    table(['账号','可比播放净增长','发布数'],p.accounts.slice(0,8).map(a=>['#'+a.account_no+' '+esc(a.username),N(a.growth),N(a.published)]))+
    '<p class="muted">'+esc(data.method)+'</p>';
}

function renderHealth(data) {
  $('#health').innerHTML = table(['手机 / 账号','最近采集成功'],data.accounts.map(a=>['#'+a.account_no+' '+esc(a.username),D(a.last_ok)]));
  $('#status').textContent = '最近采集 '+D(data.latest_sample)+' · 看板更新 '+D(data.generated_at);
}

async function load() {
  try {
    const [insights,board] = await Promise.all([fetch('data/insights.json',{cache:'no-store'}),fetch('data/board.json',{cache:'no-store'})]);
    if (!insights.ok || !board.ok) throw new Error('公开数据暂不可用');
    const [data,live] = await Promise.all([insights.json(),board.json()]);
    renderYesterday(data); renderPosting(data); renderLive(live); renderRevenue(data); renderWeek(data); renderHealth(data);
    $('#error').style.display = 'none';
  } catch (error) {
    $('#error').style.display = 'block'; $('#error').textContent = '数据读取失败：'+error.message;
    $('#status').textContent = '本次未能读取公开快照';
  }
}
$('#refresh').onclick = () => location.reload();
load();
