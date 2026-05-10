const studentPortalState = {
  authMode: "login",
  activePage: "home",
  activeChatTab: "classroom",
  activeChatView: "list",
  sessionToken: "",
  loginId: "",
  student: null,
  summary: null,
  studentCard: null,
  attendance: null,
  consultations: [],
  examResults: [],
  grades: [],
  bulletinPosts: [],
  groupChat: [],
  chatThreads: { classroom: [], homeroom: [] },
  homework: { assignments: [] },
  settings: null,
  requests: [],
  profileChangeRequests: [],
  residenceChangeRequests: [],
  pendingAttendanceCode: "",
  pendingCheckoutCode: "",
};

const STUDENT_PORTAL_BOOTSTRAP_KEY = "studentPortalBootstrap";
const INITIAL_ATTENDANCE_CODE = new URLSearchParams(window.location.search).get("attendance_code") || "";
const INITIAL_CHECKOUT_CODE = new URLSearchParams(window.location.search).get("checkout_code") || "";

async function studentPortalApi(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw data.error || { message: "処理に失敗しました。" };
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

function toast(message, isError = false) {
  let node = document.querySelector(".portal-toast");
  if (!node) {
    node = document.createElement("div");
    node.className = "portal-toast hidden";
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.className = `portal-toast ${isError ? "error" : ""}`;
  window.setTimeout(() => node.classList.add("hidden"), 3200);
}

function setButtonLoading(button, text) {
  if (!button) {
    return () => {};
  }
  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  button.disabled = true;
  button.textContent = text;
  return () => {
    button.disabled = originalDisabled;
    button.textContent = originalText;
  };
}

function statusBadge(status) {
  if (status === "発行済") return badge(status, "green");
  if (status === "承認済") return badge(status, "blue");
  return badge(status || "-", "yellow");
}

function metricCard(label, value, note = "") {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-note">${escapeHtml(note)}</div>
    </div>
  `;
}

function profileRow(label, value) {
  return `
    <div class="profile-row">
      <div class="profile-label">${escapeHtml(label)}</div>
      <div class="profile-value">${escapeHtml(value || "-")}</div>
    </div>
  `;
}

function todoBadge(status) {
  if (status === "期限注意" || status === "未提出" || status === "再提出依頼") return badge(status, "yellow");
  if (status === "承認待ち" || status === "確認待ち") return badge(status, "blue");
  if (status === "発行済" || status === "完了") return badge(status, "green");
  return badge(status || "-", "gray");
}

function portalNavItem(key, label, isActive) {
  const captions = {
    home: "総合",
    card: "ID",
    attendance: "記録",
    chat: "連絡",
    homework: "対応",
    apply: "申請",
    my: "設定",
  };
  return `
    <button type="button" class="portal-nav-item ${isActive ? "active" : ""}" data-portal-page="${escapeHtml(key)}">
      <span class="portal-nav-label">${escapeHtml(label)}</span>
      <span class="portal-nav-caption">${escapeHtml(captions[key] || "")}</span>
    </button>
  `;
}

function quickActionTile(key, title, note) {
  return `
    <button type="button" class="quick-action-tile" data-portal-page="${escapeHtml(key)}">
      <span class="quick-action-title">${escapeHtml(title)}</span>
      <span class="quick-action-note">${escapeHtml(note)}</span>
    </button>
  `;
}

function initials(name) {
  const text = String(name || "").trim();
  if (!text) return "SC";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function defaultCertificateDeliveryMethod(certificateType) {
  const map = {
    "出席率証明書": "電子",
    "成績証明書": "窓口受取",
    "修了証明書": "窓口受取",
  };
  return map[certificateType] || "電子";
}

function certificateDeliveryLabel(method) {
  if (method === "電子+窓口") return "電子 + 窓口";
  if (method === "窓口受取") return "窓口受取";
  return "電子";
}

function residenceChangeFileLink(requestId, kind, fileName) {
  if (!fileName || !studentPortalState.sessionToken) return "";
  const token = encodeURIComponent(studentPortalState.sessionToken);
  const id = encodeURIComponent(requestId);
  return `/api/public/residence-change-files/${id}/${kind}?session_token=${token}`;
}

function certificateFulfillmentState(item) {
  const method = item.delivery_method || "電子";
  const status = item.status || "";
  const pickupStatus = item.pickup_status || "";
  const hasFile = Boolean(item.file_url);
  if (status !== "発行済") {
    if (status === "承認済") {
      return { label: "発行待ち", tone: "blue", note: "事務局で発行準備中です。" };
    }
    return { label: "承認待ち", tone: "yellow", note: "事務局の確認後に発行へ進みます。" };
  }
  if (method === "電子") {
    return hasFile
      ? { label: "電子版あり", tone: "green", note: "この画面からそのままダウンロードできます。" }
      : { label: "発行済", tone: "green", note: "電子版の準備が終わり次第ここに表示されます。" };
  }
  if (method === "窓口受取") {
    if (pickupStatus === "受領済") {
      return { label: "受領済", tone: "green", note: "窓口で受け取りが完了しています。" };
    }
    return { label: "窓口受取待ち", tone: "yellow", note: "紙の証明書は事務局窓口で受け取ってください。" };
  }
  if (pickupStatus === "受領済") {
    return { label: "受領済", tone: "green", note: "電子版と紙の受取が完了しています。" };
  }
  return hasFile
    ? { label: "電子版あり", tone: "green", note: "電子版を先にダウンロードでき、紙は窓口で受け取れます。" }
    : { label: "窓口受取待ち", tone: "yellow", note: "紙の受取準備中です。電子版も発行後ここに出ます。" };
}

function certificateEtaText(item) {
  const method = item.delivery_method || "電子";
  const status = item.status || "";
  const pickupStatus = item.pickup_status || "";
  if (status === "申請中") return "目安: 事務局確認後に発行へ進みます。";
  if (status === "承認済") return "目安: 発行準備が完了するとここに反映されます。";
  if (status !== "発行済") return "目安: ステータス更新をお待ちください。";
  if (method === "電子") return "目安: いまダウンロードできます。";
  if (method === "窓口受取") {
    return pickupStatus === "受領済" ? "目安: 受取完了です。" : "目安: 事務局窓口で受け取れます。";
  }
  return pickupStatus === "受領済"
    ? "目安: 電子版と紙の受取が完了しています。"
    : "目安: 電子版は今すぐ、紙は窓口で受け取れます。";
}

function certificateDeliveryPill(method) {
  const label = certificateDeliveryLabel(method);
  if (method === "窓口受取") return badge(`紙 ${label}`, "yellow");
  if (method === "電子+窓口") return badge(`電子+紙 ${label}`, "blue");
  return badge(`電子 ${label}`, "green");
}

function toTimeValue(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function todoPriority(item) {
  const status = item.status || "";
  if (status === "期限注意") return 0;
  if (status === "再提出依頼") return 1;
  if (status === "未提出") return 2;
  if (status === "確認待ち") return 3;
  if (status === "承認待ち") return 4;
  if (status === "発行待ち") return 5;
  return 9;
}

function todoTone(status) {
  if (status === "期限注意") return "critical";
  if (status === "再提出依頼") return "warning";
  if (status === "未提出") return "pending";
  if (status === "確認待ち" || status === "承認待ち" || status === "発行待ち") return "info";
  return "neutral";
}

function todoCard(item, extraClass = "") {
  const targetPage = item.targetPage || "homework";
  const tone = todoTone(item.status || "");
  const cardClass = `history-card action-card todo-card todo-card-${tone} ${extraClass}`.trim();
  return `
    <button type="button" class="${escapeHtml(cardClass)}" data-portal-page="${escapeHtml(targetPage)}">
      <div class="history-head">
        <strong>${escapeHtml(item.title || "-")}</strong>
        ${todoBadge(item.status)}
      </div>
      <div class="history-meta">
        <span>${escapeHtml(item.meta || "-")}</span>
        <span class="todo-card-link">開く</span>
      </div>
      <div class="muted-note">${escapeHtml(item.note || "")}</div>
    </button>
  `;
}

function chatConversationCard(key, title, note, meta, isActive, countText = "") {
  const avatarText = key === "classroom" ? "班" : "担";
  return `
    <button type="button" class="chat-conversation-card ${isActive ? "active" : ""}" data-chat-tab="${escapeHtml(key)}">
      <div class="chat-conversation-top">
        <div class="chat-conversation-avatar">${escapeHtml(avatarText)}</div>
        <div class="chat-conversation-head">
          <strong>${escapeHtml(title)}</strong>
          ${countText ? badge(countText, isActive ? "blue" : "gray") : ""}
        </div>
      </div>
      <div class="chat-conversation-note">${escapeHtml(note || "まだメッセージはありません。")}</div>
      <div class="chat-conversation-meta">${escapeHtml(meta || "")}</div>
    </button>
  `;
}

function conversationPreviewTile(key, title, preview, meta, countText = "") {
  return `
    <button type="button" class="history-card action-card conversation-preview-tile" data-open-chat-tab="${escapeHtml(key)}">
      <div class="history-head">
        <strong>${escapeHtml(title)}</strong>
        ${countText ? badge(countText, "gray") : ""}
      </div>
      <div class="history-purpose">${escapeHtml(preview || "まだメッセージはありません。")}</div>
      <div class="history-meta">
        <span>${escapeHtml(meta || "チャットを開く")}</span>
        <span class="todo-card-link">開く</span>
      </div>
    </button>
  `;
}

function chatThreadStats(messages = []) {
  const teacherCount = messages.filter((item) => item.author_role === "staff").length;
  const studentCount = messages.filter((item) => item.author_role !== "staff").length;
  const latest = messages.length ? messages[messages.length - 1] : null;
  return {
    teacherCount,
    studentCount,
    latest,
  };
}

function summaryMiniCard(label, title, meta, note = "", tone = "blue") {
  return `
    <article class="summary-mini-card">
      <div class="history-head">
        <strong>${escapeHtml(title || "-")}</strong>
        ${badge(label, tone)}
      </div>
      <div class="history-meta">
        <span>${escapeHtml(meta || "-")}</span>
      </div>
      <div class="muted-note">${escapeHtml(note || "")}</div>
    </article>
  `;
}

function applyActionCard(kicker, title, note, toneClass = "") {
  return `
    <div class="apply-action-card ${escapeHtml(toneClass)}">
      <div class="section-kicker">${escapeHtml(kicker)}</div>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(note)}</p>
    </div>
  `;
}

function pageHeader(eyebrow, title, summary, tags = []) {
  return `
    <section class="panel page-header">
      <div class="page-eyebrow">${escapeHtml(eyebrow)}</div>
      <div class="page-title-row">
        <h3>${escapeHtml(title)}</h3>
        ${tags.length ? `<div class="page-chip-row">${tags.join("")}</div>` : ""}
      </div>
      <p class="page-summary">${escapeHtml(summary)}</p>
    </section>
  `;
}

function applyPortalPayload(result) {
  studentPortalState.sessionToken = result.session_token || "";
  studentPortalState.loginId = result.login_id || studentPortalState.loginId;
  studentPortalState.student = result.student || null;
  studentPortalState.summary = result.summary || null;
  studentPortalState.studentCard = result.student_card || null;
  studentPortalState.attendance = result.attendance || null;
  studentPortalState.consultations = result.consultations || [];
  studentPortalState.examResults = result.exam_results || [];
  studentPortalState.grades = result.grades || [];
  studentPortalState.bulletinPosts = result.bulletin_posts || [];
  studentPortalState.groupChat = result.group_chat || [];
  studentPortalState.chatThreads = result.chat_threads || { classroom: result.group_chat || [], homeroom: [] };
  studentPortalState.homework = result.homework || { assignments: [] };
  studentPortalState.settings = result.settings || null;
  studentPortalState.requests = result.certificate_requests || [];
  studentPortalState.profileChangeRequests = result.profile_change_requests || [];
  studentPortalState.residenceChangeRequests = result.residence_change_requests || [];
}

function toggleAuthMode(mode) {
  studentPortalState.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  document.querySelector("#studentLoginForm").classList.toggle("hidden", mode !== "login");
  document.querySelector("#studentSetupForm").classList.toggle("hidden", mode !== "setup");
}

function bindAuthShellEvents() {
  if (document.body.dataset.portalAuthBound === "true") return;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => toggleAuthMode(button.dataset.authMode));
  });
  document.querySelector("#studentLoginForm")?.addEventListener("submit", submitStudentLogin);
  document.querySelector("#studentSetupForm")?.addEventListener("submit", submitStudentPasswordSetup);
  document.querySelector("#studentLoginButton")?.addEventListener("click", () => {
    const form = document.querySelector("#studentLoginForm");
    if (form) submitStudentLogin({ preventDefault() {}, currentTarget: form });
  });
  document.querySelector("#studentSetupButton")?.addEventListener("click", () => {
    const form = document.querySelector("#studentSetupForm");
    if (form) submitStudentPasswordSetup({ preventDefault() {}, currentTarget: form });
  });
  document.body.dataset.portalAuthBound = "true";
}

function bindGlobalPortalDelegation() {
  if (document.body.dataset.portalGlobalBound === "true") return;
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-auth-mode]");
    if (!target) return;
    event.preventDefault();
    toggleAuthMode(target.dataset.authMode);
  });
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === "studentLoginForm") {
      submitStudentLogin(event);
      return;
    }
    if (form.id === "studentSetupForm") {
      submitStudentPasswordSetup(event);
      return;
    }
  });
  document.body.dataset.portalGlobalBound = "true";
}

function hydrateStudentPortalBootstrap() {
  try {
    const raw = window.sessionStorage.getItem(STUDENT_PORTAL_BOOTSTRAP_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload && payload.student && payload.session_token) {
      studentPortalState.activePage = "home";
      studentPortalState.activeChatTab = "classroom";
      applyPortalPayload(payload);
    }
    window.sessionStorage.removeItem(STUDENT_PORTAL_BOOTSTRAP_KEY);
  } catch (_error) {
    window.sessionStorage.removeItem(STUDENT_PORTAL_BOOTSTRAP_KEY);
  }
}

async function tryAutoAttendanceCheckin() {
  const accessCode = (studentPortalState.pendingAttendanceCode || INITIAL_ATTENDANCE_CODE || "").trim();
  if (!studentPortalState.sessionToken || !accessCode) return false;
  try {
    const result = await studentPortalApi("/api/public/attendance-checkin", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        access_code: accessCode,
      }),
    });
    studentPortalState.pendingAttendanceCode = "";
    applyPortalPayload(result);
    studentPortalState.activePage = "attendance";
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("attendance_code");
      window.history.replaceState({}, "", url.toString());
    } catch (_error) {
      // ignore
    }
    toast(result.checkin_message || "出席を登録しました。");
    return true;
  } catch (error) {
    toast(error.message || "出席登録に失敗しました。", true);
    studentPortalState.pendingAttendanceCode = accessCode;
    studentPortalState.activePage = "attendance";
    return false;
  }
}

async function tryAutoAttendanceCheckout() {
  const accessCode = (studentPortalState.pendingCheckoutCode || INITIAL_CHECKOUT_CODE || "").trim();
  if (!studentPortalState.sessionToken || !accessCode) return false;
  try {
    const result = await studentPortalApi("/api/public/attendance-checkout", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        access_code: accessCode,
      }),
    });
    studentPortalState.pendingCheckoutCode = "";
    applyPortalPayload(result);
    studentPortalState.activePage = "attendance";
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout_code");
      window.history.replaceState({}, "", url.toString());
    } catch (_error) {
      // ignore
    }
    toast(result.checkout_message || "退室を登録しました。");
    return true;
  } catch (error) {
    toast(error.message || "退室登録に失敗しました。", true);
    studentPortalState.pendingCheckoutCode = accessCode;
    studentPortalState.activePage = "attendance";
    return false;
  }
}

function syncPortalShell(isAuthenticated) {
  const shell = document.querySelector("#studentPortalShell");
  if (!shell) return;
  if (isAuthenticated) {
    shell.innerHTML = "";
    document.body.dataset.portalAuthBound = "false";
    return;
  }
  if (shell.childElementCount) {
    bindAuthShellEvents();
    toggleAuthMode(studentPortalState.authMode || "login");
    return;
  }
  const template = document.querySelector("#studentPortalShellTemplate");
  if (!template) return;
  shell.innerHTML = template.innerHTML;
  document.body.dataset.portalAuthBound = "false";
  bindAuthShellEvents();
  toggleAuthMode(studentPortalState.authMode || "login");
}

function renderStudentPortal() {
  const root = document.querySelector("#studentPortalContent");
  const student = studentPortalState.student;
  const summary = studentPortalState.summary || {};
  const studentCard = studentPortalState.studentCard || {};
  const attendance = studentPortalState.attendance || { summary: {}, records: [], leave_requests: [] };
  const consultations = studentPortalState.consultations || [];
  const exams = studentPortalState.examResults || [];
  const grades = studentPortalState.grades || [];
  const bulletinPosts = studentPortalState.bulletinPosts || [];
  const chatThreads = studentPortalState.chatThreads || { classroom: [], homeroom: [] };
  const groupChat = chatThreads.classroom || studentPortalState.groupChat || [];
  const homeroomChat = chatThreads.homeroom || [];
  const homework = studentPortalState.homework || { assignments: [] };
  const settings = studentPortalState.settings || {};
  const items = studentPortalState.requests || [];
  const profileChangeRequests = studentPortalState.profileChangeRequests || [];
  const residenceChangeRequests = studentPortalState.residenceChangeRequests || [];
  const pendingProfileChangeCount = profileChangeRequests.filter((item) => item.status === "申請中").length;
  const completedProfileChangeCount = profileChangeRequests.filter((item) => item.status === "反映済").length;
  const pendingResidenceChangeCount = residenceChangeRequests.filter((item) => item.status === "申請中").length;
  const completedResidenceChangeCount = residenceChangeRequests.filter((item) => item.status === "反映済").length;
  const activePage = studentPortalState.activePage || "home";
  const activeChatTab = studentPortalState.activeChatTab || "classroom";
  const activeChatView = studentPortalState.activeChatView || "list";
  const todoItems = [];
  if (summary.days_to_expiry !== null && summary.days_to_expiry !== undefined && summary.days_to_expiry <= 90) {
    todoItems.push({
      title: "在留期限の確認",
      status: "期限注意",
      meta: `${summary.days_to_expiry}日後に期限`,
      note: student.residence_expiry || "在留期限未登録",
      targetPage: "my",
      sortDate: student.residence_expiry || "",
      category: "手続き",
    });
  }
  (homework.assignments || []).forEach((item) => {
    const status = item.submission_status || "未提出";
    if (!item.submission_id || status === "再提出依頼") {
      todoItems.push({
        title: item.title || "課題",
        status,
        meta: `${item.subject_name || "-"} / 締切 ${item.due_date || "-"}`,
        note: item.review_comment || item.description || "",
        targetPage: "homework",
        sortDate: item.due_date || "",
        category: "学習",
      });
    }
  });
  (items || []).forEach((item) => {
    if (item.status === "承認済" || item.status === "申請中") {
      todoItems.push({
        title: item.certificate_type || "証明書申請",
        status: item.status === "申請中" ? "承認待ち" : "発行待ち",
        meta: `申請日 ${(item.requested_at || "").slice(0, 10) || "-"}`,
        note: item.purpose || "用途未入力",
        targetPage: "apply",
        sortDate: item.requested_at || "",
        category: "申請",
      });
    }
  });
  (attendance.leave_requests || []).forEach((item) => {
    if (item.status === "申請中") {
      todoItems.push({
        title: `${item.request_type || "申請"} / ${item.request_date || "-"}`,
        status: "確認待ち",
        meta: item.period_label || "全時限",
        note: item.reason || "",
        targetPage: "attendance",
        sortDate: item.request_date || "",
        category: "申請",
      });
    }
  });
  todoItems.sort((a, b) => {
    const priorityDelta = todoPriority(a) - todoPriority(b);
    if (priorityDelta !== 0) return priorityDelta;
    return toTimeValue(a.sortDate || a.deadline || a.rawDate || "") - toTimeValue(b.sortDate || b.deadline || b.rawDate || "");
  });
  const topTodo = todoItems[0] || null;
  const urgentTodos = todoItems.filter((item) => todoPriority(item) <= 1);
  const studyTodos = todoItems.filter((item) => item.category === "学習");
  const requestTodos = todoItems.filter((item) => item.category === "申請");
  const processTodos = todoItems.filter((item) => item.category === "手続き");
  const certificateReadyCount = items.filter((item) => {
    const state = certificateFulfillmentState(item);
    return state.label === "電子版あり";
  }).length;
  const certificatePickupCount = items.filter((item) => {
    const state = certificateFulfillmentState(item);
    return state.label === "窓口受取待ち";
  }).length;
  const certificateReceivedCount = items.filter((item) => {
    const state = certificateFulfillmentState(item);
    return state.label === "受領済";
  }).length;
  const classroomLatest = groupChat.length ? groupChat[groupChat.length - 1] : null;
  const homeroomLatest = homeroomChat.length ? homeroomChat[homeroomChat.length - 1] : null;
  const classroomStaffCount = groupChat.filter((item) => item.author_role === "staff").length;
  const homeroomStaffCount = homeroomChat.filter((item) => item.author_role === "staff").length;
  const activeMessages = activeChatTab === "classroom" ? groupChat : homeroomChat;
  const activeThreadTitle = activeChatTab === "classroom" ? `班級群 ${student.class_name || ""}`.trim() : "班主任";
  const activeThreadStats = chatThreadStats(activeMessages);
  const leavePendingCount = (attendance.leave_requests || []).filter((item) => item.status === "申請中").length;
  const certificatePendingCount = items.filter((item) => item.status === "申請中").length;
  const studentCardStatusTone = summary.days_to_expiry !== null && summary.days_to_expiry !== undefined && summary.days_to_expiry <= 90 ? "yellow" : "green";
  const studentCardValidLabel = summary.days_to_expiry !== null && summary.days_to_expiry !== undefined ? `有効 ${summary.days_to_expiry}日` : "有効期限未登録";
  const certificateIssuedCount = items.filter((item) => item.status === "発行済").length;
  const latestCertificate = items[0] || null;
  const recentCheckins = attendance.recent_checkins || [];
  if (!student) {
    syncPortalShell(false);
    root.innerHTML = "";
    root.classList.add("hidden");
    return;
  }

  const alerts = summary.alerts || [];
  const expiryLabel = summary.days_to_expiry === null || summary.days_to_expiry === undefined
    ? "未登録"
    : `${summary.days_to_expiry}日`;

  syncPortalShell(true);
  root.classList.remove("hidden");
  root.innerHTML = `
    <section class="panel student-summary">
      <div class="student-heading">
        <div class="section-kicker">学生情報</div>
        <h2>${escapeHtml(student.name)}</h2>
        <div class="summary-lines">
          <span>${escapeHtml(student.student_no || "-")}</span>
          <span>${escapeHtml(student.class_name || "-")}</span>
          <span>${escapeHtml(student.status || "-")}</span>
        </div>
      </div>
      <button class="subtle-btn" id="logoutStudentPortal">ログアウト</button>
    </section>

    <nav class="portal-nav" aria-label="学生ポータル内メニュー">
      ${portalNavItem("home", "ホーム", activePage === "home")}
      ${portalNavItem("card", "学生証", activePage === "card")}
      ${portalNavItem("attendance", "出席", activePage === "attendance")}
      ${portalNavItem("chat", "チャット", activePage === "chat")}
      ${portalNavItem("homework", "To Do", activePage === "homework")}
      ${portalNavItem("apply", "申請", activePage === "apply")}
      ${portalNavItem("my", "マイページ", activePage === "my")}
    </nav>

    <section class="portal-page ${activePage === "home" ? "" : "hidden"}" data-portal-view="home">
      <section class="metrics-grid">
      ${metricCard("学生番号", student.student_no || "-", "ログインID")}
      ${metricCard("出席率", attendance.summary.overall_rate !== undefined ? `${attendance.summary.overall_rate}%` : (student.attendance_rate !== null && student.attendance_rate !== undefined ? `${student.attendance_rate}%` : "-"), summary.attendance_warning ? "注意対象" : "現在値")}
      ${metricCard("在留期限まで", expiryLabel, student.residence_expiry || "期限未登録")}
      ${metricCard("To Do", `${todoItems.length}件`, "今やること")}
      </section>

      ${topTodo ? `
        <section class="panel top-todo-banner">
          <div class="panel-head">
            <div>
              <div class="section-kicker">最優先</div>
              <h3>今日いちばん先に確認したいこと</h3>
              <p class="panel-note">今いちばん先に動くと、後の手続きが楽になる項目です。</p>
            </div>
            ${todoBadge(topTodo.status)}
          </div>
          ${todoCard(topTodo, "top-todo-card")}
        </section>
      ` : ""}

      <section class="home-hero-grid">
        <article class="panel student-card-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">学生証</div>
              <h3>デジタル学生証</h3>
            </div>
            <button type="button" class="subtle-btn" data-open-student-card>大きく表示</button>
          </div>
          <div class="student-id-card">
            <div class="student-id-topline">
              <div class="student-id-school">${escapeHtml(studentCard.school_name || "渋谷外語学院")}</div>
              <div class="student-id-badges">
                ${badge(student.status || "在籍", "green")}
                ${badge(studentCardValidLabel, studentCardStatusTone)}
              </div>
            </div>
            <div class="student-id-name">${escapeHtml(studentCard.name || student.name || "-")}</div>
            <div class="student-id-emphasis">${escapeHtml(studentCard.student_no || student.student_no || "-")}</div>
            <div class="student-id-meta">
              <span>クラス ${escapeHtml(studentCard.class_name || student.class_name || "-")}</span>
              <span>在留資格 ${escapeHtml(studentCard.residence_status || student.residence_status || "-")}</span>
            </div>
            <div class="student-id-meta">
              <span>入学日 ${escapeHtml(studentCard.admission_date || student.admission_date || "-")}</span>
              <span>在留期限 ${escapeHtml(student.residence_expiry || "-")}</span>
            </div>
            <div class="student-id-footer">
              <span>学校連絡先 03-6233-9963</span>
              <span>提示用デジタル学生証</span>
            </div>
          </div>
        </article>

        <article class="panel home-focus-panel ${alerts.length ? "alert-panel" : ""}">
          <div class="panel-head">
            <div>
              <div class="section-kicker">事務局からの確認項目</div>
              <h3>今日の確認</h3>
            </div>
            ${badge(`${alerts.length || 0}件`, alerts.length ? "yellow" : "gray")}
          </div>
          <div class="alert-list">
            ${(alerts.length ? alerts : ["新しいお知らせはありません。"]).map((text) => `<div class="alert-pill">${escapeHtml(text)}</div>`).join("")}
          </div>
          <div class="home-focus-footer">
            <div>
              <div class="section-kicker">証明書</div>
              <strong>${certificateIssuedCount}件 発行済</strong>
              <span>${escapeHtml(latestCertificate?.certificate_type || "最近の発行なし")}</span>
            </div>
            <div>
              <div class="section-kicker">申請</div>
              <strong>${leavePendingCount + certificatePendingCount}件 処理中</strong>
              <span>公欠・証明書の確認待ち</span>
            </div>
          </div>
        </article>
      </section>

      <section class="info-grid home-primary-grid">
        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">クイックアクセス</div>
              <h3>よく使う機能</h3>
            </div>
          </div>
          <div class="quick-action-grid">
            ${quickActionTile("card", "学生証", "すぐ見せる")}
            ${quickActionTile("attendance", "出席", "最近の記録")}
            ${quickActionTile("chat", "チャット", "班級群・班主任")}
            ${quickActionTile("homework", "To Do", "対応が必要なもの")}
            ${quickActionTile("apply", "申請", "証明書・公欠")}
          </div>
        </article>

        <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の動き</div>
            <h3>直近の To Do</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${todoItems.slice(0, 3).map((item) => todoCard(item)).join("") || `<div class="empty-state">現在対応が必要な To Do はありません。</div>`}
        </div>
      </article>
      </section>

      <section class="info-grid home-secondary-grid">

      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の連絡</div>
            <h3>チャット</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${conversationPreviewTile(
            "classroom",
            `班級群 ${student.class_name || ""}`.trim(),
            classroomLatest ? classroomLatest.body : "クラス全体のお知らせを確認できます。",
            classroomLatest ? `${(classroomLatest.posted_at || "").replace("T", " ")} / ${classroomLatest.author_name || "-"}` : "全体連絡",
            `${groupChat.length}件`
          )}
          ${conversationPreviewTile(
            "homeroom",
            "班主任",
            homeroomLatest ? homeroomLatest.body : "班主任との個別相談に使います。",
            homeroomLatest ? `${(homeroomLatest.posted_at || "").replace("T", " ")} / ${homeroomLatest.author_name || "-"}` : "個別相談",
            `${homeroomChat.length}件`
          )}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の状況</div>
            <h3>出席とお知らせ</h3>
          </div>
        </div>
        <div class="summary-mini-grid">
          <article class="summary-mini-card">
            <div class="section-kicker">最近の出席</div>
            ${(attendance.records || []).slice(-2).reverse().map((item) => `
              <div class="history-head" style="margin-top:10px;">
                <strong>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")}</strong>
                ${badge(item.status || "-", item.status === "出席" ? "green" : item.status === "公欠" ? "blue" : "yellow")}
              </div>
            `).join("") || `<div class="empty-state">まだ出席記録はありません。</div>`}
          </article>
          <article class="summary-mini-card">
            <div class="section-kicker">最近のお知らせ</div>
            ${bulletinPosts.slice(0, 2).map((item) => `
              <div class="history-head" style="margin-top:10px;">
                <strong>${escapeHtml(item.title || "-")}</strong>
                ${item.pinned ? badge("置頂", "yellow") : ""}
              </div>
            `).join("") || `<div class="empty-state">掲示はまだありません。</div>`}
          </article>
        </div>
      </article>
      </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">学習サマリー</div>
          <h3>面談・試験・成績</h3>
        </div>
      </div>
      <div class="summary-mini-grid">
        ${consultations[0] ? summaryMiniCard(
          consultations[0].category || "面談",
          consultations[0].meeting_date || "-",
          consultations[0].staff_name || "-",
          consultations[0].summary || consultations[0].next_action || "",
          "blue"
        ) : ""}
        ${exams[0] ? summaryMiniCard(
          "試験",
          exams[0].exam_name || "-",
          exams[0].completion_date || "-",
          exams[0].score_text || exams[0].note || "",
          "green"
        ) : ""}
        ${grades[0] ? summaryMiniCard(
          "成績",
          grades[0].subject_name || "-",
          grades[0].term_label || "-",
          `${grades[0].grade || "-"} / ${grades[0].score || 0} ${grades[0].comment ? `- ${grades[0].comment}` : ""}`.trim(),
          "green"
        ) : ""}
        ${!consultations[0] && !exams[0] && !grades[0] ? `<div class="empty-state">まだ学習サマリーはありません。</div>` : ""}
      </div>
    </section>
    </section>

    <section class="portal-page ${activePage === "card" ? "" : "hidden"}" data-portal-view="card">
      ${pageHeader("学生証", "提示用表示", "駅員や外部の方に見せるときは、この画面をそのまま表示してください。", [badge(student.status || "-", "blue")])}
      <section class="panel student-card-page">
        <div class="panel-head">
          <div>
            <div class="section-kicker">Student ID</div>
            <h3>Digital Student ID</h3>
          </div>
          <button type="button" class="subtle-btn" data-portal-page="home">ホームに戻る</button>
        </div>
        <div class="student-id-card student-id-card-large">
          <div class="student-id-topline">
            <div class="student-id-school">${escapeHtml(studentCard.school_name || "渋谷外語学院")}</div>
            <div class="student-id-badges">
              ${badge(student.status || "在籍", "green")}
              ${badge(studentCardValidLabel, studentCardStatusTone)}
            </div>
          </div>
          <div class="student-id-name">${escapeHtml(studentCard.name || student.name || "-")}</div>
          <div class="student-id-emphasis">${escapeHtml(studentCard.student_no || student.student_no || "-")}</div>
          <div class="student-id-meta student-id-meta-large">
            <span>クラス ${escapeHtml(studentCard.class_name || student.class_name || "-")}</span>
            <span>在籍状態 ${escapeHtml(student.status || "-")}</span>
          </div>
          <div class="student-id-meta student-id-meta-large">
            <span>在留資格 ${escapeHtml(studentCard.residence_status || student.residence_status || "-")}</span>
            <span>在留期限 ${escapeHtml(student.residence_expiry || "-")}</span>
          </div>
          <div class="student-id-meta student-id-meta-large">
            <span>入学日 ${escapeHtml(studentCard.admission_date || student.admission_date || "-")}</span>
            <span>学校連絡先 03-6233-9963</span>
          </div>
        </div>
        <div class="student-card-caption">
          <div>${escapeHtml(student.address_japan || "住所未登録")}</div>
          <div>${escapeHtml(student.phone || "学校連絡先未登録")}</div>
        </div>
      </section>
    </section>

    <section class="portal-page ${activePage === "attendance" ? "" : "hidden"}" data-portal-view="attendance">
      ${pageHeader("出席", "出席状況", "出席率と申請履歴をまとめて確認できます。", [
        badge(attendance.summary.overall_rate !== undefined ? `${attendance.summary.overall_rate}%` : "-", "green"),
        badge(summary.attendance_warning ? "注意対象" : "安定", summary.attendance_warning ? "yellow" : "blue")
      ])}
      <section class="info-grid">
        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">QR出席</div>
              <h3>授業コードで出席</h3>
            </div>
            ${badge(student.class_name || "-", "blue")}
          </div>
          <div class="request-mini-guide cool">
            <strong>教室の QR / コードを使います</strong>
            <p>先生が表示した授業ごとの出席コードを入力すると、その時限の出席が記録されます。QR を読み込んだ場合も同じコードで処理します。</p>
          </div>
          <form id="studentAttendanceCheckinForm" class="settings-form">
            <label>
              出席コード
              <input name="access_code" value="${escapeHtml(studentPortalState.pendingAttendanceCode || INITIAL_ATTENDANCE_CODE || "")}" placeholder="例: A1B2C3" required>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit">出席する</button>
            </div>
          </form>
        </article>
        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">QR退室</div>
              <h3>退室コードで記録</h3>
            </div>
            ${badge("早退判定", "yellow")}
          </div>
          <div class="request-mini-guide cool">
            <strong>授業終了時にもコードを使えます</strong>
            <p>終了前に退室コードを読み込むと、残り時間に応じて早退として記録します。通常どおり最後まで受講した場合は無理に入力しなくて大丈夫です。</p>
          </div>
          <form id="studentAttendanceCheckoutForm" class="settings-form">
            <label>
              退室コード
              <input name="access_code" value="${escapeHtml(studentPortalState.pendingCheckoutCode || INITIAL_CHECKOUT_CODE || "")}" placeholder="例: F7G8H9" required>
            </label>
            <div class="form-actions">
              <button class="primary-btn secondary" type="submit">退室する</button>
            </div>
          </form>
        </article>
      </section>
      <section class="info-grid">
        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">最近のQR出席</div>
              <h3>チェックイン履歴</h3>
            </div>
          </div>
          <div class="history-list compact-list">
            ${recentCheckins.map((item) => `
              <article class="history-card">
                <div class="history-head">
                  <strong>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")}</strong>
                  ${badge("QR出席", "green")}
                </div>
                <div class="muted-note">${escapeHtml(item.note || "")}</div>
              </article>
            `).join("") || `<div class="empty-state">まだ QR 出席の記録はありません。</div>`}
          </div>
        </article>
      </section>
      <section class="metrics-grid">
        ${metricCard("総合出席率", attendance.summary.overall_rate !== undefined ? `${attendance.summary.overall_rate}%` : "-", "全体")}
        ${metricCard("今月出席率", attendance.summary.monthly_rate !== undefined ? `${attendance.summary.monthly_rate}%` : "-", "当月")}
        ${metricCard("欠席回数", attendance.summary.absence_count !== undefined ? `${attendance.summary.absence_count} 回` : "-", "通常欠席")}
        ${metricCard("公欠回数", attendance.summary.official_absence_count !== undefined ? `${attendance.summary.official_absence_count} 回` : "-", "承認済")}
      </section>

      <section class="panel history-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">出席明細</div>
            <h3>最近の出席状況</h3>
          </div>
        </div>
        <div class="history-list">
            ${(attendance.records || []).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")}</strong>
                ${badge(item.status || "-", item.status === "出席" ? "green" : item.status === "公欠" ? "blue" : item.status === "遅刻" ? "yellow" : item.status === "早退" ? "yellow" : "red")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.attendance_minutes || 0)} 分 / ${escapeHtml(item.scheduled_minutes || 0)} 分</span>
                ${item.late_minutes ? `<span>遅刻 ${escapeHtml(item.late_minutes)} 分</span>` : ""}
                ${item.early_leave_minutes ? `<span>早退 ${escapeHtml(item.early_leave_minutes)} 分</span>` : ""}
              </div>
              <div class="history-purpose">${escapeHtml(item.note || "記録メモなし")}</div>
            </article>
          `).join("") || `<div class="empty-state">まだ出席明細はありません。</div>`}
        </div>
      </section>

      <section class="panel history-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">申請履歴</div>
            <h3>公欠・欠席申請の状況</h3>
          </div>
        </div>
        <div class="history-list">
          ${(attendance.leave_requests || []).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.request_type || "-")} / ${escapeHtml(item.request_date || "-")}</strong>
                ${statusBadge(item.status)}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.period_label || "全時限")}</span>
              </div>
              <div class="history-purpose">${escapeHtml(item.reason || "-")}</div>
              <div class="muted-note">${escapeHtml(item.detail || "詳細なし")}</div>
            </article>
          `).join("") || `<div class="empty-state">まだ公欠・欠席申請はありません。</div>`}
        </div>
      </section>
    </section>

    <section class="portal-page ${activePage === "chat" ? "" : "hidden"}" data-portal-view="chat">
      ${pageHeader(
        "チャット",
        activeChatView === "list" ? "会話一覧" : "学生連絡",
        activeChatView === "list"
          ? "班級群と班主任の会話をここから開けます。"
          : (activeChatTab === "classroom" ? "クラス全体の連絡を確認したり、クラスメッセージを送れます。" : "班主任との個別連絡に使います。"),
        [badge(activeChatView === "list" ? "一覧" : (activeChatTab === "classroom" ? "班級群" : "班主任"), "blue")]
      )}
      <section class="panel chat-page-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">${escapeHtml(activeChatView === "list" ? "会話一覧" : "現在の会話")}</div>
            <h3>${escapeHtml(activeChatView === "list" ? "チャットを選ぶ" : activeThreadTitle)}</h3>
          </div>
          ${activeChatView === "list"
            ? badge("2件", "gray")
            : badge(activeChatTab === "classroom" ? (student.class_name || "-") : "担任", "blue")}
        </div>
        <div class="chat-conversation-list" role="tablist" aria-label="チャット種類">
          ${chatConversationCard(
            "classroom",
            `班級群 ${student.class_name || ""}`.trim(),
            classroomLatest ? classroomLatest.body : "クラス全体のお知らせや連絡を確認できます。",
            classroomLatest ? `${(classroomLatest.posted_at || "").replace("T", " ")} / ${classroomLatest.author_name || "-"}` : "全体連絡",
            activeChatView === "detail" && activeChatTab === "classroom",
            `${groupChat.length}件`
          )}
          ${chatConversationCard(
            "homeroom",
            "班主任",
            homeroomLatest ? homeroomLatest.body : "自分の班主任と1対1で相談できます。",
            homeroomLatest ? `${(homeroomLatest.posted_at || "").replace("T", " ")} / ${homeroomLatest.author_name || "-"}` : "個別相談",
            activeChatView === "detail" && activeChatTab === "homeroom",
            `${homeroomChat.length}件`
          )}
        </div>
        ${activeChatView === "list" ? `
          <div class="chat-summary-row">
            ${badge(`${classroomStaffCount + homeroomStaffCount}件の先生メッセージ`, "gray")}
            <span class="panel-note">会話を選ぶと、そのままメッセージ一覧に入れます。</span>
          </div>
          <div class="chat-context-card">
            <strong>チャットの使い分け</strong>
            <p>班級群はクラス全体への連絡、班主任は個別相談や確認事項に使います。</p>
          </div>
        ` : `
          <div class="chat-detail-actions">
            <button type="button" class="subtle-btn chat-back-button" data-chat-back>会話一覧に戻る</button>
          </div>
          <div class="chat-summary-row">
            ${badge(activeChatTab === "classroom" ? `${classroomStaffCount}件の先生メッセージ` : `${homeroomStaffCount}件の先生メッセージ`, "gray")}
            <span class="panel-note">${activeChatTab === "classroom" ? "クラス全体のお知らせや連絡を確認できます。" : "自分の班主任と1対1で相談できます。"}</span>
          </div>
          <div class="chat-selected-thread">
            <div>
              <div class="section-kicker">現在の会話</div>
              <h4>${escapeHtml(activeThreadTitle)}</h4>
              <p>${escapeHtml(activeThreadStats.latest ? `${(activeThreadStats.latest.posted_at || "").replace("T", " ")} に ${activeThreadStats.latest.author_name || "-"} から更新` : "まだ新しいメッセージはありません。")}</p>
            </div>
            <div class="chat-thread-chips">
              ${badge(`${activeThreadStats.teacherCount}件 先生`, "blue")}
              ${badge(`${activeThreadStats.studentCount}件 学生`, "gray")}
            </div>
          </div>
          <div class="chat-context-card">
            <strong>${escapeHtml(activeChatTab === "classroom" ? "班級群でできること" : "班主任チャットでできること")}</strong>
            <p>${escapeHtml(activeChatTab === "classroom" ? "授業連絡、課題の確認、クラス全体への質問に使います。" : "欠席相談、在留更新の相談、個別確認に使います。")}</p>
          </div>
          <div class="chat-timeline">
            ${activeMessages.map((item) => `
              <article class="chat-bubble ${item.author_role === "staff" ? "staff" : "student"}">
                <div class="chat-bubble-head">
                  <strong>${escapeHtml(item.author_name || "-")}</strong>
                  ${badge(item.author_role === "staff" ? "先生" : "学生", item.author_role === "staff" ? "blue" : "gray")}
                </div>
                <div class="history-purpose">${escapeHtml(item.body || "-")}</div>
                <div class="chat-time">${escapeHtml((item.posted_at || "").replace("T", " "))}</div>
              </article>
            `).join("") || `<div class="empty-state">まだメッセージはありません。</div>`}
          </div>
          <form id="studentGroupChatForm" class="chat-form chat-page-form">
            <input type="hidden" name="channel" value="${escapeHtml(activeChatTab)}">
            <input name="message" placeholder="${escapeHtml(activeChatTab === "classroom" ? "クラス全体にメッセージを送る" : "班主任にメッセージを送る")}" required>
            <button class="primary-btn" type="submit">送信</button>
          </form>
        `}
      </section>
    </section>

    <section class="portal-page ${activePage === "homework" ? "" : "hidden"}" data-portal-view="homework">
      ${pageHeader("To Do", "やること一覧", "学生が今対応すべきことを優先度高くまとめます。", [
        badge(`${todoItems.length}件`, todoItems.length ? "yellow" : "green")
      ])}
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">学生タスク</div>
            <h3>To Do</h3>
          </div>
          ${badge(`${todoItems.length}件`, todoItems.length ? "yellow" : "green")}
        </div>
        <p class="panel-note">課題、在留期限、申請状況など、今やることをここにまとめます。</p>
        <div class="todo-summary-row">
          ${badge(`緊急 ${urgentTodos.length}件`, urgentTodos.length ? "yellow" : "gray")}
          ${badge(`学習 ${studyTodos.length}件`, studyTodos.length ? "blue" : "gray")}
          ${badge(`申請 ${requestTodos.length}件`, requestTodos.length ? "blue" : "gray")}
          ${badge(`手続き ${processTodos.length}件`, processTodos.length ? "blue" : "gray")}
        </div>
        ${todoItems.length ? `
          <div class="todo-group-list">
            ${urgentTodos.length ? `
              <section class="todo-group">
                <div class="todo-group-head">
                  <div class="section-kicker">最優先</div>
                  <h4>先に対応したいこと</h4>
                </div>
                <div class="history-list compact-list">
                  ${urgentTodos.map((item) => todoCard(item)).join("")}
                </div>
              </section>
            ` : ""}
            ${processTodos.length ? `
              <section class="todo-group">
                <div class="todo-group-head">
                  <div class="section-kicker">手続き</div>
                  <h4>期限や確認が必要なこと</h4>
                </div>
                <div class="history-list compact-list">
                  ${processTodos.map((item) => todoCard(item)).join("")}
                </div>
              </section>
            ` : ""}
            ${requestTodos.length ? `
              <section class="todo-group">
                <div class="todo-group-head">
                  <div class="section-kicker">申請</div>
                  <h4>確認待ちの申請</h4>
                </div>
                <div class="history-list compact-list">
                  ${requestTodos.map((item) => todoCard(item)).join("")}
                </div>
              </section>
            ` : ""}
            ${studyTodos.length ? `
              <section class="todo-group">
                <div class="todo-group-head">
                  <div class="section-kicker">学習</div>
                  <h4>課題と再提出</h4>
                </div>
                <div class="history-list compact-list">
                  ${studyTodos.map((item) => todoCard(item)).join("")}
                </div>
              </section>
            ` : ""}
          </div>
        ` : `<div class="empty-state">現在対応が必要な To Do はありません。</div>`}
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">作業アップロード</div>
            <h3>課題提出</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${(homework.assignments || []).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.title || "-")}</strong>
                ${badge(item.submission_status || "未提出", item.submission_status ? "green" : "yellow")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.subject_name || "-")}</span>
                <span>締切 ${escapeHtml(item.due_date || "-")}</span>
              </div>
              <div class="history-purpose">${escapeHtml(item.description || "-")}</div>
              <div class="muted-note">${escapeHtml(item.file_name || "提出ファイルなし")} ${item.submitted_at ? `/ ${escapeHtml((item.submitted_at || "").replace("T", " "))}` : ""}</div>
              <div class="muted-note">${item.review_score !== null && item.review_score !== undefined ? `点数 ${escapeHtml(item.review_score)}` : ""} ${escapeHtml(item.review_comment || "")}</div>
              <form class="homework-form" data-homework-assignment="${escapeHtml(item.id)}">
                <input type="file" name="file">
                <input name="note" placeholder="メモ（任意）" value="${escapeHtml(item.submission_note || "")}">
                <button class="primary-btn" type="submit">${item.submission_id ? "再提出" : "提出"}</button>
              </form>
            </article>
          `).join("") || `<div class="empty-state">課題はありません。</div>`}
        </div>
      </section>
    </section>

    <section class="portal-page ${activePage === "apply" ? "" : "hidden"}" data-portal-view="apply">
      ${pageHeader("申請", "各種申請", "公欠・欠席申請と証明書申請をここで受け付けます。", [
        badge("学生申請", "green")
      ])}
      <section class="metrics-grid">
        ${metricCard("公欠・欠席 申請中", `${leavePendingCount}件`, "確認待ち")}
        ${metricCard("証明書 申請中", `${certificatePendingCount}件`, "承認待ち")}
        ${metricCard("電子版を受け取れる", `${certificateReadyCount}件`, "ダウンロード可")}
        ${metricCard("窓口受取待ち", `${certificatePickupCount}件`, certificateReceivedCount ? `受領済 ${certificateReceivedCount}件` : "受取案内あり")}
      </section>

      <section class="panel certificate-overview-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">受取案内</div>
            <h3>証明書の受け取り方</h3>
          </div>
        </div>
        <div class="certificate-overview-grid">
          <article class="certificate-overview-card">
            <strong>電子で受け取る</strong>
            <p>発行済みになったら、このページの履歴からそのままダウンロードできます。</p>
          </article>
          <article class="certificate-overview-card">
            <strong>窓口で受け取る</strong>
            <p>紙の証明書は事務局窓口で受け取ります。希望受取日があれば先に入力できます。</p>
          </article>
          <article class="certificate-overview-card">
            <strong>両方必要なとき</strong>
            <p>電子版を先に確認しながら、原本はあとで窓口で受け取れます。</p>
          </article>
        </div>
      </section>

      <section class="panel certificate-flow-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">発行までの流れ</div>
            <h3>証明書申請の進み方</h3>
          </div>
        </div>
        <div class="certificate-flow-grid">
          <div class="certificate-flow-step">
            <span>1</span>
            <strong>学生が申請</strong>
            <p>必要な証明書と受取方法を選びます。</p>
          </div>
          <div class="certificate-flow-step">
            <span>2</span>
            <strong>事務局が確認</strong>
            <p>承認されると発行準備へ進みます。</p>
          </div>
          <div class="certificate-flow-step">
            <span>3</span>
            <strong>発行</strong>
            <p>電子版はダウンロード、紙は窓口受取になります。</p>
          </div>
        </div>
      </section>

      <section class="info-grid request-status-grid">
        <article class="panel request-status-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">処理中</div>
              <h3>いま確認中の申請</h3>
            </div>
          </div>
          <div class="history-list compact-list">
            ${[
              ...(attendance.leave_requests || [])
                .filter((item) => item.status === "申請中")
                .slice(0, 3)
                .map((item) => `
                  <article class="history-card">
                    <div class="history-head">
                      <strong>${escapeHtml(item.request_type || "-")} / ${escapeHtml(item.request_date || "-")}</strong>
                      ${badge("確認待ち", "blue")}
                    </div>
                    <div class="history-purpose">${escapeHtml(item.reason || "-")}</div>
                  </article>
                `),
              ...(items || [])
                .filter((item) => item.status === "申請中" || item.status === "承認済")
                .slice(0, 3)
                .map((item) => `
                  <article class="history-card">
                    <div class="history-head">
                      <strong>${escapeHtml(item.certificate_type || "-")}</strong>
                      ${todoBadge(item.status === "申請中" ? "承認待ち" : "発行待ち")}
                    </div>
                    <div class="history-purpose">${escapeHtml(certificateEtaText(item))}</div>
                  </article>
                `),
            ].join("") || `<div class="empty-state">現在、処理中の申請はありません。</div>`}
          </div>
        </article>

        <article class="panel request-status-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">案内</div>
              <h3>申請後の流れ</h3>
            </div>
          </div>
          <div class="request-help-list">
            <div class="request-help-item">
              <strong>公欠・欠席申請</strong>
              <p>学生が申請後、事務局または先生が確認し、承認されると出席記録へ反映されます。</p>
            </div>
            <div class="request-help-item">
              <strong>証明書申請</strong>
              <p>承認後に発行へ進みます。電子版はこの画面から、紙は窓口で受け取れます。</p>
            </div>
          </div>
        </article>
      </section>

      <section class="info-grid apply-form-grid">
        <article class="panel request-panel leave-request-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">申請</div>
              <h3>公欠・欠席申請</h3>
            </div>
            ${badge("学生申請", "yellow")}
          </div>
          ${applyActionCard("Attendance", "授業を休む前に申請", "公欠・欠席ともに、日付と理由を先に出しておくと確認が早くなります。", "apply-tone-warm")}
          <p class="panel-note">授業を休む前に、公欠または欠席を学生端から申請できます。</p>
          <div class="request-mini-guide warm">
            <strong>申請後の流れ</strong>
            <p>申請後は先生または事務局が確認し、承認されると出席記録へ反映されます。</p>
          </div>
          <form id="studentLeaveRequestForm" class="request-form compact-request-form">
            <label class="full">
              申請種別
              <select name="request_type" required>
                <option value="公欠">公欠申請</option>
                <option value="欠席">欠席申請</option>
              </select>
            </label>
            <label>
              日付
              <input type="date" name="request_date" required>
            </label>
            <label>
              時限
              <input name="period_label" placeholder="例: 1-2限 / 1-4限">
            </label>
            <label class="full">
              理由
              <input name="reason" placeholder="例: 通院 / 入管手続き / 体調不良" required>
            </label>
            <label class="full optional-field">
              詳細（任意）
              <input name="detail" placeholder="補足があれば入力してください">
            </label>
            <div class="form-actions full">
              <button class="primary-btn" type="submit">この内容で申請する</button>
            </div>
          </form>
        </article>

        <article class="panel request-panel certificate-request-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">附加機能</div>
              <h3>証明書申請</h3>
            </div>
            ${badge("学生申請", "green")}
          </div>
          ${applyActionCard("Certificate", "必要な証明書を選んで申請", "発行済みになったら下の履歴からそのまま開けます。", "apply-tone-cool")}
          <p class="panel-note">必要な証明書を選ぶだけで申請できます。発行後は下の履歴から確認できます。</p>
          <div class="certificate-guide-grid">
            <div class="certificate-guide-card">
              <strong>電子</strong>
              <p>発行後、この画面からそのままダウンロードできます。</p>
            </div>
            <div class="certificate-guide-card">
              <strong>窓口受取</strong>
              <p>紙の証明書は事務局窓口で受け取ります。希望日があれば入力してください。</p>
            </div>
          </div>
          <div class="request-mini-guide cool">
            <strong>申請後の流れ</strong>
            <p>事務局が確認してから発行します。電子版はダウンロード、紙は窓口受取になります。</p>
          </div>
          <form id="studentCertificateRequestForm" class="request-form compact-request-form">
            <label class="full">
              証明書種別
              <select name="certificate_type" required>
                <option value="出席率証明書">出席率証明書</option>
                <option value="成績証明書">成績証明書</option>
                <option value="修了証明書">修了証明書</option>
              </select>
            </label>
            <input type="hidden" name="copies" value="1">
            <label class="full">
              受取方法
              <select name="delivery_method" required>
                <option value="電子">電子ダウンロード</option>
                <option value="窓口受取">窓口受取</option>
                <option value="電子+窓口">電子 + 窓口受取</option>
              </select>
            </label>
            <label>
              希望受取日
              <input name="preferred_pickup_date" type="date">
            </label>
            <label class="full optional-field">
              用途（任意）
              <input name="purpose" placeholder="例: 奨学金提出 / 在留更新 / 進学提出">
            </label>
            <label class="full optional-field">
              事務局メモ（任意）
              <input name="counter_note" placeholder="例: 午後受取希望 / 原本2通必要">
            </label>
            <div class="form-actions full">
              <button class="primary-btn" type="submit">この証明書を申請する</button>
            </div>
          </form>
        </article>
      </section>

      <section class="info-grid">
        <article class="panel history-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">申請履歴</div>
              <h3>公欠・欠席申請の履歴</h3>
            </div>
          </div>
          <div class="history-list">
            ${(attendance.leave_requests || []).map((item) => `
              <article class="history-card">
                <div class="history-head">
                  <strong>${escapeHtml(item.request_type || "-")} / ${escapeHtml(item.request_date || "-")}</strong>
                  ${statusBadge(item.status)}
                </div>
                <div class="history-meta">
                  <span>${escapeHtml(item.period_label || "全時限")}</span>
                </div>
                <div class="history-purpose">${escapeHtml(item.reason || "-")}</div>
                <div class="muted-note">${escapeHtml(item.detail || "詳細なし")}</div>
              </article>
            `).join("") || `<div class="empty-state">まだ公欠・欠席申請はありません。</div>`}
          </div>
        </article>

        <article class="panel history-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">申請履歴</div>
              <h3>証明書の申請状況</h3>
            </div>
          </div>
          <div class="history-list">
            ${items.map((item) => `
              ${(() => {
                const fulfillment = certificateFulfillmentState(item);
                return `
              <article class="history-card">
                <div class="history-head">
                  <strong>${escapeHtml(item.certificate_type || "-")}</strong>
                  ${statusBadge(item.status)}
                </div>
                <div class="history-meta">
                  <span>申請日 ${escapeHtml((item.requested_at || "").slice(0, 10) || "-")}</span>
                  <span>${certificateDeliveryPill(item.delivery_method || "電子")}</span>
                  ${item.preferred_pickup_date ? `<span>希望 ${escapeHtml(item.preferred_pickup_date)}</span>` : ""}
                  <span>${escapeHtml(item.document_no || "番号発行待ち")}</span>
                </div>
                <div class="history-purpose">${escapeHtml(item.purpose || "用途未入力")}</div>
                <div class="certificate-status-strip ${escapeHtml(fulfillment.tone)}">
                  <div class="certificate-status-main">
                    ${badge(fulfillment.label, fulfillment.tone)}
                    <span>${escapeHtml(fulfillment.note)}</span>
                  </div>
                  ${item.last_downloaded_at ? `<span class="certificate-download-meta">最終DL ${(item.last_downloaded_at || "").replace("T", " ")}</span>` : ""}
                </div>
                <div class="certificate-eta">${escapeHtml(certificateEtaText(item))}</div>
                <div class="history-actions">
                  ${item.file_url && (item.delivery_method === "電子" || item.delivery_method === "電子+窓口")
                    ? `<a class="download-link" href="${escapeHtml(item.file_url)}" data-certificate-download="${escapeHtml(item.id)}">電子版をダウンロード</a>`
                    : item.delivery_method === "窓口受取"
                      ? `<span class="muted-note">紙の証明書は事務局窓口で受け取ってください。</span>`
                      : `<span class="muted-note">承認・発行後にここから確認できます。</span>`}
                </div>
              </article>
              `;
              })()}
            `).join("") || `<div class="empty-state">まだ証明書申請はありません。</div>`}
          </div>
        </article>
      </section>
    </section>

    <section class="portal-page ${activePage === "my" ? "" : "hidden"}" data-portal-view="my">
      ${pageHeader("マイページ", "個人情報と設定", "プロフィール、在留情報、通知設定、パスワード変更を管理します。", [
        badge(student.class_name || "-", "blue")
      ])}
      <section class="panel my-overview-card">
        <div class="my-overview-head">
          <div class="my-avatar">${escapeHtml(initials(student.name || ""))}</div>
          <div class="my-overview-text">
            <div class="section-kicker">Account</div>
            <h3>${escapeHtml(student.name || "-")}</h3>
            <div class="summary-lines">
              <span>${escapeHtml(student.student_no || "-")}</span>
              <span>${escapeHtml(student.class_name || "-")}</span>
              <span>${escapeHtml(student.login_id || studentPortalState.loginId || "-")}</span>
            </div>
          </div>
        </div>
        <div class="my-overview-chips">
          ${badge(student.status || "在籍", "green")}
          ${badge(summary.days_to_expiry !== null && summary.days_to_expiry !== undefined ? `在留 ${summary.days_to_expiry}日` : "在留未登録", summary.days_to_expiry !== null && summary.days_to_expiry !== undefined && summary.days_to_expiry <= 90 ? "yellow" : "blue")}
          ${badge(attendance.summary.overall_rate !== undefined ? `出席 ${attendance.summary.overall_rate}%` : "出席未登録", summary.attendance_warning ? "yellow" : "blue")}
        </div>
        <div class="my-snapshot-grid">
          <article class="my-snapshot-card">
            <div class="section-kicker">連絡先</div>
            <strong>${escapeHtml(student.phone || "未登録")}</strong>
            <span>${escapeHtml(student.address_japan || "日本住所未登録")}</span>
          </article>
          <article class="my-snapshot-card">
            <div class="section-kicker">在留</div>
            <strong>${escapeHtml(student.residence_status || "未登録")}</strong>
            <span>${escapeHtml(student.residence_expiry || "期限未登録")}</span>
          </article>
          <article class="my-snapshot-card">
            <div class="section-kicker">変更申請</div>
            <strong>${pendingProfileChangeCount + pendingResidenceChangeCount}件</strong>
            <span>${pendingProfileChangeCount ? `個人 ${pendingProfileChangeCount}件` : "個人 0件"} / ${pendingResidenceChangeCount ? `在留 ${pendingResidenceChangeCount}件` : "在留 0件"}</span>
          </article>
        </div>
      </section>
      <section class="my-section-strip">
        <div class="my-strip-item">
          <div class="section-kicker">プロフィール</div>
          <strong>基本情報を確認</strong>
        </div>
        <div class="my-strip-item">
          <div class="section-kicker">更新申請</div>
          <strong>連絡先と在留を申請</strong>
        </div>
        <div class="my-strip-item">
          <div class="section-kicker">設定</div>
          <strong>通知とパスワード</strong>
        </div>
      </section>
      <section class="info-grid">
        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">個人情報</div>
              <h3>基本プロフィール</h3>
            </div>
          </div>
          <div class="profile-list">
            ${profileRow("国籍", student.nationality)}
            ${profileRow("生年月日", student.birth_date)}
            ${profileRow("電話番号", student.phone)}
            ${profileRow("日本住所", student.address_japan)}
            ${profileRow("緊急連絡先", student.emergency_contact)}
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">在留情報</div>
              <h3>在留カード情報</h3>
            </div>
            ${badge(`${pendingResidenceChangeCount}件 申請中`, pendingResidenceChangeCount ? "yellow" : "gray")}
          </div>
          <div class="profile-list">
            ${profileRow("在留資格", student.residence_status)}
            ${profileRow("在留カード番号", student.residence_card_no)}
            ${profileRow("在留期限", student.residence_expiry)}
            ${profileRow("旅券番号", student.passport_no)}
            ${profileRow("期限まで", expiryLabel)}
          </div>
          <div class="request-mini-guide warm" style="margin-top:16px;">
            <strong>在留カードや旅券が更新されたとき</strong>
            <p>更新後の情報をここから申請すると、事務局が確認して在籍情報へ反映します。期限が近いときは早めに送ってください。</p>
          </div>
          <form id="studentResidenceChangeForm" class="settings-form">
            <label>
              新しい在留資格
              <input name="requested_residence_status" value="${escapeHtml(student.residence_status || "")}" placeholder="例: 留学">
            </label>
            <label>
              新しい在留カード番号
              <input name="requested_residence_card_no" value="${escapeHtml(student.residence_card_no || "")}" placeholder="例: AB1234567CD">
            </label>
            <label>
              新しい在留期限
              <input name="requested_residence_expiry" type="date" value="${escapeHtml(student.residence_expiry || "")}">
            </label>
            <label>
              新しい旅券番号
              <input name="requested_passport_no" value="${escapeHtml(student.passport_no || "")}" placeholder="例: P-CN-8831400">
            </label>
            <label>
              在留カード画像
              <input name="residence_card_file" type="file" accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf">
            </label>
            <label>
              旅券画像
              <input name="passport_file" type="file" accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf">
            </label>
            <label class="full">
              変更理由
              <textarea name="reason" rows="3" placeholder="例: 在留更新許可が出たため / 旅券を更新したため"></textarea>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit">在留情報を申請</button>
            </div>
          </form>
          <div class="history-list compact-list" style="margin-top:16px;">
            ${(residenceChangeRequests || []).map((item) => `
              <article class="history-card">
                <div class="history-head">
                  <strong>${escapeHtml((item.created_at || "").replace("T", " "))}</strong>
                  ${statusBadge(item.status)}
                </div>
                <div class="history-meta">
                  <span>資格 ${escapeHtml(item.requested_residence_status || "-")}</span>
                  <span>期限 ${escapeHtml(item.requested_residence_expiry || "-")}</span>
                </div>
                <div class="history-purpose">${escapeHtml(item.reason || "変更理由なし")}</div>
                <div class="history-actions">
                  ${item.residence_card_file_name ? `<a class="download-link" href="${escapeHtml(residenceChangeFileLink(item.id, "residence-card", item.residence_card_file_name))}">在留カード画像</a>` : `<span class="muted-note">在留カード画像なし</span>`}
                  ${item.passport_file_name ? `<a class="download-link" href="${escapeHtml(residenceChangeFileLink(item.id, "passport", item.passport_file_name))}">旅券画像</a>` : `<span class="muted-note">旅券画像なし</span>`}
                </div>
                <div class="muted-note">
                  ${escapeHtml(item.reviewed_note || (item.status === "申請中" ? "事務局で確認中です。" : item.status === "反映済" ? "在籍情報へ反映されました。" : "差戻しになりました。内容を確認してください。"))}
                </div>
              </article>
            `).join("") || `<div class="empty-state">まだ在留情報の変更申請はありません。</div>`}
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">変更申請</div>
              <h3>連絡先の更新</h3>
            </div>
            ${badge(`${pendingProfileChangeCount}件 申請中`, pendingProfileChangeCount ? "yellow" : "gray")}
          </div>
          <div class="request-mini-guide cool">
            <strong>住所・電話番号が変わったとき</strong>
            <p>このフォームから申請すると、事務局が確認して在籍情報へ反映します。急ぎのときは班主任チャットも併用してください。</p>
          </div>
          <form id="studentProfileChangeForm" class="settings-form">
            <label>
              新しい電話番号
              <input name="requested_phone" value="${escapeHtml(student.phone || "")}" placeholder="例: 090-1234-5678">
            </label>
            <label class="full">
              新しい日本住所
              <input name="requested_address_japan" value="${escapeHtml(student.address_japan || "")}" placeholder="例: 東京都新宿区...">
            </label>
            <label class="full">
              新しい緊急連絡先
              <input name="requested_emergency_contact" value="${escapeHtml(student.emergency_contact || "")}" placeholder="例: 母 / 080-...">
            </label>
            <label class="full">
              変更理由
              <textarea name="reason" rows="3" placeholder="例: 引っ越しのため / 電話番号変更のため"></textarea>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit">変更申請を送る</button>
            </div>
          </form>
          <div class="history-list compact-list" style="margin-top:16px;">
            ${(profileChangeRequests || []).map((item) => `
              <article class="history-card">
                <div class="history-head">
                  <strong>${escapeHtml((item.created_at || "").replace("T", " "))}</strong>
                  ${statusBadge(item.status)}
                </div>
                <div class="history-meta">
                  <span>電話 ${escapeHtml(item.requested_phone || "-")}</span>
                  <span>住所 ${escapeHtml(item.requested_address_japan ? "更新あり" : "-")}</span>
                </div>
                <div class="history-purpose">${escapeHtml(item.reason || "変更理由なし")}</div>
                <div class="muted-note">
                  ${escapeHtml(item.reviewed_note || (item.status === "申請中" ? "事務局で確認中です。" : item.status === "反映済" ? "在籍情報へ反映されました。" : "差戻しになりました。内容を確認してください。"))}
                </div>
              </article>
            `).join("") || `<div class="empty-state">まだ個人情報の変更申請はありません。</div>`}
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">個人設定</div>
              <h3>通知と表示</h3>
            </div>
          </div>
          <form id="studentSettingsForm" class="settings-form">
            <label class="toggle-row">
              <span>出席通知を受け取る</span>
              <input type="checkbox" name="push_attendance" ${settings.push_attendance ? "checked" : ""}>
            </label>
            <label class="toggle-row">
              <span>課題通知を受け取る</span>
              <input type="checkbox" name="push_homework" ${settings.push_homework ? "checked" : ""}>
            </label>
            <label class="toggle-row">
              <span>掲示板通知を受け取る</span>
              <input type="checkbox" name="push_bulletin" ${settings.push_bulletin ? "checked" : ""}>
            </label>
            <label>
              表示言語
              <select name="display_language">
                <option value="ja" ${settings.display_language === "ja" ? "selected" : ""}>日本語</option>
                <option value="zh" ${settings.display_language === "zh" ? "selected" : ""}>中文</option>
              </select>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit">設定を保存</button>
            </div>
          </form>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">セキュリティ</div>
              <h3>パスワード変更</h3>
            </div>
          </div>
          <form id="studentPasswordChangeForm" class="settings-form">
            <label>
              現在のパスワード
              <input type="password" name="current_password" placeholder="現在のパスワード" required>
            </label>
            <label>
              新しいパスワード
              <input type="password" name="new_password" placeholder="8文字以上" required>
            </label>
            <label>
              新しいパスワード確認
              <input type="password" name="new_password_confirm" placeholder="もう一度入力" required>
            </label>
            <div class="form-actions">
              <button class="primary-btn" type="submit">パスワードを変更</button>
            </div>
          </form>
        </article>

        <article class="panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">サポート</div>
              <h3>連絡と変更の案内</h3>
            </div>
          </div>
          <div class="history-list compact-list">
            <article class="history-card">
              <div class="history-head">
                <strong>住所・電話番号が変わったとき</strong>
                ${badge(completedProfileChangeCount ? `反映済 ${completedProfileChangeCount}件` : "変更申請可", completedProfileChangeCount ? "green" : "yellow")}
              </div>
              <div class="muted-note">マイページから変更申請を送ると、事務局確認後に在籍情報へ反映されます。急ぎのときは班主任チャットも使えます。</div>
            </article>
            <article class="history-card">
              <div class="history-head">
                <strong>在留カード・旅券が更新されたとき</strong>
                ${badge(completedResidenceChangeCount ? `反映済 ${completedResidenceChangeCount}件` : "更新連絡可", completedResidenceChangeCount ? "green" : "blue")}
              </div>
              <div class="muted-note">在留資格、在留期限、カード番号、旅券番号の更新はこのページから連絡できます。更新直後の申請がおすすめです。</div>
            </article>
            <article class="history-card">
              <div class="history-head">
                <strong>ログイン情報の管理</strong>
                ${badge("安全設定", "blue")}
              </div>
              <div class="muted-note">共用端末ではログアウトし、パスワードは他人に共有しないでください。</div>
            </article>
          </div>
        </article>
      </section>
    </section>
  `;

  document.querySelector("#logoutStudentPortal").addEventListener("click", logoutStudentPortal);
  document.querySelectorAll("[data-portal-page]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activePage = button.dataset.portalPage || "home";
      if (studentPortalState.activePage === "chat") {
        studentPortalState.activeChatView = "list";
      }
      renderStudentPortal();
    });
  });
  document.querySelectorAll("[data-open-student-card]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activePage = "card";
      renderStudentPortal();
    });
  });
  document.querySelectorAll("[data-chat-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activeChatTab = button.dataset.chatTab || "classroom";
      studentPortalState.activeChatView = "detail";
      renderStudentPortal();
    });
  });
  document.querySelectorAll("[data-open-chat-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activePage = "chat";
      studentPortalState.activeChatTab = button.dataset.openChatTab || "classroom";
      studentPortalState.activeChatView = "detail";
      renderStudentPortal();
    });
  });
  document.querySelectorAll("[data-chat-back]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activeChatView = "list";
      renderStudentPortal();
    });
  });
  if (document.querySelector("#studentLeaveRequestForm")) {
    document.querySelector("#studentLeaveRequestForm").addEventListener("submit", submitStudentLeaveRequest);
  }
  if (document.querySelector("#studentAttendanceCheckinForm")) {
    document.querySelector("#studentAttendanceCheckinForm").addEventListener("submit", submitStudentAttendanceCheckin);
  }
  if (document.querySelector("#studentAttendanceCheckoutForm")) {
    document.querySelector("#studentAttendanceCheckoutForm").addEventListener("submit", submitStudentAttendanceCheckout);
  }
  if (document.querySelector("#studentCertificateRequestForm")) {
    document.querySelector("#studentCertificateRequestForm").addEventListener("submit", submitStudentCertificateRequest);
    const certificateTypeSelect = document.querySelector("#studentCertificateRequestForm [name='certificate_type']");
    const deliveryMethodSelect = document.querySelector("#studentCertificateRequestForm [name='delivery_method']");
    if (certificateTypeSelect && deliveryMethodSelect) {
      const syncDeliveryMethod = () => {
        deliveryMethodSelect.value = defaultCertificateDeliveryMethod(certificateTypeSelect.value);
      };
      certificateTypeSelect.addEventListener("change", syncDeliveryMethod);
      syncDeliveryMethod();
    }
  }
  document.querySelectorAll("[data-certificate-download]").forEach((link) => {
    link.addEventListener("click", handleCertificateDownloadClick);
  });
  if (document.querySelector("#studentGroupChatForm")) {
    document.querySelector("#studentGroupChatForm").addEventListener("submit", submitStudentGroupMessage);
  }
  if (document.querySelector("#studentSettingsForm")) {
    document.querySelector("#studentSettingsForm").addEventListener("submit", submitStudentSettings);
  }
  if (document.querySelector("#studentProfileChangeForm")) {
    document.querySelector("#studentProfileChangeForm").addEventListener("submit", submitStudentProfileChange);
  }
  if (document.querySelector("#studentResidenceChangeForm")) {
    document.querySelector("#studentResidenceChangeForm").addEventListener("submit", submitStudentResidenceChange);
  }
  if (document.querySelector("#studentPasswordChangeForm")) {
    document.querySelector("#studentPasswordChangeForm").addEventListener("submit", submitStudentPasswordChange);
  }
  document.querySelectorAll("[data-homework-assignment]").forEach((form) => {
    form.addEventListener("submit", submitHomeworkSubmission);
  });
}

