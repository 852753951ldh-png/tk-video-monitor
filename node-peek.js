/* 住宅节点按用户确认在 GitHub Pages 无密码公开；此脚本不内嵌凭据。 */
(() => {
  const local = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const privateGateway = document.documentElement.dataset.privateGateway === '1';
  const labels = ['香港A9', '日本A9', '香港A10', '日本A10', '美国A1'];
  const container = document.querySelector('#trialContent');
  const cache = new Map();
  let active = null;
  let hideTimer = null;

  const panel = document.createElement('aside');
  panel.className = 'node-peek-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '住宅节点预览');
  panel.hidden = true;
  panel.innerHTML = '<div class="node-peek-head"><b id="nodePeekTitle"></b><span id="nodePeekGroup"></span></div>'+
    '<p class="node-peek-hint">节点四段信息，可直接复制</p>'+
    '<div class="node-peek-copyline"><code id="nodePeekValue"></code><button id="nodePeekCopy" type="button">复制</button></div>'+
    '<p id="nodePeekFeedback" class="node-peek-feedback" role="status"></p>'+
    '<img id="nodePeekQr" alt="对应的连接二维码" width="340" height="340" hidden>'+
    '<p id="nodePeekQrMissing" class="node-peek-hint" hidden>二维码尚未上传</p>';
  document.body.append(panel);
  const title = panel.querySelector('#nodePeekTitle');
  const group = panel.querySelector('#nodePeekGroup');
  const value = panel.querySelector('#nodePeekValue');
  const qr = panel.querySelector('#nodePeekQr');
  const qrMissing = panel.querySelector('#nodePeekQrMissing');
  const feedback = panel.querySelector('#nodePeekFeedback');

  const svg = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function decorate() {
    container.querySelectorAll('.trial-empty-slot, .trial-account').forEach(row => {
      if (row.querySelector('.node-peek-trigger')) return;
      const phone = row.querySelector('.phone');
      const number = Number(phone?.textContent?.replace(/\D/g, ''));
      if (!Number.isInteger(number) || number < 1 || number > 50) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'node-peek-trigger';
      button.dataset.nodePhone = String(number);
      const label = labels[groupFor(number)-1];
      button.setAttribute('aria-label', `查看 ${number} 号手机${label}住宅节点与二维码`);
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = svg+'<span>'+label+'</span>';
      if (row.classList.contains('trial-empty-slot')) {
        row.insertBefore(button, row.querySelector('.trial-empty-label'));
      } else {
        phone.after(button);
      }
    });
  }
  new MutationObserver(() => requestAnimationFrame(decorate))
    .observe(container, {childList:true, subtree:true});

  function clearHide() { if (hideTimer) clearTimeout(hideTimer); hideTimer = null; }
  function hide() {
    clearHide();
    panel.hidden = true;
    document.querySelectorAll('.node-peek-trigger[aria-expanded="true"]')
      .forEach(button => button.setAttribute('aria-expanded', 'false'));
    active = null;
  }
  function laterHide() { clearHide(); hideTimer = setTimeout(hide, 180); }
  function position(trigger) {
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 16);
    const height = Math.min(panel.offsetHeight, window.innerHeight - 16);
    panel.style.width = width + 'px';
    panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + 'px';
    panel.style.top = (rect.bottom + height + 8 <= window.innerHeight
      ? rect.bottom - 2 : Math.max(8, rect.top - height + 2)) + 'px';
  }
  function groupFor(phone) { return Math.floor(((phone - 1) % 25) / 5) + 1; }
  async function getNode(phone) {
    if (local || privateGateway) {
      if (!cache.has(phone)) {
        const response = await fetch((local ? '/api/local/node' : '/private/node') + '?phone=' + phone, {
          cache:'no-store', headers: local ? {'X-TK-Local-Manager':'1'} : {}
        });
        if (!response.ok) throw new Error('节点接口暂不可用');
        cache.set(phone, await response.json());
      }
      return cache.get(phone);
    }
    if (!cache.has(phone)) {
      const response = await fetch('data/nodes.json', {cache:'no-store'});
      if (!response.ok) throw new Error('公开节点文件暂不可用');
      const payload = await response.json();
      for (const item of payload.phones || []) cache.set(item.phone, item);
    }
    if (!cache.has(phone)) throw new Error('该手机尚未分配住宅节点');
    return cache.get(phone);
  }
  async function show(trigger) {
    clearHide();
    const phone = Number(trigger.dataset.nodePhone);
    if (!phone) return;
    active = phone;
    document.querySelectorAll('.node-peek-trigger[aria-expanded="true"]')
      .forEach(button => button.setAttribute('aria-expanded', 'false'));
    trigger.setAttribute('aria-expanded', 'true');
    title.textContent = `#${phone} 住宅节点`;
    group.textContent = labels[groupFor(phone)-1]+' · 连接二维码';
    value.textContent = '正在读取…';
    feedback.textContent = '';
    qr.hidden = true;
    qr.removeAttribute('src');
    qrMissing.hidden = true;
    panel.hidden = false;
    position(trigger);
    try {
      const item = await getNode(phone);
      if (active !== phone || panel.hidden) return;
      group.textContent = (item.qr_name || labels[groupFor(phone)-1])+' · 连接二维码';
      value.textContent = item.node || '该序号暂未配置节点';
      if (item.qr_data?.startsWith('data:image/png;base64,') || /^data\/qr\/[1-5]\.svg$/.test(item.qr_url || '')) {
        qr.src = item.qr_data || item.qr_url;
        qr.alt = `${labels[item.qr_group-1]} 连接二维码`;
        qr.hidden = false;
        qr.onload = () => { if (active === phone && !panel.hidden) position(trigger); };
      } else qrMissing.hidden = false;
      position(trigger);
    } catch (error) {
      if (active === phone) value.textContent = error.message;
    }
  }
  container.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest?.('.node-peek-trigger');
    if (button && !button.contains(event.relatedTarget)) show(button);
  });
  container.addEventListener('pointerout', event => {
    const button = event.target.closest?.('.node-peek-trigger');
    if (button && !button.contains(event.relatedTarget)) laterHide();
  });
  container.addEventListener('focusin', event => {
    if (event.target.matches('.node-peek-trigger')) show(event.target);
  });
  container.addEventListener('click', event => {
    const button = event.target.closest?.('.node-peek-trigger');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    show(button);
  });
  panel.addEventListener('pointerenter', clearHide);
  panel.addEventListener('pointerleave', laterHide);
  panel.addEventListener('focusin', clearHide);
  panel.addEventListener('focusout', event => {
    if (!panel.contains(event.relatedTarget)) laterHide();
  });
  window.addEventListener('scroll', hide, {passive:true});
  window.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
  panel.querySelector('#nodePeekCopy').addEventListener('click', async () => {
    const text = value.textContent;
    if (!text || !text.includes(':')) return;
    try { await navigator.clipboard.writeText(text); feedback.textContent = '已复制四段节点信息'; }
    catch { feedback.textContent = '复制失败，请选中上方文字手动复制'; }
  });

  decorate();
})();
