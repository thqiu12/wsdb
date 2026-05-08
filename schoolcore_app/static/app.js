const state = {
  view: "dashboard",
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
  editingAnnualResult: null,
  annualResultsStudentFilter: "",
  certificateStudentFilter: "",
  applicantFilter: "all",
  coeFilter: "all",
  documentFilter: "all",
  documentSearch: "",
};

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
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw data.error || { message: "APIエラーが発生しました。" };
  }
  return data;
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

function requestedByLabel(value) {
  if (value === "student") return "学生";
  if (value === "staff") return "事務局";
  return value || "-";
}

function yen(value) {
  return `${Number(value).toLocaleString("ja-JP")} 円`;
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
  state.view = id;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== id);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id);
  });
  document.querySelector("#title").textContent = titles[id][0];
  document.querySelector("#subtitle").textContent = titles[id][1];
  render();
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
  document.querySelector("#dashboard").innerHTML = `
    <div class="quick-actions">
      <button class="btn" id="dashboardOpenIntake">受付を開く</button>
      <button class="btn primary" id="dashboardNewApplicant">新規出願者を登録</button>
      <button class="btn" id="dashboardOpenApplicants">出願者を確認</button>
      <button class="btn" id="dashboardOpenCoe">COE案件を確認</button>
    </div>
    <div class="grid stats">
      ${stat("出願者", data.applicant_count, "面接申請から COE まで")}
      ${stat("COE準備中", data.coe_preparing, "資料回収と AI チェック")}
      ${stat("未発行領収書", data.pending_receipts, "入金確認済み")}
      ${stat("COE送付待ち", data.blocked_coe, "領収書発行で解除")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">今日の優先業務</div>
          ${badge("業務キュー", "green")}
        </div>
        <div class="card-body task-list">
          ${taskRow("合格通知書生成待ち", data.acceptance_notice_waiting, "applicants")}
          ${taskRow("COE準備中", data.coe_preparing, "coe")}
          ${taskRow("学費入金済み・領収書未発行", data.pending_receipts, "payments")}
          ${taskRow("COE全体送付ブロック", data.blocked_coe, "coe")}
          ${taskRow("出席率80%未満", data.low_attendance, "students")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">この版でできること</div></div>
        <div class="card-body">
          <div class="checkline">新規出願者を登録できます。</div>
          <div class="checkline">選考料 20,000 円を確認できます。</div>
          <div class="checkline">面接結果を合格にできます。</div>
          <div class="checkline">合格通知書を生成できます。</div>
          <div class="checkline">COE案件を作成できます。</div>
          <div class="checkline">領収書未発行なら COE 全体送付をブロックします。</div>
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
        <button class="btn" data-open-view="${view}">開く</button>
      </div>
    </div>
  `;
}