function logoutStudentPortal() {
  studentPortalState.activePage = "home";
  studentPortalState.activeChatTab = "classroom";
  studentPortalState.activeChatView = "list";
  studentPortalState.sessionToken = "";
  studentPortalState.loginId = "";
  studentPortalState.student = null;
  studentPortalState.summary = null;
  studentPortalState.studentCard = null;
  studentPortalState.attendance = null;
  studentPortalState.consultations = [];
  studentPortalState.examResults = [];
  studentPortalState.grades = [];
  studentPortalState.bulletinPosts = [];
  studentPortalState.groupChat = [];
  studentPortalState.chatThreads = { classroom: [], homeroom: [] };
  studentPortalState.homework = { assignments: [] };
  studentPortalState.settings = null;
  studentPortalState.requests = [];
  studentPortalState.profileChangeRequests = [];
  studentPortalState.residenceChangeRequests = [];
  studentPortalState.pendingAttendanceCode = "";
  studentPortalState.pendingCheckoutCode = "";
  try {
    window.sessionStorage.removeItem(STUDENT_PORTAL_BOOTSTRAP_KEY);
  } catch (_error) {
    // ignore
  }
  renderStudentPortal();
  document.querySelector("#studentLoginForm")?.reset();
  document.querySelector("#studentSetupForm")?.reset();
}

