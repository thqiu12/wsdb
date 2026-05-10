const state = {
  view: "dashboard",
  currentStaff: null,
  intakeSummary: null,
  importBatches: [],
  applicants: [],
  coeCases: [],
  payments: [],
  studentPortalAdmin: null,
  documentLedger: null,
  immigrationReport: null,
  mayNovemberReport: null,
  annualResultsData: null,
  operationsSummary: null,
  editingAnnualResult: null,
  annualResultsStudentFilter: "",
  certificateStudentFilter: "",
  applicantFilter: "all",
  coeFilter: "all",
  documentFilter: "all",
  documentSearch: "",
};

const STAFF_SESSION_KEY = "schoolcore_staff_session";

const titles = {
  dashboard: ["Dashboard", "今日やることを確認します"],
  intake: ["受付", "学生フォームと Excel 取込をまとめて管理します"],
  applicants: ["出願者", "面接申請から COE 準備までを進めます"],
  coe: ["COE進行", "AIチェック、COE一部送付、COE全体送付を管理します"],
  payments: ["入金・領収書", "選考料、学費、領収書を確認します"],
  students: ["学生", "在籍生情報、在留期限、出席率を確認します"],
  studentPortal: ["学生連携", "学生端から届く申請、提出、掲示を管理します"],
  certificates: ["証明書", "申請、承認、発行までを学生別に管理します"],
  immigration: ["入管報告", "半期毎出席率報告など入管提出帳票をまとめます"],
  annualResults: ["年度結果", "進学・就職・試験・退学後進路を年度終了報告に連動させます"],
  documents: ["帳票台帳", "生成した帳票をまとめて確認し、再ダウンロードします"],
  audit: ["監査ログ", "重要な操作履歴を確認します"],
  operations: ["運用管理", "内部試運行のアカウント、バックアップ、自検状況を確認します"],
};

const viewMetaLabels = {
  dashboard: "Overview / Daily Operations",
  intake: "Admissions / Intake",
  applicants: "Admissions / Applicants",
  coe: "Admissions / COE Workflow",
  payments: "Admissions / Payments",
  students: "Student Life / Enrollment",
  studentPortal: "Student Life / Student Portal",
  certificates: "Student Life / Certificates",
  immigration: "Reporting / Immigration",
  annualResults: "Reporting / Annual Results",
  documents: "Reporting / Document Ledger",
  audit: "Reporting / Audit Trail",
  operations: "Overview / Operations",
};

async function api(path, options = {}) {
  const staffSession = localStorage.getItem(STAFF_SESSION_KEY) || "";
  const headers = {
    "content-type": "application/json",
    ...(staffSession ? { "x-staff-session": staffSession } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(path, {
    headers,
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      clearAdminSession();
      renderAdminAuth("ログインの有効期限が切れました。もう一度ログインしてください。");
    }
    throw data.error || { message: "APIエラーが発生しました。" };
  }
  return data;
}

function can(permission) {
  return Boolean(state.currentStaff?.permissions?.includes(permission));
}

function permissionDisabled(permission) {
  return can(permission) ? "" : "disabled";
}

function permissionBadge(permission, text = "この操作権限がありません") {
  if (can(permission)) return "";
  return `<div class="form-note permission-note">${escapeHtml(text)}</div>`;
}

function currentRoleLabel() {
  const role = state.currentStaff?.role || "";
  if (role === "manager") return "manager";
  if (role === "immigration_report_staff") return "入管担当";
  if (role === "staff") return "staff";
  return "未ログイン";
}

function pageGuide(title, description, chips = []) {
  return `
    <div class="ops-banner">
      <div>
        <div class="section-kicker">現在の役割</div>
        <div class="ops-title">${escapeHtml(title)}</div>
        <div class="ops-description">${escapeHtml(description)}</div>
      </div>
      <div class="ops-chips">
        ${chips.map((chip) => `<span class="hint-chip ${chip.color || "gray"}">${escapeHtml(chip.label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function currentStaffLabel() {
  if (!state.currentStaff) return "未ログイン";
  return `${state.currentStaff.display_name} / ${state.currentStaff.role}`;
}

function renderStaffPill() {
  if (!state.currentStaff) return "未ログイン";
  const role = state.currentStaff.role || "";
  const roleLabel = role === "manager" ? "manager" : role === "immigration_report_staff" ? "入管担当" : "staff";
  return `
    <div class="user-pill-meta">Signed in</div>
    <div class="user-pill-name">${escapeHtml(state.currentStaff.display_name)}</div>
    <div class="user-pill-role">${escapeHtml(roleLabel)}</div>
  `;
}

function setAdminSession(token, staff) {
  localStorage.setItem(STAFF_SESSION_KEY, token);
  state.currentStaff = staff;
}

function clearAdminSession() {
  localStorage.removeItem(STAFF_SESSION_KEY);
  state.currentStaff = null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(text, color = "gray") {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function statusBadge(status, fallbackColor = "gray") {
  const value = String(status || "").trim();
  if (!value) return badge("-", fallbackColor);
  const greenStatuses = new Set(["完了", "正常", "使用中", "確認済", "合格", "発行済", "承認済", "反映済", "運用中", "出席", "受領済", "COE連携済", "下付済", "済"]);
  const yellowStatuses = new Set(["申請中", "未発行", "未確認", "未", "資料待ち", "AI未実行", "修正中", "学費待ち", "遅刻", "早退", "再提出", "再提出依頼", "要確認", "未打刻"]);
  const redStatuses = new Set(["欠席", "Error"]);
  const blueStatuses = new Set(["発行待ち", "提出待ち", "入管提出待ち", "学生対応"]);
  const grayStatuses = new Set(["差戻し", "未設定", "終了", "閲覧のみ", "未実行"]);
  if (greenStatuses.has(value)) return badge(value, "green");
  if (yellowStatuses.has(value)) return badge(value, "yellow");
  if (redStatuses.has(value)) return badge(value, "red");
  if (blueStatuses.has(value)) return badge(value, "blue");
  if (grayStatuses.has(value)) return badge(value, "gray");
  return badge(value, fallbackColor);
}

function requestedByLabel(value) {
  if (value === "student") return "学生";
  if (value === "staff") return "事務局";
  return value || "-";
}

function yen(value) {
  return `${Number(value).toLocaleString("ja-JP")} 円`;
}

function qrImageUrl(path, size = 180) {
  if (!path) return "";
  const absoluteUrl = new URL(path, window.location.origin).toString();
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(absoluteUrl)}`;
}

function groupStudentRelatedFiles(files = []) {
  const order = ["学生提出", "証明書", "入管・在籍帳票", "帳票"];
  const grouped = new Map();
  files.forEach((item) => {
    const key = item.category || (item.kind === "attachment" ? "学生提出" : "帳票");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });
  return order
    .filter((key) => grouped.has(key))
    .map((key) => ({ label: key, items: grouped.get(key) || [] }));
}

function relatedFileMeta(item) {
  const kindLabel = item.kind === "attachment" ? "学生提出ファイル" : "生成済み帳票";
  const dateLabel = item.date_label || (item.kind === "attachment" ? "提出日" : "発行日");
  const dateValue = item.date_value || "-";
  return `${kindLabel} / ${dateLabel} ${dateValue}`;
}

function relatedFileReviewMeta(item) {
  if (!item?.reviewed_at) return "最終確認 未記録";
  const base = `最終確認 ${String(item.reviewed_at || "").replace("T", " ")} / ${item.reviewed_by || "-"}`;
  return item.review_note ? `${base} / ${item.review_note}` : base;
}

function renderStudentRelatedFileGroups(files = [], category = "all") {
  const grouped = groupStudentRelatedFiles(files);
  const visibleGroups = category === "all"
    ? grouped
    : grouped.filter((group) => group.label === category);
  if (!visibleGroups.length) {
    return `<div class="preview-sheet"><div class="empty-state">この条件に一致するファイルはありません。</div></div>`;
  }
  return visibleGroups.map((group) => `
    <div class="preview-sheet">
      <div class="preview-head">
        <strong>${escapeHtml(group.label)}</strong>
        <span>${group.items.length} 件</span>
      </div>
      ${group.items.map((item) => `
        <div class="preview-row">
          <span>${escapeHtml(item.label || "関連ファイル")}</span>
          <strong>${escapeHtml(item.sub_label || "-")}</strong>
        </div>
        <div class="table-secondary" style="margin: -2px 0 8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
          <span>${escapeHtml(relatedFileMeta(item))}</span>
          <div class="table-inline-actions">
            <input class="staff-reset-input" type="text" data-related-file-note="${escapeHtml(item.review_key || "")}" placeholder="確認メモ">
            <a class="btn compact" href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener noreferrer">開く</a>
            <button class="btn compact" type="button" data-related-file-review="${escapeHtml(item.review_key || "")}" data-related-file-label="${escapeHtml(item.label || "関連ファイル")}">確認済みにする</button>
          </div>
        </div>
        <div class="table-secondary" style="margin: -4px 0 10px 0;">${escapeHtml(relatedFileReviewMeta(item))}</div>
      `).join("")}
    </div>
  `).join("");
}

function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.remove("hidden");
  window.setTimeout(() => node.classList.add("hidden"), 3200);
}

function showError(error) {
  toast(error.message || "処理に失敗しました。");
}

function setButtonLoading(button, text) {
  if (!button) return () => {};
  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.textContent = text;
  return () => {
    button.disabled = originalDisabled;
    button.textContent = originalText;
  };
}

function showView(id) {
  if (!state.currentStaff) return;
  state.view = id;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== id);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id);
  });
  document.querySelector("#topbarMeta").textContent = viewMetaLabels[id] || "SchoolCore";
  document.querySelector("#title").textContent = titles[id][0];
  document.querySelector("#subtitle").textContent = titles[id][1];
  render();
}

function renderAdminAuth(message = "") {
  document.querySelector("#adminApp").classList.add("hidden");
  const root = document.querySelector("#adminAuth");
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="auth-layout">
      <section class="auth-hero">
        <div class="auth-kicker">SchoolCore Administration</div>
        <h1>学籍、在留、帳票の運用を<br>ひとつの入口から。</h1>
        <p class="auth-lead">内部試運行版の管理画面です。受付、COE、証明書、在籍管理、入管報告まで、事務局の一日の流れに合わせて使えます。</p>
        <div class="auth-feature-grid">
          <article class="auth-feature-card">
            <div class="auth-feature-label">Admissions</div>
            <strong>出願者から COE まで</strong>
            <p>面接、合格通知、COE進行を一連で管理します。</p>
          </article>
          <article class="auth-feature-card">
            <div class="auth-feature-label">Student Life</div>
            <strong>在籍、出席、学生連携</strong>
            <p>在留期限、QR出席、学生端からの申請を追えます。</p>
          </article>
          <article class="auth-feature-card">
            <div class="auth-feature-label">Reporting</div>
            <strong>証明書と入管帳票</strong>
            <p>日常の発行業務と定期報告を同じ画面系で進めます。</p>
          </article>
        </div>
        <div class="auth-status-strip">
          <span class="auth-status-chip">内部試運行版</span>
          <span class="auth-status-chip">ローカル環境</span>
          <span class="auth-status-chip">役割ベース権限</span>
        </div>
      </section>

      <section class="auth-card">
        <div class="section-kicker">内部試運行版</div>
        <div class="auth-card-head">
          <h2>管理画面ログイン</h2>
          <p>事務局、入管担当、manager のアカウントでログインしてください。</p>
        </div>
        ${message ? `<div class="auth-error">${escapeHtml(message)}</div>` : ""}
        <form id="adminLoginForm" class="settings-form auth-form">
          <label>
            ログインID
            <input name="login_id" placeholder="例: yamada" autocomplete="username" required>
          </label>
          <label>
            パスワード
            <input name="password" type="password" placeholder="8文字以上" autocomplete="current-password" required>
          </label>
          <div class="auth-form-note">役割ごとに操作できる範囲が変わります。ログイン後は自分の権限に応じた画面だけが操作可能になります。</div>
          <div class="form-actions auth-form-actions">
            <button class="primary-btn auth-submit" type="submit">ログインする</button>
          </div>
        </form>
        <div class="auth-note">
          <div class="auth-note-title">試運行用アカウント</div>
          <div class="auth-account-list">
            <div class="auth-account-row"><span>staff</span><strong>yamada</strong></div>
            <div class="auth-account-row"><span>入管担当</span><strong>nakajima</strong></div>
            <div class="auth-account-row"><span>manager</span><strong>admin</strong></div>
          </div>
        </div>
      </section>
    </div>
  `;
  document.querySelector("#adminLoginForm").addEventListener("submit", submitAdminLogin);
}

async function submitAdminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "ログイン中...");
  try {
    const result = await fetch("/api/staff-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        login_id: form.get("login_id"),
        password: form.get("password"),
      }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw data.error || { message: "ログインに失敗しました。" };
      return data;
    });
    setAdminSession(result.session_token, result.staff);
    await bootstrapAdminApp();
  } catch (error) {
    renderAdminAuth(error.message || "ログインに失敗しました。");
  } finally {
    restore();
  }
}

async function bootstrapAdminApp() {
  const token = localStorage.getItem(STAFF_SESSION_KEY);
  if (!token) {
    renderAdminAuth();
    return;
  }
  try {
    const result = await fetch("/api/staff-session", {
      headers: { "x-staff-session": token },
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw data.error || { message: "ログイン状態を確認できません。" };
      return data;
    });
    state.currentStaff = result.staff;
    document.querySelector("#adminAuth").classList.add("hidden");
    document.querySelector("#adminApp").classList.remove("hidden");
    document.querySelector("#userPill").innerHTML = renderStaffPill();
    document.querySelector("#topbarMeta").textContent = viewMetaLabels[state.view] || "SchoolCore";
    render();
  } catch (_error) {
    clearAdminSession();
    renderAdminAuth("管理画面にログインしてください。");
  }
}

async function refreshCoreData() {
  const [applicants, coeCases, payments] = await Promise.all([
    api("/api/applicants"),
    api("/api/coe-cases"),
    api("/api/payments"),
  ]);
  state.applicants = applicants;
  state.coeCases = coeCases;
  state.payments = payments;
}

async function render() {
  if (state.view === "dashboard") return renderDashboard();
  if (state.view === "intake") return renderIntake();
  if (state.view === "applicants") return renderApplicants();
  if (state.view === "coe") return renderCoe();
  if (state.view === "payments") return renderPayments();
  if (state.view === "students") return renderStudents();
  if (state.view === "studentPortal") return renderStudentPortalAdmin();
  if (state.view === "certificates") return renderCertificates();
  if (state.view === "immigration") return renderImmigration();
  if (state.view === "annualResults") return renderAnnualResults();
  if (state.view === "documents") return renderDocuments();
  if (state.view === "audit") return renderAudit();
  if (state.view === "operations") return renderOperations();
}

function stat(label, value, note) {
  return `
    <div class="card stat">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      <div class="stat-note">${escapeHtml(note)}</div>
    </div>
  `;
}

async function renderDashboard() {
  const data = await api("/api/dashboard");
  const role = state.currentStaff?.role || "";
  const roleSummary =
    role === "manager"
      ? "全体の進行、権限の高い処理、入管報告の最終確認をここから見ます。"
      : role === "immigration_report_staff"
        ? "入管報告、COE提出、更新対象の確認を優先して進める役割です。"
        : "日々の受付、学生対応、証明書、入金確認を優先して進める役割です。";
  const primaryQueue = [
    { label: "合格通知書生成待ち", count: data.acceptance_notice_waiting, view: "applicants" },
    { label: "COE準備中", count: data.coe_preparing, view: "coe" },
    { label: "学費入金済み・領収書未発行", count: data.pending_receipts, view: "payments" },
    { label: "COE全体送付ブロック", count: data.blocked_coe, view: "coe" },
    { label: "出席率80%未満", count: data.low_attendance, view: "students" },
  ].sort((a, b) => b.count - a.count);
  const topQueue = primaryQueue[0];
  const focusQueue = primaryQueue.slice(0, 3);
  document.querySelector("#dashboard").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} の今日の運用ホーム`,
      roleSummary,
      [
        { label: `出願者 ${data.applicant_count}`, color: "blue" },
        { label: `在籍生 ${data.student_count}`, color: "gray" },
        { label: topQueue.count > 0 ? `最優先: ${topQueue.label}` : "大きな滞留なし", color: topQueue.count > 0 ? "yellow" : "green" },
      ],
    )}
    <div class="dashboard-focus-grid">
      ${focusQueue.map((item, index) => `
        <button class="dashboard-focus-card ${index === 0 ? "primary" : ""}" data-open-view="${item.view}">
          <div class="dashboard-focus-label">${index === 0 ? "いちばん先に見る" : index === 1 ? "次に確認" : "続けて確認"}</div>
          <div class="dashboard-focus-title">${escapeHtml(item.label)}</div>
          <div class="dashboard-focus-meta">
            <span class="dashboard-focus-count">${escapeHtml(String(item.count))} 件</span>
            <span class="dashboard-focus-cta">一覧へ</span>
          </div>
        </button>
      `).join("")}
    </div>
    <div class="quick-actions dashboard-shortcuts">
      <button class="btn" id="dashboardOpenIntake">受付を開く</button>
      <button class="btn primary" id="dashboardNewApplicant">新規出願者を登録</button>
      <button class="btn" id="dashboardOpenApplicants">出願者一覧へ</button>
      <button class="btn" id="dashboardOpenCoe">COE案件一覧へ</button>
    </div>
    <div class="grid stats">
      ${stat("出願者", data.applicant_count, "面接申請から COE まで")}
      ${stat("COE準備中", data.coe_preparing, "資料回収と AI チェック")}
      ${stat("未発行領収書", data.pending_receipts, "入金確認済み")}
      ${stat("COE送付待ち", data.blocked_coe, "領収書発行で解除")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        ${tableSectionHead(
          "今日の優先業務",
          "件数が多い順に並べています。迷ったら上から開けば大きな滞留を先に動かせます。",
          [
            summaryPill("最優先", topQueue.count || 0, topQueue.count ? "yellow" : "gray"),
            summaryPill("キュー数", primaryQueue.length, "blue"),
          ],
        )}
        <div class="card-body task-list">
          ${primaryQueue.map((item) => taskRow(item.label, item.count, item.view)).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">この役割の見どころ</div></div>
        <div class="card-body">
          <div class="checkline">まずは上の「今日の優先業務」から件数が多いものを開きます。</div>
          <div class="checkline">学生対応は「学生連携」、証明書の承認と発行は「証明書」で進めます。</div>
          <div class="checkline">在籍生の注意対象は「学生」で、在留期限と出席率をまとめて追えます。</div>
          <div class="checkline">領収書未発行の案件は COE 全体送付を止めるため、「入金・領収書」を優先します。</div>
          <div class="checkline">${can("immigration_generate") ? "このアカウントは入管報告の出力ができます。" : "入管報告の出力は入管担当または manager が行います。"}</div>
          <div class="checkline">${can("student_portal_review") ? "学生端から届く申請の審査も行えます。" : "学生端の審査は権限付き staff が行います。"}</div>
        </div>
      </div>
    </div>
  `;
  document.querySelector("#dashboardOpenIntake").addEventListener("click", () => showView("intake"));
  document.querySelector("#dashboardNewApplicant").addEventListener("click", openApplicantModal);
  document.querySelector("#dashboardOpenApplicants").addEventListener("click", () => showView("applicants"));
  document.querySelector("#dashboardOpenCoe").addEventListener("click", () => showView("coe"));
  document.querySelectorAll("[data-open-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.openView));
  });
}

async function renderIntake() {
  const [summary, batches] = await Promise.all([api("/api/intake-summary"), api("/api/import-batches")]);
  state.intakeSummary = summary;
  state.importBatches = batches;
  document.querySelector("#intake").innerHTML = `
    <div class="grid two">
      <div class="card">
        <div class="card-header">
          <div class="card-title">学生入力フォーム</div>
          ${badge("スマホ対応", "green")}
        </div>
        <div class="card-body intake-stack">
          <div class="intake-linkbox">
            <div class="kicker">URL</div>
            <div class="intake-url">${escapeHtml(summary.portal_url)}</div>
          </div>
          <div class="checkline">学生はこのページから自分で面接申請情報を入力できます。</div>
          <div class="checkline">入力完了後は出願者一覧に自動追加されます。</div>
          <div class="checkline">現在の受付件数: ${escapeHtml(summary.portal_submissions)} 件</div>
          <div class="quick-actions">
            <a class="btn primary" href="/apply" target="_blank" rel="noreferrer">学生ページを開く</a>
            <button class="btn" id="copyPortalUrl">URLをコピー</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Excel 取込</div>
          ${badge("中介対応", "blue")}
        </div>
        <div class="card-body">
          <form id="importForm" class="import-form">
            <label>
              取込元名
              <input name="source_label" placeholder="例: SGG留学サポート">
            </label>
            <label class="full">
              Excel / CSV ファイル
              <input name="file" type="file" accept=".xlsx,.xls,.csv" required>
            </label>
            <div class="form-note full">
              まずは xlsx / csv を自動取込します。古い xls はアップロード記録を残し、必要に応じて変換対応します。
            </div>
            <div class="form-actions full">
              <button class="btn primary" type="submit">取込を開始</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">取込履歴</div>
        ${badge(`${batches.length} 件`, "gray")}
      </div>
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>日時</th>
              <th>ファイル</th>
              <th>取込元</th>
              <th>状態</th>
              <th>登録</th>
              <th>要確認</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map(renderImportBatchRow).join("") || `<tr><td colspan="7">まだ取込履歴はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#copyPortalUrl").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary.portal_url);
      toast("学生ページ URL をコピーしました。");
    } catch (error) {
      showError({ message: "URL をコピーできませんでした。" });
    }
  });
  document.querySelector("#importForm").addEventListener("submit", submitImportForm);
}

function renderImportBatchRow(item) {
  const statusColor = item.status === "completed" ? "green" : item.status === "partial" ? "yellow" : "red";
  const statusLabel = item.status === "completed" ? "完了" : item.status === "partial" ? "一部要確認" : "要確認";
  return `
    <tr>
      <td>${escapeHtml(item.created_at.replace("T", " "))}</td>
      <td>${escapeHtml(item.filename)}</td>
      <td>${escapeHtml(item.source_label || "-")}</td>
      <td>${badge(statusLabel, statusColor)}</td>
      <td>${escapeHtml(item.imported_rows)}</td>
      <td>${escapeHtml(item.error_rows)}</td>
      <td>${escapeHtml(item.note || "-")}</td>
    </tr>
  `;
}

async function submitImportForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const response = await fetch("/api/import-batches/upload", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) throw data.error || { message: "取込に失敗しました。" };
    toast(`取込が完了しました。登録 ${data.imported_rows} 件 / 要確認 ${data.error_rows} 件`);
    renderIntake();
  } catch (error) {
    showError(error);
  }
}

function taskRow(label, count, view) {
  const color = count > 0 ? "yellow" : "green";
  return `
    <div class="task-row">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <p>${count > 0 ? "対応が必要です。" : "現在はありません。"}</p>
      </div>
      <div class="task-actions">
        ${badge(`${count} 件`, color)}
        <button class="btn" data-open-view="${view}">一覧へ</button>
      </div>
    </div>
  `;
}

function tableSectionHead(title, note, chips = [], extra = "") {
  return `
    <div class="table-section-head">
      <div class="table-section-copy">
        <div class="table-section-title">${escapeHtml(title)}</div>
        <div class="table-section-note">${escapeHtml(note)}</div>
      </div>
      <div class="table-section-meta">
        ${chips.join("")}
        ${extra}
      </div>
    </div>
  `;
}

function summaryPill(label, value, tone = "gray") {
  return `<span class="summary-pill ${tone}"><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(label)}</small></span>`;
}

