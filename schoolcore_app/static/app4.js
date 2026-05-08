// ── SchoolCore V2 Frontend ─────────────────────────────────────────────────
const API_TOKEN = 'schoolcore-dev-token';
const BASE = '';

// ── API Helper ────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || err?.detail?.error?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.innerHTML = `<i class="fa ${icons[type] || 'fa-circle-info'}"></i><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100px)'; el.style.transition = '0.2s'; setTimeout(() => el.remove(), 200); }, duration);
}

// ── Drawer ────────────────────────────────────────────────────────────────
function openDrawer(title, html) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = html;
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Modal ─────────────────────────────────────────────────────────────────
function showModal({ title, html, actions = [], size = '' }) {
  const container = document.getElementById('modal-container');
  const actionsHtml = actions.map(a =>
    `<button class="btn ${a.class || 'btn-secondary'}" onclick="${a.onclick}">${a.label}</button>`
  ).join('');
  container.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal ${size}">
        <div class="flex items-start justify-between mb-5">
          <h3 class="text-base font-bold text-slate-800">${title}</h3>
          <button onclick="closeModal()" class="btn btn-ghost btn-sm ml-4 flex-shrink-0"><i class="fa fa-xmark"></i></button>
        </div>
        <div id="modal-body">${html}</div>
        ${actionsHtml ? `<div class="flex gap-2 justify-end mt-5 pt-4 border-t border-slate-100">${actionsHtml}</div>` : ''}
      </div>
    </div>`;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
  document.body.style.overflow = '';
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
function askConfirm(message) {
  return new Promise(resolve => {
    showModal({
      title: '確認',
      html: `<p class="text-sm text-slate-600">${message}</p>`,
      actions: [
        { label: 'キャンセル', class: 'btn-secondary', onclick: 'closeModal();window._confirmResolve(false)' },
        { label: '確認', class: 'btn-primary', onclick: 'closeModal();window._confirmResolve(true)' },
      ],
    });
    window._confirmResolve = resolve;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function badge(text, color = 'gray') {
  return `<span class="badge badge-${color}">${text}</span>`;
}

function statusBadge(status) {
  const map = {
    '在籍': 'green', '休学': 'yellow', '退学': 'red', '卒業': 'blue', '修了': 'blue',
    '合格': 'green', '合格者': 'green', '不合格': 'red', '保留': 'yellow',
    '面接申請': 'blue', '面接待ち': 'blue', '合格通知待ち': 'purple',
    'COE準備中': 'orange', '再面接待ち': 'yellow',
    '確認済': 'green', '未入金': 'gray', '未設定': 'gray', 'confirmed': 'green', 'pending': 'yellow',
    '申請中': 'blue', '承認済': 'green', '発行済': 'purple',
    'COE準備': 'blue', '資料回収中': 'orange', 'AIチェック待ち': 'yellow',
    '修正中': 'orange', '入管提出準備完了': 'green', '入管提出済・COE交付待ち': 'purple',
    '未実行': 'gray', '要修正 3件': 'red', '確認完了': 'green',
  };
  return badge(status, map[status] || 'gray');
}

function fmtDate(d) {
  if (!d) return '—';
  return d.replace('T', ' ').slice(0, 16);
}

function fmtDateOnly(d) {
  if (!d) return '—';
  return (d + '').slice(0, 10);
}

function daysLeft(expiry) {
  if (!expiry) return null;
  const diff = Math.floor((new Date(expiry) - new Date()) / 86400000);
  return diff;
}

function daysLeftBadge(expiry) {
  const d = daysLeft(expiry);
  if (d === null) return '—';
  if (d < 0) return badge('期限切れ', 'red');
  if (d <= 30) return `<span class="badge badge-red"><i class="fa fa-triangle-exclamation mr-1"></i>${d}日</span>`;
  if (d <= 90) return `<span class="badge badge-yellow">${d}日</span>`;
  return `<span class="text-slate-400 text-xs">${d}日</span>`;
}

function attendanceBar(rate) {
  const r = parseFloat(rate) || 0;
  const color = r >= 90 ? '#22c55e' : r >= 80 ? '#3b82f6' : r >= 60 ? '#f59e0b' : '#ef4444';
  return `<div class="flex items-center gap-2">
    <div class="progress-bar flex-1" style="width:80px">
      <div class="progress-fill" style="width:${r}%;background:${color}"></div>
    </div>
    <span class="text-xs font-semibold" style="color:${color}">${r.toFixed(1)}%</span>
  </div>`;
}

function skeleton(lines = 3) {
  return Array.from({length: lines}, () =>
    `<div class="skeleton h-8 mb-2 w-full rounded"></div>`
  ).join('');
}

function emptyState(message = 'データがありません') {
  return `<div class="text-center py-16 text-slate-400">
    <i class="fa fa-inbox text-4xl mb-3 block opacity-30"></i>
    <p class="text-sm">${message}</p>
  </div>`;
}

// ── Navigation ────────────────────────────────────────────────────────────
const viewTitles = {
  dashboard: ['ダッシュボード', '学籍・在留・帳票の統合管理'],
  intake: ['入学受付', 'ポータル出願・一括取込'],
  applicants: ['出願者管理', '出願者の選考・合格通知管理'],
  coe: ['COE進行管理', 'COE申請資料の確認・提出管理'],
  payments: ['入金・領収書', '入金確認と領収書の発行管理'],
  students: ['学生管理', '在籍学生の情報・出席・在留管理'],
  certificates: ['証明書管理', '証明書の申請・承認・発行管理'],
  immigration: ['入管報告', '出席率・在留期限等の報告書作成'],
  annualResults: ['年度結果', '進学・就職・試験結果の登録'],
  documents: ['帳票台帳', '発行済み帳票の一覧'],
  audit: ['監査ログ', '操作履歴の確認'],
};

let currentView = 'dashboard';

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(name)?.classList.add('active');
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === name);
  });
  const [title, subtitle] = viewTitles[name] || [name, ''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
  document.getElementById('topbar-actions').innerHTML = '';
  currentView = name;
  renderView(name);
}

function renderView(name) {
  const fns = {
    dashboard:     renderDashboard,
    intake:        renderIntake,
    applicants:    renderApplicants,
    coe:           renderCoe,
    payments:      renderPayments,
    students:      renderStudents,
    certificates:  renderCertificates,
    immigration:   renderImmigration,
    annualResults: renderAnnualResults,
    documents:     renderDocuments,
    audit:         renderAudit,
  };
  fns[name]?.();
}

// ── Dashboard ─────────────────────────────────────────────────────────────
async function renderDashboard() {
  const el = document.getElementById('dashboard');
  el.innerHTML = skeleton(4);
  try {
    const d = await api('/api/dashboard');

    const urgentAlerts = d.expiring_soon?.filter(s => s.days_left <= 30) || [];
    const warnAlerts   = d.expiring_soon?.filter(s => s.days_left > 30) || [];

    el.innerHTML = `
    <!-- Stats Cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      ${statCard('出願者', d.applicant_count, 'fa-users', '#3b82f6', '選考・合格通知管理')}
      ${statCard('在籍学生', d.student_count, 'fa-id-card', '#10b981', '在留注意 ' + (d.expiring_soon?.length || 0) + '名')}
      ${statCard('低出席率', d.low_attendance, 'fa-chart-bar', d.low_attendance > 0 ? '#f59e0b' : '#6b7280', '80%未満 要注意')}
      ${statCard('領収書待ち', d.pending_receipts, 'fa-receipt', d.pending_receipts > 0 ? '#ef4444' : '#6b7280', '入金確認済・未発行')}
    </div>

    <div class="grid grid-cols-3 gap-4">
      <!-- COE Status -->
      <div class="col-span-2 table-wrap">
        <div class="section-header px-4 pt-4 pb-0">
          <span class="section-title">COE進行中</span>
          <button class="btn btn-ghost btn-sm" onclick="showView('coe')"><i class="fa fa-arrow-right text-xs"></i></button>
        </div>
        <table class="data-table">
          <thead><tr>
            <th>出願者</th><th>入学期</th><th>ステージ</th><th>AIチェック</th><th>締切</th>
          </tr></thead>
          <tbody>
          ${(d.recent_coe || []).map(c => `<tr>
            <td class="font-medium">${c.applicant_name}</td>
            <td class="text-slate-500 text-xs">${c.admission_term}</td>
            <td>${statusBadge(c.stage)}</td>
            <td>${statusBadge(c.ai_check_status)}</td>
            <td>${daysLeftBadge(c.deadline)}</td>
          </tr>`).join('') || `<tr><td colspan="5">${emptyState()}</td></tr>`}
          </tbody>
        </table>
      </div>

      <!-- Right Sidebar -->
      <div class="flex flex-col gap-4">
        <!-- Expiring -->
        <div class="card">
          <div class="section-header mb-3">
            <span class="section-title text-sm"><i class="fa fa-passport text-orange-500 mr-1.5"></i>在留期限注意</span>
          </div>
          ${urgentAlerts.length + warnAlerts.length === 0 ?
            `<p class="text-xs text-slate-400 text-center py-4">対象者なし</p>` :
            [...urgentAlerts, ...warnAlerts].slice(0, 6).map(s => `
            <div class="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div>
                <p class="text-xs font-semibold text-slate-700 truncate max-w-[120px]">${s.name}</p>
                <p class="text-xs text-slate-400">${s.class_name}</p>
              </div>
              ${daysLeftBadge(s.residence_expiry)}
            </div>`).join('')
          }
        </div>

        <!-- Audit -->
        <div class="card">
          <div class="section-header mb-3">
            <span class="section-title text-sm"><i class="fa fa-clock-rotate-left text-slate-400 mr-1.5"></i>最近の操作</span>
          </div>
          ${(d.recent_audit || []).slice(0, 6).map(log => `
            <div class="text-xs text-slate-500 py-1.5 border-b border-slate-50 last:border-0">
              <span class="font-medium text-slate-700">${log.event_type}</span>
              <span class="mx-1 text-slate-300">·</span>${log.message?.slice(0, 30) || ''}
              <div class="text-slate-300 mt-0.5">${fmtDate(log.created_at)}</div>
            </div>`).join('') || `<p class="text-xs text-slate-400 text-center py-4">ログなし</p>`}
        </div>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

function statCard(label, value, icon, color, sub) {
  return `<div class="stat-card">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${label}</p>
        <p class="text-3xl font-bold mt-1" style="color:${color}">${value ?? '—'}</p>
        <p class="text-xs text-slate-400 mt-1">${sub}</p>
      </div>
      <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${color}18">
        <i class="fa ${icon}" style="color:${color}"></i>
      </div>
    </div>
  </div>`;
}

// ── Intake ────────────────────────────────────────────────────────────────
async function renderIntake() {
  const el = document.getElementById('intake');
  el.innerHTML = skeleton(2);
  try {
    const d = await api('/api/intake-summary');
    el.innerHTML = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      ${statCard('ポータル出願', d.portal_submissions, 'fa-globe', '#6366f1', 'Web受付件数')}
      ${statCard('取込バッチ', d.import_batches, 'fa-file-excel', '#10b981', 'Excel一括取込')}
      ${statCard('最新バッチ', d.latest_batch?.status || '—', 'fa-layer-group', '#f59e0b', d.latest_batch?.created_at?.slice(0,10) || '未実行')}
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="card">
        <div class="section-header"><span class="section-title">出願ポータル</span></div>
        <p class="text-sm text-slate-500 mb-4">出願者が自分で情報を入力するフォームです。</p>
        <a href="/apply" target="_blank" class="btn btn-primary"><i class="fa fa-external-link"></i> ポータルを開く</a>
        <p class="text-xs text-slate-400 mt-3">URL: <code class="bg-slate-100 px-1 rounded">${location.origin}/apply</code></p>
      </div>
      <div class="card">
        <div class="section-header"><span class="section-title">Excel一括取込</span></div>
        <p class="text-sm text-slate-500 mb-4">エクセルファイル（xlsx/csv）から出願者を一括登録します。</p>
        <button class="btn btn-secondary" onclick="alert('機能は準備中です')"><i class="fa fa-upload"></i> ファイルを選択</button>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

// ── Applicants ────────────────────────────────────────────────────────────
let applicantsData = [];

async function renderApplicants() {
  const el = document.getElementById('applicants');
  document.getElementById('topbar-actions').innerHTML =
    `<button class="btn btn-primary" onclick="openCreateApplicantModal()"><i class="fa fa-plus"></i> 出願者を追加</button>`;
  el.innerHTML = skeleton(5);
  try {
    applicantsData = await api('/api/applicants');
    renderApplicantsTable(applicantsData);
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

function renderApplicantsTable(data) {
  const el = document.getElementById('applicants');
  const statusCounts = {};
  data.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  el.innerHTML = `
  <!-- Summary badges -->
  <div class="flex gap-2 flex-wrap mb-4">
    <span class="text-sm font-semibold text-slate-600 self-center">全${data.length}件</span>
    ${Object.entries(statusCounts).map(([s,c]) => `<button class="badge badge-gray hover:bg-slate-200 cursor-pointer transition-colors" onclick="filterApplicants('${s}')">${s}: ${c}</button>`).join('')}
    ${data.length ? `<button class="badge badge-gray hover:bg-slate-200 cursor-pointer ml-auto" onclick="renderApplicantsTable(applicantsData)">すべて表示</button>` : ''}
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>出願番号</th><th>氏名</th><th>国籍</th><th>入学期</th>
        <th>エージェント</th><th>ステータス</th><th>選考料</th><th>操作</th>
      </tr></thead>
      <tbody>
      ${data.length ? data.map(a => `
        <tr class="cursor-pointer" onclick="openApplicantDrawer('${a.id}')">
          <td class="text-slate-400 text-xs font-mono">${a.application_no}</td>
          <td class="font-semibold">${a.name}</td>
          <td><span class="text-xs">${nationalityFlag(a.nationality)} ${a.nationality}</span></td>
          <td class="text-xs">${a.admission_term}</td>
          <td class="text-xs text-slate-500">${a.agent_name || '—'}</td>
          <td>${statusBadge(a.status)}</td>
          <td>${statusBadge(a.application_fee_status)}</td>
          <td onclick="event.stopPropagation()">
            <div class="flex gap-1">
              ${a.interview_result === '未設定' ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openInterviewModal('${a.id}')"><i class="fa fa-clipboard-check"></i> 結果</button>` : ''}
              ${a.interview_result === '合格' && !a.acceptance_notice_generated ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation();generateAcceptance('${a.id}')"><i class="fa fa-file-circle-check"></i> 通知書</button>` : ''}
              ${a.application_fee_status === '未入金' ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();confirmApplicationFee('${a.id}')"><i class="fa fa-yen-sign"></i> 選考料</button>` : ''}
            </div>
          </td>
        </tr>`).join('') : `<tr><td colspan="8" class="text-center py-10 text-slate-400 text-sm">出願者がいません</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function filterApplicants(status) {
  renderApplicantsTable(applicantsData.filter(a => a.status === status));
}

function nationalityFlag(n) {
  const flags = { '中国': '🇨🇳', 'ベトナム': '🇻🇳', '韓国': '🇰🇷', '台湾': '🇹🇼', 'ネパール': '🇳🇵', '香港': '🇭🇰' };
  return flags[n] || '🌏';
}

async function openApplicantDrawer(id) {
  const applicant = applicantsData.find(a => a.id === id);
  if (!applicant) return;
  openDrawer(applicant.name, `
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div><span class="label">出願番号</span><p class="font-mono text-xs text-slate-500">${applicant.application_no}</p></div>
        <div><span class="label">国籍</span><p>${nationalityFlag(applicant.nationality)} ${applicant.nationality}</p></div>
        <div><span class="label">入学期</span><p>${applicant.admission_term}</p></div>
        <div><span class="label">在学期間</span><p>${applicant.desired_study_length}</p></div>
        <div><span class="label">エージェント</span><p>${applicant.agent_name || '—'}</p></div>
        <div><span class="label">作成日</span><p class="text-xs">${fmtDateOnly(applicant.created_at)}</p></div>
      </div>
      <div class="flex gap-2">
        <div class="flex-1"><span class="label">ステータス</span>${statusBadge(applicant.status)}</div>
        <div class="flex-1"><span class="label">面接結果</span>${statusBadge(applicant.interview_result)}</div>
        <div class="flex-1"><span class="label">選考料</span>${statusBadge(applicant.application_fee_status)}</div>
      </div>
      <div class="border-t pt-4 flex flex-wrap gap-2">
        ${applicant.interview_result === '未設定' ? `<button class="btn btn-primary btn-sm" onclick="openInterviewModal('${id}')"><i class="fa fa-clipboard-check"></i> 面接結果入力</button>` : ''}
        ${applicant.interview_result === '合格' && !applicant.acceptance_notice_generated ? `<button class="btn btn-success" onclick="generateAcceptance('${id}')"><i class="fa fa-file-circle-check"></i> 合格通知書生成</button>` : ''}
        ${applicant.application_fee_status === '未入金' ? `<button class="btn btn-secondary btn-sm" onclick="confirmApplicationFee('${id}')"><i class="fa fa-yen-sign"></i> 選考料確認</button>` : ''}
        ${applicant.coe_case_exists ? `<button class="btn btn-secondary btn-sm" onclick="closeDrawer();showView('coe')"><i class="fa fa-file-shield"></i> COEを確認</button>` : ''}
      </div>
    </div>`);
}

function openCreateApplicantModal() {
  showModal({
    title: '出願者を追加',
    html: `
    <div class="grid grid-cols-2 gap-3">
      <div class="col-span-2"><label class="label">氏名 *</label><input class="input" id="a-name" placeholder="WANG FANG（王 芳）"></div>
      <div><label class="label">国籍 *</label>
        <select class="input" id="a-nationality">
          <option>中国</option><option>ベトナム</option><option>韓国</option><option>台湾</option><option>ネパール</option><option>その他</option>
        </select>
      </div>
      <div><label class="label">入学期 *</label><input class="input" id="a-term" placeholder="2026年4月"></div>
      <div><label class="label">在学希望期間 *</label>
        <select class="input" id="a-duration">
          <option>1年</option><option>1年6ヶ月</option><option>2年</option><option>短期</option>
        </select>
      </div>
      <div><label class="label">エージェント</label><input class="input" id="a-agent" placeholder="エージェント名"></div>
      <div><label class="label">メール</label><input class="input" id="a-email" type="email"></div>
      <div><label class="label">電話</label><input class="input" id="a-phone"></div>
    </div>`,
    actions: [
      { label: 'キャンセル', class: 'btn-secondary', onclick: 'closeModal()' },
      { label: '追加する', class: 'btn-primary', onclick: 'doCreateApplicant()' },
    ],
  });
}

async function doCreateApplicant() {
  const name = document.getElementById('a-name').value.trim();
  if (!name) { showToast('氏名を入力してください', 'error'); return; }
  const btn = document.querySelector('#modal-body + div .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 追加中...'; }
  try {
    await api('/api/applicants', { method: 'POST', body: JSON.stringify({
      name,
      nationality: document.getElementById('a-nationality').value,
      admission_term: document.getElementById('a-term').value,
      desired_study_length: document.getElementById('a-duration').value,
      agent_name: document.getElementById('a-agent').value || '',
      email: document.getElementById('a-email').value || '',
      phone: document.getElementById('a-phone').value || '',
    })});
    closeModal();
    showToast(`${name} を登録しました`, 'success');
    renderApplicants();
  } catch (e) {
    showToast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '追加する'; }
  }
}

function openInterviewModal(id) {
  showModal({
    title: '面接結果を入力',
    html: `
    <p class="text-sm text-slate-500 mb-3">面接結果を選択してください：</p>
    <div class="grid grid-cols-2 gap-2">
      ${['合格','保留','再面接','不合格'].map(r =>
        `<button class="btn btn-secondary" onclick="setInterviewResult('${id}','${r}');closeModal()">${r}</button>`
      ).join('')}
    </div>`,
    actions: [{ label: 'キャンセル', class: 'btn-secondary', onclick: 'closeModal()' }],
  });
}

async function setInterviewResult(id, result) {
  try {
    await api(`/api/applicants/${id}/interview-result`, { method: 'POST', body: JSON.stringify({ result }) });
    showToast(`面接結果を「${result}」に設定しました`, result === '合格' ? 'success' : 'info');
    closeDrawer();
    renderApplicants();
  } catch (e) { showToast(e.message, 'error'); }
}

async function generateAcceptance(id) {
  const ok = await askConfirm('合格通知書を生成し、COE案件を作成します。よろしいですか？');
  if (!ok) return;
  try {
    await api(`/api/applicants/${id}/acceptance-notice`, { method: 'POST' });
    showToast('合格通知書を生成しました', 'success');
    closeDrawer();
    renderApplicants();
  } catch (e) { showToast(e.message, 'error'); }
}

async function confirmApplicationFee(id) {
  const ok = await askConfirm('選考料 ¥20,000 の受取を確認しますか？');
  if (!ok) return;
  try {
    await api(`/api/applicants/${id}/application-fee`, { method: 'POST' });
    showToast('選考料を確認しました', 'success');
    closeDrawer();
    renderApplicants();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── COE ──────────────────────────────────────────────────────────────────
async function renderCoe() {
  const el = document.getElementById('coe');
  el.innerHTML = skeleton(5);
  try {
    const cases = await api('/api/coe-cases');
    el.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-6">
      ${statCard('COE案件', cases.length, 'fa-file-shield', '#6366f1', 'アクティブ')}
      ${statCard('材料完了', cases.filter(c => c.material_complete_count === c.material_total_count).length, 'fa-circle-check', '#10b981', '全材料収集済み')}
      ${statCard('AI確認中', cases.filter(c => c.ai_check_status === '未実行').length, 'fa-robot', '#f59e0b', 'AIチェック待ち')}
      ${statCard('提出済み', cases.filter(c => c.stage.includes('提出済')).length, 'fa-paper-plane', '#3b82f6', '入管提出完了')}
    </div>
    <div class="flex flex-col gap-3">
      ${cases.length ? cases.map(c => coeCaseCard(c)).join('') : emptyState('COE案件がありません')}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

function coeCaseCard(c) {
  const matPct = c.material_total_count ? Math.round(c.material_complete_count / c.material_total_count * 100) : 0;
  const stages = ['COE準備', '資料回収中', 'AIチェック待ち', '修正中', '入管提出準備完了', '入管提出済・COE交付待ち', '完了'];
  const stageIdx = stages.indexOf(c.stage);
  const stageWidth = Math.max(5, Math.round((stageIdx + 1) / stages.length * 100));

  return `<div class="card hover:shadow-md transition-shadow cursor-pointer" onclick="openCoeDrawer('${c.id}')">
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-semibold text-slate-800">${c.applicant_name}</h3>
          <span class="text-xs text-slate-400">${c.admission_term}</span>
          ${c.agent_name ? `<span class="text-xs text-slate-400">${c.agent_name}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          ${statusBadge(c.stage)}
          ${statusBadge(c.ai_check_status)}
          <span class="text-xs text-slate-500"><i class="fa fa-folder text-xs mr-1"></i>${c.material_complete_count}/${c.material_total_count} 資料</span>
          ${c.open_issue_count > 0 ? `<span class="text-xs text-red-500 font-semibold"><i class="fa fa-triangle-exclamation mr-1"></i>${c.open_issue_count}件 未確認</span>` : ''}
        </div>
        <div class="mt-3">
          <div class="flex justify-between text-xs text-slate-400 mb-1">
            <span>進捗</span><span>${stageIdx + 1}/${stages.length}</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${stageWidth}%;background:#6366f1"></div></div>
        </div>
        <div class="mt-2">
          <div class="flex justify-between text-xs text-slate-400 mb-1">
            <span>資料収集</span><span>${matPct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${matPct}%;background:${matPct===100?'#10b981':'#f59e0b'}"></div></div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="text-xs text-slate-400 mb-1">締切</p>
        ${daysLeftBadge(c.deadline)}
        <p class="text-xs text-slate-400 mt-1">${fmtDateOnly(c.deadline)}</p>
      </div>
    </div>
  </div>`;
}

async function openCoeDrawer(id) {
  openDrawer('COE進行管理', `<p class="text-slate-400 text-sm">読み込み中...</p>`);
  try {
    const [coeList, materials, issues] = await Promise.all([
      api('/api/coe-cases'),
      api(`/api/coe-cases/${id}/materials`),
      api(`/api/coe-cases/${id}/ai-issues`),
    ]);
    const c = coeList.find(x => x.id === id);
    if (!c) return;

    document.getElementById('drawer-body').innerHTML = `
    <div class="flex flex-col gap-5">
      <div class="flex items-center gap-3 pb-3 border-b">
        <div>
          <h3 class="font-bold text-slate-800">${c.applicant_name}</h3>
          <p class="text-xs text-slate-500">${c.admission_term} · ${c.agent_name || '—'}</p>
        </div>
        <div class="ml-auto">${statusBadge(c.stage)}</div>
      </div>

      <!-- Materials -->
      <div>
        <h4 class="text-sm font-bold mb-3 text-slate-700">📁 申請資料チェックリスト</h4>
        <div class="flex flex-col gap-1.5" id="mat-list">
          ${materials.map(m => `
            <label class="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" ${m.collected ? 'checked' : ''} onchange="toggleMaterial('${id}', this)"
                class="w-4 h-4 rounded accent-blue-600" data-key="${m.material_key}">
              <span class="text-sm ${m.collected ? 'line-through text-slate-400' : 'text-slate-700'}">${m.label}</span>
              ${m.collected ? badge('収集済', 'green') : ''}
            </label>`).join('')}
        </div>
        <button class="btn btn-secondary btn-sm mt-2" onclick="saveMaterials('${id}')">
          <i class="fa fa-save"></i> 資料状況を保存
        </button>
      </div>

      <!-- AI Check -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-slate-700">🤖 AIチェック結果</h4>
          <button class="btn btn-primary btn-sm" onclick="runAiCheck('${id}')">
            <i class="fa fa-robot"></i> AIチェック実行
          </button>
        </div>
        <div id="ai-issues-${id}">
          ${issues.length ? issues.map(i => aiIssueRow(i)).join('') : `<p class="text-xs text-slate-400">チェック未実行または問題なし</p>`}
        </div>
      </div>

      <!-- Actions -->
      <div class="border-t pt-4 flex flex-wrap gap-2">
        <button class="btn btn-secondary btn-sm" onclick="sendPartialCoe('${id}')">
          <i class="fa fa-paper-plane"></i> 一部COE送付
        </button>
        <button class="btn btn-primary btn-sm" onclick="submitImmigration('${id}')">
          <i class="fa fa-building-columns"></i> 入管提出済みにする
        </button>
        <button class="btn btn-success btn-sm" onclick="sendFullCoe('${id}')">
          <i class="fa fa-check-double"></i> COE全送付
        </button>
      </div>
    </div>`;
  } catch (e) {
    document.getElementById('drawer-body').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
  }
}

function aiIssueRow(issue) {
  const colors = { error: 'red', warning: 'yellow' };
  return `<div class="flex items-start gap-2 p-2.5 rounded-lg mb-1.5 ${issue.status === 'resolved' ? 'bg-slate-50 opacity-60' : 'alert-badge-' + colors[issue.severity]}">
    <i class="fa fa-${issue.severity === 'error' ? 'circle-exclamation text-red-500' : 'triangle-exclamation text-yellow-500'} mt-0.5 flex-shrink-0"></i>
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold">${issue.field}</p>
      <p class="text-xs">${issue.message}</p>
    </div>
    ${issue.status !== 'resolved' ? `<button class="btn btn-success btn-sm flex-shrink-0 text-xs" onclick="resolveIssue('${issue.id}')">確認済み</button>` : badge('解決済', 'green')}
  </div>`;
}

async function toggleMaterial(coeId, el) {
  // Just updates UI, save when button clicked
}

async function saveMaterials(coeId) {
  const checked = [...document.querySelectorAll('#mat-list input[type=checkbox]:checked')].map(c => c.dataset.key);
  try {
    await api(`/api/coe-cases/${coeId}/materials`, { method: 'POST', body: JSON.stringify({ completed_materials: checked }) });
    showToast('資料状況を保存しました', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

async function runAiCheck(coeId) {
  try {
    const res = await api(`/api/coe-cases/${coeId}/ai-check`, { method: 'POST' });
    const el = document.getElementById(`ai-issues-${coeId}`);
    if (el) el.innerHTML = res.issues.map(i => aiIssueRow({...i, status: 'open', id: 'placeholder'})).join('');
    showToast(`AIチェック完了: エラー${res.summary.errors}件, 警告${res.summary.warnings}件`, 'warning');
    renderCoe();
  } catch (e) { showToast(e.message, 'error'); }
}

async function resolveIssue(id) {
  try {
    await api(`/api/ai-issues/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution_note: '資料確認済み' }) });
    showToast('確認済みにしました', 'success');
    // Refresh drawer
  } catch (e) { showToast(e.message, 'error'); }
}

async function sendPartialCoe(id) {
  try { await api(`/api/coe-cases/${id}/send-partial-coe`, { method: 'POST' }); showToast('一部COE送付を記録しました', 'success'); renderCoe(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function submitImmigration(id) {
  const ok = await askConfirm('COE申請を入管提出済みにしますか？');
  if (!ok) return;
  try { await api(`/api/coe-cases/${id}/submit-immigration`, { method: 'POST', body: '{}' }); showToast('入管提出済みにしました', 'success'); closeDrawer(); renderCoe(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function sendFullCoe(id) {
  const ok = await askConfirm('COE全体ファイルを送付済みにしますか？（学費全額+領収書が必要）');
  if (!ok) return;
  try { await api(`/api/coe-cases/${id}/send-full-coe`, { method: 'POST' }); showToast('COE全送付を記録しました', 'success'); closeDrawer(); renderCoe(); }
  catch (e) { showToast(e.message, 'error'); }
}

// ── Payments ──────────────────────────────────────────────────────────────
async function renderPayments() {
  const el = document.getElementById('payments');
  el.innerHTML = skeleton(4);
  try {
    const payments = await api('/api/payments');
    const pending = payments.filter(p => p.status === 'confirmed' && !p.receipt_issued);
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);

    el.innerHTML = `
    <div class="grid grid-cols-3 gap-4 mb-6">
      ${statCard('入金合計', `¥${total.toLocaleString()}`, 'fa-yen-sign', '#10b981', `${payments.length}件`)}
      ${statCard('領収書待ち', pending.length, 'fa-receipt', pending.length > 0 ? '#ef4444' : '#6b7280', '確認済・未発行')}
      ${statCard('発行済み', payments.filter(p => p.receipt_issued).length, 'fa-circle-check', '#6366f1', '領収書発行完了')}
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>出願者</th><th>入学期</th><th>種別</th><th>金額</th><th>支払者</th><th>状態</th><th>領収書</th><th>操作</th></tr></thead>
        <tbody>
          ${payments.map(p => `<tr>
            <td class="font-medium">${p.applicant_name || p.payer_display_name || '—'}</td>
            <td class="text-xs text-slate-400">${p.admission_term || '—'}</td>
            <td>${badge(p.payment_type, 'blue')}</td>
            <td class="font-mono font-semibold">¥${(p.amount||0).toLocaleString()}</td>
            <td class="text-xs text-slate-500">${p.payer_display_name}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${p.receipt_issued ? `<span class="text-xs font-mono text-slate-500">${p.receipt_no || p.receipt_doc_no || '—'}</span>` : badge('未発行','gray')}</td>
            <td>
              ${p.status === 'confirmed' && !p.receipt_issued ?
                `<button class="btn btn-success btn-sm" onclick="issueReceipt('${p.id}', this)"><i class="fa fa-receipt"></i> 発行</button>` :
                `<span class="text-xs text-slate-300">—</span>`}
            </td>
          </tr>`).join('') || `<tr><td colspan="8" class="text-center py-10 text-slate-400">入金記録がありません</td></tr>`}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

async function issueReceipt(id, btn) {
  const ok = await askConfirm('領収書を発行しますか？（発行後は取り消せません）');
  if (!ok) return;
  btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
  try {
    const res = await api(`/api/payments/${id}/receipt`, { method: 'POST' });
    showToast(`領収書 ${res.receipt_no} を発行しました`, 'success');
    renderPayments();
  } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa fa-receipt"></i> 発行'; }
}

// ── Students ──────────────────────────────────────────────────────────────
let studentsData = [];

async function renderStudents() {
  const el = document.getElementById('students');
  el.innerHTML = skeleton(6);
  try {
    studentsData = await api('/api/students');
    renderStudentsTable(studentsData);
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

function renderStudentsTable(data) {
  const el = document.getElementById('students');
  el.innerHTML = `
  <!-- Filter -->
  <div class="flex gap-2 mb-4 flex-wrap">
    <input class="input max-w-xs" placeholder="氏名・学籍番号で検索" oninput="filterStudents(this.value)" id="student-search">
    <select class="input max-w-xs" onchange="filterStudentsByStatus(this.value)">
      <option value="">すべてのステータス</option>
      <option value="在籍">在籍</option><option value="休学">休学</option><option value="退学">退学</option><option value="修了">修了</option>
    </select>
    <div class="ml-auto flex gap-2">
      <span class="text-sm self-center text-slate-500">計 ${data.length}名</span>
    </div>
  </div>
  <!-- Table -->
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>学籍番号</th><th>氏名</th><th>国籍</th><th>クラス</th>
        <th>出席率</th><th>在留期限</th><th>ステータス</th><th>操作</th>
      </tr></thead>
      <tbody>
        ${data.length ? data.map(s => `
          <tr class="cursor-pointer" onclick="openStudentDrawer('${s.id}')">
            <td class="font-mono text-xs text-slate-500">${s.student_no}</td>
            <td>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                  ${(s.name||'')[0]||'?'}
                </div>
                <span class="font-medium text-sm">${s.name}</span>
                ${s.alerts?.map(a => `<i class="fa fa-triangle-exclamation text-${a.includes('在留') ? 'red' : 'yellow'}-500 text-xs"></i>`).join('') || ''}
              </div>
            </td>
            <td class="text-xs">${nationalityFlag(s.nationality)} ${s.nationality}</td>
            <td class="text-xs">${s.class_name || '—'}</td>
            <td>${attendanceBar(s.attendance_rate)}</td>
            <td>${daysLeftBadge(s.residence_expiry)}<br><span class="text-xs text-slate-400">${fmtDateOnly(s.residence_expiry)}</span></td>
            <td>${statusBadge(s.status)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-sm" onclick="openStudentDrawer('${s.id}')"><i class="fa fa-pen-to-square"></i></button>
            </td>
          </tr>`).join('') : `<tr><td colspan="8" class="text-center py-10 text-slate-400">学生がいません</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function filterStudents(q) {
  const lower = q.toLowerCase();
  renderStudentsTable(studentsData.filter(s =>
    s.name?.toLowerCase().includes(lower) || s.student_no?.toLowerCase().includes(lower)
  ));
}
function filterStudentsByStatus(status) {
  renderStudentsTable(status ? studentsData.filter(s => s.status === status) : studentsData);
}

async function openStudentDrawer(id) {
  openDrawer('学生詳細', `<p class="text-slate-400 text-sm">読み込み中...</p>`);
  try {
    const { student, certificate_requests, exam_results } = await api(`/api/students/${id}`);
    document.getElementById('drawer-body').innerHTML = `
    <div class="flex flex-col gap-4">
      <!-- Header -->
      <div class="flex items-start gap-3 pb-3 border-b">
        <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700 flex-shrink-0">
          ${(student.name||'')[0]||'?'}
        </div>
        <div>
          <h3 class="font-bold text-slate-800">${student.name}</h3>
          <p class="text-xs text-slate-500">${student.student_no} · ${student.class_name || '—'} · ${nationalityFlag(student.nationality)} ${student.nationality}</p>
          <div class="flex gap-1 mt-1">${statusBadge(student.status)}${student.alerts?.map(a => badge(a, a.includes('在留')? 'red':'yellow')).join('')||''}</div>
        </div>
      </div>

      <!-- Info Grid -->
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div><span class="label">生年月日</span><p>${fmtDateOnly(student.birth_date) || '—'}</p></div>
        <div><span class="label">入学日</span><p>${fmtDateOnly(student.admission_date) || '—'}</p></div>
        <div><span class="label">在留カード番号</span><p class="font-mono text-xs">${student.residence_card_no || '—'}</p></div>
        <div><span class="label">在留期限</span>
          <p class="font-semibold">${fmtDateOnly(student.residence_expiry) || '—'} ${daysLeftBadge(student.residence_expiry)}</p>
        </div>
        <div><span class="label">電話番号</span><p>${student.phone || '—'}</p></div>
        <div><span class="label">パスポート番号</span><p class="font-mono text-xs">${student.passport_no || '—'}</p></div>
      </div>

      <!-- Attendance -->
      <div>
        <span class="label">出席率</span>
        <div class="mt-1">${attendanceBar(student.attendance_rate)}</div>
      </div>

      <!-- Exams -->
      ${exam_results?.length ? `
      <div>
        <span class="label">試験結果</span>
        <div class="mt-1 flex flex-col gap-1">
          ${exam_results.map(e => `
            <div class="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
              <span class="font-medium">${e.exam_name}</span>
              <span class="font-mono text-slate-600">${e.score_text || '—'}</span>
              <span class="text-slate-400">${fmtDateOnly(e.completion_date)}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Actions -->
      <div class="border-t pt-4 flex flex-wrap gap-2">
        <button class="btn btn-primary btn-sm" onclick="showStudentEditForm('${id}')"><i class="fa fa-pen"></i> 編集</button>
        <button class="btn btn-secondary btn-sm" onclick="showView('certificates')"><i class="fa fa-certificate"></i> 証明書申請</button>
      </div>

      <!-- Edit form (hidden by default) -->
      <div id="student-edit-${id}" class="hidden mt-2 border-t pt-4">
        <h4 class="text-sm font-bold mb-3">情報編集</h4>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div><label class="label">在留カード番号</label><input class="input" id="edit-rc-${id}" value="${student.residence_card_no||''}"></div>
          <div><label class="label">在留期限</label><input class="input" type="date" id="edit-re-${id}" value="${student.residence_expiry||''}"></div>
          <div><label class="label">電話</label><input class="input" id="edit-phone-${id}" value="${student.phone||''}"></div>
          <div><label class="label">住所</label><input class="input" id="edit-addr-${id}" value="${student.address_japan||''}"></div>
          <div class="col-span-2"><label class="label">ステータス</label>
            <select class="input" id="edit-status-${id}">
              ${['在籍','休学','退学','修了'].map(s => `<option ${s===student.status?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-primary mt-3" onclick="saveStudentEdit('${id}')"><i class="fa fa-save"></i> 保存</button>
      </div>
    </div>`;
  } catch (e) {
    document.getElementById('drawer-body').innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
  }
}

function showStudentEditForm(id) {
  document.getElementById(`student-edit-${id}`)?.classList.toggle('hidden');
}

async function saveStudentEdit(id) {
  const student = studentsData.find(s => s.id === id);
  if (!student) return;
  try {
    await api(`/api/students/${id}`, { method: 'PATCH', body: JSON.stringify({
      ...student,
      residence_card_no: document.getElementById(`edit-rc-${id}`)?.value || '',
      residence_expiry:  document.getElementById(`edit-re-${id}`)?.value || '',
      phone:             document.getElementById(`edit-phone-${id}`)?.value || '',
      address_japan:     document.getElementById(`edit-addr-${id}`)?.value || '',
      status:            document.getElementById(`edit-status-${id}`)?.value || student.status,
    })});
    showToast('学生情報を更新しました', 'success');
    closeDrawer();
    renderStudents();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Certificates ──────────────────────────────────────────────────────────
async function renderCertificates() {
  const el = document.getElementById('certificates');
  el.innerHTML = skeleton(4);
  try {
    const { summary, items } = await api('/api/certificate-requests');
    el.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-6">
      ${statCard('申請中', summary.requested_count, 'fa-file-circle-plus', '#3b82f6', '未処理')}
      ${statCard('承認済', summary.approved_count, 'fa-file-circle-check', '#f59e0b', '発行待ち')}
      ${statCard('発行済', summary.issued_count, 'fa-file-circle-xmark', '#10b981', '完了')}
      ${statCard('合計', summary.total_count, 'fa-certificate', '#6366f1', '全申請')}
    </div>
    <div class="flex justify-between mb-4">
      <span class="text-sm font-semibold text-slate-600">証明書申請一覧</span>
      <button class="btn btn-primary" onclick="openNewCertRequestModal()"><i class="fa fa-plus"></i> 新規申請</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>学生</th><th>証明書種別</th><th>部数</th><th>用途</th><th>ステータス</th><th>申請日</th><th>操作</th></tr></thead>
        <tbody>
          ${items.length ? items.map(r => `<tr>
            <td class="font-medium text-sm">${r.student_name || '—'}<br><span class="text-xs text-slate-400">${r.student_no}</span></td>
            <td>${badge(r.certificate_type, 'blue')}</td>
            <td class="text-center">${r.copies}部</td>
            <td class="text-xs text-slate-500">${r.purpose || '—'}</td>
            <td>${statusBadge(r.status)}</td>
            <td class="text-xs text-slate-400">${fmtDateOnly(r.requested_at)}</td>
            <td>
              <div class="flex gap-1">
                ${r.status === '申請中' ? `<button class="btn btn-success btn-sm" onclick="approveCert('${r.id}', this)"><i class="fa fa-check"></i> 承認</button>` : ''}
                ${r.status === '承認済' ? `<button class="btn btn-primary btn-sm" onclick="issueCert('${r.id}', this)"><i class="fa fa-file-export"></i> 発行</button>` : ''}
              </div>
            </td>
          </tr>`).join('') : `<tr><td colspan="7" class="text-center py-10 text-slate-400">申請がありません</td></tr>`}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

async function approveCert(id, btn) {
  btn.disabled = true;
  try { await api(`/api/certificate-requests/${id}/approve`, { method: 'POST' }); showToast('承認しました', 'success'); renderCertificates(); }
  catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}
async function issueCert(id, btn) {
  const ok = await askConfirm('証明書を発行しますか？');
  if (!ok) return;
  btn.disabled = true;
  try { await api(`/api/certificate-requests/${id}/issue`, { method: 'POST' }); showToast('証明書を発行しました', 'success'); renderCertificates(); }
  catch (e) { showToast(e.message, 'error'); btn.disabled = false; }
}

function openNewCertRequestModal() {
  showModal({
    title: '証明書新規申請',
    html: `
    <div class="flex flex-col gap-3">
      <div><label class="label">学生</label>
        <select class="input" id="cert-student">
          ${studentsData.filter(s=>s.status==='在籍').map(s=>`<option value="${s.id}">${s.name} (${s.student_no})</option>`).join('')}
        </select>
      </div>
      <div><label class="label">証明書種別</label>
        <select class="input" id="cert-type">
          <option>出席率証明書</option><option>成績証明書</option><option>修了証明書</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="label">部数</label><input class="input" type="number" id="cert-copies" value="1" min="1" max="10"></div>
        <div><label class="label">用途</label><input class="input" id="cert-purpose" placeholder="大学院進学用"></div>
      </div>
    </div>`,
    actions: [
      { label: 'キャンセル', class: 'btn-secondary', onclick: 'closeModal()' },
      { label: '申請する', class: 'btn-primary', onclick: 'doCreateCertRequest()' },
    ],
  });
}

async function doCreateCertRequest() {
  try {
    await api('/api/certificate-requests', { method: 'POST', body: JSON.stringify({
      student_id: document.getElementById('cert-student').value,
      certificate_type: document.getElementById('cert-type').value,
      copies: parseInt(document.getElementById('cert-copies').value) || 1,
      purpose: document.getElementById('cert-purpose').value || '',
    })});
    closeModal(); showToast('証明書を申請しました', 'success'); renderCertificates();
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Immigration ───────────────────────────────────────────────────────────
let immigrationTab = 'semiannual';
async function renderImmigration() {
  const el = document.getElementById('immigration');
  el.innerHTML = `
  <div class="flex border-b mb-5 gap-1">
    ${[
      ['semiannual', '半期出席率'],
      ['poor', '低出席率'],
      ['renewal', '在留更新'],
      ['may_nov', '5月・11月'],
      ['annual', '年度終了'],
    ].map(([key, label]) => `
      <button class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${immigrationTab === key ? 'bg-white border border-b-white -mb-px text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-700'}"
        onclick="switchImmigrationTab('${key}')">${label}</button>`).join('')}
  </div>
  <div id="immigration-content">読み込み中...</div>`;
  await loadImmigrationTab(immigrationTab);
}

async function switchImmigrationTab(tab) {
  immigrationTab = tab;
  document.querySelectorAll('#immigration .flex button').forEach(b => {
    const key = b.getAttribute('onclick').match(/'(\w+)'/)?.[1];
    b.className = `px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === key ? 'bg-white border border-b-white -mb-px text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-700'}`;
  });
  await loadImmigrationTab(tab);
}

async function loadImmigrationTab(tab) {
  const el = document.getElementById('immigration-content');
  el.innerHTML = skeleton(4);
  const endpoints = {
    semiannual: '/api/immigration-reports/semiannual-attendance',
    poor:       '/api/immigration-reports/poor-attendance',
    renewal:    '/api/immigration-reports/residence-renewal',
    may_nov:    '/api/immigration-reports/may-november',
    annual:     '/api/immigration-reports/annual-completion',
  };
  try {
    const d = await api(endpoints[tab]);
    const s = d.summary;
    const statusColor = s.status?.includes('なし') ? 'green' : s.status?.includes('準備') ? 'blue' : 'yellow';

    el.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${statCard('対象者', d.targets?.length ?? d.students?.length ?? d.entries?.length ?? '—', 'fa-users', '#6366f1', s.report_period || s.report_month || '')}
      ${statCard('ステータス', s.status, 'fa-circle-info', s.status?.includes('なし') || s.status?.includes('適合') ? '#10b981' : '#f59e0b', '')}
      ${s.average_attendance != null ? statCard('平均出席率', s.average_attendance + '%', 'fa-chart-line', '#3b82f6', '全体') : ''}
      ${s.withdrawal_count != null ? statCard('離脱者数', s.withdrawal_count, 'fa-person-walking-arrow-right', '#ef4444', '退学') : ''}
    </div>
    <div class="card mb-4 flex items-center gap-3">
      <div class="flex-1">
        <p class="text-sm font-semibold">${s.report_period || '報告書'}</p>
        <p class="text-xs text-slate-500">発行日: ${fmtDateOnly(s.issue_date)}</p>
      </div>
      ${statusBadge(s.status)}
      <button class="btn btn-primary btn-sm" onclick="showToast('帳票生成機能は準備中です', 'info')">
        <i class="fa fa-file-export"></i> 帳票生成
      </button>
    </div>
    ${immigrationTable(d, tab)}`;
  } catch (e) {
    el.innerHTML = `<p class="text-red-500 text-sm">${e.message}</p>`;
  }
}

function immigrationTable(d, tab) {
  const items = d.targets || d.students || d.entries || [];
  if (!items.length) return emptyState('対象者なし');
  return `<div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>学籍番号</th><th>氏名</th><th>国籍</th><th>クラス</th>
        ${tab === 'renewal' ? '<th>残日数</th>' : ''}
        ${tab !== 'annual' ? '<th>出席率</th><th>在留期限</th>' : '<th>種別</th><th>進路</th><th>修了日</th>'}
      </tr></thead>
      <tbody>
        ${items.slice(0, 50).map(s => `<tr>
          <td class="font-mono text-xs">${s.student_no || s.no || ''}</td>
          <td class="font-medium">${s.name || s.student_name || ''}</td>
          <td class="text-xs">${nationalityFlag(s.nationality || '') + ' ' + (s.nationality || '')}</td>
          <td class="text-xs">${s.class_name || s.course_name || ''}</td>
          ${tab === 'renewal' ? `<td>${daysLeftBadge(s.residence_expiry)}</td>` : ''}
          ${tab !== 'annual' ? `
            <td>${attendanceBar(s.attendance_rate)}</td>
            <td class="text-xs">${fmtDateOnly(s.residence_expiry)}</td>
          ` : `
            <td>${badge(s.requirement || s.result_type || '', 'blue')}</td>
            <td class="text-xs">${s.destination || s.title || ''}</td>
            <td class="text-xs">${fmtDateOnly(s.completion_date)}</td>
          `}
        </tr>`).join('')}
      </tbody>
    </table>
    ${items.length > 50 ? `<p class="text-xs text-slate-400 p-3">他${items.length-50}件省略</p>` : ''}
  </div>`;
}

// ── Annual Results ─────────────────────────────────────────────────────────
async function renderAnnualResults() {
  const el = document.getElementById('annualResults');
  el.innerHTML = skeleton(3);
  try {
    const d = await api('/api/annual-results');
    el.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${statCard('在籍学生', d.summary.student_count, 'fa-users', '#3b82f6', '')}
      ${statCard('進学', d.summary.advancement_count, 'fa-school', '#10b981', '')}
      ${statCard('就職', d.summary.employment_count, 'fa-briefcase', '#6366f1', '')}
      ${statCard('試験合格', d.summary.exam_count, 'fa-award', '#f59e0b', '')}
    </div>
    <div class="grid grid-cols-2 gap-4">
      ${resultsCard('進学結果', d.advancement, ['進学先', '学部'])}
      ${resultsCard('就職結果', d.employment, ['会社名', '職種'])}
    </div>
    <div class="mt-4">
      ${resultsCard('試験結果', d.exams, ['試験名', 'スコア'])}
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

function resultsCard(title, items, [col1, col2]) {
  return `<div class="table-wrap">
    <div class="section-header px-4 pt-3 pb-0"><span class="section-title text-sm">${title}</span></div>
    <table class="data-table">
      <thead><tr><th>学生</th><th>${col1}</th><th>${col2}</th><th>修了日</th></tr></thead>
      <tbody>
        ${items?.length ? items.map(i => `<tr>
          <td class="font-medium text-sm">${i.student_name}</td>
          <td class="text-xs text-slate-600">${i.title || '—'}</td>
          <td class="text-xs text-slate-400">${i.detail || '—'}</td>
          <td class="text-xs text-slate-400">${fmtDateOnly(i.completion_date)}</td>
        </tr>`).join('') : `<tr><td colspan="4" class="text-center py-6 text-slate-400 text-xs">データなし</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

// ── Documents ─────────────────────────────────────────────────────────────
async function renderDocuments() {
  const el = document.getElementById('documents');
  el.innerHTML = skeleton(4);
  try {
    const { summary, items } = await api('/api/document-ledger');
    el.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${statCard('合計', summary.total_count, 'fa-folder-open', '#6366f1', '全帳票')}
      ${statCard('領収書', summary.receipt_count, 'fa-receipt', '#10b981', '発行済み')}
      ${statCard('合格通知書', summary.acceptance_count, 'fa-file-circle-check', '#3b82f6', '生成済み')}
      ${statCard('証明書', summary.certificate_count, 'fa-certificate', '#f59e0b', '発行済み')}
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>帳票種別</th><th>帳票番号</th><th>対象者</th><th>発行日</th></tr></thead>
        <tbody>
          ${items.length ? items.map(d => `<tr>
            <td>${badge(d.document_type, d.document_type === '領収書' ? 'green' : d.document_type === '合格通知書' ? 'blue' : 'purple')}</td>
            <td class="font-mono text-xs">${d.document_no || '—'}</td>
            <td class="text-sm">${d.target_name || '—'}</td>
            <td class="text-xs text-slate-400">${fmtDateOnly(d.created_at)}</td>
          </tr>`).join('') : `<tr><td colspan="4" class="text-center py-10 text-slate-400">帳票がありません</td></tr>`}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

// ── Audit ─────────────────────────────────────────────────────────────────
async function renderAudit() {
  const el = document.getElementById('audit');
  el.innerHTML = skeleton(6);
  try {
    const logs = await api('/api/audit-logs');
    const typeColors = { 'create': 'blue', 'interview.result': 'green', 'document.generate': 'purple',
      'receipt.issue': 'green', 'payment.confirm': 'green', 'ai_check.run': 'orange', 'immigration.submit': 'blue' };
    el.innerHTML = `
    <div class="flex justify-between mb-4">
      <span class="text-sm font-semibold text-slate-600">操作ログ (最新${logs.length}件)</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>日時</th><th>操作者</th><th>操作種別</th><th>対象</th><th>内容</th></tr></thead>
        <tbody>
          ${logs.length ? logs.map(l => `<tr>
            <td class="text-xs font-mono text-slate-400">${fmtDate(l.created_at)}</td>
            <td class="text-sm">${l.actor}</td>
            <td>${badge(l.event_type, typeColors[l.event_type] || 'gray')}</td>
            <td class="text-xs text-slate-500">${l.target_type}</td>
            <td class="text-xs text-slate-600">${l.message}</td>
          </tr>`).join('') : `<tr><td colspan="5" class="text-center py-10 text-slate-400">ログがありません</td></tr>`}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card text-red-500 text-sm">${e.message}</div>`;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderView('dashboard');
  // Preload students in background for certificates modal
  api('/api/students').then(d => { studentsData = d; }).catch(() => {});
});