async function submitStudentLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']") || form.querySelector("#studentLoginButton");
  const restore = setButtonLoading(button, "ログイン中...");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await studentPortalApi("/api/public/student-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    studentPortalState.activePage = "home";
    studentPortalState.activeChatTab = "classroom";
    studentPortalState.activeChatView = "list";
    studentPortalState.pendingAttendanceCode = (INITIAL_ATTENDANCE_CODE || "").trim();
    studentPortalState.pendingCheckoutCode = (INITIAL_CHECKOUT_CODE || "").trim();
    applyPortalPayload(result);
    await tryAutoAttendanceCheckin();
    await tryAutoAttendanceCheckout();
    renderStudentPortal();
    toast("ログインしました。");
  } catch (error) {
    toast(error.message || "ログインできませんでした。", true);
  } finally {
    restore();
  }
}

async function submitStudentPasswordSetup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']") || form.querySelector("#studentSetupButton");
  const restore = setButtonLoading(button, "設定中...");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await studentPortalApi("/api/public/student-password/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    studentPortalState.activePage = "home";
    studentPortalState.activeChatTab = "classroom";
    studentPortalState.activeChatView = "list";
    studentPortalState.pendingAttendanceCode = (INITIAL_ATTENDANCE_CODE || "").trim();
    studentPortalState.pendingCheckoutCode = (INITIAL_CHECKOUT_CODE || "").trim();
    applyPortalPayload(result);
    await tryAutoAttendanceCheckin();
    await tryAutoAttendanceCheckout();
    renderStudentPortal();
    toast("パスワードを設定してログインしました。");
  } catch (error) {
    toast(error.message || "パスワードを設定できませんでした。", true);
  } finally {
    restore();
  }
}