async function renderApplicants() {
  await refreshCoreData();
  const acceptanceConfig = await api("/api/acceptance-config");
  const filteredApplicants = sortApplicantsByPriority(filterApplicants(state.applicants, state.applicantFilter));
  const applicantQueue = {
    needsSections: countApplicants("needs_sections"),
    needsFee: countApplicants("needs_fee"),
    needsInterview: countApplicants("needs_interview"),
    needsNotice: countApplicants("needs_notice"),
    accepted: countApplicants("accepted"),
  };
  document.querySelector("#applicants").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として出願者を確認中`,
      "受付直後の学生から合格通知待ちまでをここで進めます。上から順に、今いちばん詰まっている行が来るように並べています。",
      [
        { label: `必須情報待ち ${applicantQueue.needsSections}`, color: applicantQueue.needsSections ? "yellow" : "green" },
        { label: `面接結果待ち ${applicantQueue.needsInterview}`, color: applicantQueue.needsInterview ? "yellow" : "green" },
        { label: `合格通知待ち ${applicantQueue.needsNotice}`, color: applicantQueue.needsNotice ? "blue" : "gray" },
      ],
    )}
    <div class="grid two" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">合格通知書テンプレート</div>
          ${badge(acceptanceConfig.active_template ? "使用中" : "未設定", acceptanceConfig.active_template ? "green" : "yellow")}
        </div>
        <div class="card-body template-summary">
          ${acceptanceConfig.active_template ? `
            <div class="info-list single">
              <div><span>テンプレート名</span><strong>${escapeHtml(acceptanceConfig.active_template.name)}</strong></div>
              <div><span>校舎</span><strong>${escapeHtml(acceptanceConfig.active_template.campus_name || "-")}</strong></div>
              <div><span>状態</span><strong>${escapeHtml(acceptanceConfig.active_template.notes)}</strong></div>
            </div>
          ` : `<div class="empty-state">合格通知書テンプレートがまだ設定されていません。</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">通知書運用状況</div></div>
        <div class="card-body">
          <div class="checkline">登録テンプレート数: ${escapeHtml(acceptanceConfig.template_count)} 件</div>
          <div class="checkline">発行済み通知書: ${escapeHtml(acceptanceConfig.issued_count)} 件</div>
          <div class="checkline">今は票面項目をプレビュー可能。校舎別テンプレート接続は次段階で追加します。</div>
        </div>
      </div>
    </div>
    <div class="quick-actions">
      <button class="btn primary" id="createApplicant">新規出願者を登録</button>
      <button class="btn" id="refreshApplicants">最新状態に更新</button>
    </div>
    <div class="filter-tabs">
      ${filterButton("all", "すべて", state.applicants.length)}
      ${filterButton("needs_sections", "必須情報待ち", countApplicants("needs_sections"))}
      ${filterButton("needs_fee", "選考料待ち", countApplicants("needs_fee"))}
      ${filterButton("needs_interview", "面接結果待ち", countApplicants("needs_interview"))}
      ${filterButton("needs_notice", "合格通知待ち", countApplicants("needs_notice"))}
      ${filterButton("accepted", "合格者", countApplicants("accepted"))}
    </div>
    <div class="card">
      ${tableSectionHead(
        "出願者一覧",
        "受付から合格通知までを、いま詰まっている順に確認します。",
        [
          summaryPill("表示中", `${filteredApplicants.length} / ${state.applicants.length}`, "blue"),
          summaryPill("選考料待ち", applicantQueue.needsFee, applicantQueue.needsFee ? "yellow" : "gray"),
          summaryPill("合格者", applicantQueue.accepted, applicantQueue.accepted ? "green" : "gray"),
        ],
        `<span class="table-section-hint">フィルターで現在の担当範囲だけに絞れます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>受付番号</th>
              <th>受付</th>
              <th>氏名</th>
              <th>入学期</th>
              <th>状態</th>
              <th>必須</th>
              <th>選考料</th>
              <th>面接</th>
              <th>合格通知</th>
              <th>連携</th>
              <th>次アクション</th>
            </tr>
          </thead>
          <tbody>
            ${filteredApplicants.map(renderApplicantRow).join("") || `<tr><td colspan="11">該当する出願者はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#createApplicant").addEventListener("click", openApplicantModal);
  document.querySelector("#refreshApplicants").addEventListener("click", renderApplicants);
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.applicantFilter = button.dataset.filter;
      renderApplicants();
    });
  });
  document.querySelectorAll("[data-next-applicant]").forEach((button) => {
    button.addEventListener("click", () => advanceApplicant(button.dataset.nextApplicant));
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runApplicantAction(button.dataset.action, button.dataset.applicantId, button));
  });
}

function filterButton(key, label, count) {
  const active = state.applicantFilter === key ? "active" : "";
  return `<button class="filter-btn ${active}" data-filter="${key}">${escapeHtml(label)} <span>${count}</span></button>`;
}

function countApplicants(filter) {
  return filterApplicants(state.applicants, filter).length;
}

function filterApplicants(applicants, filter) {
  return applicants.filter((item) => {
    const step = applicantStep(item);
    if (filter === "all") return true;
    if (filter === "needs_sections") return step.action === "sections";
    if (filter === "needs_fee") return step.action === "fee";
    if (filter === "needs_interview") return step.action === "pass";
    if (filter === "needs_notice") return step.action === "notice";
    if (filter === "accepted") return item.status === "合格者" || Boolean(item.acceptance_notice_generated);
    return true;
  });
}

function applicantPriority(item) {
  const step = applicantStep(item);
  if (step.action === "notice") return 0;
  if (step.action === "pass") return 1;
  if (step.action === "fee") return 2;
  if (step.action === "sections") return 3;
  return 4;
}

function sortApplicantsByPriority(items) {
  return [...items].sort((a, b) => {
    const priorityDiff = applicantPriority(a) - applicantPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
}

function renderApplicantRow(item) {
  const step = applicantStep(item);
  return `
    <tr>
      <td>${escapeHtml(item.application_no)}</td>
      <td>${sourceMini(item.source_type, item.source_label)}</td>
      <td>
        <div class="applicant-name">${escapeHtml(item.name)}</div>
        <div class="applicant-sub">${escapeHtml(item.nationality)} / ${escapeHtml(item.desired_study_length)}</div>
      </td>
      <td>${escapeHtml(item.admission_term)}</td>
      <td>${statusBadge(item.status, step.color)}</td>
      <td>${statusMini(`${item.required_complete_count}/${item.required_total_count}`, Number(item.required_complete_count) >= Number(item.required_total_count))}</td>
      <td>${statusMini(item.application_fee_status, item.application_fee_status === "確認済")}</td>
      <td>${statusMini(item.interview_result, item.interview_result === "合格")}</td>
      <td>${statusMini(item.acceptance_notice_generated ? "済" : "未", Boolean(item.acceptance_notice_generated))}</td>
      <td>${statusMini(item.coe_case_exists ? "COE連携済" : "未", Boolean(item.coe_case_exists))}</td>
      <td>
        <button class="btn primary compact" data-next-applicant="${item.id}" ${step.done ? "disabled" : ""}>${escapeHtml(step.button)}</button>
        <button class="btn compact" data-action="acceptance-preview" data-applicant-id="${item.id}" ${item.interview_result === "合格" ? "" : "disabled"}>通知書</button>
        <button class="btn compact" data-action="acceptance-export" data-applicant-id="${item.id}" ${item.interview_result === "合格" ? "" : "disabled"}>帳票出力</button>
        <button class="btn compact" data-action="sections" data-applicant-id="${item.id}">詳細を見る</button>
      </td>
    </tr>
  `;
}

function sourceMini(sourceType, sourceLabel) {
  const labelMap = {
    staff: "事務局",
    student_portal: "学生",
    excel_import: "Excel",
  };
  const label = labelMap[sourceType] || "受付";
  return `
    <div class="source-cell">
      <span class="mini-status ${sourceType === "student_portal" ? "ok" : "todo"}">${escapeHtml(label)}</span>
      <div class="applicant-sub">${escapeHtml(sourceLabel || "-")}</div>
    </div>
  `;
}

function statusMini(text, ok) {
  const label = String(text || "-");
  if (label === "差戻し") return `<span class="mini-status neutral">${escapeHtml(label)}</span>`;
  if (label === "欠席") return `<span class="mini-status danger">${escapeHtml(label)}</span>`;
  return `<span class="mini-status ${ok ? "ok" : "todo"}">${escapeHtml(label)}</span>`;
}

function renderApplicantCard(item) {
  const step = applicantStep(item);
  return `
    <article class="workflow-card">
      <div class="workflow-head">
        <div>
          <div class="kicker">${escapeHtml(item.application_no)}</div>
          <h2>${escapeHtml(item.name)}</h2>
          <p>${escapeHtml(item.nationality)} / ${escapeHtml(item.admission_term)} / ${escapeHtml(item.desired_study_length)}</p>
        </div>
        ${badge(item.status, step.color)}
      </div>

      <div class="stepper">
        ${stepPill("申請", true)}
        ${stepPill("選考料", item.application_fee_status === "確認済")}
        ${stepPill("面接合格", item.interview_result === "合格")}
        ${stepPill("合格通知", Boolean(item.acceptance_notice_generated))}
        ${stepPill("合格者", item.status === "合格者")}
      </div>

      <div class="info-list">
        <div><span>必須情報</span><strong>${escapeHtml(item.required_complete_count)}/${escapeHtml(item.required_total_count)}</strong></div>
        <div><span>選考料</span><strong>${escapeHtml(item.application_fee_status)}</strong></div>
        <div><span>面接結果</span><strong>${escapeHtml(item.interview_result)}</strong></div>
      </div>

      <div class="next-box">
        <div>
          <strong>${escapeHtml(step.label)}</strong>
          <p>${escapeHtml(step.help)}</p>
        </div>
        <button class="btn primary" data-next-applicant="${item.id}" ${step.done ? "disabled" : ""}>${escapeHtml(step.button)}</button>
      </div>

      <div class="secondary-actions">
        <button class="btn" data-action="sections" data-applicant-id="${item.id}">必須情報</button>
        <button class="btn" data-action="fee" data-applicant-id="${item.id}">選考料</button>
        <button class="btn" data-action="pass" data-applicant-id="${item.id}">合格</button>
        <button class="btn" data-action="notice" data-applicant-id="${item.id}">通知書</button>
      </div>
    </article>
  `;
}

function stepPill(label, active) {
  return `<span class="step-pill ${active ? "done" : ""}">${escapeHtml(label)}</span>`;
}

function applicantStep(item) {
  if (Number(item.required_complete_count) < Number(item.required_total_count)) {
    return {
      label: "次に面接申請の必須情報を確認します",
      help: "入学時期、個人情報、学歴、申請歴、経費支弁者情報を確認してください。",
      button: "必須情報を確認",
      color: "yellow",
      action: "sections",
    };
  }
  if (item.application_fee_status !== "確認済") {
    return {
      label: "次に選考料を確認します",
      help: "固定 20,000 円。エージェントがある場合は表示名にエージェント名を使います。",
      button: "選考料を確認",
      color: "yellow",
      action: "fee",
    };
  }
  if (item.interview_result !== "合格") {
    return {
      label: "次に面接結果を登録します",
      help: "この簡易版ではまず合格フローを進められます。保留・再面接・不合格の詳細画面は次に作ります。",
      button: "合格にする",
      color: "yellow",
      action: "pass",
    };
  }
  if (!item.acceptance_notice_generated) {
    return {
      label: "次に合格通知書を生成します",
      help: "校舎別テンプレートの履歴を残す前提で、まず生成記録を作成します。",
      button: "合格通知書を生成",
      color: "blue",
      action: "notice",
    };
  }
  if (item.status === "合格者" || item.acceptance_notice_generated) {
    return {
      label: "合格者として COE 進行へ連携済みです",
      help: "以降の作業は COE進行 で管理します。",
      button: "完了",
      color: "green",
      done: true,
    };
  }
  return {
    label: "合格通知後に合格者へ移動します",
    help: "合格通知書を出した学生は自動で COE進行へ連携されます。",
    button: "完了",
    color: "green",
    done: true,
  };
}

function advanceApplicant(id) {
  const applicant = state.applicants.find((item) => item.id === id);
  if (!applicant) return;
  const step = applicantStep(applicant);
  if (!step.action) return;
  runApplicantAction(step.action, id);
}

async function runApplicantAction(action, id, button) {
  if (action === "sections") return openRequiredSectionsModal(id);
  if (action === "acceptance-preview") return openAcceptancePreview(id);
  if (action === "acceptance-export") return exportAcceptanceNotice(id, button);
  if (action === "fee") return createApplicationFee(id, button);
  if (action === "pass") return setInterviewPassed(id, button);
  if (action === "notice") return generateAcceptanceNotice(id, button);
  if (action === "coe") return createCoeCase(id, button);
}

async function openAcceptancePreview(id) {
  try {
    const preview = await api(`/api/applicants/${id}/acceptance-preview`);
    const fields = preview.fields;
    const template = preview.template;
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>合格通知書プレビュー</h2>
            <p>${escapeHtml(template?.name || "テンプレート未設定")} / ${escapeHtml(fields.template_status)}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <div class="card-body preview-grid">
          <div class="preview-sheet">
            <div class="preview-head">
              <strong>合格通知書</strong>
              <span>${escapeHtml(fields.document_no)}</span>
            </div>
            <div class="preview-row"><span>発行日</span><strong>${escapeHtml(fields.issue_date)}</strong></div>
            <div class="preview-row"><span>校舎</span><strong>${escapeHtml(fields.campus_name)}</strong></div>
            <div class="preview-row"><span>氏名</span><strong>${escapeHtml(fields.student_name)}</strong></div>
            <div class="preview-row"><span>入学期</span><strong>${escapeHtml(fields.admission_term)}</strong></div>
            <div class="preview-row"><span>在学予定</span><strong>${escapeHtml(fields.study_length)}</strong></div>
            <div class="preview-row"><span>エージェント</span><strong>${escapeHtml(fields.agent_name || "-")}</strong></div>
            <div class="preview-note">${escapeHtml(fields.message)}</div>
          </div>
          <div class="preview-meta">
            <div class="form-note">この版では通知書の票面項目を確認できます。校舎別の実テンプレート差し込みは次段階で接続します。</div>
          </div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
  } catch (error) {
    showError(error);
  }
}

async function exportAcceptanceNotice(id, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api(`/api/applicants/${id}/acceptance-export`);
    window.location.href = result.url;
    toast("合格通知書ファイルを出力しました。");
    renderApplicants();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function openRequiredSectionsModal(id) {
  const applicant = state.applicants.find((item) => item.id === id);
  if (!applicant) return;
  try {
    const sections = await api(`/api/applicants/${id}/sections`);
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>面接申請 必須情報チェック</h2>
            <p>${escapeHtml(applicant.name)} / ${escapeHtml(applicant.application_no)}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <form id="sectionForm" class="section-checklist">
          ${sections.map((section) => `
            <label class="section-check">
              <input type="checkbox" name="section" value="${escapeHtml(section.section_key)}" ${section.completed ? "checked" : ""}>
              <span>
                <strong>${escapeHtml(section.label)}</strong>
                <small>${section.completed ? "確認済み" : "未確認"}</small>
              </span>
            </label>
          `).join("")}
          <div class="form-note">
            この簡易版では区分単位の確認です。次の版で各区分の詳細入力欄を追加します。
          </div>
          <div class="form-actions">
            <button class="btn" type="button" id="cancelModal">キャンセル</button>
            <button class="btn primary" type="submit">保存する</button>
          </div>
        </form>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
    document.querySelector("#cancelModal").addEventListener("click", closeModal);
    document.querySelector("#sectionForm").addEventListener("submit", (event) => submitRequiredSections(event, id));
  } catch (error) {
    showError(error);
  }
}

async function submitRequiredSections(event, id) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const completedSections = form.getAll("section");
  try {
    await api(`/api/applicants/${id}/sections`, {
      method: "POST",
      body: JSON.stringify({ completed_sections: completedSections }),
    });
    closeModal();
    toast("必須情報チェックを保存しました。");
    renderApplicants();
  } catch (error) {
    showError(error);
  }
}

function openApplicantModal() {
  const modal = document.querySelector("#modalRoot");
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>新規出願者登録</h2>
          <p>まずは面接申請に必要な最小情報を登録します。</p>
        </div>
        <button class="btn" id="closeModal">閉じる</button>
      </div>
      <form id="applicantForm" class="form-grid">
        <label>
          氏名（英字）
          <input name="name" value="ZHANG WEI" required>
        </label>
        <label>
          国籍・地域
          <input name="nationality" value="中国" required>
        </label>
        <label>
          入学時期
          <select name="admission_term" required>
            <option>2026年7月期</option>
            <option selected>2026年10月期</option>
            <option>2027年1月期</option>
            <option>2027年4月期</option>
            <option>短期随時</option>
          </select>
        </label>
        <label>
          語学学校滞在予定期間
          <select name="desired_study_length" required>
            <option>6か月</option>
            <option>1年</option>
            <option selected>1年6か月</option>
            <option>2年</option>
          </select>
        </label>
        <label class="full">
          エージェント名
          <input name="agent_name" value="テストエージェント">
        </label>
        <div class="form-note full">
          詳細な個人情報、学歴、申請歴、経費支弁者情報は次の詳細画面で追加する想定です。
        </div>
        <div class="form-actions full">
          <button class="btn" type="button" id="cancelModal">キャンセル</button>
          <button class="btn primary" type="submit">登録する</button>
        </div>
      </form>
    </div>
  `;
  modal.classList.remove("hidden");
  document.querySelector("#closeModal").addEventListener("click", closeModal);
  document.querySelector("#cancelModal").addEventListener("click", closeModal);
  document.querySelector("#applicantForm").addEventListener("submit", submitApplicantForm);
}

function closeModal() {
  const modal = document.querySelector("#modalRoot");
  modal.classList.add("hidden");
  modal.innerHTML = "";
}

async function submitApplicantForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  try {
    await api("/api/applicants", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeModal();
    toast("出願者を登録しました。");
    showView("applicants");
  } catch (error) {
    showError(error);
  }
}

async function createApplicationFee(id, button) {
  const restore = setButtonLoading(button, "確認中...");
  try {
    const result = await api(`/api/applicants/${id}/application-fee`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast(`選考料 ${yen(result.amount)} を確認しました。`);
    renderApplicants();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function setInterviewPassed(id, button) {
  const restore = setButtonLoading(button, "更新中...");
  try {
    await api(`/api/applicants/${id}/interview-result`, {
      method: "POST",
      body: JSON.stringify({ result: "合格" }),
    });
    toast("面接結果を合格にしました。");
    renderApplicants();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function generateAcceptanceNotice(id, button) {
  const restore = setButtonLoading(button, "生成中...");
  try {
    const result = await api(`/api/applicants/${id}/acceptance-notice`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast(`合格通知書 ${result.document_no} を生成しました。`);
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    renderApplicants();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function createCoeCase(id, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    await api(`/api/applicants/${id}/coe-case`, {
      method: "POST",
      body: JSON.stringify({ deadline: "2026-06-20" }),
    });
    toast("COE案件を作成しました。");
    renderApplicants();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function renderCoe() {
  await refreshCoreData();
  const filteredCases = sortCoeCasesByPriority(filterCoeCases(state.coeCases, state.coeFilter));
  const coeQueue = {
    materials: countCoeCases("materials"),
    ai: countCoeCases("ai"),
    fixing: countCoeCases("fixing"),
    submit: countCoeCases("submit"),
    waiting: countCoeCases("waiting"),
    tuition: countCoeCases("tuition"),
    done: countCoeCases("done"),
  };
  document.querySelector("#coe").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として COE 案件を確認中`,
      "資料回収、AI修正、入管提出、COE送付条件を一列で見ます。案件は提出に近いものと詰まりやすいものが上に来るように並べています。",
      [
        { label: `修正中 ${coeQueue.fixing}`, color: coeQueue.fixing ? "yellow" : "green" },
        { label: `提出待ち ${coeQueue.submit}`, color: coeQueue.submit ? "blue" : "gray" },
        { label: `学費待ち ${coeQueue.tuition}`, color: coeQueue.tuition ? "yellow" : "green" },
      ],
    )}
    <div class="quick-actions">
      <button class="btn" id="refreshCoe">最新状態に更新</button>
    </div>
    <div class="filter-tabs">
      ${coeFilterButton("all", "すべて", state.coeCases.length)}
      ${coeFilterButton("materials", "資料待ち", countCoeCases("materials"))}
      ${coeFilterButton("ai", "AI未実行", countCoeCases("ai"))}
      ${coeFilterButton("fixing", "修正中", countCoeCases("fixing"))}
      ${coeFilterButton("submit", "入管提出待ち", countCoeCases("submit"))}
      ${coeFilterButton("waiting", "COE交付待ち", countCoeCases("waiting"))}
      ${coeFilterButton("tuition", "学費待ち", countCoeCases("tuition"))}
      ${coeFilterButton("done", "完了", countCoeCases("done"))}
    </div>
    <div class="card">
      ${tableSectionHead(
        "COE案件一覧",
        "提出に近い案件、差戻しで止まりやすい案件を上から優先して並べています。",
        [
          summaryPill("表示中", `${filteredCases.length} / ${state.coeCases.length}`, "blue"),
          summaryPill("資料待ち", coeQueue.materials, coeQueue.materials ? "yellow" : "gray"),
          summaryPill("完了", coeQueue.done, coeQueue.done ? "green" : "gray"),
        ],
        `<span class="table-section-hint">AI・提出・学費の詰まりをここで追えます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table coe-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>入学期</th>
              <th>期限</th>
              <th>段階</th>
              <th>資料</th>
              <th>AI</th>
              <th>未確認</th>
              <th>入管提出</th>
              <th>COE</th>
              <th>学費</th>
              <th>次アクション</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCases.map(renderCoeRow).join("") || `<tr><td colspan="11">該当する COE 案件はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#refreshCoe").addEventListener("click", renderCoe);
  document.querySelectorAll("[data-coe-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.coeFilter = button.dataset.coeFilter;
      renderCoe();
    });
  });
  document.querySelectorAll("[data-ai]").forEach((button) => {
    button.addEventListener("click", () => runAiCheck(button.dataset.ai));
  });
  document.querySelectorAll("[data-materials]").forEach((button) => {
    button.addEventListener("click", () => openCoeMaterialsModal(button.dataset.materials));
  });
  document.querySelectorAll("[data-full]").forEach((button) => {
    button.addEventListener("click", () => sendFullCoe(button.dataset.full));
  });
  document.querySelectorAll("[data-issues]").forEach((button) => {
    button.addEventListener("click", () => openAiIssuesModal(button.dataset.issues));
  });
  document.querySelectorAll("[data-submit-immigration]").forEach((button) => {
    button.addEventListener("click", () => submitImmigration(button.dataset.submitImmigration));
  });
}

function coeFilterButton(key, label, count) {
  const active = state.coeFilter === key ? "active" : "";
  return `<button class="filter-btn ${active}" data-coe-filter="${key}">${escapeHtml(label)} <span>${count}</span></button>`;
}

function countCoeCases(filter) {
  return filterCoeCases(state.coeCases, filter).length;
}

function filterCoeCases(cases, filter) {
  return cases.filter((item) => {
    const status = coeCaseStatus(item);
    if (filter === "all") return true;
    return status.key === filter;
  });
}

function coePriority(item) {
  const status = coeCaseStatus(item).key;
  if (status === "submit") return 0;
  if (status === "fixing") return 1;
  if (status === "ai") return 2;
  if (status === "materials") return 3;
  if (status === "tuition") return 4;
  if (status === "waiting") return 5;
  if (status === "done") return 6;
  return 7;
}

function sortCoeCasesByPriority(items) {
  return [...items].sort((a, b) => {
    const priorityDiff = coePriority(a) - coePriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.deadline || "").localeCompare(String(b.deadline || ""));
  });
}

function coeCaseStatus(item) {
  const materialsComplete = Number(item.material_complete_count) >= Number(item.material_total_count);
  const aiDone = item.ai_check_status !== "未実行";
  const hasOpenIssues = Number(item.open_issue_count) > 0;
  const submitted = item.stage.includes("入管提出");
  const waitingCoe = item.stage.includes("COE交付待ち");
  if (item.full_coe_sent) return { key: "done", label: "完了", color: "green" };
  if (!materialsComplete) return { key: "materials", label: "資料待ち", color: "yellow" };
  if (!aiDone) return { key: "ai", label: "AI未実行", color: "yellow" };
  if (hasOpenIssues) return { key: "fixing", label: "修正中", color: "red" };
  if (!submitted) return { key: "submit", label: "入管提出待ち", color: "blue" };
  if (waitingCoe && !item.partial_coe_sent) return { key: "waiting", label: "COE交付待ち", color: "blue" };
  if (!item.full_tuition_confirmed || !item.receipt_issued) return { key: "tuition", label: "学費待ち", color: "yellow" };
  return { key: "done", label: "完了", color: "green" };
}

function renderCoeRow(item) {
  const materialsComplete = Number(item.material_complete_count) >= Number(item.material_total_count);
  const aiDone = item.ai_check_status !== "未実行";
  const hasOpenIssues = Number(item.open_issue_count) > 0;
  const readyToSubmit = materialsComplete && aiDone && !hasOpenIssues && !item.stage.includes("入管提出");
  const waitingCoe = item.stage.includes("COE交付待ち");
  const canSendFull = item.full_tuition_confirmed && item.receipt_issued && !item.full_coe_sent && !waitingCoe;
  const next = coeNextAction({ item, materialsComplete, aiDone, hasOpenIssues, readyToSubmit, waitingCoe, canSendFull });
  const status = coeCaseStatus(item);
  return `
    <tr>
      <td>
        <div class="applicant-name">${escapeHtml(item.applicant_name)}</div>
        <div class="applicant-sub">${escapeHtml(item.agent_name || "エージェントなし")}</div>
      </td>
      <td>${escapeHtml(item.admission_term)}</td>
      <td>${escapeHtml(item.deadline)}</td>
      <td>${statusBadge(status.label, status.color)}</td>
      <td>${statusMini(`${item.material_complete_count}/${item.material_total_count}`, materialsComplete)}</td>
      <td>${statusMini(item.ai_check_status, aiDone && !hasOpenIssues)}</td>
      <td>${statusMini(`${item.open_issue_count || 0}件`, !hasOpenIssues)}</td>
      <td>${statusMini(item.stage.includes("入管提出") ? "済" : "未", item.stage.includes("入管提出"))}</td>
      <td>${statusMini(item.partial_coe_sent ? "下付済" : "未", Boolean(item.partial_coe_sent))}</td>
      <td>${statusMini(item.full_tuition_confirmed && item.receipt_issued ? "確認済" : "未", Boolean(item.full_tuition_confirmed && item.receipt_issued))}</td>
      <td>
        ${next.button.replace("btn primary", "btn primary compact").replace("btn warn", "btn warn compact")}
        <button class="btn compact" data-materials="${item.id}">資料確認</button>
        <button class="btn compact" data-issues="${item.id}">AI確認</button>
      </td>
    </tr>
  `;
}

