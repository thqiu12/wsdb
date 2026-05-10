// HTML エスケープ。innerHTML に流す全てのユーザー由来文字列でこれを通す。
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


async function submitPortalForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const response = await fetch("/api/public/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw data.error || { message: "送信に失敗しました。" };
  }
  const formNode = document.querySelector("#portalForm");
  const success = document.querySelector("#successBox");
  formNode.classList.add("hidden");
  success.classList.remove("hidden");
  success.innerHTML = `
    <h2>申込みを受け付けました。</h2>
    <p>受付番号は <strong>${escapeHtml(data.application_no)}</strong> です。事務局からの連絡をお待ちください。</p>
  `;
}

document.querySelector("#portalForm").addEventListener("submit", async (event) => {
  try {
    await submitPortalForm(event);
  } catch (error) {
    window.alert(error.message || "送信に失敗しました。");
  }
});