async function submitStudentCertificateRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "申請中...");
  const payload = {
    session_token: studentPortalState.sessionToken,
    ...Object.fromEntries(new FormData(form).entries()),
  };
  try {
    await studentPortalApi("/api/public/certificate-request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    const hiddenCopies = form.querySelector("[name='copies']");
    if (hiddenCopies) hiddenCopies.value = "1";
    const result = await studentPortalApi("/api/public/student-session", {
      method: "POST",
      body: JSON.stringify({ session_token: studentPortalState.sessionToken }),
    });
    applyPortalPayload(result);
    renderStudentPortal();
    toast("証明書申請を受け付けました。");
  } catch (error) {
    toast(error.message || "証明書申請に失敗しました。", true);
  } finally {
    restore();
  }
}

async function submitStudentLeaveRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "申請中...");
  const payload = {
    session_token: studentPortalState.sessionToken,
    ...Object.fromEntries(new FormData(form).entries()),
  };
  try {
    await studentPortalApi("/api/public/leave-request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    const result = await studentPortalApi("/api/public/student-session", {
      method: "POST",
      body: JSON.stringify({ session_token: studentPortalState.sessionToken }),
    });
    applyPortalPayload(result);
    renderStudentPortal();
    toast("公欠・欠席申請を受け付けました。");
  } catch (error) {
    toast(error.message || "申請に失敗しました。", true);
  } finally {
    restore();
  }
}