function renderCoeCard(item) {
  const canSendFull = item.full_tuition_confirmed && item.receipt_issued && !item.full_coe_sent;
  const materialsComplete = Number(item.material_complete_count) >= Number(item.material_total_count);
  const aiDone = item.ai_check_status !== "未実行";
  const hasOpenIssues = Number(item.open_issue_count) > 0;
  const readyToSubmit = materialsComplete && aiDone && !hasOpenIssues && !item.stage.includes("入管提出");
  const waitingCoe = item.stage.includes("COE交付待ち");
  const next = coeNextAction({ item, materialsComplete, aiDone, hasOpenIssues, readyToSubmit, waitingCoe, canSendFull });
  return `
    <article class="workflow-card">
      <div class="workflow-head">
        <div>
          <div class="kicker">${escapeHtml(item.admission_term)}</div>
          <h2>${escapeHtml(item.applicant_name)}</h2>
          <p>期限 ${escapeHtml(item.deadline)} / エージェント ${escapeHtml(item.agent_name || "なし")}</p>
        </div>
        ${badge(item.stage, "blue")}
      </div>
      <div class="stepper coe-stepper">
        ${stepPill("資料回収", materialsComplete)}
        ${stepPill("AI確認", aiDone && !hasOpenIssues)}
        ${stepPill("入管提出", item.stage.includes("入管提出"))}
        ${stepPill("COE交付", Boolean(item.partial_coe_sent))}
        ${stepPill("学費確認", Boolean(item.full_tuition_confirmed))}
      </div>
      <div class="info-list">
        <div><span>申請資料</span><strong>${escapeHtml(item.material_complete_count)}/${escapeHtml(item.material_total_count)}</strong></div>
        <div><span>AIチェック</span><strong>${escapeHtml(item.ai_check_status)}</strong></div>
        <div><span>未確認項目</span><strong>${escapeHtml(item.open_issue_count || 0)} 件</strong></div>
        <div><span>COE一部</span><strong>${item.partial_coe_sent ? "送付済" : "未送付"}</strong></div>
        <div><span>COE全体</span><strong>${item.full_coe_sent ? "送付済" : "未送付"}</strong></div>
        <div><span>学費全額</span><strong>${item.full_tuition_confirmed ? "確認済" : "未確認"}</strong></div>
        <div><span>領収書</span><strong>${item.receipt_issued ? "発行済" : "未発行"}</strong></div>
      </div>
      <div class="next-box">
        <div>
          <strong>${escapeHtml(next.label)}</strong>
          <p>${escapeHtml(next.help)}</p>
        </div>
        ${next.button}
      </div>
      <div class="secondary-actions">
        <button class="btn" data-materials="${item.id}">資料確認</button>
        <button class="btn" data-ai="${item.id}">AIチェック実行</button>
        <button class="btn" data-issues="${item.id}">AI結果確認</button>
        <button class="btn" data-submit-immigration="${item.id}">入管提出</button>
      </div>
    </article>
  `;
}

function coeNextAction({ item, materialsComplete, aiDone, hasOpenIssues, readyToSubmit, waitingCoe, canSendFull }) {
  if (!materialsComplete) {
    return {
      label: "次に COE 申請資料を確認します",
      help: "願書、パスポート、卒業証明書、経費支弁者資料などを回収・確認してください。",
      button: `<button class="btn primary" data-materials="${item.id}">資料を確認</button>`,
    };
  }
  if (!aiDone) {
    return {
      label: "次に AI チェックを実行します",
      help: "資料がそろいました。提出前の整合性チェックを実行できます。",
      button: `<button class="btn primary" data-ai="${item.id}">AIチェック実行</button>`,
    };
  }
  if (hasOpenIssues) {
    return {
      label: "AIチェック結果を修正・確認します",
      help: "Error / Warning を資料修正後に staff が確認してください。",
      button: `<button class="btn primary" data-issues="${item.id}">AI結果を確認</button>`,
    };
  }
  if (readyToSubmit) {
    const allowed = can("immigration_submit");
    return {
      label: allowed ? "入管へ提出できます" : "入管担当の確認が必要です",
      help: allowed ? "AIチェック項目は確認済みです。提出記録を作成します。" : "提出記録の作成は入管担当または manager が行います。",
      button: `<button class="btn primary" data-submit-immigration="${item.id}" ${allowed ? "" : "disabled"}>入管提出済みにする</button>`,
    };
  }
  if (waitingCoe) {
    return {
      label: "COE交付待ちです",
      help: "入管提出済みです。COE下付後に交付情報を登録します。",
      button: `<button class="btn warn" disabled>COE全体送付</button>`,
    };
  }
  return {
    label: canSendFull ? "COE全体を送付できます" : "COE全体送付の条件確認",
    help: canSendFull ? "全額入金と領収書発行が完了しています。" : "全額入金と領収書発行が完了するまで、COE全体は送付できません。",
    button: `<button class="btn warn" data-full="${item.id}" ${item.full_coe_sent ? "disabled" : ""}>COE全体送付</button>`,
  };
}

async function openCoeMaterialsModal(id) {
  const coeCase = state.coeCases.find((item) => item.id === id);
  if (!coeCase) return;
  try {
    const materials = await api(`/api/coe-cases/${id}/materials`);
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>COE申請資料チェック</h2>
            <p>${escapeHtml(coeCase.applicant_name)} / ${escapeHtml(coeCase.admission_term)}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <form id="coeMaterialForm" class="section-checklist">
          ${materials.map((material) => `
            <label class="section-check">
              <input type="checkbox" name="material" value="${escapeHtml(material.material_key)}" ${material.collected && material.checked ? "checked" : ""}>
              <span>
                <strong>${escapeHtml(material.label)}</strong>
                <small>${material.collected && material.checked ? "回収・確認済み" : "未確認"}</small>
              </span>
            </label>
          `).join("")}
          <div class="form-note">
            ここでは「回収済み」と「スタッフ確認済み」を同時に扱います。次の版でファイル添付と個別確認者を追加します。
          </div>
          <div class="form-actions">
            <button class="btn" type="button" id="cancelModal">キャンセル</button>
            <button class="btn primary" type="submit">保存する</button>
          </div>
        </form>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
    document.querySelector("#cancelModal").addEventListener("click", closeModal);
    document.querySelector("#coeMaterialForm").addEventListener("submit", (event) => submitCoeMaterials(event, id));
  } catch (error) {
    showError(error);
  }
}

async function submitCoeMaterials(event, id) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const completedMaterials = form.getAll("material");
  try {
    await api(`/api/coe-cases/${id}/materials`, {
      method: "POST",
      body: JSON.stringify({ completed_materials: completedMaterials }),
    });
    closeModal();
    toast("COE申請資料チェックを保存しました。");
    renderCoe();
  } catch (error) {
    showError(error);
  }
}

async function runAiCheck(id) {
  try {
    const result = await api(`/api/coe-cases/${id}/ai-check`, { method: "POST", body: "{}" });
    toast(`AIチェック完了: Error ${result.summary.errors} / Warning ${result.summary.warnings}`);
    renderCoe();
  } catch (error) {
    showError(error);
  }
}

async function openAiIssuesModal(id) {
  const coeCase = state.coeCases.find((item) => item.id === id);
  if (!coeCase) return;
  try {
    const issues = await api(`/api/coe-cases/${id}/ai-issues`);
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>AIチェック結果確認</h2>
            <p>${escapeHtml(coeCase.applicant_name)} / 修正後に staff が確認します。</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <div class="section-checklist">
          ${issues.length ? issues.map((issue) => `
            <div class="issue-row">
              ${badge(issue.severity === "error" ? "Error" : "Warning", issue.severity === "error" ? "red" : "yellow")}
              <div>
                <strong>${escapeHtml(issue.field)}</strong>
                <p>${escapeHtml(issue.message)}</p>
                <small>${issue.status === "resolved" ? `確認済み: ${escapeHtml(issue.resolution_note || "")}` : "未確認"}</small>
              </div>
              <button class="btn primary" data-resolve-issue="${issue.id}" ${issue.status === "resolved" ? "disabled" : ""}>修正確認済み</button>
            </div>
          `).join("") : emptyState("AIチェック結果はまだありません。")}
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
    document.querySelectorAll("[data-resolve-issue]").forEach((button) => {
      button.addEventListener("click", () => resolveAiIssue(button.dataset.resolveIssue, id));
    });
  } catch (error) {
    showError(error);
  }
}