async function renderApplicants() {
  await refreshCoreData();
  const acceptanceConfig = await api("/api/acceptance-config");
  const filteredApplicants = filterApplicants(state.applicants, state.applicantFilter);
  document.querySelector("#applicants").innerHTML = `
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
      <div class="card-header">
        <div class="card-title">出願者一覧</div>
        ${badge(`${filteredApplicants.length} / ${state.applicants.length} 件`, "gray")}
      </div>
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
      <td>${badge(item.status, step.color)}</td>
      <td>${statusMini(`${item.required_complete_count}/${item.required_total_count}`, Number(item.required_complete_count) >= Number(item.required_total_count))}</td>
      <td>${statusMini(item.application_fee_status, item.application_fee_status === "確認済")}</td>
      <td>${statusMini(item.interview_result, item.interview_result === "合格")}</td>
      <td>${statusMini(item.acceptance_notice_generated ? "済" : "未", Boolean(item.acceptance_notice_generated))}</td>
      <td>${statusMini(item.coe_case_exists ? "COE連携済" : "未", Boolean(item.coe_case_exists))}</td>
      <td>
        <button class="btn primary compact" data-next-applicant="${item.id}" ${step.done ? "disabled" : ""}>${escapeHtml(step.button)}</button>
        <button class="btn compact" data-action="acceptance-preview" data-applicant-id="${item.id}" ${item.interview_result === "合格" ? "" : "disabled"}>通知書</button>
        <button class="btn compact" data-action="acceptance-export" data-applicant-id="${item.id}" ${item.interview_result === "合格" ? "" : "disabled"}>出力</button>
        <button class="btn compact" data-action="sections" data-applicant-id="${item.id}">詳細</button>
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
  return `<span class="mini-status ${ok ? "ok" : "todo"}">${escapeHtml(text)}</span>`;
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
  const filteredCases = filterCoeCases(state.coeCases, state.coeFilter);
  document.querySelector("#coe").innerHTML = `
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
      <div class="card-header">
        <div class="card-title">COE案件一覧</div>
        ${badge(`${filteredCases.length} / ${state.coeCases.length} 件`, "gray")}
      </div>
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
      <td>${badge(status.label, status.color)}</td>
      <td>${statusMini(`${item.material_complete_count}/${item.material_total_count}`, materialsComplete)}</td>
      <td>${statusMini(item.ai_check_status, aiDone && !hasOpenIssues)}</td>
      <td>${statusMini(`${item.open_issue_count || 0}件`, !hasOpenIssues)}</td>
      <td>${statusMini(item.stage.includes("入管提出") ? "済" : "未", item.stage.includes("入管提出"))}</td>
      <td>${statusMini(item.partial_coe_sent ? "下付済" : "未", Boolean(item.partial_coe_sent))}</td>
      <td>${statusMini(item.full_tuition_confirmed && item.receipt_issued ? "確認済" : "未", Boolean(item.full_tuition_confirmed && item.receipt_issued))}</td>
      <td>
        ${next.button.replace("btn primary", "btn primary compact").replace("btn warn", "btn warn compact")}
        <button class="btn compact" data-materials="${item.id}">資料</button>
        <button class="btn compact" data-issues="${item.id}">AI結果</button>
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
    return {
      label: "入管へ提出できます",
      help: "AIチェック項目は確認済みです。提出記録を作成します。",
      button: `<button class="btn primary" data-submit-immigration="${item.id}">入管提出済みにする</button>`,
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
  document.querySelector("#payments").innerHTML = `
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
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">入金・領収書</div></div>
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>区分</th><th>金額</th><th>表示名</th><th>状態</th><th>領収書</th><th>操作</th></tr></thead>
          <tbody>
            ${payments.map((item) => `
              <tr>
                <td>${escapeHtml(item.payment_type)}</td>
                <td>${yen(item.amount)}</td>
                <td>${escapeHtml(item.payer_display_name)}</td>
                <td>${badge(item.status === "confirmed" ? "確認済" : item.status, "green")}</td>
                <td>
                  ${item.receipt_issued ? badge(item.receipt_no, "green") : badge("未発行", "yellow")}
                  <div class="applicant-sub">${escapeHtml(item.receipt_issue_date || "")}</div>
                </td>
                <td>
                  <button class="btn compact" data-receipt-preview="${item.id}">プレビュー</button>
                  <button class="btn compact" data-receipt-export="${item.id}" ${item.receipt_issued ? "" : "disabled"}>出力</button>
                  <button class="btn primary compact" ${item.receipt_issued ? "disabled" : ""} data-receipt="${item.id}">領収書発行</button>
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
  const [students, withdrawalConfig] = await Promise.all([api("/api/students"), api("/api/withdrawal-config")]);
  const activeTemplate = withdrawalConfig.active_template;
  const residenceDue = students.filter((item) => Number(item.days_to_expiry) <= 90).length;
  const attendanceWarning = students.filter((item) => Number(item.attendance_rate) < 80).length;
  document.querySelector("#students").innerHTML = `
    <div class="grid stats" style="margin-bottom:14px;">
      ${stat("在籍者数", students.length, "現在の在籍学生")}
      ${stat("在留期限90日以内", residenceDue, "更新・確認対象")}
      ${stat("出席率80%未満", attendanceWarning, "面談・報告対象")}
      ${stat("主档案更新", "可", "連絡先・在留情報を編集できます")}
    </div>
    <div class="grid two" style="margin-bottom:14px;">
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
      <div class="card">
        <div class="card-header"><div class="card-title">離脱届運用状況</div></div>
        <div class="card-body">
          <div class="checkline">登録テンプレート数: ${escapeHtml(withdrawalConfig.template_count)} 件</div>
          <div class="checkline">生成済み離脱届: ${escapeHtml(withdrawalConfig.issued_count)} 件</div>
          <div class="checkline">票面項目はプレビュー可能。xls 原本のため xlsx 化後にセル差し込みを接続します。</div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">学生一覧</div></div>
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>学生番号</th><th>氏名</th><th>国籍</th><th>状態</th><th>クラス</th><th>在留期限</th><th>出席率</th><th>注意</th><th>帳票</th><th>進路</th><th>主档案</th></tr></thead>
          <tbody>
            ${students.map((item) => `
              <tr>
                <td>${escapeHtml(item.student_no)}</td>
                <td>
                  <div class="applicant-name">${escapeHtml(item.name)}</div>
                  <div class="applicant-sub">${escapeHtml(item.phone || "-")}</div>
                </td>
                <td>${escapeHtml(item.nationality)}</td>
                <td>${badge(item.status, "green")}</td>
                <td>${escapeHtml(item.class_name)}</td>
                <td>${escapeHtml(item.residence_expiry)}</td>
                <td>${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}</td>
                <td>${item.alerts?.length ? item.alerts.map((alert) => badge(alert, item.alert_level === "red" ? "red" : "yellow")).join(" ") : badge("正常", "green")}</td>
                <td>
                  <button class="btn compact" data-withdrawal-preview="${item.id}">離脱届</button>
                  <button class="btn compact" data-withdrawal-export="${item.id}">出力</button>
                  <button class="btn primary compact" data-withdrawal-generate="${item.id}">生成</button>
                </td>
                <td>
                  <button class="btn compact" data-open-annual-results="${item.id}">年度結果</button>
                </td>
                <td>
                  <button class="btn compact" data-student-detail="${item.id}">詳細</button>
                  <button class="btn compact" data-open-certificates="${item.id}">証明書</button>
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
}

async function renderStudentPortalAdmin() {
  const data = await api("/api/student-portal-admin");
  state.studentPortalAdmin = data;
  const summary = data.summary || {};
  const leaveRequests = data.leave_requests || [];
  const homeworkSubmissions = data.homework_submissions || [];
  const bulletinPosts = data.bulletin_posts || [];
  const recentGroupMessages = data.recent_group_messages || [];
  document.querySelector("#studentPortal").innerHTML = `
    <div class="grid stats">
      ${stat("請假申請待ち", summary.leave_pending_count || 0, "公欠・欠席の承認待ち")}
      ${stat("課題提出", summary.homework_submission_count || 0, "学生端からの提出")}
      ${stat("掲示件数", summary.bulletin_count || 0, "公開中のお知らせ")}
      ${stat("群消息", summary.group_message_count || 0, "最近のクラス会話")}
    </div>

    <div class="grid two" style="margin-top:14px;">
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
            <button class="btn primary" type="submit">掲示する</button>
          </div>
        </form>
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
            <button class="btn primary" type="submit">送信する</button>
          </div>
        </form>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">最近のクラスメッセージ</div></div>
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
                <td><button class="btn compact" data-group-delete="${escapeHtml(item.id)}">削除</button></td>
              </tr>
            `).join("") || `<tr><td colspan="5">まだメッセージはありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">公欠・欠席申請</div></div>
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
                <td>${escapeHtml(item.request_date || "-")}<br><span class="muted-cell">${escapeHtml(item.period_label || "-")}</span></td>
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>${escapeHtml(item.student_name || "-")}</td>
                <td>${escapeHtml(item.class_name || "-")}</td>
                <td>${escapeHtml(item.request_type || "-")}</td>
                <td>${escapeHtml(item.reason || "-")}</td>
                <td>${badge(item.status || "-", item.status === "承認済" ? "green" : item.status === "差戻し" ? "gray" : "yellow")}</td>
                <td>
                  <button class="btn compact" data-leave-approve="${escapeHtml(item.id)}" ${item.status !== "申請中" ? "disabled" : ""}>承認</button>
                  <button class="btn compact" data-leave-reject="${escapeHtml(item.id)}" ${item.status !== "申請中" ? "disabled" : ""}>差戻し</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="8">申請はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">作業アップロード一覧</div></div>
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
                <td>${escapeHtml((item.submitted_at || "").replace("T", " "))}</td>
                <td>${escapeHtml(item.student_no || "-")}<br><span class="muted-cell">${escapeHtml(item.student_name || "-")}</span></td>
                <td>${escapeHtml(item.assignment_title || "-")}<br><span class="muted-cell">締切 ${escapeHtml(item.due_date || "-")}</span></td>
                <td>${escapeHtml(item.subject_name || "-")}</td>
                <td>${badge(item.status || "-", item.status === "再提出" ? "yellow" : "green")}</td>
                <td>${escapeHtml(item.file_name || "-")}</td>
                <td>${escapeHtml(item.note || "-")}</td>
                <td>${escapeHtml(item.review_comment || item.reviewed_by || "-")}</td>
                <td>
                  <button class="btn compact" data-homework-review="${escapeHtml(item.id)}" data-review-status="確認済">確認済</button>
                  <button class="btn compact" data-homework-review="${escapeHtml(item.id)}" data-review-status="再提出依頼">再提出依頼</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="9">まだ提出はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">公開中の掲示</div></div>
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
                <td><button class="btn compact" data-bulletin-pin="${escapeHtml(item.id)}" data-pin-value="${item.pinned ? "0" : "1"}">${item.pinned ? "解除" : "置頂"}</button></td>
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
    const annualResults = detail.annual_results || [];
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
          <label>
            学生番号
            <input name="student_no" value="${escapeHtml(student.student_no || "")}" required>
          </label>
          <label>
            氏名
            <input name="name" value="${escapeHtml(student.name || "")}" required>
          </label>
          <label>
            国籍
            <input name="nationality" value="${escapeHtml(student.nationality || "")}" required>
          </label>
          <label>
            在籍状態
            <input name="status" value="${escapeHtml(student.status || "")}" required>
          </label>
          <label>
            クラス
            <input name="class_name" value="${escapeHtml(student.class_name || "")}">
          </label>
          <label>
            出席率
            <input name="attendance_rate" type="number" min="0" max="100" step="0.1" value="${escapeHtml(student.attendance_rate || "")}">
          </label>
          <label>
            在留資格
            <input name="residence_status" value="${escapeHtml(student.residence_status || "")}">
          </label>
          <label>
            在留カード番号
            <input name="residence_card_no" value="${escapeHtml(student.residence_card_no || "")}">
          </label>
          <label>
            在留期限
            <input name="residence_expiry" type="date" value="${escapeHtml(student.residence_expiry || "")}">
          </label>
          <label>
            入学日
            <input name="admission_date" type="date" value="${escapeHtml(student.admission_date || "")}">
          </label>
          <label>
            生年月日
            <input name="birth_date" type="date" value="${escapeHtml(student.birth_date || "")}">
          </label>
          <label>
            旅券番号
            <input name="passport_no" value="${escapeHtml(student.passport_no || "")}">
          </label>
          <label>
            日本の電話番号
            <input name="phone" value="${escapeHtml(student.phone || "")}">
          </label>
          <label class="full">
            日本の住所
            <input name="address_japan" value="${escapeHtml(student.address_japan || "")}">
          </label>
          <label class="full">
            緊急連絡先
            <input name="emergency_contact" value="${escapeHtml(student.emergency_contact || "")}">
          </label>
          <label class="full">
            備考
            <textarea name="notes">${escapeHtml(student.notes || "")}</textarea>
          </label>
          <div class="full info-list">
            <div><span>在留期限まで</span><strong>${summary.days_to_expiry == null ? "-" : `${summary.days_to_expiry}日`}</strong></div>
            <div><span>出席率注意</span><strong>${summary.attendance_warning ? "要確認" : "正常"}</strong></div>
            <div><span>年度結果</span><strong>${summary.annual_result_count || 0} 件</strong></div>
          </div>
          <div class="full preview-sheet">
            <div class="preview-head"><strong>最近の年度結果</strong><span>${annualResults.length} 件</span></div>
            ${annualResults.length ? annualResults.map((item) => `<div class="preview-row"><span>${escapeHtml(item.requirement || item.result_type)}</span><strong>${escapeHtml(item.destination || item.title || "-")}</strong></div>`).join("") : `<div class="preview-row"><span>年度結果</span><strong>まだありません</strong></div>`}
          </div>
          <div class="form-actions full">
            <button class="btn" type="button" id="studentOpenAnnualResults">年度結果へ</button>
            <button class="btn" type="button" id="studentOpenCertificates">証明書へ</button>
            <button class="btn" type="button" id="cancelModal">閉じる</button>
            <button class="btn primary" type="submit">保存する</button>
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
    document.querySelector("#studentDetailForm").addEventListener("submit", submitStudentDetailForm);
  } catch (error) {
    showError(error);
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
  document.querySelector("#certificates").innerHTML = `
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
          <label class="full">
            用途
            <input name="purpose" placeholder="例: 奨学金提出 / 在留更新 / 学校提出">
          </label>
          <div class="form-actions full">
            <button class="btn primary" type="submit">申請を登録</button>
          </div>
        </form>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">運用ルール</div></div>
        <div class="card-body">
          <div class="checkline">学生ポータル: <a href="/student" target="_blank" rel="noopener noreferrer">/student</a></div>
          <div class="checkline">申請後はまず承認します。</div>
          <div class="checkline">承認済みになったら発行します。</div>
          <div class="checkline">発行すると台帳に入り、Excel を再ダウンロードできます。</div>
          <div class="checkline">第一版は出席率証明書・成績証明書・修了証明書を対象にしています。</div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">証明書申請一覧</div></div>
      <div class="table-scroll">
        <table class="dense-table">
          <thead>
            <tr>
              <th>申請日</th>
              <th>学生番号</th>
              <th>氏名</th>
              <th>種別</th>
              <th>申請元</th>
              <th>用途</th>
              <th>部数</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${escapeHtml((item.requested_at || "").replace("T", " "))}</td>
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>${escapeHtml(item.student_name || "-")}</td>
                <td>${escapeHtml(item.certificate_type || "-")}</td>
                <td>${escapeHtml(requestedByLabel(item.requested_by))}</td>
                <td>${escapeHtml(item.purpose || "-")}</td>
                <td>${escapeHtml(item.copies || 1)}</td>
                <td>${badge(item.status || "-", item.status === "発行済" ? "green" : item.status === "承認済" ? "blue" : "yellow")}</td>
                <td>
                  <button class="btn compact" data-certificate-approve="${escapeHtml(item.id)}" ${item.status !== "申請中" ? "disabled" : ""}>承認</button>
                  <button class="btn primary compact" data-certificate-issue="${escapeHtml(item.id)}" ${item.status === "申請中" ? "disabled" : ""}>発行</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="9">まだ証明書申請はありません。</td></tr>`}
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
  if (document.querySelector("#clearCertificateStudentFilter")) {
    document.querySelector("#clearCertificateStudentFilter").addEventListener("click", clearCertificateStudentFilter);
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

function filterCertificateRequestsByStudent(items, studentId) {
  if (!studentId) return items;
  return items.filter((item) => item.student_id === studentId);
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
    <div class="grid stats">
      ${stat("報告期間", summary.report_period, "半期毎出席率報告")}
      ${stat("在籍者数", summary.student_count, "対象学生数")}
      ${stat("平均出席率", `${summary.average_attendance}%`, "全体平均")}
      ${stat("80%未満 / 在留確認 / 更新", `${poorSummary.target_count} / ${mnSummary.expiring_count} / ${renewalSummary.target_count}`, "重点確認対象")}
    </div>
    <div class="grid two" style="margin-top:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">半期毎出席率報告</div>
          ${badge(summary.status, summary.low_attendance_count ? "yellow" : "green")}
        </div>
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(summary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(summary.issue_date)}</strong></div>
            <div><span>報告期間</span><strong>${escapeHtml(summary.report_period)}</strong></div>
          </div>
          <div class="form-note">半期報告の総表と、個別明細のテンプレート出力を行います。</div>
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="semiannualExportButton">半期報告を出力</button>
            <button class="btn subtle" id="semiannualDetailExportButton">明細を出力</button>
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
        <div class="card-header">
          <div class="card-title">5月 / 11月 受け入れ状況報告</div>
          ${badge(mnSummary.status, expiring.length ? "yellow" : "green")}
        </div>
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(mnSummary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(mnSummary.issue_date)}</strong></div>
            <div><span>報告期間</span><strong>${escapeHtml(mnSummary.report_period)}</strong></div>
          </div>
          <div class="form-note">在留者リストと在留期限確認対象をまとめた Excel を出力します。</div>
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="mayNovemberExportButton">5月/11月報告を出力</button>
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
        <div class="card-header">
          <div class="card-title">年度終了報告</div>
          ${badge(annualSummary.status, annualSummary.status === "基準適合" ? "green" : "yellow")}
        </div>
        <div class="card-body">
          <div class="info-list single">
            <div><span>帳票番号</span><strong>${escapeHtml(annualSummary.document_no)}</strong></div>
            <div><span>発行日</span><strong>${escapeHtml(annualSummary.issue_date)}</strong></div>
            <div><span>基準該当者割合</span><strong>${escapeHtml(annualSummary.ratio_display)}</strong></div>
          </div>
          <div class="form-note">報告様式とリストを真テンプレートで出力します。</div>
          <div class="quick-actions" style="margin-top:14px;">
            <button class="btn primary" id="annualCompletionExportButton">報告様式を出力</button>
            <button class="btn subtle" id="annualCompletionListExportButton">リストを出力</button>
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
      <div class="card-header">
        <div class="card-title">在留期間更新（申請者リスト）</div>
        ${badge(renewalSummary.status, renewalTargets.length ? "yellow" : "green")}
      </div>
      <div class="card-body">
        <div class="info-list single">
          <div><span>帳票番号</span><strong>${escapeHtml(renewalSummary.document_no)}</strong></div>
          <div><span>発行日</span><strong>${escapeHtml(renewalSummary.issue_date)}</strong></div>
          <div><span>次回期限</span><strong>${escapeHtml(renewalSummary.next_expiry || "-")}</strong></div>
        </div>
        <div class="form-note">在留期限 90 日以内の学生を自動抽出し、在留更新申請者リストを真テンプレートで出力します。</div>
        <div class="quick-actions" style="margin-top:14px;">
          <button class="btn primary" id="renewalExportButton">更新申請者リストを出力</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header">
        <div class="card-title">出席率不佳報告</div>
        ${badge(poorSummary.status, poorTargets.length ? "yellow" : "green")}
      </div>
      <div class="card-body">
        <div class="info-list single">
          <div><span>帳票番号</span><strong>${escapeHtml(poorSummary.document_no)}</strong></div>
          <div><span>発行日</span><strong>${escapeHtml(poorSummary.issue_date)}</strong></div>
          <div><span>最低出席率</span><strong>${escapeHtml(poorSummary.lowest_attendance === "" ? "-" : `${poorSummary.lowest_attendance}%`)}</strong></div>
        </div>
        <div class="form-note">80% 未満の学生だけを抽出した独立報告書を出力します。</div>
        <div class="quick-actions" style="margin-top:14px;">
          <button class="btn primary" id="poorAttendanceExportButton">出席率不佳報告を出力</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">報告対象一覧</div></div>
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
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>${escapeHtml(item.name || "-")}</td>
                <td>${escapeHtml(item.nationality || "-")}</td>
                <td>${escapeHtml(item.class_name || "-")}</td>
                <td>${escapeHtml(item.status || "-")}</td>
                <td>${escapeHtml(item.residence_expiry || "-")}</td>
                <td>${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}</td>
              </tr>
            `).join("") || `<tr><td colspan="7">対象学生がいません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">出席率不佳対象一覧</div></div>
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
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>${escapeHtml(item.name || "-")}</td>
                <td>${escapeHtml(item.class_name || "-")}</td>
                <td>${escapeHtml(item.residence_expiry || "-")}</td>
                <td>${badge(`${item.attendance_rate}%`, "yellow")}</td>
              </tr>
            `).join("") || `<tr><td colspan="5">現在、80% 未満の対象者はいません。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:14px;">
      <div class="card-header"><div class="card-title">更新対象一覧</div></div>
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
                <td>${escapeHtml(item.student_no || "-")}</td>
                <td>${escapeHtml(item.name || "-")}</td>
                <td>${escapeHtml(item.class_name || "-")}</td>
                <td>${escapeHtml(item.residence_expiry || "-")}</td>
                <td>${badge(`${item.days_left}日`, item.days_left <= 30 ? "red" : "yellow")}</td>
                <td>${badge(`${item.attendance_rate}%`, item.attendance_rate < 80 ? "yellow" : "green")}</td>
                <td><button class="btn subtle renewal-form-export-button" data-student-id="${escapeHtml(item.id)}">個人五表</button></td>
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
  document.querySelector("#audit").innerHTML = `
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