async function submitStudentAttendanceCheckin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "出席中...");
  const data = new FormData(form);
  try {
    const result = await studentPortalApi("/api/public/attendance-checkin", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        access_code: data.get("access_code"),
      }),
    });
    studentPortalState.pendingAttendanceCode = "";
    applyPortalPayload(result);
    studentPortalState.activePage = "attendance";
    renderStudentPortal();
    toast(result.checkin_message || "出席を登録しました。");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("attendance_code");
      window.history.replaceState({}, "", url.toString());
    } catch (_error) {
      // ignore
    }
  } catch (error) {
    toast(error.message || "出席登録に失敗しました。", true);
  } finally {
    restore();
  }
}

async function submitStudentAttendanceCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "退室中...");
  const data = new FormData(form);
  try {
    const result = await studentPortalApi("/api/public/attendance-checkout", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        access_code: data.get("access_code"),
      }),
    });
    studentPortalState.pendingCheckoutCode = "";
    applyPortalPayload(result);
    studentPortalState.activePage = "attendance";
    renderStudentPortal();
    toast(result.checkout_message || "退室を登録しました。");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout_code");
      window.history.replaceState({}, "", url.toString());
    } catch (_error) {
      // ignore
    }
  } catch (error) {
    toast(error.message || "退室登録に失敗しました。", true);
  } finally {
    restore();
  }
}