async function resolveAiIssue(issueId, coeId) {
  try {
    await api(`/api/ai-issues/${issueId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution_note: "資料修正・staff確認済み" }),
    });
    toast("AIチェック項目を確認済みにしました。");
    closeModal();
    await renderCoe();
    openAiIssuesModal(coeId);
  } catch (error) {
    showError(error);
  }
}

async function submitImmigration(id) {
  try {
    const result = await api(`/api/coe-cases/${id}/submit-immigration`, { method: "POST", body: "{}" });
    toast(result.stage);
    renderCoe();
  } catch (error) {
    showError(error);
  }
}

async function sendFullCoe(id) {
  try {
    const result = await api(`/api/coe-cases/${id}/send-full-coe`, { method: "POST", body: "{}" });
    toast(result.message);
    renderCoe();
  } catch (error) {
    showError(error);
  }
}

async function renderPayments() {
  const [payments, receiptConfig] = await Promise.all([api("/api/payments"), api("/api/receipt-config")]);
  const activeTemplate = receiptConfig.active_template;
  const canIssueReceipts = can("receipt_issue");
  document.querySelector("#payments").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として入金・領収書を確認中`,
      "入金確認後に領収書を発行し、COE送付のブロックが解消されているかをここで確認します。",
      [
        { label: `未発行 ${payments.filter((item) => item.status === "confirmed" && !item.receipt_issued).length}`, color: payments.filter((item) => item.status === "confirmed" && !item.receipt_issued).length ? "yellow" : "green" },
        { label: `発行済 ${payments.filter((item) => item.receipt_issued).length}`, color: "blue" },
        { label: canIssueReceipts ? "発行できます" : "閲覧のみ", color: canIssueReceipts ? "blue" : "gray" },
      ],
    )}
    <div class="grid two" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">領収書テンプレート</div>
          ${badge(activeTemplate ? "使用中" : "未設定", activeTemplate ? "green" : "yellow")}
        </div>
        <div class="card-body template-summary">
          ${activeTemplate ? `
            <div class="info-list single">
              <div><span>テンプレート名</span><strong>${escapeHtml(activeTemplate.name)}</strong></div>
              <div><span>校舎</span><strong>${escapeHtml(activeTemplate.campus_name || "-")}</strong></div>
              <div><span>形式</span><strong>${escapeHtml(String(activeTemplate.file_format || "").toUpperCase())}</strong></div>
            </div>
            <div class="form-note">${escapeHtml(activeTemplate.notes)}</div>
            <div class="template-path">${escapeHtml(activeTemplate.source_path)}</div>
          ` : `<div class="empty-state">領収書テンプレートがまだ設定されていません。</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">帳票運用状況</div></div>
        <div class="card-body">
          <div class="checkline">登録テンプレート数: ${escapeHtml(receiptConfig.template_count)} 件</div>
          <div class="checkline">発行済み領収書: ${escapeHtml(receiptConfig.issued_count)} 件</div>
          <div class="checkline">票面データは保存済み。xls 原本のため xlsx 化後にセル差し込みを接続します。</div>
          ${permissionBadge("receipt_issue", "領収書の発行は staff / 入管担当 / manager のみ実行できます。")}
        </div>
      </div>
    </div>
    <div class="card">
      ${tableSectionHead(
        "入金・領収書一覧",
        "入金確認、領収書の発行、再出力までをこの表でまとめて行います。",
        [
          summaryPill("確認済", payments.filter((item) => item.status === "confirmed").length, "blue"),
          summaryPill("未発行", payments.filter((item) => item.status === "confirmed" && !item.receipt_issued).length, payments.filter((item) => item.status === "confirmed" && !item.receipt_issued).length ? "yellow" : "gray"),
          summaryPill("発行済", payments.filter((item) => item.receipt_issued).length, "green"),
        ],
        `<span class="table-section-hint">未発行の領収書は COE 全体送付のブロック要因になります</span>`,
      )}
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>区分</th><th>金額</th><th>表示名</th><th>状態</th><th>領収書</th><th>操作</th></tr></thead>
          <tbody>
            ${payments.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml(item.payment_type)}</div>
                  <div class="table-secondary">${escapeHtml(item.admission_term || "入学期未設定")}</div>
                </td>
                <td>
                  <div class="table-primary">${yen(item.amount)}</div>
                  <div class="table-secondary">${escapeHtml(item.currency || "JPY")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.payer_display_name)}</div>
                  <div class="table-secondary">${escapeHtml(item.payer_type || "学生")}</div>
                </td>
                <td>
                  ${statusBadge(item.status === "confirmed" ? "確認済" : item.status, "green")}
                  <div class="table-secondary">${item.status === "confirmed" ? "入金確認済み" : "確認待ち"}</div>
                </td>
                <td>
                  <div class="table-chip-stack">
                    ${item.receipt_issued ? badge(item.receipt_no, "green") : statusBadge("未発行")}
                  </div>
                  <div class="table-secondary">${escapeHtml(item.receipt_issue_date || "発行日未登録")}</div>
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-receipt-preview="${item.id}">内容確認</button>
                    <button class="btn compact" data-receipt-export="${item.id}" ${item.receipt_issued ? "" : "disabled"}>帳票出力</button>
                    <button class="btn primary compact" ${(item.receipt_issued || !canIssueReceipts) ? "disabled" : ""} data-receipt="${item.id}">領収書発行</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelectorAll("[data-receipt-preview]").forEach((button) => {
    button.addEventListener("click", () => openReceiptPreview(button.dataset.receiptPreview));
  });
  document.querySelectorAll("[data-receipt-export]").forEach((button) => {
    button.addEventListener("click", () => exportReceipt(button.dataset.receiptExport, button));
  });
  document.querySelectorAll("[data-receipt]").forEach((button) => {
    button.addEventListener("click", () => issueReceipt(button.dataset.receipt, button));
  });
}

async function openReceiptPreview(id) {
  try {
    const preview = await api(`/api/payments/${id}/receipt-preview`);
    const fields = preview.fields;
    const template = preview.template;
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>領収書プレビュー</h2>
            <p>${escapeHtml(template?.name || "テンプレート未設定")} / ${escapeHtml(fields.template_status)}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <div class="card-body preview-grid">
          <div class="preview-sheet">
            <div class="preview-head">
              <strong>領収書</strong>
              <span>${escapeHtml(fields.receipt_no)}</span>
            </div>
            <div class="preview-row"><span>発行日</span><strong>${escapeHtml(fields.issue_date)}</strong></div>
            <div class="preview-row"><span>校舎</span><strong>${escapeHtml(fields.campus_name)}</strong></div>
            <div class="preview-row"><span>宛名</span><strong>${escapeHtml(fields.payer_display_name)}</strong></div>
            <div class="preview-row"><span>学生名</span><strong>${escapeHtml(fields.student_name)}</strong></div>
            <div class="preview-row"><span>入学期</span><strong>${escapeHtml(fields.admission_term)}</strong></div>
            <div class="preview-row"><span>区分</span><strong>${escapeHtml(fields.payment_type)}</strong></div>
            <div class="preview-row total"><span>金額</span><strong>${yen(fields.amount)}</strong></div>
            <div class="preview-note">${escapeHtml(fields.line_note)}</div>
          </div>
          <div class="preview-meta">
            <div class="form-note">この版では票面項目を確定できます。実ファイルへの差し込みは xlsx テンプレート接続後に行います。</div>
            ${template ? `<div class="template-path">${escapeHtml(template.source_path)}</div>` : ""}
          </div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
  } catch (error) {
    showError(error);
  }
}

async function issueReceipt(id, button) {
  const restore = setButtonLoading(button, "発行中...");
  try {
    const result = await api(`/api/payments/${id}/receipt`, { method: "POST", body: "{}" });
    toast(`領収書 ${result.receipt_no} を発行しました。`);
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    renderPayments();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportReceipt(id, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api(`/api/payments/${id}/receipt-export`);
    window.location.href = result.url;
    toast(`領収書ファイルを出力しました。`);
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function renderStudents() {
  const [students, withdrawalConfig, attendanceSessions] = await Promise.all([
    api("/api/students"),
    api("/api/withdrawal-config"),
    api("/api/attendance-checkin-sessions"),
  ]);
  const activeTemplate = withdrawalConfig.active_template;
  const residenceDue = students.filter((item) => Number(item.days_to_expiry) <= 90).length;
  const attendanceWarning = students.filter((item) => Number(item.attendance_rate) < 80).length;
  const qrSummary = attendanceSessions.summary || {};
  const qrSessions = attendanceSessions.sessions || [];
  const activeQrSessions = qrSessions.filter((item) => item.status === "active");
  const activeMissingCount = activeQrSessions.reduce((sum, item) => sum + Number(item.missing_student_count || 0), 0);
  const checkedOutToday = qrSessions.reduce((sum, item) => sum + Number(item.checked_out_count || 0), 0);
  const activeSessionDetails = (
    await Promise.all(
      activeQrSessions.map(async (item) => {
        try {
          const detail = await api(`/api/attendance-checkin-sessions/${item.id}`);
          return detail?.ok ? detail : null;
        } catch (_error) {
          return null;
        }
      }),
    )
  ).filter(Boolean);
  const attendanceMissingAlerts = activeSessionDetails.flatMap((detail) =>
    (detail.missing_students || []).map((student) => ({
      class_date: detail.session?.class_date || "",
      class_name: detail.session?.class_name || "",
      period_label: detail.session?.period_label || "",
      student_no: student.student_no || "",
      name: student.name || "",
    })),
  );
  const lateAlerts = activeSessionDetails.flatMap((detail) =>
    (detail.attendees || [])
      .filter((item) => Number(item.late_minutes || 0) > 0 && item.status === "遅刻")
      .map((item) => ({
        class_name: detail.session?.class_name || "",
        period_label: detail.session?.period_label || "",
        student_no: item.student_no || "",
        name: item.name || "",
        minutes: Number(item.late_minutes || 0),
      })),
  );
  const earlyLeaveAlerts = activeSessionDetails.flatMap((detail) =>
    (detail.attendees || [])
      .filter((item) => Number(item.early_leave_minutes || 0) > 0 && item.status === "早退")
      .map((item) => ({
        class_date: detail.session?.class_date || "",
        class_name: detail.session?.class_name || "",
        period_label: detail.session?.period_label || "",
        student_no: item.student_no || "",
        name: item.name || "",
        minutes: Number(item.early_leave_minutes || 0),
      })),
  );
  const manualAdjustmentAlerts = activeSessionDetails.flatMap((detail) =>
    (detail.manual_updates || []).map((item) => ({
      class_date: detail.session?.class_date || "",
      class_name: detail.session?.class_name || "",
      period_label: detail.session?.period_label || "",
      student_no: item.student_no || "",
      name: item.name || "",
      status: item.status || "",
      note: item.note || "",
      late_minutes: Number(item.late_minutes || 0),
      early_leave_minutes: Number(item.early_leave_minutes || 0),
    })),
  );
  const studentClasses = [...new Set(students.map((item) => item.class_name).filter(Boolean))];
  const today = new Date().toISOString().slice(0, 10);
  const canManageAttendanceSession = can("attendance_session_manage");
  const canEditStudents = can("student_edit");
  document.querySelector("#students").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として在籍管理を確認中`,
      "在留期限・出席率・QR出席の今日の運用状況を見ながら、必要な学生だけ主档案へ進む流れです。",
      [
        { label: `要更新 ${residenceDue}名`, color: residenceDue ? "yellow" : "green" },
        { label: `出席注意 ${attendanceWarning}名`, color: attendanceWarning ? "yellow" : "green" },
        { label: canEditStudents ? "主档案を編集できます" : "主档案は閲覧のみ", color: canEditStudents ? "blue" : "gray" },
      ],
    )}
    <div class="grid stats" style="margin-bottom:14px;">
      ${stat("在籍者数", students.length, "現在の在籍学生")}
      ${stat("在留期限90日以内", residenceDue, "更新・確認対象")}
      ${stat("出席率80%未満", attendanceWarning, "面談・報告対象")}
      ${stat("QR出席運用中", qrSummary.active_count || 0, "本日 ${qrSummary.today_count || 0} コマ")}
    </div>
    <div class="grid two" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">在籍管理モニター</div>
          ${badge("在籍運用", "blue")}
        </div>
        <div class="card-body">
          <div class="checkline">在留期限 90 日以内: ${escapeHtml(residenceDue)} 名</div>
          <div class="checkline">出席率 80% 未満: ${escapeHtml(attendanceWarning)} 名</div>
          <div class="checkline">QR 出席の稼働中セッション: ${escapeHtml(qrSummary.active_count || 0)} 件</div>
          <div class="checkline">稼働中セッションの未打刻: ${escapeHtml(activeMissingCount)} 名</div>
          <div class="checkline">本日の退室登録: ${escapeHtml(checkedOutToday)} 件</div>
          <div class="checkline">本日の手動補録: ${escapeHtml(manualAdjustmentAlerts.length)} 件</div>
          <div class="checkline">学生主档案では連絡先・在留情報・証明書・年度結果を追えます。</div>
          ${permissionBadge("student_edit", "学生主档案の更新は staff / 入管担当 / manager のみ実行できます。")}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">授業QR出席</div>
          ${badge("毎コマ運用", "green")}
        </div>
        <div class="card-body">
          <form id="attendanceSessionForm" class="form-grid">
            <label>
              クラス
              <select name="class_name">
                ${studentClasses.map((className) => `<option value="${escapeHtml(className)}">${escapeHtml(className)}</option>`).join("") || `<option value="A-1">A-1</option>`}
              </select>
            </label>
            <label>
              日付
              <input name="class_date" type="date" value="${escapeHtml(today)}" required>
            </label>
            <label>
              時限
              <select name="period_label">
                <option value="1限">1限</option>
                <option value="2限">2限</option>
                <option value="3限">3限</option>
                <option value="4限">4限</option>
                <option value="1-2限" selected>1-2限</option>
                <option value="3-4限">3-4限</option>
                <option value="1-4限">1-4限</option>
              </select>
            </label>
            <label>
              開始
              <input name="start_time" type="time" value="09:10" required>
            </label>
            <label>
              終了
              <input name="end_time" type="time" value="10:40" required>
            </label>
            <label>
              作成者
              <input name="created_by" value="事務局 山田">
            </label>
          <div class="form-actions full">
              <button class="btn primary" type="submit" ${permissionDisabled("attendance_session_manage")}>授業コードを発行</button>
          </div>
          </form>
          <div class="form-note" style="margin-top:10px;">
            発行すると授業コードと学生用リンクが作られます。学生は QR から開くか、コード入力で出席できます。
          </div>
          ${permissionBadge("attendance_session_manage", "QR出席の発行・終了は staff / 入管担当 / manager のみ実行できます。")}
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header"><div class="card-title">離脱届運用状況</div></div>
        <div class="card-body">
          <div class="checkline">登録テンプレート数: ${escapeHtml(withdrawalConfig.template_count)} 件</div>
          <div class="checkline">生成済み離脱届: ${escapeHtml(withdrawalConfig.issued_count)} 件</div>
          <div class="checkline">票面項目はプレビュー可能。xls 原本のため xlsx 化後にセル差し込みを接続します。</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">離脱届テンプレート</div>
          ${badge(activeTemplate ? "使用中" : "未設定", activeTemplate ? "green" : "yellow")}
        </div>
        <div class="card-body template-summary">
          ${activeTemplate ? `
            <div class="info-list single">
              <div><span>テンプレート名</span><strong>${escapeHtml(activeTemplate.name)}</strong></div>
              <div><span>学校名</span><strong>${escapeHtml(activeTemplate.school_name || "-")}</strong></div>
              <div><span>形式</span><strong>${escapeHtml(String(activeTemplate.file_format || "").toUpperCase())}</strong></div>
            </div>
            <div class="form-note">${escapeHtml(activeTemplate.notes)}</div>
            <div class="template-path">${escapeHtml(activeTemplate.source_path)}</div>
          ` : `<div class="empty-state">離脱届テンプレートがまだ設定されていません。</div>`}
        </div>
      </div>
    </div>

    <div class="grid three" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">本日未打刻一覧</div>
          ${badge(`${attendanceMissingAlerts.length}名`, attendanceMissingAlerts.length ? "yellow" : "green")}
        </div>
        <div class="card-body">
          ${attendanceMissingAlerts.length
            ? attendanceMissingAlerts.slice(0, 6).map((item) => `
              <div class="checkline">
                ${escapeHtml(item.student_no)} ${escapeHtml(item.name)}
                <span class="muted-cell">/ ${escapeHtml(item.class_name)} ${escapeHtml(item.period_label)} / ${escapeHtml(item.class_date)}</span>
              </div>
            `).join("")
            : `<div class="checkline">現在、未打刻の学生はいません。</div>`}
          ${attendanceMissingAlerts.length > 6 ? `<div class="form-note">ほか ${attendanceMissingAlerts.length - 6} 名</div>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">本日遅刻一覧</div>
          ${badge(`${lateAlerts.length}名`, lateAlerts.length ? "yellow" : "green")}
        </div>
        <div class="card-body">
          ${lateAlerts.length
            ? lateAlerts.slice(0, 6).map((item) => `
              <div class="checkline">
                ${escapeHtml(item.student_no)} ${escapeHtml(item.name)}
                <span class="muted-cell">/ ${escapeHtml(item.class_name)} ${escapeHtml(item.period_label)} / ${escapeHtml(item.minutes)}分</span>
              </div>
            `).join("")
            : `<div class="checkline">現在、遅刻登録はありません。</div>`}
          ${lateAlerts.length > 6 ? `<div class="form-note">ほか ${lateAlerts.length - 6} 名</div>` : ""}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">本日早退一覧</div>
          ${badge(`${earlyLeaveAlerts.length}名`, earlyLeaveAlerts.length ? "yellow" : "green")}
        </div>
        <div class="card-body">
          ${earlyLeaveAlerts.length
            ? earlyLeaveAlerts.slice(0, 6).map((item) => `
              <div class="checkline">
                ${escapeHtml(item.student_no)} ${escapeHtml(item.name)}
                <span class="muted-cell">/ ${escapeHtml(item.class_name)} ${escapeHtml(item.period_label)} / ${escapeHtml(item.minutes)}分</span>
              </div>
            `).join("")
            : `<div class="checkline">現在、早退登録はありません。</div>`}
          ${earlyLeaveAlerts.length > 6 ? `<div class="form-note">ほか ${earlyLeaveAlerts.length - 6} 名</div>` : ""}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      <div class="card-header">
        <div class="card-title">本日出勤修正一覧</div>
        ${badge(`${manualAdjustmentAlerts.length}件`, manualAdjustmentAlerts.length ? "blue" : "green")}
      </div>
      <div class="card-body">
        ${manualAdjustmentAlerts.length
          ? manualAdjustmentAlerts.slice(0, 8).map((item) => `
            <div class="checkline">
              ${escapeHtml(item.student_no)} ${escapeHtml(item.name)}
              <span class="muted-cell">
                / ${escapeHtml(item.class_date)} ${escapeHtml(item.class_name)} ${escapeHtml(item.period_label)}
                / ${escapeHtml(item.status)}
                ${item.late_minutes ? ` / 遅刻 ${escapeHtml(item.late_minutes)}分` : ""}
                ${item.early_leave_minutes ? ` / 早退 ${escapeHtml(item.early_leave_minutes)}分` : ""}
                / ${escapeHtml(item.note || "-")}
              </span>
            </div>
          `).join("")
          : `<div class="checkline">現在、手動補録・修正はありません。</div>`}
        ${manualAdjustmentAlerts.length > 8 ? `<div class="form-note">ほか ${manualAdjustmentAlerts.length - 8} 件</div>` : ""}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      ${tableSectionHead(
        "授業QR表示",
        "運用中の授業はこの場で入室・退室 QR を表示できます。QR が読み取れない場合でも、授業コードと学生リンクで運用を続けられます。",
        [
          summaryPill("運用中", activeQrSessions.length, activeQrSessions.length ? "green" : "gray"),
          summaryPill("表示中QR", activeQrSessions.length * 2, activeQrSessions.length ? "blue" : "gray"),
        ],
        `<span class="table-section-hint">内部試運行版では外部 QR 画像サービスを利用し、コードとリンクも併記しています</span>`,
      )}
      <div class="card-body">
        ${activeQrSessions.length
          ? `<div class="qr-session-grid">
              ${activeQrSessions.map((item) => `
                <article class="qr-session-card">
                  <div class="qr-session-head">
                    <div>
                      <div class="section-kicker">${escapeHtml(item.class_date || "-")}</div>
                      <h3>${escapeHtml(item.class_name || "-")} / ${escapeHtml(item.period_label || "-")}</h3>
                      <p>${escapeHtml(item.start_time || "-")} - ${escapeHtml(item.end_time || "-")}</p>
                    </div>
                    ${statusBadge("運用中")}
                  </div>
                  <div class="qr-code-pair">
                    <div class="qr-code-card">
                      <div class="qr-code-label">入室</div>
                      <div class="qr-code-frame">
                        <img src="${escapeHtml(qrImageUrl(item.checkin_url || "", 180))}" alt="入室QR" />
                      </div>
                      <div class="qr-code-value">${escapeHtml(item.access_code || "-")}</div>
                      <div class="table-action-stack">
                        <button class="btn compact" data-attendance-copy="${escapeHtml(item.checkin_url || "")}">リンクコピー</button>
                        <button class="btn compact" data-attendance-open="${escapeHtml(item.checkin_url || "")}">学生画面</button>
                      </div>
                    </div>
                    <div class="qr-code-card">
                      <div class="qr-code-label">退室</div>
                      <div class="qr-code-frame">
                        <img src="${escapeHtml(qrImageUrl(item.checkout_url || "", 180))}" alt="退室QR" />
                      </div>
                      <div class="qr-code-value">${escapeHtml(item.checkout_access_code || "-")}</div>
                      <div class="table-action-stack">
                        <button class="btn compact" data-attendance-copy="${escapeHtml(item.checkout_url || "")}">退室リンク</button>
                      </div>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>`
          : `<div class="empty-state">現在、表示中の授業 QR はありません。授業コードを発行するとここに表示されます。</div>`}
      </div>
    </div>

    <div class="card" style="margin-bottom:14px;">
      ${tableSectionHead(
        "QR出席セッション",
        "授業ごとの出席コード運用、未打刻の把握、終了処理までをこの一覧で追います。",
        [
          summaryPill("運用中", activeQrSessions.length, activeQrSessions.length ? "green" : "gray"),
          summaryPill("未打刻", activeMissingCount, activeMissingCount ? "yellow" : "gray"),
          summaryPill("本日退室", checkedOutToday, "blue"),
        ],
        `<span class="table-section-hint">1-5分は遅刻、5分超は欠席、授業終了前の退室は早退として扱います</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead><tr><th>授業</th><th>入室 / 退室</th><th>学生リンク</th><th>打刻状況</th><th>未打刻</th><th>状態</th><th>操作</th></tr></thead>
          <tbody>
            ${qrSessions.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml(item.class_date || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.class_name || "-")} / ${escapeHtml(item.period_label || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.start_time || "-")} - ${escapeHtml(item.end_time || "-")}</div>
                </td>
                <td>
                  <div class="table-note-list">
                    <div><strong>入室</strong><span>${escapeHtml(item.access_code || "-")}</span></div>
                    <div><strong>退室</strong><span>${escapeHtml(item.checkout_access_code || "-")}</span></div>
                  </div>
                  <div class="table-secondary">${escapeHtml(item.scheduled_minutes || 0)}分 / 1-5分遅刻 / 5分超欠席</div>
                </td>
                <td>
                  <div class="table-secondary attendance-link-cell">${escapeHtml(item.checkin_url || "-")}</div>
                  <div class="table-action-stack">
                    <button class="btn compact" data-attendance-copy="${escapeHtml(item.checkin_url || "")}">リンクコピー</button>
                    <button class="btn compact" data-attendance-open="${escapeHtml(item.checkin_url || "")}">学生画面</button>
                    <button class="btn compact" data-attendance-copy="${escapeHtml(item.checkout_url || "")}">退室リンク</button>
                  </div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.attendee_count || 0)} 名 打刻</div>
                  <div class="table-secondary">${escapeHtml(item.checked_out_count || 0)} 名 退室</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.missing_student_count || 0)} 名</div>
                  <div class="table-secondary table-ellipsis">
                    ${(item.missing_students || []).map((student) => `${escapeHtml(student.student_no)} ${escapeHtml(student.name)}`).join(" / ") || "全員打刻済み"}
                  </div>
                </td>
                <td>${statusBadge(item.status === "active" ? "運用中" : "終了")}</td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-attendance-detail="${escapeHtml(item.id)}">詳細を見る</button>
                    <button class="btn compact" data-attendance-close="${escapeHtml(item.id)}" ${(item.status !== "active" || !canManageAttendanceSession) ? "disabled" : ""}>受付終了</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7">まだ授業コードは発行されていません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      ${tableSectionHead(
        "学生一覧",
        "在留期限、出席率、証明書・年度結果への導線をこの表からまとめて確認します。",
        [
          summaryPill("在籍者", students.length, "blue"),
          summaryPill("在留注意", residenceDue, residenceDue ? "yellow" : "gray"),
          summaryPill("出席注意", attendanceWarning, attendanceWarning ? "yellow" : "gray"),
        ],
        `<span class="table-section-hint">注意列から優先確認対象が一目で分かります</span>`,
      )}
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>学生番号</th><th>氏名</th><th>国籍</th><th>状態</th><th>クラス</th><th>在留期限</th><th>出席率</th><th>注意</th><th>帳票</th><th>進路</th><th>主档案</th></tr></thead>
          <tbody>
            ${students.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_no)}</div>
                  <div class="table-secondary">${escapeHtml(item.admission_date || "入学日未設定")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.name)}</div>
                  <div class="table-secondary">${escapeHtml(item.phone || "電話未登録")}</div>
                  <div class="table-secondary table-ellipsis">${escapeHtml(item.address_japan || "住所未登録")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.nationality)}</div>
                  <div class="table-secondary">${escapeHtml(item.residence_status || "在留資格未設定")}</div>
                </td>
                <td>
                  ${statusBadge(item.status, "green")}
                  <div class="table-secondary">在籍区分</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.class_name)}</div>
                  <div class="table-secondary">${escapeHtml(item.emergency_contact || "緊急連絡先未登録")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.residence_expiry || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.residence_card_no || "カード番号未登録")}</div>
                </td>
                <td>
                  ${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}
                  <div class="table-secondary">${item.attendance_rate < 80 ? "要フォロー" : "安定"}</div>
                </td>
                <td>
                  <div class="table-chip-stack">
                    ${item.alerts?.length ? item.alerts.map((alert) => badge(alert, item.alert_level === "red" ? "red" : "yellow")).join(" ") : badge("正常", "green")}
                  </div>
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-withdrawal-preview="${item.id}">離脱届</button>
                    <button class="btn compact" data-withdrawal-export="${item.id}">帳票出力</button>
                    <button class="btn primary compact" data-withdrawal-generate="${item.id}">帳票生成</button>
                  </div>
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-open-annual-results="${item.id}">年度結果</button>
                  </div>
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-student-detail="${item.id}">主档案</button>
                    <button class="btn compact" data-open-certificates="${item.id}">証明書</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelectorAll("[data-withdrawal-preview]").forEach((button) => {
    button.addEventListener("click", () => openWithdrawalPreview(button.dataset.withdrawalPreview));
  });
  document.querySelectorAll("[data-withdrawal-export]").forEach((button) => {
    button.addEventListener("click", () => exportWithdrawalDocument(button.dataset.withdrawalExport, button));
  });
  document.querySelectorAll("[data-withdrawal-generate]").forEach((button) => {
    button.addEventListener("click", () => generateWithdrawalDocument(button.dataset.withdrawalGenerate, button));
  });
  document.querySelectorAll("[data-open-annual-results]").forEach((button) => {
    button.addEventListener("click", () => openAnnualResultsForStudent(button.dataset.openAnnualResults));
  });
  document.querySelectorAll("[data-student-detail]").forEach((button) => {
    button.addEventListener("click", () => openStudentDetail(button.dataset.studentDetail));
  });
  document.querySelectorAll("[data-open-certificates]").forEach((button) => {
    button.addEventListener("click", () => openCertificatesForStudent(button.dataset.openCertificates));
  });
  const attendanceForm = document.querySelector("#attendanceSessionForm");
  attendanceForm?.addEventListener("submit", submitAttendanceSessionForm);
  const periodSelect = attendanceForm?.querySelector("[name='period_label']");
  const startInput = attendanceForm?.querySelector("[name='start_time']");
  const endInput = attendanceForm?.querySelector("[name='end_time']");
  if (periodSelect && startInput && endInput) {
    const periodMap = {
      "1限": ["09:10", "09:55"],
      "2限": ["09:55", "10:40"],
      "3限": ["10:50", "11:35"],
      "4限": ["11:35", "12:20"],
      "5限": ["13:10", "13:55"],
      "1-2限": ["09:10", "10:40"],
      "3-4限": ["10:50", "12:20"],
      "1-4限": ["09:10", "12:20"],
    };
    const syncPeriodRange = () => {
      const [start, end] = periodMap[periodSelect.value] || ["09:10", "12:20"];
      startInput.value = start;
      endInput.value = end;
    };
    periodSelect.addEventListener("change", syncPeriodRange);
    syncPeriodRange();
  }
  document.querySelectorAll("[data-attendance-copy]").forEach((button) => {
    button.addEventListener("click", () => copyAttendanceLink(button.dataset.attendanceCopy, button));
  });
  document.querySelectorAll("[data-attendance-open]").forEach((button) => {
    button.addEventListener("click", () => openAttendanceLink(button.dataset.attendanceOpen));
  });
  document.querySelectorAll("[data-attendance-detail]").forEach((button) => {
    button.addEventListener("click", () => openAttendanceSessionModal(button.dataset.attendanceDetail));
  });
  document.querySelectorAll("[data-attendance-close]").forEach((button) => {
    button.addEventListener("click", () => closeAttendanceSession(button.dataset.attendanceClose, button));
  });
}

async function submitAttendanceSessionForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "発行中...");
  try {
    const result = await api("/api/attendance-checkin-sessions", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const latest = (result.sessions || [])[0];
    toast(latest ? `授業コード ${latest.access_code} を発行しました。` : "授業コードを発行しました。");
    renderStudents();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function copyAttendanceLink(path, button) {
  if (!path) return;
  const restore = setButtonLoading(button, "コピー中...");
  try {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    toast("学生用出席リンクをコピーしました。");
  } catch (_error) {
    toast("リンクをコピーできませんでした。");
  } finally {
    restore();
  }
}

function openAttendanceLink(path) {
  if (!path) return;
  window.open(new URL(path, window.location.origin).toString(), "_blank", "noopener,noreferrer");
}

const ATTENDANCE_MANUAL_REASON_OPTIONS = [
  "学生が打刻を忘れた",
  "端末・通信トラブル",
  "公欠確認済み",
  "教員が代行入力",
  "その他",
];

function attendanceManualReasonSelect(studentId, location = "row") {
  return `
    <select class="attendance-adjust-select attendance-reason-select" data-attendance-reason="${escapeHtml(studentId)}" data-attendance-reason-location="${escapeHtml(location)}">
      ${ATTENDANCE_MANUAL_REASON_OPTIONS.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join("")}
    </select>
  `;
}

async function closeAttendanceSession(sessionId, button) {
  const restore = setButtonLoading(button, "終了中...");
  try {
    await api("/api/attendance-checkin-sessions/close", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
    toast("QR出席セッションを終了しました。");
    renderStudents();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function openAttendanceSessionModal(sessionId) {
  try {
    const detail = await api(`/api/attendance-checkin-sessions/${sessionId}`);
    if (!detail.ok) throw new Error(detail.message || "出席セッションの取得に失敗しました。");
    const { session, summary, attendees, missing_students: missingStudents, manual_updates: manualUpdates = [] } = detail;
    const canManageAttendanceSession = can("attendance_session_manage");
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal modal-wide">
        <div class="modal-header">
          <div>
            <h2>授業QR出席の詳細</h2>
            <p>${escapeHtml(session.class_date || "-")} / ${escapeHtml(session.class_name || "-")} / ${escapeHtml(session.period_label || "-")}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <div class="grid stats compact-stats">
          ${stat("打刻済み", summary.attendee_count || 0, "このセッションで登録済み")}
          ${stat("未打刻", summary.missing_student_count || 0, "まだコード未登録")}
          ${stat("退室済み", summary.checked_out_count || 0, "退室コード登録済み")}
          ${stat("欠席", (summary.status_counts || {}).欠席 || 0, "未打刻を含む")}
        </div>
        <div class="info-grid" style="margin-top:14px;">
          <article class="panel">
            <div class="panel-head">
              <div>
                <div class="section-kicker">運用情報</div>
                <h3>本節のルール</h3>
              </div>
              ${badge(session.status === "active" ? "運用中" : "終了", session.status === "active" ? "green" : "gray")}
            </div>
            <div class="history-list compact-list">
              <article class="history-card">
                <div class="history-head"><strong>入室コード</strong>${badge(session.access_code || "-", "blue")}</div>
                <div class="muted-note">${escapeHtml(session.checkin_url || "-")}</div>
              </article>
              <article class="history-card">
                <div class="history-head"><strong>退室コード</strong>${badge(session.checkout_access_code || "-", "yellow")}</div>
                <div class="muted-note">${escapeHtml(session.checkout_url || "-")}</div>
              </article>
              <article class="history-card">
                <div class="history-head"><strong>時刻ルール</strong>${badge(`${escapeHtml(session.start_time || "-")} - ${escapeHtml(session.end_time || "-")}`, "gray")}</div>
                <div class="muted-note">1-5分で遅刻、5分超で欠席、授業終了前の退室は早退として記録します。</div>
              </article>
            </div>
          </article>
          <article class="panel">
            <div class="panel-head">
              <div>
                <div class="section-kicker">本節の手動補録</div>
                <h3>教員が補録・修正した記録</h3>
              </div>
            </div>
            <div class="history-list compact-list">
              ${manualUpdates.length ? manualUpdates.map((item) => `
                <article class="history-card">
                  <div class="history-head">
                    <strong>${escapeHtml(item.student_no || "-")} ${escapeHtml(item.name || "-")}</strong>
                    ${statusBadge(item.status || "-", item.status === "公欠" ? "blue" : "gray")}
                  </div>
                  <div class="muted-note">
                    ${escapeHtml(item.note || "-")}
                    ${item.late_minutes ? ` / 遅刻 ${escapeHtml(item.late_minutes)}分` : ""}
                    ${item.early_leave_minutes ? ` / 早退 ${escapeHtml(item.early_leave_minutes)}分` : ""}
                  </div>
                </article>
              `).join("") : `<div class="empty-state">まだ手動補録はありません。</div>`}
            </div>
          </article>
          <article class="panel">
            <div class="panel-head">
              <div>
                <div class="section-kicker">本節未打刻学生</div>
                <h3>まだコード登録がない学生</h3>
              </div>
            </div>
            <div class="history-list compact-list">
              ${missingStudents.length ? missingStudents.map((student) => `
                <article class="history-card">
                  <div class="history-head">
                    <strong>${escapeHtml(student.student_no || "-")} ${escapeHtml(student.name || "-")}</strong>
                    ${badge("未打刻", "yellow")}
                  </div>
                  <div class="muted-note">セッション終了時に他の記録がなければ欠席として登録されます。</div>
                  <div class="attendance-reason-block">
                    <div class="table-secondary">補録理由</div>
                    ${attendanceManualReasonSelect(student.id, "missing")}
                  </div>
                  <div class="table-inline-actions">
                    <button class="btn compact" data-attendance-mark="${escapeHtml(student.id)}" data-attendance-mark-status="出席" ${canManageAttendanceSession ? "" : "disabled"}>出席にする</button>
                    <button class="btn compact" data-attendance-mark="${escapeHtml(student.id)}" data-attendance-mark-status="公欠" ${canManageAttendanceSession ? "" : "disabled"}>公欠にする</button>
                    <button class="btn compact" data-attendance-mark="${escapeHtml(student.id)}" data-attendance-mark-status="欠席" ${canManageAttendanceSession ? "" : "disabled"}>欠席にする</button>
                  </div>
                </article>
              `).join("") : `<div class="empty-state">全員打刻済みです。</div>`}
            </div>
          </article>
        </div>
        <div class="panel" style="margin-top:14px;">
          <div class="panel-head">
            <div>
              <div class="section-kicker">打刻済み一覧</div>
              <h3>出席・遅刻・早退の詳細</h3>
            </div>
          </div>
          ${permissionBadge("attendance_session_manage", "出席の手動補録・修正は出席管理権限のある staff のみ実行できます。")}
          <div class="table-scroll">
            <table class="dense-table">
              <thead><tr><th>学生</th><th>状態</th><th>入室</th><th>退室</th><th>遅刻</th><th>早退</th><th>備考</th><th>手動補録・修正</th></tr></thead>
              <tbody>
                ${attendees.map((item) => `
                  <tr>
                    <td>
                      <div class="table-primary">${escapeHtml(item.student_no || "-")}</div>
                      <div class="table-secondary">${escapeHtml(item.name || "-")}</div>
                    </td>
                    <td>${statusBadge(item.status || "-", item.status === "公欠" ? "blue" : "gray")}</td>
                    <td><div class="table-primary">${escapeHtml((item.checkin_at || "").replace("T", " ") || "-")}</div></td>
                    <td><div class="table-primary">${escapeHtml((item.checkout_at || "").replace("T", " ") || "-")}</div></td>
                    <td><div class="table-primary">${escapeHtml(item.late_minutes || 0)}分</div></td>
                    <td><div class="table-primary">${escapeHtml(item.early_leave_minutes || 0)}分</div></td>
                    <td class="table-secondary">${escapeHtml(item.note || "-")}</td>
                    <td>
                      <div class="table-action-stack attendance-adjust-stack">
                        <select class="attendance-adjust-select" data-attendance-status="${escapeHtml(item.student_id)}" ${canManageAttendanceSession ? "" : "disabled"}>
                          ${["出席", "遅刻", "早退", "欠席", "公欠"].map((status) => `<option value="${escapeHtml(status)}" ${item.status === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
                        </select>
                        <input class="attendance-adjust-minutes" data-attendance-minutes="${escapeHtml(item.student_id)}" type="number" min="0" max="${escapeHtml(session.scheduled_minutes || 0)}" value="${escapeHtml(item.status === "遅刻" ? item.late_minutes || 1 : item.status === "早退" ? item.early_leave_minutes || 1 : 0)}" ${canManageAttendanceSession ? "" : "disabled"}>
                        ${attendanceManualReasonSelect(item.student_id, "row")}
                        <input class="attendance-adjust-note" data-attendance-note="${escapeHtml(item.student_id)}" type="text" value="${escapeHtml(item.note || "")}" placeholder="備考" ${canManageAttendanceSession ? "" : "disabled"}>
                        <button class="btn compact" data-attendance-save="${escapeHtml(item.student_id)}" ${canManageAttendanceSession ? "" : "disabled"}>更新する</button>
                      </div>
                    </td>
                  </tr>
                `).join("") || `<tr><td colspan="8">まだ打刻済み学生はいません。</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
    document.querySelectorAll("[data-attendance-mark]").forEach((button) => {
      button.addEventListener("click", () => {
        const studentId = button.dataset.attendanceMark;
        const reason = document.querySelector(`[data-attendance-reason="${studentId}"][data-attendance-reason-location="missing"]`)?.value || "教員が代行入力";
        manualUpdateAttendanceSession(sessionId, studentId, {
          status: button.dataset.attendanceMarkStatus,
          note: `手動補録（${button.dataset.attendanceMarkStatus}）/ ${reason}`,
        }, button);
      });
    });
    document.querySelectorAll("[data-attendance-save]").forEach((button) => {
      button.addEventListener("click", () => {
        const studentId = button.dataset.attendanceSave;
        const status = document.querySelector(`[data-attendance-status="${studentId}"]`)?.value || "出席";
        const minuteValue = document.querySelector(`[data-attendance-minutes="${studentId}"]`)?.value || "0";
        const note = document.querySelector(`[data-attendance-note="${studentId}"]`)?.value || "";
        const reason = document.querySelector(`[data-attendance-reason="${studentId}"][data-attendance-reason-location="row"]`)?.value || "教員が代行入力";
        const payload = {
          status,
          note: note || `手動補録（${status}）/ ${reason}`,
          late_minutes: status === "遅刻" ? Number(minuteValue || 0) : 0,
          early_leave_minutes: status === "早退" ? Number(minuteValue || 0) : 0,
        };
        manualUpdateAttendanceSession(sessionId, studentId, payload, button);
      });
    });
  } catch (error) {
    showError(error);
  }
}

async function manualUpdateAttendanceSession(sessionId, studentId, payload, button) {
  const restore = setButtonLoading(button, "更新中...");
  try {
    const response = await api(`/api/attendance-checkin-sessions/${sessionId}/manual-update`, {
      method: "POST",
      body: JSON.stringify({
        student_id: studentId,
        ...payload,
      }),
    });
    if (!response.ok) {
      throw new Error(response.message || "出席の更新に失敗しました。");
    }
    toast("出席を手動更新しました。");
    await renderStudents();
    await openAttendanceSessionModal(sessionId);
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

function portalPendingPriority(item) {
  if ((item.status || "") === "申請中") return 0;
  if ((item.status || "") === "再提出依頼") return 1;
  if ((item.status || "") === "承認済") return 2;
  return 3;
}

function sortPortalItems(items, dateKey = "created_at") {
  return [...items].sort((a, b) => {
    const priorityDiff = portalPendingPriority(a) - portalPendingPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return String(b[dateKey] || "").localeCompare(String(a[dateKey] || ""));
  });
}

async function renderStudentPortalAdmin() {
  const data = await api("/api/student-portal-admin");
  state.studentPortalAdmin = data;
  const summary = data.summary || {};
  const leaveRequests = sortPortalItems(data.leave_requests || [], "created_at");
  const profileChangeRequests = sortPortalItems(data.profile_change_requests || [], "created_at");
  const residenceChangeRequests = sortPortalItems(data.residence_change_requests || [], "created_at");
  const homeworkSubmissions = sortPortalItems(data.homework_submissions || [], "submitted_at");
  const bulletinPosts = data.bulletin_posts || [];
  const recentGroupMessages = data.recent_group_messages || [];
  const canReviewPortal = can("student_portal_review");
  const pendingReviewCount =
    (summary.leave_pending_count || 0) +
    (summary.profile_change_pending_count || 0) +
    (summary.residence_change_pending_count || 0);
  document.querySelector("#studentPortal").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として学生連携を確認中`,
      "学生端から届く申請と提出物をここで受け取り、承認・差戻し・掲示公開までまとめて処理します。",
      [
        { label: `請假待ち ${summary.leave_pending_count || 0}`, color: (summary.leave_pending_count || 0) ? "yellow" : "green" },
        { label: `情報変更 ${summary.profile_change_pending_count || 0}`, color: (summary.profile_change_pending_count || 0) ? "yellow" : "green" },
        { label: `未処理合計 ${pendingReviewCount}`, color: pendingReviewCount ? "yellow" : "green" },
        { label: canReviewPortal ? "審査できます" : "閲覧のみ", color: canReviewPortal ? "blue" : "gray" },
      ],
    )}
    <div class="grid stats">
      ${stat("請假申請待ち", summary.leave_pending_count || 0, "公欠・欠席の承認待ち")}
      ${stat("情報変更待ち", summary.profile_change_pending_count || 0, "電話・住所・連絡先の更新")}
      ${stat("在留更新待ち", summary.residence_change_pending_count || 0, "在留資格・期限・旅券の更新")}
      ${stat("課題提出", summary.homework_submission_count || 0, "学生端からの提出")}
      ${stat("掲示 / 群消息", `${summary.bulletin_count || 0} / ${summary.group_message_count || 0}`, "公開中 / 最近の会話")}
    </div>

    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">いま優先したいもの</div>
          ${badge(pendingReviewCount ? "未処理あり" : "安定運用", pendingReviewCount ? "yellow" : "green")}
        </div>
        <div class="card-body task-list">
          ${taskRow("公欠・欠席申請", summary.leave_pending_count || 0, "studentPortal")}
          ${taskRow("個人情報変更申請", summary.profile_change_pending_count || 0, "studentPortal")}
          ${taskRow("在留情報変更申請", summary.residence_change_pending_count || 0, "studentPortal")}
          ${taskRow("課題提出の確認", summary.homework_submission_count || 0, "studentPortal")}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">掲示板を掲載</div>
          ${badge("学生端公開", "green")}
        </div>
        <form id="studentBulletinForm" class="form-grid">
          <label>
            タイトル
            <input name="title" required>
          </label>
          <label>
            公開範囲
            <select name="scope">
              <option value="all">全体</option>
              <option value="class">クラス指定</option>
            </select>
          </label>
          <label>
            クラス名
            <input name="class_name" placeholder="例: A-1">
          </label>
          <label class="full">
            内容
            <textarea name="body" rows="4" required></textarea>
          </label>
          <div class="form-actions full">
            <button class="btn primary" type="submit" ${permissionDisabled("student_portal_review")}>掲示する</button>
          </div>
        </form>
        ${permissionBadge("student_portal_review", "学生連携の審査・掲示・メッセージ送信は staff / 入管担当 / manager のみ実行できます。")}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">クラスへメッセージ送信</div></div>
        <form id="studentGroupMessageAdminForm" class="form-grid">
          <label>
            クラス名
            <input name="class_name" value="A-1" required>
          </label>
          <label class="full">
            メッセージ
            <textarea name="message" rows="3" required></textarea>
          </label>
          <div class="form-actions full">
            <button class="btn primary" type="submit" ${permissionDisabled("student_portal_review")}>送信する</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "最近のクラスメッセージ",
        "学生端の班级群聊で直近に流れた内容を確認します。",
        [
          summaryPill("最近投稿", recentGroupMessages.length, "blue"),
          summaryPill("公開中掲示", bulletinPosts.length, "gray"),
        ],
        `<span class="table-section-hint">必要ならこの場で削除・補足対応します</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>投稿日時</th>
              <th>クラス</th>
              <th>投稿者</th>
              <th>本文</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${recentGroupMessages.map((item) => `
              <tr>
                <td>${escapeHtml((item.posted_at || "").replace("T", " "))}</td>
                <td>${escapeHtml(item.class_name || "-")}</td>
                <td>${escapeHtml(item.author_name || "-")}<br><span class="muted-cell">${escapeHtml(item.author_role || "-")}</span></td>
                <td>${escapeHtml(item.body || "-")}</td>
                <td><button class="btn compact" data-group-delete="${escapeHtml(item.id)}" ${permissionDisabled("student_portal_review")}>削除する</button></td>
              </tr>
            `).join("") || `<tr><td colspan="5">まだメッセージはありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "公欠・欠席申請",
        "授業別の請假申請を確認し、承認または差戻しを行います。",
        [
          summaryPill("承認待ち", summary.leave_pending_count || 0, (summary.leave_pending_count || 0) ? "yellow" : "gray"),
          summaryPill("一覧件数", leaveRequests.length, "blue"),
        ],
        `<span class="table-section-hint">承認後は出勤記録へ自動反映されます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>学生番号</th>
              <th>氏名</th>
              <th>クラス</th>
              <th>種別</th>
              <th>理由</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${leaveRequests.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml(item.request_date || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.period_label || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.student_no || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.class_name || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(item.request_type || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.reason || "-")}</div>
                </td>
                <td>${statusBadge(item.status || "-", "yellow")}</td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-leave-approve="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>承認する</button>
                    <button class="btn compact" data-leave-reject="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>差戻す</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8">申請はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "個人情報変更申請",
        "電話、住所、緊急連絡先の更新内容を比較して反映します。",
        [
          summaryPill("承認待ち", summary.profile_change_pending_count || 0, (summary.profile_change_pending_count || 0) ? "yellow" : "gray"),
          summaryPill("一覧件数", profileChangeRequests.length, "blue"),
        ],
        `<span class="table-section-hint">差分を見ながら主档案へ反映できます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>申請日時</th>
              <th>学生</th>
              <th>変更内容</th>
              <th>理由</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${profileChangeRequests.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml((item.created_at || "").replace("T", " "))}</div>
                  <div class="table-secondary">申請受付</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_no || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.student_name || "-")} / ${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td>
                  <div class="table-note-list">
                    <div><strong>電話</strong><span>${escapeHtml(item.current_phone || "-")} -> ${escapeHtml(item.requested_phone || "-")}</span></div>
                    <div><strong>住所</strong><span>${escapeHtml(item.current_address_japan || "-")} -> ${escapeHtml(item.requested_address_japan || "-")}</span></div>
                    <div><strong>緊急</strong><span>${escapeHtml(item.current_emergency_contact || "-")} -> ${escapeHtml(item.requested_emergency_contact || "-")}</span></div>
                  </div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.reason || "-")}</div></td>
                <td>${statusBadge(item.status || "-", "yellow")}</td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-profile-change-approve="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>反映する</button>
                    <button class="btn compact" data-profile-change-reject="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>差戻す</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="6">変更申請はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "在留情報変更申請",
        "在留資格、カード番号、期限、旅券番号と添付画像をまとめて確認します。",
        [
          summaryPill("承認待ち", summary.residence_change_pending_count || 0, (summary.residence_change_pending_count || 0) ? "yellow" : "gray"),
          summaryPill("一覧件数", residenceChangeRequests.length, "blue"),
        ],
        `<span class="table-section-hint">画像確認後に反映、または差戻しします</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>申請日時</th>
              <th>学生</th>
              <th>変更内容</th>
              <th>理由</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${residenceChangeRequests.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml((item.created_at || "").replace("T", " "))}</div>
                  <div class="table-secondary">申請受付</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_no || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.student_name || "-")} / ${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td>
                  <div class="table-note-list">
                    <div><strong>資格</strong><span>${escapeHtml(item.current_residence_status || "-")} -> ${escapeHtml(item.requested_residence_status || "-")}</span></div>
                    <div><strong>カード</strong><span>${escapeHtml(item.current_residence_card_no || "-")} -> ${escapeHtml(item.requested_residence_card_no || "-")}</span></div>
                    <div><strong>期限</strong><span>${escapeHtml(item.current_residence_expiry || "-")} -> ${escapeHtml(item.requested_residence_expiry || "-")}</span></div>
                    <div><strong>旅券</strong><span>${escapeHtml(item.current_passport_no || "-")} -> ${escapeHtml(item.requested_passport_no || "-")}</span></div>
                  </div>
                  <div class="table-secondary" style="margin-top:6px;">
                    ${item.residence_card_file_name ? `<a href="/api/student-residence-change-files/${escapeHtml(item.id)}/residence-card" target="_blank" rel="noopener noreferrer">在留カード画像</a>` : "在留カード画像なし"}
                    ${item.passport_file_name ? ` / <a href="/api/student-residence-change-files/${escapeHtml(item.id)}/passport" target="_blank" rel="noopener noreferrer">旅券画像</a>` : " / 旅券画像なし"}
                  </div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.reason || "-")}</div></td>
                <td>${statusBadge(item.status || "-", "yellow")}</td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-residence-change-approve="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>反映する</button>
                    <button class="btn compact" data-residence-change-reject="${escapeHtml(item.id)}" ${(!canReviewPortal || item.status !== "申請中") ? "disabled" : ""}>差戻す</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="6">在留情報の変更申請はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "作業アップロード一覧",
        "提出済み課題を確認し、確認済みまたは再提出依頼へ進めます。",
        [
          summaryPill("提出件数", homeworkSubmissions.length, "blue"),
          summaryPill("再提出依頼", homeworkSubmissions.filter((item) => item.status === "再提出依頼").length, homeworkSubmissions.filter((item) => item.status === "再提出依頼").length ? "yellow" : "gray"),
        ],
        `<span class="table-section-hint">レビュー結果は学生端に即時反映されます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>提出日時</th>
              <th>学生</th>
              <th>課題</th>
              <th>科目</th>
              <th>状態</th>
              <th>ファイル</th>
              <th>メモ</th>
              <th>レビュー</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${homeworkSubmissions.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml((item.submitted_at || "").replace("T", " "))}</div>
                  <div class="table-secondary">提出受付</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_no || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.student_name || "-")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.assignment_title || "-")}</div>
                  <div class="table-secondary">締切 ${escapeHtml(item.due_date || "-")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.subject_name || "-")}</div>
                </td>
                <td>${statusBadge(item.status || "-", item.status === "確認済" ? "green" : "yellow")}</td>
                <td>
                  <div class="table-primary">${escapeHtml(item.file_name || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.note || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.review_comment || item.reviewed_by || "-")}</div>
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-homework-review="${escapeHtml(item.id)}" data-review-status="確認済" ${permissionDisabled("student_portal_review")}>確認完了</button>
                    <button class="btn compact" data-homework-review="${escapeHtml(item.id)}" data-review-status="再提出依頼" ${permissionDisabled("student_portal_review")}>再提出依頼</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="9">まだ提出はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "公開中の掲示",
        "学生端に現在公開されているお知らせを確認します。",
        [
          summaryPill("公開中", bulletinPosts.length, "blue"),
          summaryPill("置頂中", bulletinPosts.filter((item) => item.pinned).length, bulletinPosts.filter((item) => item.pinned).length ? "green" : "gray"),
        ],
        `<span class="table-section-hint">置頂で学生端の表示順を調整できます</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>公開日時</th>
              <th>範囲</th>
              <th>タイトル</th>
              <th>内容</th>
              <th>置頂</th>
            </tr>
          </thead>
          <tbody>
            ${bulletinPosts.map((item) => `
              <tr>
                <td>${escapeHtml((item.published_at || "").replace("T", " "))}</td>
                <td>${item.scope === "class" ? `クラス / ${escapeHtml(item.class_name || "-")}` : "全体"}</td>
                <td>${escapeHtml(item.title || "-")}</td>
                <td>${escapeHtml(item.body || "-")}</td>
                <td><button class="btn compact" data-bulletin-pin="${escapeHtml(item.id)}" data-pin-value="${item.pinned ? "0" : "1"}" ${permissionDisabled("student_portal_review")}>${item.pinned ? "置頂解除" : "置頂する"}</button></td>
              </tr>
            `).join("") || `<tr><td colspan="5">掲示はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#studentBulletinForm").addEventListener("submit", submitStudentBulletinForm);
  document.querySelector("#studentGroupMessageAdminForm").addEventListener("submit", submitStudentGroupMessageAdminForm);
  document.querySelectorAll("[data-leave-approve]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentLeave(button.dataset.leaveApprove, "承認済", button));
  });
  document.querySelectorAll("[data-leave-reject]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentLeave(button.dataset.leaveReject, "差戻し", button));
  });
  document.querySelectorAll("[data-profile-change-approve]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentProfileChange(button.dataset.profileChangeApprove, "反映済", button));
  });
  document.querySelectorAll("[data-profile-change-reject]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentProfileChange(button.dataset.profileChangeReject, "差戻し", button));
  });
  document.querySelectorAll("[data-residence-change-approve]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentResidenceChange(button.dataset.residenceChangeApprove, "反映済", button));
  });
  document.querySelectorAll("[data-residence-change-reject]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentResidenceChange(button.dataset.residenceChangeReject, "差戻し", button));
  });
  document.querySelectorAll("[data-homework-review]").forEach((button) => {
    button.addEventListener("click", () => reviewStudentHomework(button.dataset.homeworkReview, button.dataset.reviewStatus, button));
  });
  document.querySelectorAll("[data-group-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteGroupMessage(button.dataset.groupDelete, button));
  });
  document.querySelectorAll("[data-bulletin-pin]").forEach((button) => {
    button.addEventListener("click", () => toggleStudentBulletinPin(button.dataset.bulletinPin, button.dataset.pinValue === "1", button));
  });
}

