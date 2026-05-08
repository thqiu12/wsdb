const studentPortalState = {
  authMode: "login",
  activePage: "home",
  activeChatTab: "classroom",
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
};

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
  return `
    <button type="button" class="portal-nav-item ${isActive ? "active" : ""}" data-portal-page="${escapeHtml(key)}">
      ${escapeHtml(label)}
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
}

function toggleAuthMode(mode) {
  studentPortalState.authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  document.querySelector("#studentLoginForm").classList.toggle("hidden", mode !== "login");
  document.querySelector("#studentSetupForm").classList.toggle("hidden", mode !== "setup");
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
  const activePage = studentPortalState.activePage || "home";
  const activeChatTab = studentPortalState.activeChatTab || "classroom";
  const todoItems = [];
  if (summary.days_to_expiry !== null && summary.days_to_expiry !== undefined && summary.days_to_expiry <= 90) {
    todoItems.push({
      title: "在留期限の確認",
      status: "期限注意",
      meta: `${summary.days_to_expiry}日後に期限`,
      note: student.residence_expiry || "在留期限未登録",
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
      });
    }
  });
  if (!student) {
    root.innerHTML = "";
    root.classList.add("hidden");
    return;
  }

  const alerts = summary.alerts || [];
  const expiryLabel = summary.days_to_expiry === null || summary.days_to_expiry === undefined
    ? "未登録"
    : `${summary.days_to_expiry}日`;

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

      <section class="panel student-card-panel">
      <div class="panel-head">
        <div>
          <div class="section-kicker">学生証</div>
          <h3>デジタル学生証</h3>
        </div>
        <button type="button" class="subtle-btn" data-open-student-card>大きく表示</button>
      </div>
      <div class="student-id-card">
        <div class="student-id-school">${escapeHtml(studentCard.school_name || "渋谷外語学院")}</div>
        <div class="student-id-name">${escapeHtml(studentCard.name || student.name || "-")}</div>
        <div class="student-id-meta">
          <span>${escapeHtml(studentCard.student_no || student.student_no || "-")}</span>
          <span>${escapeHtml(studentCard.class_name || student.class_name || "-")}</span>
          <span>${escapeHtml(studentCard.residence_status || student.residence_status || "-")}</span>
        </div>
        <div class="student-id-meta">
          <span>入学日 ${escapeHtml(studentCard.admission_date || student.admission_date || "-")}</span>
        </div>
      </div>
      </section>

      <section class="info-grid">
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

        <article class="panel ${alerts.length ? "alert-panel" : ""}">
        <div class="panel-head">
          <div>
            <div class="section-kicker">事務局からの確認項目</div>
            <h3>今日の確認</h3>
          </div>
        </div>
        <div class="alert-list">
          ${(alerts.length ? alerts : ["新しいお知らせはありません。"]).map((text) => `<div class="alert-pill">${escapeHtml(text)}</div>`).join("")}
        </div>
        </article>
      </section>

      <section class="info-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の動き</div>
            <h3>直近の To Do</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${todoItems.slice(0, 3).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.title || "-")}</strong>
                ${todoBadge(item.status)}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.meta || "-")}</span>
              </div>
              <div class="muted-note">${escapeHtml(item.note || "")}</div>
            </article>
          `).join("") || `<div class="empty-state">現在対応が必要な To Do はありません。</div>`}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の出席</div>
            <h3>出席状況</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${(attendance.records || []).slice(-3).reverse().map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.class_date || "-")} / ${escapeHtml(item.period_label || "-")}</strong>
                ${badge(item.status || "-", item.status === "出席" ? "green" : item.status === "公欠" ? "blue" : "yellow")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.attendance_minutes || 0)} 分 / ${escapeHtml(item.scheduled_minutes || 0)} 分</span>
              </div>
            </article>
          `).join("") || `<div class="empty-state">まだ出席記録はありません。</div>`}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近のお知らせ</div>
            <h3>掲示板</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${bulletinPosts.slice(0, 2).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.title || "-")}</strong>
                ${item.pinned ? badge("置頂", "yellow") : ""}
              </div>
              <div class="history-meta">
                <span>${escapeHtml((item.published_at || "").replace("T", " "))}</span>
              </div>
              <div class="muted-note">${escapeHtml(item.body || "-")}</div>
            </article>
          `).join("") || `<div class="empty-state">掲示はまだありません。</div>`}
        </div>
      </article>
    </section>

    <section class="info-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の面談</div>
            <h3>面談記録</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${consultations.slice(0, 2).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.meeting_date || "-")}</strong>
                ${badge(item.category || "-", "blue")}
              </div>
              <div class="history-purpose">${escapeHtml(item.summary || "-")}</div>
              <div class="muted-note">${escapeHtml(item.staff_name || "-")} / ${escapeHtml(item.next_action || "次回予定なし")}</div>
            </article>
          `).join("") || `<div class="empty-state">まだ面談記録はありません。</div>`}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">最近の成績</div>
            <h3>試験・成績</h3>
          </div>
        </div>
        <div class="history-list compact-list">
          ${exams.slice(0, 1).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.exam_name || "-")}</strong>
                ${badge(item.score_text || "-", "green")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.completion_date || "-")}</span>
                <span>${escapeHtml(item.certificate_no || "番号未登録")}</span>
              </div>
              <div class="muted-note">${escapeHtml(item.note || "備考なし")}</div>
            </article>
          `).join("")}
          ${grades.slice(0, 1).map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.subject_name || "-")}</strong>
                ${badge(`${item.grade || "-"} / ${item.score || 0}`, "green")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.term_label || "-")}</span>
              </div>
              <div class="muted-note">${escapeHtml(item.comment || "コメントなし")}</div>
            </article>
          `).join("") || `<div class="empty-state">まだ試験結果や成績はありません。</div>`}
        </div>
      </article>
      </section>
    </section>

    <section class="portal-page ${activePage === "card" ? "" : "hidden"}" data-portal-view="card">
      ${pageHeader("学生証", "提示用表示", "駅員や外部の方に見せるときは、この画面をそのまま表示してください。", [badge(student.status || "-", "blue")])}
      <section class="panel student-card-page">
        <div class="panel-head">
          <div>
            <div class="section-kicker">Student ID</div>
            <h3>SchoolCore Student Card</h3>
          </div>
          <button type="button" class="subtle-btn" data-portal-page="home">ホームに戻る</button>
        </div>
        <div class="student-id-card student-id-card-large">
          <div class="student-id-school">${escapeHtml(studentCard.school_name || "渋谷外語学院")}</div>
          <div class="student-id-name">${escapeHtml(studentCard.name || student.name || "-")}</div>
          <div class="student-id-meta student-id-meta-large">
            <span>学籍番号 ${escapeHtml(studentCard.student_no || student.student_no || "-")}</span>
            <span>クラス ${escapeHtml(studentCard.class_name || student.class_name || "-")}</span>
          </div>
          <div class="student-id-meta student-id-meta-large">
            <span>在籍状態 ${escapeHtml(student.status || "-")}</span>
            <span>在留資格 ${escapeHtml(studentCard.residence_status || student.residence_status || "-")}</span>
          </div>
          <div class="student-id-meta student-id-meta-large">
            <span>入学日 ${escapeHtml(studentCard.admission_date || student.admission_date || "-")}</span>
          </div>
        </div>
        <div class="student-card-caption">
          <div>${escapeHtml(student.phone || "学校連絡先未登録")}</div>
          <div>${escapeHtml(student.address_japan || "住所未登録")}</div>
        </div>
      </section>
    </section>

    <section class="portal-page ${activePage === "attendance" ? "" : "hidden"}" data-portal-view="attendance">
      ${pageHeader("出席", "出席状況", "出席率と申請履歴をまとめて確認できます。", [
        badge(attendance.summary.overall_rate !== undefined ? `${attendance.summary.overall_rate}%` : "-", "green"),
        badge(summary.attendance_warning ? "注意対象" : "安定", summary.attendance_warning ? "yellow" : "blue")
      ])}
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
                ${badge(item.status || "-", item.status === "出席" ? "green" : item.status === "公欠" ? "blue" : "yellow")}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.attendance_minutes || 0)} 分 / ${escapeHtml(item.scheduled_minutes || 0)} 分</span>
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
      ${pageHeader("チャット", "学生連絡", activeChatTab === "classroom" ? "クラス全体の連絡を確認したり、クラスメッセージを送れます。" : "班主任との個別連絡に使います。", [
        badge(activeChatTab === "classroom" ? "班級群" : "班主任", "blue")
      ])}
      <section class="panel chat-page-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">班級群聊</div>
            <h3>チャット</h3>
          </div>
          ${badge(activeChatTab === "classroom" ? (student.class_name || "-") : "担任", "blue")}
        </div>
        <div class="chat-switcher" role="tablist" aria-label="チャット種類">
          <button type="button" class="chat-switch ${activeChatTab === "classroom" ? "active" : ""}" data-chat-tab="classroom">班級群</button>
          <button type="button" class="chat-switch ${activeChatTab === "homeroom" ? "active" : ""}" data-chat-tab="homeroom">班主任</button>
        </div>
        <p class="panel-note">${activeChatTab === "classroom" ? "クラス全体のお知らせや連絡を確認できます。" : "自分の班主任と1対1で相談できます。"}</p>
        <div class="chat-timeline">
          ${(activeChatTab === "classroom" ? groupChat : homeroomChat).map((item) => `
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
        <div class="history-list compact-list">
          ${todoItems.map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.title || "-")}</strong>
                ${todoBadge(item.status)}
              </div>
              <div class="history-meta">
                <span>${escapeHtml(item.meta || "-")}</span>
              </div>
              <div class="muted-note">${escapeHtml(item.note || "")}</div>
            </article>
          `).join("") || `<div class="empty-state">現在対応が必要な To Do はありません。</div>`}
        </div>
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
      <section class="info-grid">
        <article class="panel request-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">申請</div>
              <h3>公欠・欠席申請</h3>
            </div>
            ${badge("学生申請", "yellow")}
          </div>
          <p class="panel-note">授業を休む前に、公欠または欠席を学生端から申請できます。</p>
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

        <article class="panel request-panel">
          <div class="panel-head">
            <div>
              <div class="section-kicker">附加機能</div>
              <h3>証明書申請</h3>
            </div>
            ${badge("学生申請", "green")}
          </div>
          <p class="panel-note">必要な証明書を選ぶだけで申請できます。発行後は下の履歴から確認できます。</p>
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
            <label class="full optional-field">
              用途（任意）
              <input name="purpose" placeholder="例: 奨学金提出 / 在留更新 / 進学提出">
            </label>
            <div class="form-actions full">
              <button class="primary-btn" type="submit">この証明書を申請する</button>
            </div>
          </form>
        </article>
      </section>

      <section class="panel history-panel">
        <div class="panel-head">
          <div>
            <div class="section-kicker">申請履歴</div>
            <h3>証明書の申請状況</h3>
          </div>
        </div>
        <div class="history-list">
          ${items.map((item) => `
            <article class="history-card">
              <div class="history-head">
                <strong>${escapeHtml(item.certificate_type || "-")}</strong>
                ${statusBadge(item.status)}
              </div>
              <div class="history-meta">
                <span>申請日 ${escapeHtml((item.requested_at || "").slice(0, 10) || "-")}</span>
                <span>${escapeHtml(item.document_no || "番号発行待ち")}</span>
              </div>
              <div class="history-purpose">${escapeHtml(item.purpose || "用途未入力")}</div>
              <div class="history-actions">
                ${item.file_url ? `<a class="download-link" href="${escapeHtml(item.file_url)}">発行済みファイルを開く</a>` : `<span class="muted-note">承認・発行後にここから確認できます。</span>`}
              </div>
            </article>
          `).join("") || `<div class="empty-state">まだ証明書申請はありません。</div>`}
        </div>
      </section>
    </section>

    <section class="portal-page ${activePage === "my" ? "" : "hidden"}" data-portal-view="my">
      ${pageHeader("マイページ", "個人情報と設定", "プロフィール、在留情報、通知設定、パスワード変更を管理します。", [
        badge(student.class_name || "-", "blue")
      ])}
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
          </div>
          <div class="profile-list">
            ${profileRow("在留資格", student.residence_status)}
            ${profileRow("在留カード番号", student.residence_card_no)}
            ${profileRow("在留期限", student.residence_expiry)}
            ${profileRow("期限まで", expiryLabel)}
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
      </section>
    </section>
  `;

  document.querySelector("#logoutStudentPortal").addEventListener("click", logoutStudentPortal);
  document.querySelectorAll("[data-portal-page]").forEach((button) => {
    button.addEventListener("click", () => {
      studentPortalState.activePage = button.dataset.portalPage || "home";
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
      renderStudentPortal();
    });
  });
  if (document.querySelector("#studentLeaveRequestForm")) {
    document.querySelector("#studentLeaveRequestForm").addEventListener("submit", submitStudentLeaveRequest);
  }
  if (document.querySelector("#studentCertificateRequestForm")) {
    document.querySelector("#studentCertificateRequestForm").addEventListener("submit", submitStudentCertificateRequest);
  }
  if (document.querySelector("#studentGroupChatForm")) {
    document.querySelector("#studentGroupChatForm").addEventListener("submit", submitStudentGroupMessage);
  }
  if (document.querySelector("#studentSettingsForm")) {
    document.querySelector("#studentSettingsForm").addEventListener("submit", submitStudentSettings);
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
  document.querySelector("#studentLoginForm").reset();
  document.querySelector("#studentSetupForm").reset();
  renderStudentPortal();
}

async function submitStudentLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "ログイン中...");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await studentPortalApi("/api/public/student-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    studentPortalState.activePage = "home";
    studentPortalState.activeChatTab = "classroom";
    applyPortalPayload(result);
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
  const button = form.querySelector("button[type='submit']");
  const restore = setButtonLoading(button, "設定中...");
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const result = await studentPortalApi("/api/public/student-password/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    studentPortalState.activePage = "home";
    studentPortalState.activeChatTab = "classroom";
    applyPortalPayload(result);
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

async function refreshStudentSession() {
  const result = await studentPortalApi("/api/public/student-session", {
    method: "POST",
    body: JSON.stringify({ session_token: studentPortalState.sessionToken }),
  });
  applyPortalPayload(result);
  renderStudentPortal();
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

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => toggleAuthMode(button.dataset.authMode));
});
document.querySelector("#studentLoginForm").addEventListener("submit", submitStudentLogin);
document.querySelector("#studentSetupForm").addEventListener("submit", submitStudentPasswordSetup);