async function refreshStudentSession() {
  const result = await studentPortalApi("/api/public/student-session", {
    method: "POST",
    body: JSON.stringify({ session_token: studentPortalState.sessionToken }),
  });
  applyPortalPayload(result);
  renderStudentPortal();
}

async function handleCertificateDownloadClick(event) {
  const link = event.currentTarget;
  const requestId = link.dataset.certificateDownload || "";
  if (!requestId) return;
  event.preventDefault();
  try {
    await studentPortalApi("/api/public/certificate-download-track", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        request_id: requestId,
      }),
    });
  } catch (error) {
    toast(error.message || "ダウンロード記録を更新できませんでした。", true);
  }
  window.location.href = link.href;
  setTimeout(() => {
    refreshStudentSession().catch(() => {});
  }, 500);
}

async function submitStudentGroupMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "送信中...");
  try {
    await studentPortalApi("/api/public/group-message", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        channel: new FormData(form).get("channel") || studentPortalState.activeChatTab || "classroom",
        message: new FormData(form).get("message"),
      }),
    });
    form.reset();
    await refreshStudentSession();
    toast("メッセージを送信しました。");
  } catch (error) {
    toast(error.message || "送信に失敗しました。", true);
  } finally {
    restore();
  }
}

async function submitStudentSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "保存中...");
  const data = new FormData(form);
  try {
    await studentPortalApi("/api/public/student-settings", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        push_attendance: data.get("push_attendance") === "on",
        push_homework: data.get("push_homework") === "on",
        push_bulletin: data.get("push_bulletin") === "on",
        display_language: data.get("display_language"),
      }),
    });
    await refreshStudentSession();
    toast("個人設定を保存しました。");
  } catch (error) {
    toast(error.message || "設定を保存できませんでした。", true);
  } finally {
    restore();
  }
}