async function renderDocuments() {
  const ledger = await api("/api/document-ledger");
  state.documentLedger = ledger;
  const summary = ledger.summary || {};
  const items = ledger.items || [];
  const filteredItems = filterDocuments(items, state.documentFilter, state.documentSearch);
  document.querySelector("#documents").innerHTML = `
    <div class="grid stats">
      ${stat("帳票総数", summary.total_count ?? 0, "生成済み帳票の件数")}
      ${stat("出力済み", summary.exported_count ?? 0, "Excel を再ダウンロードできます")}
      ${stat("領収書", summary.receipt_count ?? 0, "入金・学費関連")}
      ${stat("証明書", summary.certificate_count ?? 0, "学生申請・発行")}
      ${stat("通知書 / 離脱届 / 報告", (summary.acceptance_count ?? 0) + (summary.withdrawal_count ?? 0) + (summary.semiannual_count ?? 0) + (summary.may_november_count ?? 0) + (summary.renewal_count ?? 0) + (summary.poor_attendance_count ?? 0), "学生対応帳票")}
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
                <td>${escapeHtml(String(item.created_at || "").replace("T", " "))}</td>
                <td>${badge(item.document_type, documentTypeColor(item.document_type))}</td>
                <td>${escapeHtml(item.document_no || "-")}</td>
                <td>
                  <div>${escapeHtml(item.target_name || "-")}</div>
                  <div class="applicant-sub">${escapeHtml(item.issue_date || "")}</div>
                </td>
                <td>${escapeHtml(item.subject_name || "-")}</td>
                <td>${escapeHtml(item.category || "-")}</td>
                <td>
                  ${item.file_url
                    ? `<a class="btn compact" href="${escapeHtml(item.file_url)}">Excel</a>`
                    : `<button class="btn compact" data-ledger-export="${escapeHtml(item.document_type)}" data-ledger-id="${escapeHtml(item.target_id)}">出力</button>`}
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

render();