async function submitStudentBulletinForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "掲載中...");
  try {
    await api("/api/student-bulletins", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    toast("掲示板へ掲載しました。");
    form.reset();
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function reviewStudentLeave(id, status, button) {
  const restore = setButtonLoading(button, status === "承認済" ? "承認中..." : "差戻し中...");
  try {
    await api(`/api/student-leave-requests/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    toast(`申請を ${status} に更新しました。`);
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function reviewStudentProfileChange(id, status, button) {
  const reviewedNote = window.prompt(
    status === "反映済" ? "反映メモを入力してください（任意）" : "差戻し理由を入力してください",
    "",
  ) ?? "";
  const restore = setButtonLoading(button, status === "反映済" ? "反映中..." : "差戻し中...");
  try {
    await api(`/api/student-profile-change-requests/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, reviewed_note: reviewedNote }),
    });
    toast(`個人情報変更申請を ${status} に更新しました。`);
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function reviewStudentResidenceChange(id, status, button) {
  const reviewedNote = window.prompt(
    status === "反映済" ? "反映メモを入力してください（任意）" : "差戻し理由を入力してください",
    "",
  ) ?? "";
  const restore = setButtonLoading(button, status === "反映済" ? "反映中..." : "差戻し中...");
  try {
    await api(`/api/student-residence-change-requests/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, reviewed_note: reviewedNote }),
    });
    toast(`在留情報変更申請を ${status} に更新しました。`);
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function submitStudentGroupMessageAdminForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "送信中...");
  try {
    await api("/api/class-group-messages", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    toast("クラスへメッセージを送信しました。");
    form.reset();
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function reviewStudentHomework(id, status, button) {
  const reviewComment = window.prompt(status === "確認済" ? "確認コメントを入力してください" : "再提出理由を入力してください", "") ?? "";
  const reviewScore = window.prompt("点数を入力してください（任意）", "") ?? "";
  const restore = setButtonLoading(button, status === "確認済" ? "更新中..." : "依頼中...");
  try {
    await api(`/api/student-homework-submissions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, review_comment: reviewComment, review_score: reviewScore }),
    });
    toast(`課題提出を ${status} に更新しました。`);
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function deleteGroupMessage(id, button) {
  const restore = setButtonLoading(button, "削除中...");
  try {
    await api(`/api/class-group-messages/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast("メッセージを削除しました。");
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function toggleStudentBulletinPin(id, pinned, button) {
  const restore = setButtonLoading(button, pinned ? "置頂中..." : "解除中...");
  try {
    await api(`/api/student-bulletins/${id}/pin`, {
      method: "POST",
      body: JSON.stringify({ pinned }),
    });
    toast(pinned ? "掲示を置頂しました。" : "掲示の置頂を解除しました。");
    renderStudentPortalAdmin();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function openStudentDetail(id) {
  try {
    const detail = await api(`/api/students/${id}`);
    const student = detail.student;
    const summary = detail.summary || {};
    const attendance = detail.attendance || {};
    const attendanceSummary = attendance.summary || {};
    const attendanceRecords = attendance.records || [];
    const consultations = detail.consultations || [];
    const leaveRequests = attendance.leave_requests || [];
    const profileChangeRequests = detail.profile_change_requests || [];
    const residenceChangeRequests = detail.residence_change_requests || [];
    const certificateRequests = detail.certificate_requests || [];
    const recentDocuments = detail.recent_documents || [];
    const recentAttendanceAdjustments = detail.recent_attendance_adjustments || [];
    const relatedFiles = detail.related_files || [];
    const relatedFileGroups = groupStudentRelatedFiles(relatedFiles);
    const annualResults = detail.annual_results || [];
    const canEditStudent = can("student_edit");
    const today = new Date().toISOString().slice(0, 10);
    const nextActions = [];
    if (summary.days_to_expiry != null && Number(summary.days_to_expiry) <= 90) {
      nextActions.push({
        tone: Number(summary.days_to_expiry) <= 30 ? "red" : "yellow",
        label: "在留更新",
        text: `在留期限まで ${summary.days_to_expiry}日です。更新対象として早めの確認が必要です。`,
      });
    }
    if (summary.attendance_warning) {
      nextActions.push({
        tone: "yellow",
        label: "出席フォロー",
        text: "出席率が 80% 未満です。面談や指導の確認を優先してください。",
      });
    }
    const pendingLeave = leaveRequests.filter((item) => item.status === "申請中").length;
    if (pendingLeave) {
      nextActions.push({
        tone: "blue",
        label: "請假申請",
        text: `公欠・欠席申請が ${pendingLeave} 件、確認待ちです。`,
      });
    }
    const pendingProfile = profileChangeRequests.filter((item) => item.status === "申請中").length;
    if (pendingProfile) {
      nextActions.push({
        tone: "blue",
        label: "個人情報変更",
        text: `連絡先変更申請が ${pendingProfile} 件あります。主档案への反映可否を確認してください。`,
      });
    }
    const pendingResidence = residenceChangeRequests.filter((item) => item.status === "申請中").length;
    if (pendingResidence) {
      nextActions.push({
        tone: "blue",
        label: "在留情報変更",
        text: `在留情報変更申請が ${pendingResidence} 件あります。添付画像も合わせて確認してください。`,
      });
    }
    const pendingCertificates = certificateRequests.filter((item) => ["申請中", "承認済"].includes(item.status)).length;
    if (pendingCertificates) {
      nextActions.push({
        tone: "green",
        label: "証明書",
        text: `証明書申請が ${pendingCertificates} 件あります。承認または発行の状況を確認できます。`,
      });
    }
    const recentTimeline = [
      ...consultations.map((item) => ({
        date: item.meeting_date || item.created_at || "",
        label: "面談",
        title: item.staff_name || "面談記録",
        body: item.summary || item.note || "",
        status: item.follow_up || "",
      })),
      ...leaveRequests.map((item) => ({
        date: item.request_date || item.created_at || "",
        label: item.request_type || "請假",
        title: item.period_label || "",
        body: item.reason || item.detail || "",
        status: item.status || "",
      })),
      ...profileChangeRequests.map((item) => ({
        date: item.created_at || "",
        label: "個人情報変更",
        title: item.status || "",
        body: item.reason || "連絡先変更申請",
        status: item.reviewed_note || "",
      })),
      ...residenceChangeRequests.map((item) => ({
        date: item.created_at || "",
        label: "在留情報変更",
        title: item.status || "",
        body: item.reason || "在留情報変更申請",
        status: item.reviewed_note || "",
      })),
    ]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 10);
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>学生主档案</h2>
            <p>${escapeHtml(student.student_no || "-")} / ${escapeHtml(student.name || "-")} / ${escapeHtml(student.class_name || "-")}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <form id="studentDetailForm" class="form-grid">
          <input type="hidden" name="id" value="${escapeHtml(student.id)}">
          ${permissionBadge("student_edit", "このアカウントでは学生主档案を保存できません。閲覧のみ可能です。")}
          <label>
            学生番号
            <input name="student_no" value="${escapeHtml(student.student_no || "")}" required ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            氏名
            <input name="name" value="${escapeHtml(student.name || "")}" required ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            国籍
            <input name="nationality" value="${escapeHtml(student.nationality || "")}" required ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            在籍状態
            <input name="status" value="${escapeHtml(student.status || "")}" required ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            クラス
            <input name="class_name" value="${escapeHtml(student.class_name || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            出席率
            <input name="attendance_rate" type="number" min="0" max="100" step="0.1" value="${escapeHtml(student.attendance_rate || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            在留資格
            <input name="residence_status" value="${escapeHtml(student.residence_status || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            在留カード番号
            <input name="residence_card_no" value="${escapeHtml(student.residence_card_no || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            在留期限
            <input name="residence_expiry" type="date" value="${escapeHtml(student.residence_expiry || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            入学日
            <input name="admission_date" type="date" value="${escapeHtml(student.admission_date || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            生年月日
            <input name="birth_date" type="date" value="${escapeHtml(student.birth_date || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            旅券番号
            <input name="passport_no" value="${escapeHtml(student.passport_no || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            日本の電話番号
            <input name="phone" value="${escapeHtml(student.phone || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label class="full">
            日本の住所
            <input name="address_japan" value="${escapeHtml(student.address_japan || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label class="full">
            緊急連絡先
            <input name="emergency_contact" value="${escapeHtml(student.emergency_contact || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label>
            担任
            <input name="advisor_name" value="${escapeHtml(student.advisor_name || "")}" ${canEditStudent ? "" : "disabled"}>
          </label>
          <label class="full">
            事務メモ
            <textarea name="office_memo" ${canEditStudent ? "" : "disabled"}>${escapeHtml(student.office_memo || "")}</textarea>
          </label>
          <label class="full">
            保護者連絡メモ
            <textarea name="guardian_contact_memo" ${canEditStudent ? "" : "disabled"}>${escapeHtml(student.guardian_contact_memo || "")}</textarea>
          </label>
          <label class="full">
            エージェント連絡メモ
            <textarea name="agent_contact_memo" ${canEditStudent ? "" : "disabled"}>${escapeHtml(student.agent_contact_memo || "")}</textarea>
          </label>
          <label class="full">
            備考
            <textarea name="notes" ${canEditStudent ? "" : "disabled"}>${escapeHtml(student.notes || "")}</textarea>
          </label>
          <div class="full info-list">
            <div><span>在留期限まで</span><strong>${summary.days_to_expiry == null ? "-" : `${summary.days_to_expiry}日`}</strong></div>
            <div><span>出席率注意</span><strong>${summary.attendance_warning ? "要確認" : "正常"}</strong></div>
            <div><span>年度結果</span><strong>${summary.annual_result_count || 0} 件</strong></div>
            <div><span>次回面談</span><strong>${escapeHtml(summary.next_consultation_date || "未設定")}</strong></div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>次に必要な対応</strong><span>${nextActions.length} 件</span></div>
            ${nextActions.length
              ? nextActions.map((item) => `
                <div class="preview-row">
                  <span>${badge(item.label, item.tone)}</span>
                  <strong>${escapeHtml(item.text)}</strong>
                </div>
              `).join("")
              : `<div class="preview-row"><span>対応</span><strong>いま優先対応はありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>次回面談予定</strong><span>${summary.next_consultation_date ? "予定あり" : "未設定"}</span></div>
            <div class="preview-row">
              <span>予定日</span>
              <strong>${escapeHtml(summary.next_consultation_date || "未設定")}</strong>
            </div>
            <div class="table-secondary" style="margin-top:8px; line-height:1.6;">
              ${escapeHtml(summary.next_consultation_action || "次回対応メモはまだありません。")}
            </div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>担任・事務メモ</strong><span>${student.advisor_name ? "担当あり" : "未設定"}</span></div>
            <div class="info-list single">
              <div><span>担任</span><strong>${escapeHtml(student.advisor_name || "未設定")}</strong></div>
            </div>
            <div class="table-secondary" style="margin-top:10px; line-height:1.6;">
              ${escapeHtml(student.office_memo || "事務メモはまだありません。")}
            </div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>保護者・エージェント連絡メモ</strong><span>${student.guardian_contact_memo || student.agent_contact_memo ? "記録あり" : "未設定"}</span></div>
            <div class="info-list single">
              <div><span>保護者</span><strong>${escapeHtml(student.guardian_contact_memo || "記録なし")}</strong></div>
              <div><span>エージェント</span><strong>${escapeHtml(student.agent_contact_memo || "記録なし")}</strong></div>
            </div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>関連ファイル</strong><span>${relatedFiles.length} 件</span></div>
            ${relatedFiles[0]
              ? `
              <div class="preview-row total">
                <span>最近更新</span>
                <strong>${escapeHtml(relatedFiles[0].label || "関連ファイル")}</strong>
              </div>
              <div class="table-secondary" style="margin: -2px 0 10px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
                <span>${escapeHtml(relatedFileMeta(relatedFiles[0]))}</span>
                <div class="table-inline-actions">
                  <input class="staff-reset-input" type="text" data-related-file-note="${escapeHtml(relatedFiles[0].review_key || "")}" placeholder="確認メモ">
                  <a class="btn compact" href="${escapeHtml(relatedFiles[0].url || "#")}" target="_blank" rel="noopener noreferrer">開く</a>
                  <button class="btn compact" type="button" data-related-file-review="${escapeHtml(relatedFiles[0].review_key || "")}" data-related-file-label="${escapeHtml(relatedFiles[0].label || "関連ファイル")}" ${canEditStudent ? "" : "disabled"}>確認済みにする</button>
                </div>
              </div>
              <div class="table-secondary" style="margin: -6px 0 10px 0;">${escapeHtml(relatedFileReviewMeta(relatedFiles[0]))}</div>
            `
              : ""}
            ${relatedFileGroups.length
              ? relatedFileGroups.map((group) => `
                <div class="preview-row total">
                  <span>${escapeHtml(group.label)}</span>
                  <strong>${group.items.length} 件</strong>
                </div>
                ${group.items.slice(0, 2).map((item) => `
                  <div class="preview-row">
                    <span>${escapeHtml(item.label || "関連ファイル")}</span>
                    <strong>${escapeHtml(item.sub_label || "-")}</strong>
                  </div>
                  <div class="table-secondary" style="margin: -2px 0 8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
                    <span>${escapeHtml(relatedFileMeta(item))}</span>
                    <div class="table-inline-actions">
                      <input class="staff-reset-input" type="text" data-related-file-note="${escapeHtml(item.review_key || "")}" placeholder="確認メモ">
                      <a class="btn compact" href="${escapeHtml(item.url || "#")}" target="_blank" rel="noopener noreferrer">開く</a>
                      <button class="btn compact" type="button" data-related-file-review="${escapeHtml(item.review_key || "")}" data-related-file-label="${escapeHtml(item.label || "関連ファイル")}" ${canEditStudent ? "" : "disabled"}>確認済みにする</button>
                    </div>
                  </div>
                  <div class="table-secondary" style="margin: -4px 0 10px 0;">${escapeHtml(relatedFileReviewMeta(item))}</div>
                `).join("")}
              `).join("") + `
            <div class="table-action-stack" style="margin-top:10px;">
              <button class="btn compact" type="button" id="openStudentRelatedFiles">すべて見る</button>
            </div>`
              : `<div class="preview-row"><span>関連ファイル</span><strong>まだありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>証明書・帳票サマリー</strong><span>${recentDocuments.length} 件</span></div>
            <div class="info-list single">
              <div><span>証明書申請</span><strong>${certificateRequests.length} 件</strong></div>
              <div><span>処理中申請</span><strong>${pendingLeave + pendingProfile + pendingResidence + pendingCertificates} 件</strong></div>
              <div><span>発行済証明書</span><strong>${certificateRequests.filter((item) => item.status === "発行済").length} 件</strong></div>
              <div><span>学生関連帳票</span><strong>${recentDocuments.length} 件</strong></div>
            </div>
            <div class="preview-head" style="margin-top:12px;"><strong>最近の証明書・帳票</strong><span>${recentDocuments.length} 件</span></div>
            ${recentDocuments.length
              ? recentDocuments.map((item) => `
                <div class="preview-row">
                  <span>${escapeHtml(item.issue_date || "-")} / ${escapeHtml(item.document_type || "-")}</span>
                  <strong>${escapeHtml(item.document_no || "-")}</strong>
                </div>
                <div class="table-secondary" style="margin: -2px 0 8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
                  <span>${escapeHtml(item.subject_name || "学生関連帳票")}</span>
                  ${item.file_url ? `<a class="btn compact" href="${escapeHtml(item.file_url)}">Excel</a>` : `<span class="mini-status neutral">未出力</span>`}
                </div>
              `).join("")
              : `<div class="preview-row"><span>帳票</span><strong>まだありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>出勤サマリー</strong><span>${escapeHtml((attendanceRecords || []).length)} 件</span></div>
            <div class="info-list single">
              <div><span>総合出席率</span><strong>${escapeHtml(attendanceSummary.overall_rate ?? 0)}%</strong></div>
              <div><span>今月出席率</span><strong>${escapeHtml(attendanceSummary.monthly_rate ?? 0)}%</strong></div>
              <div><span>出席時間</span><strong>${escapeHtml(attendanceSummary.attended_hours ?? 0)}h / ${escapeHtml(attendanceSummary.scheduled_hours ?? 0)}h</strong></div>
              <div><span>欠席 / 公欠</span><strong>${escapeHtml(attendanceSummary.absence_count ?? 0)} / ${escapeHtml(attendanceSummary.official_absence_count ?? 0)}</strong></div>
            </div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>最近の出勤記録</strong><span>${attendanceRecords.length} 件</span></div>
            ${attendanceRecords.length
              ? attendanceRecords.slice(0, 8).map((item) => `
                <div class="preview-row">
                  <span>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")} / ${escapeHtml(item.status || "-")}</span>
                  <strong>${escapeHtml(item.attendance_minutes || 0)}分 / ${escapeHtml(item.scheduled_minutes || 0)}分</strong>
                </div>
                <div class="table-secondary" style="margin: -2px 0 8px 0;">
                  ${escapeHtml(item.note || "-")}
                  ${Number(item.late_minutes || 0) ? ` / 遅刻 ${escapeHtml(item.late_minutes)}分` : ""}
                  ${Number(item.early_leave_minutes || 0) ? ` / 早退 ${escapeHtml(item.early_leave_minutes)}分` : ""}
                </div>
              `).join("")
              : `<div class="preview-row"><span>出勤記録</span><strong>まだありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>最近の出勤修正</strong><span>${recentAttendanceAdjustments.length} 件</span></div>
            ${recentAttendanceAdjustments.length
              ? recentAttendanceAdjustments.map((item) => `
                <div class="preview-row">
                  <span>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")} / ${escapeHtml(item.status || "-")}</span>
                  <strong>${escapeHtml(item.attendance_minutes || 0)}分 / ${escapeHtml(item.scheduled_minutes || 0)}分</strong>
                </div>
                <div class="table-secondary" style="margin: -2px 0 8px 0;">
                  ${escapeHtml(item.note || "-")}
                  ${Number(item.late_minutes || 0) ? ` / 遅刻 ${escapeHtml(item.late_minutes)}分` : ""}
                  ${Number(item.early_leave_minutes || 0) ? ` / 早退 ${escapeHtml(item.early_leave_minutes)}分` : ""}
                </div>
              `).join("")
              : `<div class="preview-row"><span>出勤修正</span><strong>最近の手動補録はありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>最近の年度結果</strong><span>${annualResults.length} 件</span></div>
            ${annualResults.length ? annualResults.map((item) => `<div class="preview-row"><span>${escapeHtml(item.requirement || item.result_type)}</span><strong>${escapeHtml(item.destination || item.title || "-")}</strong></div>`).join("") : `<div class="preview-row"><span>年度結果</span><strong>まだありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>最近の動き</strong><span>${recentTimeline.length} 件</span></div>
            ${recentTimeline.length
              ? recentTimeline.map((item) => `
                <div class="preview-row">
                  <span>${escapeHtml(item.date || "-")} / ${escapeHtml(item.label || "-")}</span>
                  <strong>${escapeHtml(item.title || "-")}</strong>
                </div>
                <div class="table-secondary" style="margin: -2px 0 8px 0;">
                  ${escapeHtml(item.body || "-")}
                  ${item.status ? ` / ${escapeHtml(item.status)}` : ""}
                </div>
              `).join("")
              : `<div class="preview-row"><span>最近の動き</span><strong>まだありません</strong></div>`}
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>面談記録を追加</strong><span>${consultations.length} 件</span></div>
            <div class="form-grid">
              <label>
                面談日
                <input name="consultation_meeting_date" type="date" value="${escapeHtml(today)}" ${canEditStudent ? "" : "disabled"}>
              </label>
              <label>
                担当者
                <input name="consultation_staff_name" value="事務局 山田" ${canEditStudent ? "" : "disabled"}>
              </label>
              <label>
                区分
                <input name="consultation_category" value="出席面談" ${canEditStudent ? "" : "disabled"}>
              </label>
              <label class="full">
                概要
                <textarea name="consultation_summary" ${canEditStudent ? "" : "disabled"}></textarea>
              </label>
              <label>
                次回面談日
                <input name="consultation_next_meeting_date" type="date" ${canEditStudent ? "" : "disabled"}>
              </label>
              <label class="full">
                次回対応
                <input name="consultation_next_action" ${canEditStudent ? "" : "disabled"}>
              </label>
              <div class="form-actions full">
                <button class="btn" type="button" id="saveConsultationButton" ${canEditStudent ? "" : "disabled"}>面談記録を追加</button>
              </div>
            </div>
          </div>
          <div class="form-actions full">
            <button class="btn" type="button" id="studentOpenAnnualResults">年度結果へ</button>
            <button class="btn" type="button" id="studentOpenCertificates">証明書へ</button>
            <button class="btn" type="button" id="cancelModal">閉じる</button>
            <button class="btn primary" type="submit" ${canEditStudent ? "" : "disabled"}>保存する</button>
          </div>
        </form>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
    document.querySelector("#cancelModal").addEventListener("click", closeModal);
    document.querySelector("#studentOpenAnnualResults").addEventListener("click", () => {
      closeModal();
      openAnnualResultsForStudent(student.id);
    });
    document.querySelector("#studentOpenCertificates").addEventListener("click", () => {
      closeModal();
      openCertificatesForStudent(student.id);
    });
    document.querySelector("#openStudentRelatedFiles")?.addEventListener("click", () => {
      openStudentRelatedFilesModal(student.name, relatedFiles);
    });
    bindStudentRelatedFileReviewButtons(student.id, () => openStudentDetail(student.id));
    document.querySelector("#saveConsultationButton")?.addEventListener("click", (event) => {
      saveStudentConsultation(student.id, document.querySelector("#studentDetailForm"), event.currentTarget);
    });
    document.querySelector("#studentDetailForm").addEventListener("submit", submitStudentDetailForm);
  } catch (error) {
    showError(error);
  }
}

async function saveStudentConsultation(studentId, form, button) {
  const restore = setButtonLoading(button, "登録中...");
  try {
    const payload = {
      meeting_date: form.querySelector("[name='consultation_meeting_date']")?.value || "",
      staff_name: form.querySelector("[name='consultation_staff_name']")?.value || "",
      category: form.querySelector("[name='consultation_category']")?.value || "",
      summary: form.querySelector("[name='consultation_summary']")?.value || "",
      next_meeting_date: form.querySelector("[name='consultation_next_meeting_date']")?.value || "",
      next_action: form.querySelector("[name='consultation_next_action']")?.value || "",
    };
    await api(`/api/students/${studentId}/consultations`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    toast("面談記録を追加しました。");
    openStudentDetail(studentId);
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

function openStudentRelatedFilesModal(studentName, relatedFiles) {
  const student = state.students.find((item) => item.name === studentName);
  const modal = document.querySelector("#modalRoot");
  const filterButtons = [
    { key: "all", label: "すべて" },
    { key: "学生提出", label: "学生提出" },
    { key: "証明書", label: "証明書" },
    { key: "入管・在籍帳票", label: "入管・在籍帳票" },
    { key: "帳票", label: "帳票" },
  ];
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div>
          <h2>関連ファイル一覧</h2>
          <p>${escapeHtml(studentName)} / ${relatedFiles.length} 件</p>
        </div>
        <button class="btn" id="closeModal">閉じる</button>
      </div>
      <div class="filter-bar" style="margin-bottom:12px;">
        ${filterButtons.map((item) => `
          <button class="btn compact ${item.key === "all" ? "primary" : ""}" type="button" data-related-file-filter="${escapeHtml(item.key)}">${escapeHtml(item.label)}</button>
        `).join("")}
      </div>
      <div class="card-body preview-grid">
        <div id="studentRelatedFilesContent">${renderStudentRelatedFileGroups(relatedFiles, "all")}</div>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
  document.querySelector("#closeModal").addEventListener("click", closeModal);
  document.querySelectorAll("[data-related-file-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.relatedFileFilter || "all";
      document.querySelectorAll("[data-related-file-filter]").forEach((node) => {
        node.classList.toggle("primary", node === button);
      });
      const content = document.querySelector("#studentRelatedFilesContent");
      if (content) content.innerHTML = renderStudentRelatedFileGroups(relatedFiles, category);
      if (student) bindStudentRelatedFileReviewButtons(student.id, () => openStudentRelatedFilesModal(studentName, state.studentDetail?.related_files || relatedFiles));
    });
  });
  if (student) bindStudentRelatedFileReviewButtons(student.id, () => openStudentRelatedFilesModal(studentName, state.studentDetail?.related_files || relatedFiles));
}

function bindStudentRelatedFileReviewButtons(studentId, onDone) {
  document.querySelectorAll("[data-related-file-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const reviewKey = button.dataset.relatedFileReview || "";
      markStudentRelatedFileReviewed(studentId, {
        review_key: reviewKey,
        file_label: button.dataset.relatedFileLabel || "",
        note: document.querySelector(`[data-related-file-note="${reviewKey}"]`)?.value || "",
      }, button, onDone);
    });
  });
}

async function markStudentRelatedFileReviewed(studentId, payload, button, onDone) {
  const restore = setButtonLoading(button, "確認中...");
  try {
    const response = await api(`/api/students/${studentId}/related-files/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(response.message || "関連ファイルの確認記録に失敗しました。");
    }
    toast("関連ファイルを確認済みにしました。");
    if (typeof onDone === "function") onDone();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function submitStudentDetailForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const studentId = new FormData(form).get("id");
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "保存中...");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api(`/api/students/${studentId}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast("学生主档案を更新しました。");
    closeModal();
    renderStudents();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function renderCertificates() {
  const data = await api("/api/certificate-requests");
  const summary = data.summary || {};
  const students = data.students || [];
  const selectedStudentId = state.certificateStudentFilter || "";
  const selectedStudent = students.find((item) => item.id === selectedStudentId) || null;
  const items = filterCertificateRequestsByStudent(data.items || [], selectedStudentId);
  const canIssueCertificates = can("certificate_issue");
  document.querySelector("#certificates").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として証明書を確認中`,
      "学生からの申請を見て、承認・発行・窓口受領まで追うページです。電子版があるものは学生端と自動で連動します。",
      [
        { label: `申請中 ${items.filter((item) => item.status === "申請中").length}`, color: items.filter((item) => item.status === "申請中").length ? "yellow" : "green" },
        { label: `発行待ち ${items.filter((item) => item.status === "承認済").length}`, color: items.filter((item) => item.status === "承認済").length ? "blue" : "gray" },
        { label: canIssueCertificates ? "発行できます" : "閲覧のみ", color: canIssueCertificates ? "blue" : "gray" },
      ],
    )}
    <div class="grid stats">
      ${stat("申請総数", items.length || 0, selectedStudent ? "この学生の申請件数" : "証明書の申請件数")}
      ${stat("申請中", items.filter((item) => item.status === "申請中").length, "承認待ち")}
      ${stat("承認済", items.filter((item) => item.status === "承認済").length, "発行待ち")}
      ${stat("発行済", items.filter((item) => item.status === "発行済").length, "ダウンロード可能")}
    </div>
    ${selectedStudent ? `
      <div class="quick-actions" style="margin-top:14px;">
        <span class="badge blue">学生絞込中: ${escapeHtml(selectedStudent.student_no || "-")} / ${escapeHtml(selectedStudent.name)}</span>
        <button class="btn" id="clearCertificateStudentFilter">全学生に戻る</button>
      </div>
    ` : ""}
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">証明書申請を追加</div>
          ${badge("学生対応", "green")}
        </div>
        <form id="certificateRequestForm" class="form-grid">
          <label>
            学生
            <select name="student_id" required>
              ${students.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedStudentId === item.id ? "selected" : ""}>${escapeHtml(item.student_no || "-")} / ${escapeHtml(item.name)} / ${escapeHtml(item.class_name || "-")}</option>`).join("")}
            </select>
          </label>
          <label>
            証明書種別
            <select name="certificate_type" required>
              <option value="出席率証明書">出席率証明書</option>
              <option value="成績証明書">成績証明書</option>
              <option value="修了証明書">修了証明書</option>
            </select>
          </label>
          <label>
            部数
            <input name="copies" type="number" min="1" max="10" value="1" required>
          </label>
          <label>
            申請者
            <select name="requested_by">
              <option value="student">student</option>
              <option value="staff">staff</option>
            </select>
          </label>
          <label>
            受取方法
            <select name="delivery_method">
              <option value="電子">電子ダウンロード</option>
              <option value="窓口受取">窓口受取</option>
              <option value="電子+窓口">電子 + 窓口受取</option>
            </select>
          </label>
          <label>
            希望受取日
            <input name="preferred_pickup_date" type="date">
          </label>
          <label class="full">
            用途
            <input name="purpose" placeholder="例: 奨学金提出 / 在留更新 / 学校提出">
          </label>
          <label class="full">
            窓口メモ
            <input name="counter_note" placeholder="例: 午後受取希望 / 原本2通必要">
          </label>
          <div class="form-actions full">
            <button class="btn primary" type="submit" ${permissionDisabled("certificate_issue")}>申請を登録</button>
          </div>
        </form>
        ${permissionBadge("certificate_issue", "証明書の登録・承認・発行は staff / 入管担当 / manager のみ実行できます。")}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">運用ルール</div></div>
        <div class="card-body">
          <div class="checkline">学生ポータル: <a href="/student" target="_blank" rel="noopener noreferrer">/student</a></div>
          <div class="checkline">申請後はまず承認します。</div>
          <div class="checkline">承認済みになったら発行します。</div>
          <div class="checkline">電子申請は発行後に学生端で直接ダウンロードできます。</div>
          <div class="checkline">窓口受取は発行後に受取待ちへ変わり、受領済みまで管理できます。</div>
          <div class="checkline">第一版は出席率証明書・成績証明書・修了証明書を対象にしています。</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "証明書申請一覧",
        "学生から届いた申請を、承認・発行・窓口受取まで追跡します。",
        [
          summaryPill("承認待ち", items.filter((item) => item.status === "申請中").length, items.filter((item) => item.status === "申請中").length ? "yellow" : "gray"),
          summaryPill("発行待ち", items.filter((item) => item.status === "承認済").length, items.filter((item) => item.status === "承認済").length ? "blue" : "gray"),
          summaryPill("電子DL可", items.filter((item) => item.status === "発行済" && ["電子", "電子+窓口"].includes(item.delivery_method)).length, "green"),
        ],
        `<span class="table-section-hint">電子版は学生端と自動連動します</span>`,
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>申請日</th>
              <th>学生番号</th>
              <th>氏名</th>
              <th>種別</th>
              <th>申請元</th>
              <th>受取方法</th>
              <th>希望受取</th>
              <th>用途</th>
              <th>部数</th>
              <th>状態</th>
              <th>受取状況</th>
              <th>DL</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml((item.requested_at || "").replace("T", " "))}</div>
                  <div class="table-secondary">申請受付</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.student_no || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.student_name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(requestedByLabel(item.requested_by))}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.certificate_type || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(requestedByLabel(item.requested_by))}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.delivery_method || "電子")}</div>
                  <div class="table-secondary">${escapeHtml(item.counter_note || "標準運用")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.preferred_pickup_date || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.pickup_status || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.purpose || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(item.copies || 1)}</div></td>
                <td>${statusBadge(item.status || "-", item.status === "承認済" ? "blue" : "yellow")}</td>
                <td>${statusBadge(item.pickup_status || "-", (item.pickup_status || "").includes("待ち") ? "yellow" : "gray")}</td>
                <td>
                  <div class="table-primary">${escapeHtml(item.download_count || 0)} 回</div>
                  ${item.last_downloaded_at ? `<div class="table-secondary">${escapeHtml((item.last_downloaded_at || "").replace("T", " "))}</div>` : `<div class="table-secondary">未取得</div>`}
                </td>
                <td>
                  <div class="table-action-stack">
                    <button class="btn compact" data-certificate-approve="${escapeHtml(item.id)}" ${(!canIssueCertificates || item.status !== "申請中") ? "disabled" : ""}>承認する</button>
                    <button class="btn primary compact" data-certificate-issue="${escapeHtml(item.id)}" ${(!canIssueCertificates || item.status === "申請中") ? "disabled" : ""}>発行する</button>
                    <button class="btn compact" data-certificate-pickup="${escapeHtml(item.id)}" ${(!canIssueCertificates || item.status !== "発行済" || !["窓口受取", "電子+窓口"].includes(item.delivery_method) || item.pickup_status === "受領済") ? "disabled" : ""}>受領登録</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="13">まだ証明書申請はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#certificateRequestForm").addEventListener("submit", submitCertificateRequestForm);
  document.querySelectorAll("[data-certificate-approve]").forEach((button) => {
    button.addEventListener("click", () => approveCertificateRequest(button.dataset.certificateApprove, button));
  });
  document.querySelectorAll("[data-certificate-issue]").forEach((button) => {
    button.addEventListener("click", () => issueCertificateRequest(button.dataset.certificateIssue, button));
  });
  document.querySelectorAll("[data-certificate-pickup]").forEach((button) => {
    button.addEventListener("click", () => pickupCertificateRequest(button.dataset.certificatePickup, button));
  });
  if (document.querySelector("#clearCertificateStudentFilter")) {
    document.querySelector("#clearCertificateStudentFilter").addEventListener("click", clearCertificateStudentFilter);
  }
  const certificateTypeSelect = document.querySelector("#certificateRequestForm [name='certificate_type']");
  const deliveryMethodSelect = document.querySelector("#certificateRequestForm [name='delivery_method']");
  if (certificateTypeSelect && deliveryMethodSelect) {
    const syncDeliveryMethod = () => {
      deliveryMethodSelect.value = defaultCertificateDeliveryMethod(certificateTypeSelect.value);
    };
    certificateTypeSelect.addEventListener("change", syncDeliveryMethod);
    syncDeliveryMethod();
  }
}

async function submitCertificateRequestForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "登録中...");
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/certificate-requests", {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast("証明書申請を登録しました。");
    form.reset();
    renderCertificates();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function approveCertificateRequest(id, button) {
  const restore = setButtonLoading(button, "承認中...");
  try {
    await api(`/api/certificate-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast("証明書申請を承認しました。");
    renderCertificates();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function issueCertificateRequest(id, button) {
  const restore = setButtonLoading(button, "発行中...");
  try {
    const result = await api(`/api/certificate-requests/${id}/issue`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`${result.document.document_type} ${result.document.document_no} を発行しました。`);
    renderCertificates();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function pickupCertificateRequest(id, button) {
  const restore = setButtonLoading(button, "更新中...");
  try {
    await api(`/api/certificate-requests/${id}/pickup`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    toast("受取状況を受領済みに更新しました。");
    renderCertificates();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

function filterCertificateRequestsByStudent(items, studentId) {
  if (!studentId) return items;
  return items.filter((item) => item.student_id === studentId);
}

function defaultCertificateDeliveryMethod(certificateType) {
  const map = {
    "出席率証明書": "電子",
    "成績証明書": "窓口受取",
    "修了証明書": "窓口受取",
  };
  return map[certificateType] || "電子";
}

function openCertificatesForStudent(studentId) {
  state.certificateStudentFilter = studentId;
  showView("certificates");
}

function clearCertificateStudentFilter() {
  state.certificateStudentFilter = "";
  renderCertificates();
}

async function openWithdrawalPreview(id) {
  try {
    const preview = await api(`/api/students/${id}/withdrawal-preview`);
    const fields = preview.fields;
    const template = preview.template;
    const modal = document.querySelector("#modalRoot");
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>離脱届プレビュー</h2>
            <p>${escapeHtml(template?.name || "テンプレート未設定")} / ${escapeHtml(fields.template_status)}</p>
          </div>
          <button class="btn" id="closeModal">閉じる</button>
        </div>
        <div class="card-body preview-grid">
          <div class="preview-sheet">
            <div class="preview-head">
              <strong>離脱届</strong>
              <span>${escapeHtml(fields.document_no)}</span>
            </div>
            <div class="preview-row"><span>発行日</span><strong>${escapeHtml(fields.issue_date)}</strong></div>
            <div class="preview-row"><span>学校名</span><strong>${escapeHtml(fields.school_name)}</strong></div>
            <div class="preview-row"><span>学生番号</span><strong>${escapeHtml(fields.student_no)}</strong></div>
            <div class="preview-row"><span>氏名</span><strong>${escapeHtml(fields.student_name)}</strong></div>
            <div class="preview-row"><span>国籍</span><strong>${escapeHtml(fields.nationality)}</strong></div>
            <div class="preview-row"><span>クラス</span><strong>${escapeHtml(fields.class_name)}</strong></div>
            <div class="preview-row"><span>在留カード</span><strong>${escapeHtml(fields.residence_card_no || "-")}</strong></div>
            <div class="preview-row"><span>在留期限</span><strong>${escapeHtml(fields.residence_expiry || "-")}</strong></div>
            <div class="preview-note">${escapeHtml(fields.reason)}</div>
          </div>
          <div class="preview-meta">
            <div class="form-note">この版では離脱届の票面項目を確認できます。実ファイルへの差し込みは xlsx テンプレート接続後に行います。</div>
            ${template ? `<div class="template-path">${escapeHtml(template.source_path)}</div>` : ""}
          </div>
        </div>
      </div>
    `;
    modal.classList.remove("hidden");
    document.querySelector("#closeModal").addEventListener("click", closeModal);
  } catch (error) {
    showError(error);
  }
}

async function generateWithdrawalDocument(id, button) {
  const restore = setButtonLoading(button, "生成中...");
  try {
    const result = await api(`/api/students/${id}/withdrawal-document`, { method: "POST", body: "{}" });
    toast(`離脱届 ${result.document_no} を生成しました。`);
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    renderStudents();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportWithdrawalDocument(id, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api(`/api/students/${id}/withdrawal-export`);
    window.location.href = result.url;
    toast("離脱届ファイルを出力しました。");
    renderStudents();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function renderImmigration() {
  const canGenerateImmigration = can("immigration_generate");
  const [report, mayNovember, annualCompletion] = await Promise.all([
    api("/api/immigration-reports/semiannual-attendance"),
    api("/api/immigration-reports/may-november"),
    api("/api/immigration-reports/annual-completion"),
  ]);
  const renewal = await api("/api/immigration-reports/residence-renewal");
  const poorAttendance = await api("/api/immigration-reports/poor-attendance");
  state.immigrationReport = report;
  state.mayNovemberReport = mayNovember;
  const summary = report.summary;
  const students = report.students || [];
  const lowAttendance = report.low_attendance_students || [];
  const mnSummary = mayNovember.summary;
  const expiring = mayNovember.expiring_students || [];
  const renewalSummary = renewal.summary;
  const renewalTargets = renewal.targets || [];
  const poorSummary = poorAttendance.summary;
  const poorTargets = poorAttendance.targets || [];
  const annualSummary = annualCompletion.summary;
  const annualEntries = annualCompletion.entries || [];
  document.querySelector("#immigration").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として入管報告を確認中`,
      "このページでは提出用帳票の出力、注意対象の確認、更新対象者の洗い出しを行います。内部試運行では入管担当と manager が出力を担当します。",
      [
        { label: `低出席 ${poorSummary.target_count || 0}`, color: (poorSummary.target_count || 0) ? "yellow" : "green" },
        { label: `更新対象 ${renewalSummary.target_count || 0}`, color: (renewalSummary.target_count || 0) ? "yellow" : "green" },
        { label: canGenerateImmigration ? "出力できます" : "出力は入管担当のみ", color: canGenerateImmigration ? "blue" : "gray" },
      ],
    )}
    <div class="grid stats">
      ${stat("報告期間", summary.report_period, "半期毎出席率報告")}
      ${stat("在籍者数", summary.student_count, "対象学生数")}
      ${stat("平均出席率", `${summary.average_attendance}%`, "全体平均")}
      ${stat("80%未満 / 在留確認 / 更新", `${poorSummary.target_count} / ${mnSummary.expiring_count} / ${renewalSummary.target_count}`, "重点確認対象")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header"><div class="card-title">いま優先したい報告</div>${badge((poorSummary.target_count || 0) + (renewalSummary.target_count || 0) ? "確認あり" : "安定", ((poorSummary.target_count || 0) + (renewalSummary.target_count || 0)) ? "yellow" : "green")}</div>
        <div class="card-body task-list">
          ${taskRow("出席率不佳報告", poorSummary.target_count || 0, "immigration")}
          ${taskRow("在留期間更新", renewalSummary.target_count || 0, "immigration")}
          ${taskRow("5月 / 11月報告", mnSummary.expiring_count || 0, "immigration")}
          ${taskRow("年度終了報告", annualEntries.length || 0, "immigration")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">このページで行うこと</div></div>
        <div class="card-body">
          <div class="checkline">提出前に注意対象者を確認します。</div>
          <div class="checkline">必要な帳票を真テンプレートで出力します。</div>
          <div class="checkline">更新対象と低出席者を名簿から追いかけます。</div>
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        ${tableSectionHead(
          "半期毎出席率報告",
          "総表と明細を出力し、半期ごとの出席状況を提出用にまとめます。",
          [
            summaryPill("低出席", summary.low_attendance_count || 0, (summary.low_attendance_count || 0) ? "yellow" : "gray"),
            summaryPill("平均", `${summary.average_attendance}%`, "blue"),
          ],
          `${badge(summary.status, summary.low_attendance_count ? "yellow" : "green")}`,
        )}
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(summary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(summary.issue_date)}</strong></div>
            <div><span>報告期間</span><strong>${escapeHtml(summary.report_period)}</strong></div>
          </div>
          <div class="form-note">半期報告の総表と、個別明細のテンプレート出力を行います。</div>
          ${!canGenerateImmigration ? `<div class="form-note">出力は入管担当または manager が行います。</div>` : ""}
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="semiannualExportButton" ${canGenerateImmigration ? "" : "disabled"}>半期報告を出力</button>
            <button class="btn subtle" id="semiannualDetailExportButton" ${canGenerateImmigration ? "" : "disabled"}>明細を出力</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">注意対象</div></div>
        <div class="card-body">
          ${lowAttendance.length
            ? lowAttendance
                .map(
                  (item) =>
                    `<div class="checkline">${escapeHtml(item.name)} / ${escapeHtml(item.class_name || "-")} / ${escapeHtml(String(item.attendance_rate))}%</div>`,
                )
                .join("")
            : `<div class="checkline">現在、80% 未満の学生はいません。</div>`}
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        ${tableSectionHead(
          "5月 / 11月 受け入れ状況報告",
          "在留者リストと期限確認対象をまとめて、定期報告用に整えます。",
          [
            summaryPill("期限確認", expiring.length, expiring.length ? "yellow" : "gray"),
            summaryPill("在籍者", mnSummary.student_count || summary.student_count || 0, "blue"),
          ],
          `${badge(mnSummary.status, expiring.length ? "yellow" : "green")}`,
        )}
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(mnSummary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(mnSummary.issue_date)}</strong></div>
            <div><span>報告期間</span><strong>${escapeHtml(mnSummary.report_period)}</strong></div>
          </div>
          <div class="form-note">在留者リストと在留期限確認対象をまとめた Excel を出力します。</div>
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="mayNovemberExportButton" ${canGenerateImmigration ? "" : "disabled"}>5月/11月報告を出力</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">在留期限確認対象</div></div>
        <div class="card-body">
          ${expiring.length
            ? expiring
                .map(
                  (item) =>
                    `<div class="checkline">${escapeHtml(item.name)} / ${escapeHtml(item.residence_expiry || "-")} / ${escapeHtml(item.class_name || "-")}</div>`,
                )
                .join("")
            : `<div class="checkline">現在、優先確認対象の在留期限はありません。</div>`}
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        ${tableSectionHead(
          "年度終了報告",
          "報告様式とリストを年度結果と連動させて出力します。",
          [
            summaryPill("基準割合", annualSummary.ratio_display || "-", annualSummary.status === "基準適合" ? "green" : "yellow"),
            summaryPill("対象件数", annualEntries.length, "blue"),
          ],
          `${badge(annualSummary.status, annualSummary.status === "基準適合" ? "green" : "yellow")}`,
        )}
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(annualSummary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(annualSummary.issue_date)}</strong></div>
            <div><span>基準該当者割合</span><strong>${escapeHtml(annualSummary.ratio_display)}</strong></div>
          </div>
          <div class="form-note">報告様式とリストを真テンプレートで出力します。</div>
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="annualCompletionExportButton" ${canGenerateImmigration ? "" : "disabled"}>報告様式を出力</button>
            <button class="btn subtle" id="annualCompletionListExportButton" ${canGenerateImmigration ? "" : "disabled"}>リストを出力</button>
            <button class="btn" id="openAnnualResultsButton">年度結果を管理</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">年度終了対象</div></div>
        <div class="card-body">
          ${annualEntries.length
            ? annualEntries
                .slice(0, 5)
                .map(
                  (item) =>
                    `<div class="checkline">${escapeHtml(item.student_name)} / ${escapeHtml(item.requirement)} / ${escapeHtml(item.destination)}</div>`,
                )
                .join("")
            : `<div class="checkline">現在、年度終了報告の対象者はありません。</div>`}
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "在留期間更新（申請者リスト）",
        "在留期限 90 日以内の学生を抽出し、更新対象の帳票出力と個人五表へ進みます。",
        [
          summaryPill("更新対象", renewalTargets.length, renewalTargets.length ? "yellow" : "gray"),
          summaryPill("最短期限", renewalSummary.next_expiry || "-", "blue"),
        ],
        `${badge(renewalSummary.status, renewalTargets.length ? "yellow" : "green")}`,
      )}
      <div class="card-body">
        <div class="info-list single">
          <div><span>帳票番号</span><strong>${escapeHtml(renewalSummary.document_no)}</strong></div>
          <div><span>発行日</span><strong>${escapeHtml(renewalSummary.issue_date)}</strong></div>
          <div><span>次回期限</span><strong>${escapeHtml(renewalSummary.next_expiry || "-")}</strong></div>
        </div>
        <div class="form-note">在留期限 90 日以内の学生を自動抽出し、在留更新申請者リストを真テンプレートで出力します。</div>
        <div class="quick-actions" style="margin-top:14px;">
          <button class="btn primary" id="renewalExportButton" ${canGenerateImmigration ? "" : "disabled"}>更新申請者リストを出力</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "出席率不佳報告",
        "80% 未満の学生を抽出し、独立した報告書として提出用に出力します。",
        [
          summaryPill("対象者", poorTargets.length, poorTargets.length ? "yellow" : "gray"),
          summaryPill("最低出席率", poorSummary.lowest_attendance === "" ? "-" : `${poorSummary.lowest_attendance}%`, poorTargets.length ? "yellow" : "gray"),
        ],
        `${badge(poorSummary.status, poorTargets.length ? "yellow" : "green")}`,
      )}
      <div class="card-body">
        <div class="info-list single">
          <div><span>帳票番号</span><strong>${escapeHtml(poorSummary.document_no)}</strong></div>
          <div><span>発行日</span><strong>${escapeHtml(poorSummary.issue_date)}</strong></div>
          <div><span>最低出席率</span><strong>${escapeHtml(poorSummary.lowest_attendance === "" ? "-" : `${poorSummary.lowest_attendance}%`)}</strong></div>
        </div>
        <div class="form-note">80% 未満の学生だけを抽出した独立報告書を出力します。</div>
        <div class="quick-actions" style="margin-top:14px;">
          <button class="btn primary" id="poorAttendanceExportButton" ${canGenerateImmigration ? "" : "disabled"}>出席率不佳報告を出力</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "報告対象一覧",
        "全体の在籍者を俯瞰し、出席率と在留期限の全体感を確認します。",
        [
          summaryPill("対象学生", students.length, "blue"),
          summaryPill("出席注意", students.filter((item) => Number(item.attendance_rate) < 80).length, students.filter((item) => Number(item.attendance_rate) < 80).length ? "yellow" : "gray"),
        ],
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>学生番号</th>
              <th>氏名</th>
              <th>国籍</th>
              <th>クラス</th>
              <th>在籍状態</th>
              <th>在留期限</th>
              <th>出席率</th>
            </tr>
          </thead>
          <tbody>
            ${students.map((item) => `
              <tr>
                <td><div class="table-primary">${escapeHtml(item.student_no || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.nationality || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.nationality || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(item.class_name || "-")}</div></td>
                <td>${statusBadge(item.status || "-", "green")}</td>
                <td>
                  <div class="table-primary">${escapeHtml(item.residence_expiry || "-")}</div>
                </td>
                <td>${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}</td>
              </tr>
            `).join("") || `<tr><td colspan="7">対象学生がいません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "出席率不佳対象一覧",
        "80% 未満の学生だけを抜き出して、個別フォローと報告書対象を確認します。",
        [
          summaryPill("対象", poorTargets.length, poorTargets.length ? "yellow" : "gray"),
        ],
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>学生番号</th>
              <th>氏名</th>
              <th>クラス</th>
              <th>在留期限</th>
              <th>出席率</th>
            </tr>
          </thead>
          <tbody>
            ${poorTargets.map((item) => `
              <tr>
                <td><div class="table-primary">${escapeHtml(item.student_no || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.class_name || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(item.residence_expiry || "-")}</div></td>
                <td>${badge(`${item.attendance_rate}%`, "yellow")}</td>
              </tr>
            `).join("") || `<tr><td colspan="5">現在、80% 未満の対象者はいません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      ${tableSectionHead(
        "更新対象一覧",
        "在留期限 90 日以内の学生を優先順に確認し、個人五表へ進みます。",
        [
          summaryPill("更新対象", renewalTargets.length, renewalTargets.length ? "yellow" : "gray"),
          summaryPill("30日以内", renewalTargets.filter((item) => Number(item.days_left) <= 30).length, renewalTargets.filter((item) => Number(item.days_left) <= 30).length ? "red" : "gray"),
        ],
      )}
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>学生番号</th>
              <th>氏名</th>
              <th>クラス</th>
              <th>在留期限</th>
              <th>残日数</th>
              <th>出席率</th>
              <th>個人帳票</th>
            </tr>
          </thead>
          <tbody>
            ${renewalTargets.map((item) => `
              <tr>
                <td><div class="table-primary">${escapeHtml(item.student_no || "-")}</div></td>
                <td>
                  <div class="table-primary">${escapeHtml(item.name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td><div class="table-primary">${escapeHtml(item.class_name || "-")}</div></td>
                <td><div class="table-primary">${escapeHtml(item.residence_expiry || "-")}</div></td>
                <td>${badge(`${item.days_left}日`, item.days_left <= 30 ? "red" : "yellow")}</td>
                <td>${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}</td>
                <td><div class="table-action-stack"><button class="btn subtle renewal-form-export-button" data-student-id="${escapeHtml(item.id)}">個人五表</button></div></td>
              </tr>
            `).join("") || `<tr><td colspan="7">現在、更新対象者はいません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelector("#semiannualExportButton").addEventListener("click", (event) =>
    exportSemiannualAttendanceReport(summary.report_period, event.currentTarget),
  );
  document.querySelector("#semiannualDetailExportButton").addEventListener("click", (event) =>
    exportSemiannualAttendanceDetailReport(summary.report_period, event.currentTarget),
  );
  document.querySelector("#mayNovemberExportButton").addEventListener("click", (event) =>
    exportMayNovemberReport(mnSummary.report_period, event.currentTarget),
  );
  document.querySelector("#annualCompletionExportButton").addEventListener("click", (event) =>
    exportAnnualCompletionReport(event.currentTarget),
  );
  document.querySelector("#annualCompletionListExportButton").addEventListener("click", (event) =>
    exportAnnualCompletionList(event.currentTarget),
  );
  document.querySelector("#openAnnualResultsButton").addEventListener("click", () => showView("annualResults"));
  document.querySelector("#renewalExportButton").addEventListener("click", (event) =>
    exportResidenceRenewalReport(event.currentTarget),
  );
  document.querySelectorAll(".renewal-form-export-button").forEach((button) => {
    button.addEventListener("click", (event) => exportResidenceRenewalForm(event.currentTarget.dataset.studentId, event.currentTarget));
  });
  document.querySelector("#poorAttendanceExportButton").addEventListener("click", (event) =>
    exportPoorAttendanceReport(event.currentTarget),
  );
}

async function exportSemiannualAttendanceReport(period, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/semiannual-attendance/export", {
      method: "POST",
      body: JSON.stringify({ period }),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`半期毎出席率報告 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportSemiannualAttendanceDetailReport(period, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/semiannual-attendance-detail/export", {
      method: "POST",
      body: JSON.stringify({ period }),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`半期毎出席率報告の明細 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportMayNovemberReport(period, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/may-november/export", {
      method: "POST",
      body: JSON.stringify({ period }),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`5月/11月報告 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportAnnualCompletionReport(button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/annual-completion/export", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`年度終了報告 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportAnnualCompletionList(button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/annual-completion-list/export", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`年度終了報告リスト ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportResidenceRenewalReport(button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/residence-renewal/export", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`在留更新申請者リスト ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportResidenceRenewalForm(studentId, button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api(`/api/students/${studentId}/residence-renewal-form/export`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`在留更新許可申請書 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function exportPoorAttendanceReport(button) {
  const restore = setButtonLoading(button, "作成中...");
  try {
    const result = await api("/api/immigration-reports/poor-attendance/export", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (result.export?.url) {
      window.location.href = result.export.url;
    }
    toast(`出席率不佳報告 ${result.document.document_no} を出力しました。`);
    renderImmigration();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

async function renderAnnualResults() {
  const data = await api("/api/annual-results");
  state.annualResultsData = data;
  const summary = data.summary || {};
  const students = data.students || [];
  const selectedStudentId = state.annualResultsStudentFilter || "";
  const selectedStudent = students.find((item) => item.id === selectedStudentId) || null;
  const advancement = data.advancement || [];
  const employment = data.employment || [];
  const exams = data.exams || [];
  const withdrawals = data.withdrawals || [];
  const editing = state.editingAnnualResult;
  const visibleAdvancement = filterAnnualResultsByStudent(advancement, selectedStudentId);
  const visibleEmployment = filterAnnualResultsByStudent(employment, selectedStudentId);
  const visibleExams = filterAnnualResultsByStudent(exams, selectedStudentId);
  const visibleWithdrawals = filterAnnualResultsByStudent(withdrawals, selectedStudentId);
  const visibleTotal = visibleAdvancement.length + visibleEmployment.length + visibleExams.length + visibleWithdrawals.length;
  const submitLabel = editing ? "年度結果を更新" : "年度結果を追加";
  const formTitle = editing ? "年度結果を編集" : "年度結果を追加";
  const resultTypeValue = editing?.result_type || "advancement";
  const studentValue = editing?.student_id || selectedStudentId || students[0]?.id || "";
  const displayNameValue = editing?.display_name || "";
  const mainNameValue = editing?.main_name || editing?.title || "";
  const subNameValue = editing?.sub_name || "";
  const outcomeTypeValue = editing?.outcome_type || "就職";
  const certificateValue = editing?.certificate_no || "";
  const completionDateValue = toInputDate(editing?.completion_date || "");
  const noteValue = editing?.note || "";
  document.querySelector("#annualResults").innerHTML = `
    <div class="grid stats">
      ${stat("対象学生", selectedStudent ? `${selectedStudent.name}` : summary.student_count || 0, selectedStudent ? `${selectedStudent.student_no || "-"} / ${selectedStudent.class_name || "-"}` : "年度結果に紐づく在籍生")}
      ${stat("進学 / 就職", `${selectedStudent ? visibleAdvancement.length : summary.advancement_count || 0} / ${selectedStudent ? visibleEmployment.length : summary.employment_count || 0}`, "主な進路結果")}
      ${stat("試験 / 退学後", `${selectedStudent ? visibleExams.length : summary.exam_count || 0} / ${selectedStudent ? visibleWithdrawals.length : summary.withdrawal_count || 0}`, "年度終了報告の補足")}
      ${stat("登録件数", selectedStudent ? visibleTotal : summary.total_count || 0, selectedStudent ? "この学生に紐づく年度結果" : "年度終了報告に反映")}
    </div>
    ${selectedStudent ? `
      <div class="quick-actions" style="margin-top:14px;">
        <span class="badge blue">学生絞込中: ${escapeHtml(selectedStudent.student_no || "-")} / ${escapeHtml(selectedStudent.name)}</span>
        <button class="btn" id="clearAnnualResultsStudentFilter">全学生に戻る</button>
      </div>
    ` : ""}
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(formTitle)}</div>
          ${badge("報表連動", "green")}
        </div>
        <form id="annualResultForm" class="form-grid">
          <label>
            結果種別
            <select name="result_type" id="annualResultType" required>
              <option value="advancement" ${resultTypeValue === "advancement" ? "selected" : ""}>進学</option>
              <option value="employment" ${resultTypeValue === "employment" ? "selected" : ""}>就職</option>
              <option value="exam" ${resultTypeValue === "exam" ? "selected" : ""}>試験</option>
              <option value="withdrawal" ${resultTypeValue === "withdrawal" ? "selected" : ""}>退学後進路</option>
            </select>
          </label>
          <label>
            学生
            <select name="student_id" required>
              ${students.map((item) => `<option value="${escapeHtml(item.id)}" ${studentValue === item.id ? "selected" : ""}>${escapeHtml(item.student_no || "-")} / ${escapeHtml(item.name)} / ${escapeHtml(item.class_name || "-")}</option>`).join("")}
            </select>
          </label>
          <label class="full">
            年度報告表示名
            <input name="display_name" value="${escapeHtml(displayNameValue)}" placeholder="例: LIN XIAO（林 晓）">
          </label>
          <label>
            <span id="annualMainNameLabel">進学先学校名</span>
            <input name="main_name" id="annualMainNameInput" value="${escapeHtml(mainNameValue)}" placeholder="例: 東京国際ビジネス専門学校" required>
          </label>
          <label>
            <span id="annualSubNameLabel">学科 / 補足</span>
            <input name="sub_name" id="annualSubNameInput" value="${escapeHtml(subNameValue)}" placeholder="例: 国際経営学科">
          </label>
          <label id="annualOutcomeTypeWrapper" class="hidden">
            退学後の区分
            <select name="outcome_type" id="annualOutcomeType">
              <option value="進学" ${outcomeTypeValue === "進学" ? "selected" : ""}>進学</option>
              <option value="就職" ${outcomeTypeValue === "就職" ? "selected" : ""}>就職</option>
              <option value="日本語教育の参照枠（試験）" ${outcomeTypeValue === "日本語教育の参照枠（試験）" ? "selected" : ""}>試験</option>
            </select>
          </label>
          <label>
            <span id="annualCertificateLabel">証明書番号 / 受験番号</span>
            <input name="certificate_no" id="annualCertificateInput" value="${escapeHtml(certificateValue)}" placeholder="例: N2A552104J">
          </label>
          <label>
            完了日
            <input name="completion_date" type="date" value="${escapeHtml(completionDateValue)}" required>
          </label>
          <label class="full">
            備考
            <textarea name="note" placeholder="必要なら自由記入">${escapeHtml(noteValue)}</textarea>
          </label>
          <div class="form-note full">
            ここで追加・更新した内容は、年度終了報告の報告様式とリストにそのまま反映されます。
          </div>
          <div class="form-actions full">
            <button class="btn" type="button" id="annualResultOpenImmigration">入管報告へ戻る</button>
            ${editing ? `<button class="btn" type="button" id="annualResultCancelEdit">編集をやめる</button>` : ""}
            <button class="btn primary" type="submit">${escapeHtml(submitLabel)}</button>
          </div>
        </form>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">入力の目安</div></div>
        <div class="card-body">
          <div class="checkline">進学: 学校名と学科名を入れます。</div>
          <div class="checkline">就職: 会社名と職種を入れます。</div>
          <div class="checkline">試験: 試験名、得点、受験番号を入れます。</div>
          <div class="checkline">退学後進路: 区分を選び、進路内容を登録します。</div>
          <div class="checkline">表示名を入れると、年度終了報告リストの氏名表記を整えられます。</div>
        </div>
      </div>
    </div>
    ${renderAnnualResultCard("進学結果", visibleAdvancement, "進学先", "学科")}
    ${renderAnnualResultCard("就職結果", visibleEmployment, "就職先", "職種")}
    ${renderAnnualResultCard("試験結果", visibleExams, "試験名", "得点 / 番号")}
    ${renderAnnualResultCard("退学後進路", visibleWithdrawals, "進路内容", "区分 / 補足")}
  `;
  document.querySelector("#annualResultType").addEventListener("change", updateAnnualResultFormMeta);
  updateAnnualResultFormMeta();
  document.querySelector("#annualResultForm").addEventListener("submit", submitAnnualResultForm);
  document.querySelector("#annualResultOpenImmigration").addEventListener("click", () => showView("immigration"));
  document.querySelectorAll("[data-annual-edit]").forEach((button) => {
    button.addEventListener("click", () => startAnnualResultEdit(button.dataset.annualEdit, button.dataset.annualType));
  });
  document.querySelectorAll("[data-annual-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteAnnualResult(button.dataset.annualDelete, button.dataset.annualType, button));
  });
  if (document.querySelector("#annualResultCancelEdit")) {
    document.querySelector("#annualResultCancelEdit").addEventListener("click", cancelAnnualResultEdit);
  }
  if (document.querySelector("#clearAnnualResultsStudentFilter")) {
    document.querySelector("#clearAnnualResultsStudentFilter").addEventListener("click", clearAnnualResultsStudentFilter);
  }
}

function renderAnnualResultCard(title, items, primaryLabel, secondaryLabel) {
  return `
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">${escapeHtml(title)}</div>
        ${badge(`${items.length} 件`, "gray")}
      </div>
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>学生番号</th>
              <th>氏名</th>
              <th>${escapeHtml(primaryLabel)}</th>
              <th>${escapeHtml(secondaryLabel)}</th>
              <th>完了日</th>
              <th>備考</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>
                  <div class="applicant-name">${escapeHtml(item.display_name || item.student_name || "-")}</div>
                  <div class="applicant-sub">${escapeHtml(item.class_name || "-")}</div>
                </td>
                <td>${escapeHtml(item.title || "-")}</td>
                <td>${escapeHtml(annualSecondaryText(item) || "-")}</td>
                <td>${escapeHtml(item.completion_date || "-")}</td>
                <td>${escapeHtml(item.note || "-")}</td>
                <td>
                  <button class="btn compact" data-annual-edit="${escapeHtml(item.id)}" data-annual-type="${escapeHtml(item.result_type)}">編集</button>
                  <button class="btn compact warn" data-annual-delete="${escapeHtml(item.id)}" data-annual-type="${escapeHtml(item.result_type)}">削除</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7">まだ登録がありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function annualSecondaryText(item) {
  const parts = [];
  if (item.detail) parts.push(item.detail);
  if (item.score_text) parts.push(item.score_text);
  if (item.certificate_no) parts.push(item.certificate_no);
  return parts.join(" / ");
}

function filterAnnualResultsByStudent(items, studentId) {
  if (!studentId) return items;
  return items.filter((item) => item.student_id === studentId);
}

function openAnnualResultsForStudent(studentId) {
  state.editingAnnualResult = null;
  state.annualResultsStudentFilter = studentId;
  showView("annualResults");
}

function clearAnnualResultsStudentFilter() {
  state.annualResultsStudentFilter = "";
  state.editingAnnualResult = null;
  renderAnnualResults();
}

function updateAnnualResultFormMeta() {
  const type = document.querySelector("#annualResultType")?.value || "advancement";
  const mainLabel = document.querySelector("#annualMainNameLabel");
  const subLabel = document.querySelector("#annualSubNameLabel");
  const mainInput = document.querySelector("#annualMainNameInput");
  const subInput = document.querySelector("#annualSubNameInput");
  const certificateLabel = document.querySelector("#annualCertificateLabel");
  const certificateInput = document.querySelector("#annualCertificateInput");
  const outcomeWrapper = document.querySelector("#annualOutcomeTypeWrapper");
  if (!mainLabel || !subLabel || !mainInput || !subInput || !certificateLabel || !certificateInput || !outcomeWrapper) return;
  if (type === "advancement") {
    mainLabel.textContent = "進学先学校名";
    subLabel.textContent = "学科 / コース";
    mainInput.placeholder = "例: 東京国際ビジネス専門学校";
    subInput.placeholder = "例: 国際経営学科";
    certificateLabel.textContent = "証明書番号";
    certificateInput.placeholder = "必要な場合のみ";
    outcomeWrapper.classList.add("hidden");
  } else if (type === "employment") {
    mainLabel.textContent = "就職先会社名";
    subLabel.textContent = "職種";
    mainInput.placeholder = "例: 株式会社未来教育";
    subInput.placeholder = "例: 日本語サポート担当";
    certificateLabel.textContent = "証明書番号";
    certificateInput.placeholder = "必要な場合のみ";
    outcomeWrapper.classList.add("hidden");
  } else if (type === "exam") {
    mainLabel.textContent = "試験名";
    subLabel.textContent = "得点";
    mainInput.placeholder = "例: 日本語能力試験 N2";
    subInput.placeholder = "例: 126点";
    certificateLabel.textContent = "受験番号 / 証明書番号";
    certificateInput.placeholder = "例: N2A319856J";
    outcomeWrapper.classList.add("hidden");
  } else {
    mainLabel.textContent = "退学後の進路内容";
    subLabel.textContent = "補足 / 得点";
    mainInput.placeholder = "例: 株式会社HAN東京 退職予定";
    subInput.placeholder = "例: 103点";
    certificateLabel.textContent = "受験番号 / 証明書番号";
    certificateInput.placeholder = "必要な場合のみ";
    outcomeWrapper.classList.remove("hidden");
  }
}

async function submitAnnualResultForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const editing = state.editingAnnualResult;
  const restore = setButtonLoading(button, editing ? "更新中..." : "追加中...");
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  try {
    const path = editing ? `/api/annual-results/${editing.id}/update` : "/api/annual-results";
    await api(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    toast(editing ? "年度結果を更新しました。" : "年度結果を追加しました。年度終了報告にも反映されます。");
    state.editingAnnualResult = null;
    form.reset();
    updateAnnualResultFormMeta();
    renderAnnualResults();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

function findAnnualResultItem(id, resultType) {
  const data = state.annualResultsData || {};
  const groups = {
    advancement: data.advancement || [],
    employment: data.employment || [],
    exam: data.exams || [],
    withdrawal: data.withdrawals || [],
  };
  return (groups[resultType] || []).find((item) => item.id === id) || null;
}

function startAnnualResultEdit(id, resultType) {
  const item = findAnnualResultItem(id, resultType);
  if (!item) {
    toast("編集対象の年度結果が見つかりません。");
    return;
  }
  state.editingAnnualResult = item;
  renderAnnualResults();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelAnnualResultEdit() {
  state.editingAnnualResult = null;
  renderAnnualResults();
}

async function deleteAnnualResult(id, resultType, button) {
  const item = findAnnualResultItem(id, resultType);
  if (!item) {
    toast("削除対象の年度結果が見つかりません。");
    return;
  }
  const name = item.display_name || item.student_name || "この結果";
  if (!window.confirm(`${name} の年度結果を削除しますか。`)) return;
  const restore = setButtonLoading(button, "削除中...");
  try {
    await api(`/api/annual-results/${id}/delete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (state.editingAnnualResult?.id === id) {
      state.editingAnnualResult = null;
    }
    toast("年度結果を削除しました。");
    renderAnnualResults();
  } catch (error) {
    showError(error);
  } finally {
    restore();
  }
}

function toInputDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

async function renderAudit() {
  const logs = await api("/api/audit-logs");
  const recentCritical = logs.filter((item) =>
    ["immigration.submit", "receipt.issue", "certificate.issue", "student.residence_change_review", "student.leave_review"].includes(item.event_type),
  );
  document.querySelector("#audit").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として監査ログを確認中`,
      "内部試運行では、だれが何をしたかを追えることが大切です。まずは発行・提出・差戻しなど大きい操作から確認します。",
      [
        { label: `最新 ${logs.length}件`, color: "blue" },
        { label: `重点確認 ${recentCritical.length}件`, color: recentCritical.length ? "yellow" : "green" },
        { label: "新しい順に表示", color: "gray" },
      ],
    )}
    <div class="grid two" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header"><div class="card-title">直近で確認したい操作</div>${badge(recentCritical.length ? "確認あり" : "安定運用", recentCritical.length ? "yellow" : "green")}</div>
        <div class="card-body task-list">
          ${taskRow("入管提出記録", logs.filter((item) => item.event_type === "immigration.submit").length, "audit")}
          ${taskRow("領収書発行", logs.filter((item) => item.event_type === "receipt.issue").length, "audit")}
          ${taskRow("証明書発行", logs.filter((item) => item.event_type === "certificate.issue").length, "audit")}
          ${taskRow("在留変更反映", logs.filter((item) => item.event_type === "student.residence_change_review").length, "audit")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">見方の目安</div></div>
        <div class="card-body">
          <div class="checkline">帳票発行、入管提出、差戻し系はまず担当者と時刻を見ます。</div>
          <div class="checkline">学生関連の変更は、対象 student と更新内容を message から確認できます。</div>
          <div class="checkline">内部試運行中は、想定外の連続操作や二重発行がないかをここで追います。</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">監査ログ</div>${badge("最新50件", "gray")}</div>
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>日時</th><th>担当者</th><th>操作</th><th>対象</th><th>内容</th></tr></thead>
          <tbody>
            ${logs.map((item) => `
              <tr>
                <td>${escapeHtml(item.created_at)}</td>
                <td>${escapeHtml(item.actor)}</td>
                <td>${badge(item.event_type, "blue")}</td>
                <td>${escapeHtml(item.target_type)}</td>
                <td>${escapeHtml(item.message)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function documentTypeColor(type) {
  if (type === "領収書") return "blue";
  if (type === "合格通知書") return "green";
  if (type === "離脱届") return "yellow";
  if (type === "出席率証明書" || type === "成績証明書" || type === "修了証明書") return "blue";
  if (type === "半期毎出席率報告") return "blue";
  if (type === "5月11月在留者報告") return "green";
  if (type === "在留期間更新五表") return "yellow";
  if (type === "出席率不佳報告") return "red";
  return "gray";
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").replaceAll("-", "/");
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusBadge(status) {
  if (status === "ok" || status === "ready") return badge("正常", "green");
  if (status === "有効") return badge("有効", "green");
  if (status === "停止中") return badge("停止中", "gray");
  if (status === "error") return badge("要確認", "red");
  if (status === "not_run") return badge("未実行", "gray");
  return badge(status || "-", "gray");
}

async function renderOperations() {
  const data = await api("/api/operations-summary");
  state.operationsSummary = data;
  const summary = data.summary || {};
  const latestBackup = data.latest_backup || {};
  const lastBackupRun = data.last_backup_run || {};
  const lastSmokeCheck = data.last_smoke_check || {};
  const canManage = can("account_manage");
  document.querySelector("#operations").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} の運用確認`,
      "内部試運行で止まりやすいバックアップ、自検、アカウント状況をここでまとめて確認します。",
      [
        { label: `アカウント ${summary.staff_account_count || 0}`, color: "blue" },
        { label: `バックアップ ${summary.backup_count || 0}`, color: (summary.backup_count || 0) > 0 ? "green" : "yellow" },
        { label: `自検 ${summary.latest_smoke_status === "ok" ? "正常" : summary.latest_smoke_status === "error" ? "要確認" : "未実行"}`, color: summary.latest_smoke_status === "ok" ? "green" : summary.latest_smoke_status === "error" ? "red" : "gray" },
      ],
    )}
    <div class="grid stats">
      ${stat("最終バックアップ", formatDateTime(summary.latest_backup_at), summary.backup_count ? "バックアップ保存先あり" : "まだ保存がありません")}
      ${stat("最終自検", formatDateTime(summary.latest_smoke_at), summary.latest_smoke_status === "ok" ? "正常終了" : summary.latest_smoke_status === "error" ? "失敗ログあり" : "未実行")}
      ${stat("DB更新", formatDateTime(data.database?.updated_at), data.database ? formatBytes(data.database.size_bytes) : "DB未検出")}
      ${stat("現在の役割", currentRoleLabel(), canManage ? "運用アクション可" : "閲覧中心")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">運用アクション</div>
          ${canManage ? badge("manager", "blue") : badge("閲覧のみ", "gray")}
        </div>
        <div class="card-body">
          <div class="checkline">ローカルバックアップは DB・uploads・exports をまとめて保存します。</div>
          <div class="checkline">内部試運行自検は staff ログイン、主要 API、学生ログインまで一通り確認します。</div>
          ${!canManage ? `<div class="form-note">実行は manager のみ行えます。結果確認はこのページで続けられます。</div>` : ""}
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="runBackupButton" ${permissionDisabled("account_manage")}>バックアップ実行</button>
            <button class="btn" id="runSmokeButton" ${permissionDisabled("account_manage")}>自検実行</button>
          </div>
          ${permissionBadge("account_manage", "運用アクションの実行は manager のみ行えます。")}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">直近の運用状況</div>
        </div>
        <div class="card-body">
          <div class="checkline">バックアップ: ${statusBadge(summary.latest_backup_status)}</div>
          <div class="checkline">自検: ${statusBadge(summary.latest_smoke_status)}</div>
          <div class="checkline">保存先: ${escapeHtml(latestBackup.label || "未作成")}</div>
          <div class="checkline">DBファイル: ${escapeHtml(data.database?.path || "未検出")}</div>
        </div>
      </div>
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">バックアップ</div>
          ${statusBadge(summary.latest_backup_status)}
        </div>
        <div class="card-body">
          <div class="form-note">保存先: ${escapeHtml(latestBackup.path || "未作成")}</div>
          <div class="mini-list">
            ${(latestBackup.files || []).map((item) => `
              <div class="mini-list-row">
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.type === "directory" ? "フォルダ" : formatBytes(item.size_bytes))}</span>
              </div>
            `).join("") || `<div class="empty-state">まだバックアップはありません。</div>`}
          </div>
          <div class="log-box">${escapeHtml(lastBackupRun.stdout || lastBackupRun.stderr || "まだ実行ログはありません。")}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">内部試運行自検</div>
          ${statusBadge(summary.latest_smoke_status)}
        </div>
        <div class="card-body">
          <div class="form-note">学生ログイン確認: ${lastSmokeCheck.include_student_login === false ? "含めない" : "含める"}</div>
          <div class="log-box">${escapeHtml(lastSmokeCheck.stdout || lastSmokeCheck.stderr || "まだ自検ログはありません。")}</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">アカウント一覧</div>
        ${canManage ? badge("編集対象の確認", "blue") : badge("managerのみ詳細表示", "gray")}
      </div>
      <div class="card-body">
        ${canManage ? `
          <div class="form-grid" style="margin-bottom:14px;">
            <label>
              表示名
              <input name="staff_display_name" placeholder="例: 事務局 佐藤">
            </label>
            <label>
              ログインID
              <input name="staff_login_id" placeholder="例: sato">
            </label>
            <label>
              役割
              <select name="staff_role">
                <option value="staff">staff</option>
                <option value="immigration_report_staff">immigration_report_staff</option>
                <option value="manager">manager</option>
              </select>
            </label>
            <label>
              初期パスワード
              <input name="staff_initial_password" placeholder="8文字以上">
            </label>
            <div class="form-actions full">
              <button class="btn" type="button" id="createStaffAccountButton">アカウントを追加</button>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>表示名</th>
                <th>ログインID</th>
                <th>役割</th>
                <th>状態</th>
                <th>権限数</th>
                <th>作成日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${(data.staff_accounts || []).map((item) => `
                <tr>
                  <td>${escapeHtml(item.display_name)}</td>
                  <td>${escapeHtml(item.login_id)}</td>
                  <td>${escapeHtml(item.role)}</td>
                  <td>${statusBadge(item.status || (item.active ? "有効" : "停止中"))}</td>
                  <td>${escapeHtml(String((item.permissions || []).length))}</td>
                  <td>${escapeHtml(formatDateTime(item.created_at))}</td>
                  <td>
                    <div class="table-action-stack">
                      <button class="btn compact" type="button" data-staff-toggle="${escapeHtml(item.id)}" data-staff-active="${item.active ? "0" : "1"}">${item.active ? "停止する" : "再開する"}</button>
                      <input class="staff-reset-input" type="text" data-staff-password="${escapeHtml(item.id)}" placeholder="新しいパスワード">
                      <button class="btn compact" type="button" data-staff-reset="${escapeHtml(item.id)}">PW再設定</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<div class="form-note">アカウントの詳細確認と管理は manager のみ行えます。</div>`}
      </div>
    </div>
  `;
  const backupButton = document.querySelector("#runBackupButton");
  const smokeButton = document.querySelector("#runSmokeButton");
  if (backupButton) {
    backupButton.addEventListener("click", async (event) => {
      const restore = setButtonLoading(event.currentTarget, "実行中...");
      try {
        const result = await api("/api/operations/run-backup", { method: "POST", body: JSON.stringify({}) });
        toast(result.ok ? "バックアップが完了しました。" : "バックアップ結果を確認してください。");
        renderOperations();
      } catch (error) {
        showError(error);
      } finally {
        restore();
      }
    });
  }
  if (smokeButton) {
    smokeButton.addEventListener("click", async (event) => {
      const restore = setButtonLoading(event.currentTarget, "自検中...");
      try {
        const result = await api("/api/operations/run-smoke-check", {
          method: "POST",
          body: JSON.stringify({ include_student_login: true }),
        });
        toast(result.ok ? "内部試運行自検が完了しました。" : "自検結果に要確認があります。");
        renderOperations();
      } catch (error) {
        showError(error);
      } finally {
        restore();
      }
    });
  }
  const createStaffButton = document.querySelector("#createStaffAccountButton");
  if (createStaffButton) {
    createStaffButton.addEventListener("click", async (event) => {
      const container = event.currentTarget.closest(".form-grid");
      const restore = setButtonLoading(event.currentTarget, "追加中...");
      try {
        const payload = {
          display_name: container.querySelector("[name='staff_display_name']")?.value || "",
          login_id: container.querySelector("[name='staff_login_id']")?.value || "",
          role: container.querySelector("[name='staff_role']")?.value || "staff",
          password: container.querySelector("[name='staff_initial_password']")?.value || "",
        };
        await api("/api/staff-accounts", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast("staff アカウントを追加しました。");
        renderOperations();
      } catch (error) {
        showError(error);
      } finally {
        restore();
      }
    });
  }
  document.querySelectorAll("[data-staff-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const restore = setButtonLoading(button, "更新中...");
      try {
        await api(`/api/staff-accounts/${button.dataset.staffToggle}/status`, {
          method: "POST",
          body: JSON.stringify({ active: button.dataset.staffActive === "1" }),
        });
        toast("アカウント状態を更新しました。");
        renderOperations();
      } catch (error) {
        showError(error);
      } finally {
        restore();
      }
    });
  });
  document.querySelectorAll("[data-staff-reset]").forEach((button) => {
    button.addEventListener("click", async () => {
      const passwordInput = document.querySelector(`[data-staff-password="${button.dataset.staffReset}"]`);
      const password = passwordInput?.value || "";
      const restore = setButtonLoading(button, "再設定中...");
      try {
        await api(`/api/staff-accounts/${button.dataset.staffReset}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        toast("パスワードを再設定しました。");
        renderOperations();
      } catch (error) {
        showError(error);
      } finally {
        restore();
      }
    });
  });
}

async function renderDocuments() {
  const ledger = await api("/api/document-ledger");
  state.documentLedger = ledger;
  const summary = ledger.summary || {};
  const items = ledger.items || [];
  const filteredItems = filterDocuments(items, state.documentFilter, state.documentSearch);
  const pendingExports = items.filter((item) => !item.file_url);
  document.querySelector("#documents").innerHTML = `
    ${pageGuide(
      `${currentRoleLabel()} として帳票台帳を確認中`,
      "帳票の出力状況を一本化して見ます。内部試運行では、未出力の帳票と、すでに再配布可能なファイルをここで切り分けます。",
      [
        { label: `未出力 ${pendingExports.length}`, color: pendingExports.length ? "yellow" : "green" },
        { label: `再DL可 ${summary.exported_count ?? 0}`, color: "blue" },
        { label: "最新順に表示", color: "gray" },
      ],
    )}
    <div class="grid stats">
      ${stat("帳票総数", summary.total_count ?? 0, "生成済み帳票の件数")}
      ${stat("出力済み", summary.exported_count ?? 0, "Excel を再ダウンロードできます")}
      ${stat("領収書", summary.receipt_count ?? 0, "入金・学費関連")}
      ${stat("証明書", summary.certificate_count ?? 0, "学生申請・発行")}
      ${stat("通知書 / 離脱届 / 報告", (summary.acceptance_count ?? 0) + (summary.withdrawal_count ?? 0) + (summary.semiannual_count ?? 0) + (summary.may_november_count ?? 0) + (summary.renewal_count ?? 0) + (summary.poor_attendance_count ?? 0), "学生対応帳票")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header"><div class="card-title">いま確認したい帳票</div>${badge(pendingExports.length ? "未出力あり" : "整っています", pendingExports.length ? "yellow" : "green")}</div>
        <div class="card-body task-list">
          ${taskRow("未出力の帳票", pendingExports.length, "documents")}
          ${taskRow("証明書", summary.certificate_count ?? 0, "documents")}
          ${taskRow("領収書", summary.receipt_count ?? 0, "documents")}
          ${taskRow("入管報告帳票", (summary.semiannual_count ?? 0) + (summary.may_november_count ?? 0) + (summary.renewal_count ?? 0) + (summary.poor_attendance_count ?? 0), "documents")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">台帳の使い方</div></div>
        <div class="card-body">
          <div class="checkline">未出力はここから直接出力できます。</div>
          <div class="checkline">出力済みは Excel から再配布できます。</div>
          <div class="checkline">氏名、帳票番号、補足の検索で、学生別の再発行確認にも使えます。</div>
        </div>
      </div>
    </div>
    <div class="filter-tabs" style="margin-top:14px;">
      ${documentFilterButton("all", "すべて", items.length)}
      ${documentFilterButton("receipt", "領収書", countDocuments(items, "receipt", state.documentSearch))}
      ${documentFilterButton("certificate", "証明書", countDocuments(items, "certificate", state.documentSearch))}
      ${documentFilterButton("acceptance", "合格通知書", countDocuments(items, "acceptance", state.documentSearch))}
      ${documentFilterButton("withdrawal", "離脱届", countDocuments(items, "withdrawal", state.documentSearch))}
      ${documentFilterButton("semiannual", "半期報告", countDocuments(items, "semiannual", state.documentSearch))}
      ${documentFilterButton("maynov", "5月/11月報告", countDocuments(items, "maynov", state.documentSearch))}
      ${documentFilterButton("renewal", "更新五表", countDocuments(items, "renewal", state.documentSearch))}
      ${documentFilterButton("poor", "出席率不佳", countDocuments(items, "poor", state.documentSearch))}
      ${documentFilterButton("exported", "出力済み", countDocuments(items, "exported", state.documentSearch))}
      ${documentFilterButton("pending", "未出力", countDocuments(items, "pending", state.documentSearch))}
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">生成済み帳票一覧</div>
        <div class="ledger-actions">
          <input id="documentSearchInput" class="search-input" placeholder="氏名、帳票番号、補足で検索" value="${escapeHtml(state.documentSearch)}">
          ${badge(`${filteredItems.length} 件`, "gray")}
        </div>
      </div>
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>作成日時</th>
              <th>帳票種別</th>
              <th>帳票番号</th>
              <th>対象者</th>
              <th>補足</th>
              <th>区分</th>
              <th>ファイル</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((item) => `
              <tr>
                <td>
                  <div class="table-primary">${escapeHtml(String(item.created_at || "").replace("T", " "))}</div>
                  <div class="table-secondary">作成記録</div>
                </td>
                <td>${badge(item.document_type, documentTypeColor(item.document_type))}</td>
                <td>
                  <div class="table-primary">${escapeHtml(item.document_no || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.issue_date || "発行日未設定")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.target_name || "-")}</div>
                  <div class="table-secondary">${escapeHtml(item.target_id || "-")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.subject_name || "-")}</div>
                </td>
                <td>
                  <div class="table-primary">${escapeHtml(item.category || "-")}</div>
                  <div class="table-secondary">${item.file_url ? "再配布可能" : "未出力"}</div>
                </td>
                <td>
                  ${item.file_url
                    ? `<div class="table-action-stack"><a class="btn compact" href="${escapeHtml(item.file_url)}">Excel</a></div>`
                    : `<div class="table-action-stack"><button class="btn compact" data-ledger-export="${escapeHtml(item.document_type)}" data-ledger-id="${escapeHtml(item.target_id)}">帳票出力</button></div>`}
                </td>
              </tr>
            `).join("") || `<tr><td colspan="7">条件に合う帳票はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.querySelectorAll("[data-document-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.documentFilter = button.dataset.documentFilter;
      renderDocuments();
    });
  });
  document.querySelector("#documentSearchInput").addEventListener("input", (event) => {
    state.documentSearch = event.target.value;
    renderDocuments();
  });
  document.querySelectorAll("[data-ledger-export]").forEach((button) => {
    button.addEventListener("click", () => exportLedgerDocument(button.dataset.ledgerExport, button.dataset.ledgerId, button));
  });
}

function documentFilterButton(key, label, count) {
  const active = state.documentFilter === key ? "active" : "";
  return `<button class="filter-btn ${active}" data-document-filter="${key}">${escapeHtml(label)} <span>${count}</span></button>`;
}

function countDocuments(items, filter, search) {
  return filterDocuments(items, filter, search).length;
}

function filterDocuments(items, filter, search) {
  const keyword = String(search || "").trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "receipt" && item.document_type !== "領収書") return false;
    if (filter === "certificate" && !["出席率証明書", "成績証明書", "修了証明書"].includes(item.document_type)) return false;
    if (filter === "acceptance" && item.document_type !== "合格通知書") return false;
    if (filter === "withdrawal" && item.document_type !== "離脱届") return false;
    if (filter === "semiannual" && item.document_type !== "半期毎出席率報告") return false;
    if (filter === "maynov" && item.document_type !== "5月11月在留者報告") return false;
    if (filter === "renewal" && item.document_type !== "在留期間更新五表") return false;
    if (filter === "poor" && item.document_type !== "出席率不佳報告") return false;
    if (filter === "exported" && !item.file_url) return false;
    if (filter === "pending" && item.file_url) return false;
    if (!keyword) return true;
    const haystack = [
      item.document_no,
      item.target_name,
      item.subject_name,
      item.category,
      item.document_type,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

async function exportLedgerDocument(documentType, id, button) {
  if (documentType === "領収書") return exportReceipt(id, button);
  if (documentType === "出席率証明書" || documentType === "成績証明書" || documentType === "修了証明書") {
    return issueCertificateRequest(id, button);
  }
  if (documentType === "合格通知書") return exportAcceptanceNotice(id, button);
  if (documentType === "離脱届") return exportWithdrawalDocument(id, button);
  if (documentType === "半期毎出席率報告") return exportSemiannualAttendanceReport(id, button);
  if (documentType === "5月11月在留者報告") return exportMayNovemberReport(id, button);
  if (documentType === "在留期間更新五表") return exportResidenceRenewalReport(button);
  if (documentType === "出席率不佳報告") return exportPoorAttendanceReport(button);
  toast("この帳票はまだ台帳から出力できません。");
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelector("#adminLogoutButton").addEventListener("click", () => {
  clearAdminSession();
  renderAdminAuth("ログアウトしました。");
});

bootstrapAdminApp();