async function submitStudentPasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "変更中...");
  const data = new FormData(form);
  try {
    await studentPortalApi("/api/public/student-password/change", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        current_password: data.get("current_password"),
        new_password: data.get("new_password"),
        new_password_confirm: data.get("new_password_confirm"),
      }),
    });
    form.reset();
    toast("パスワードを変更しました。");
  } catch (error) {
    toast(error.message || "パスワードを変更できませんでした。", true);
  } finally {
    restore();
  }
}

async function submitStudentProfileChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "申請中...");
  const data = new FormData(form);
  try {
    const result = await studentPortalApi("/api/public/profile-change-request", {
      method: "POST",
      body: JSON.stringify({
        session_token: studentPortalState.sessionToken,
        requested_phone: data.get("requested_phone"),
        requested_address_japan: data.get("requested_address_japan"),
        requested_emergency_contact: data.get("requested_emergency_contact"),
        reason: data.get("reason"),
      }),
    });
    applyPortalPayload(result);
    renderStudentPortal();
    toast("個人情報の変更申請を受け付けました。");
  } catch (error) {
    toast(error.message || "変更申請を送信できませんでした。", true);
  } finally {
    restore();
  }
}

async function submitStudentResidenceChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "申請中...");
  const body = new FormData(form);
  body.append("session_token", studentPortalState.sessionToken);
  try {
    const response = await fetch("/api/public/residence-change-request-upload", {
      method: "POST",
      body,
    });
    const result = await response.json();
    if (!response.ok) {
      throw result.error || { message: "在留情報の変更申請を送信できませんでした。" };
    }
    applyPortalPayload(result);
    renderStudentPortal();
    toast("在留情報の変更申請を受け付けました。");
  } catch (error) {
    toast(error.message || "在留情報の変更申請を送信できませんでした。", true);
  } finally {
    restore();
  }
}

async function submitHomeworkSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "提出中...");
  const body = new FormData(form);
  body.append("session_token", studentPortalState.sessionToken);
  body.append("assignment_id", form.dataset.homeworkAssignment || "");
  try {
    const response = await fetch("/api/public/homework-submission", {
      method: "POST",
      body,
    });
    const result = await response.json();
    if (!response.ok) {
      throw result.error || { message: "課題提出に失敗しました。" };
    }
    await refreshStudentSession();
    toast("課題を提出しました。");
  } catch (error) {
    toast(error.message || "課題提出に失敗しました。", true);
  } finally {
    restore();
  }
}

bindGlobalPortalDelegation();
hydrateStudentPortalBootstrap();
renderStudentPortal();
