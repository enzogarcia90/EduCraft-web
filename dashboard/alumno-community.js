(() => {
  const api = (window.EDUCRAFT_API_BASE_URL || "").replace(/\/$/, "");
  const token = localStorage.getItem("educraft.dashboard.accessToken") || "";
  const main = document.querySelector("#studentMain");
  const nav = document.querySelector(".student-nav");
  if (!main || !nav || !token) return;

  const esc = value => String(value ?? "").replace(/[&<>\"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const date = value => value ? new Date(value).toLocaleString("es-ES", {dateStyle:"short", timeStyle:"short"}) : "";
  const request = async (path, options = {}) => {
    const response = await fetch(api + path, {
      method: options.method || "GET",
      headers: {Authorization: `Bearer ${token}`, "Content-Type":"application/json"},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "No se pudo completar la acción.");
    return body;
  };
  const empty = text => `<div class="empty">${esc(text)}</div>`;
  const message = item => `<article class="message ${item.senderId === currentUser ? "mine" : ""}"><b>${esc(item.name || "Alumno")}</b><p>${esc(item.body)}</p><small>${date(item.createdAt)}</small></article>`;
  let currentUser = "";

  const link = document.createElement("a");
  link.href = "#comunidad";
  link.dataset.view = "comunidad";
  link.textContent = "Comunidad";
  nav.insertBefore(link, nav.querySelector('[data-view="perfil"]'));

  async function renderCommunity() {
    document.querySelectorAll(".student-nav a").forEach(item => item.classList.toggle("active", item.dataset.view === "comunidad"));
    main.innerHTML = `<section class="student-hero"><div><h1>Comunidad</h1><p>Conversación global para el alumnado de tu centro. Comparte ideas y ayuda con respeto.</p></div></section><section class="student-grid two"><article class="student-card community-chat"><h2>Chat global del centro</h2><p class="student-muted">Visible solo para estudiantes activos de tu institución.</p><div id="globalMessages" class="message-list">Cargando mensajes…</div><form id="globalChatForm" class="chat-form"><input name="body" maxlength="1000" placeholder="Comparte una idea con tu centro" required><button class="student-button">Enviar</button></form></article><aside class="student-card community-guide"><h2>Buena convivencia</h2><ul><li>Escribe con respeto.</li><li>No compartas datos personales.</li><li>Usa los MDs solo con amistades.</li><li>Para tareas, consulta la sección Tareas.</li></ul></aside></section>`;
    try {
      const result = await request("/dashboard/student/global-messages");
      const box = document.querySelector("#globalMessages");
      if (box) box.innerHTML = result.items?.length ? result.items.slice().reverse().map(message).join("") : empty("Todavía no hay mensajes. Da la bienvenida a tu comunidad.");
    } catch (error) {
      const box = document.querySelector("#globalMessages");
      if (box) box.textContent = error.message;
    }
  }

  link.addEventListener("click", () => setTimeout(renderCommunity, 0));
  window.addEventListener("hashchange", () => { if (location.hash === "#comunidad") renderCommunity(); });
  document.addEventListener("submit", async event => {
    const form = event.target.closest("#globalChatForm");
    if (!form) return;
    event.preventDefault();
    const input = form.elements.body;
    try {
      await request("/dashboard/student/global-messages", {method:"POST", body:{body: input.value}});
      input.value = "";
      await renderCommunity();
    } catch (error) { alert(error.message); }
  });
  request("/me").then(me => { currentUser = me.id || ""; if (location.hash === "#comunidad") renderCommunity(); }).catch(() => {});
})();
