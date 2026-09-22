(() => {
  const api = (window.EDUCRAFT_API_BASE_URL || "").replace(/\/$/, "");
  const token = localStorage.getItem("educraft.dashboard.accessToken") || "";
  const main = document.querySelector("#studentMain");
  const planKey = "educraft.student.plan.v1";
  let me, overview, activities = [], social = {friends: [], incoming: [], outgoing: [], classmates: []}, classMessages = [], activeChat = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const request = async (path, options = {}) => {
    const response = await fetch(api + path, {method: options.method || "GET", headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: options.body ? JSON.stringify(options.body) : undefined});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "No se pudo completar la acción.");
    return body;
  };
  const empty = text => `<div class="empty">${esc(text)}</div>`;
  const metrics = () => overview?.metrics || {};
  const active = () => activities.filter(item => item.projectStatus !== "submitted");
  const coding = () => activities.filter(item => item.programmingMode !== "none");
  const submitted = () => activities.filter(item => item.projectStatus === "submitted");
  const plan = () => { try { return JSON.parse(localStorage.getItem(planKey) || "{}"); } catch (_) { return {}; } };
  const percent = (part, total) => total ? Math.round((part / total) * 100) : 0;
  const nav = view => document.querySelectorAll(".student-nav a").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  const hero = (eyebrow, title, detail, action = "") => `<section class="student-hero"><div><span class="student-kicker">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(detail)}</p></div>${action}</section>`;
  const button = (label, action, id = "", extra = "") => `<button type="button" class="student-button ${extra}" data-action="${esc(action)}" data-id="${esc(id)}">${esc(label)}</button>`;
  const task = item => {
    const state = item.projectStatus === "submitted" ? "Entregada" : item.programmingMode !== "none" ? "Proyecto disponible" : "Disponible";
    const meta = [item.subject, item.level, item.durationMinutes ? `${item.durationMinutes} min` : ""].filter(Boolean).map(esc).join(" · ");
    return `<article class="task"><h3>${esc(item.title)}</h3><p>${meta || "Actividad de tu aula"}</p><p>${esc(item.objectives || item.deliverable || "Consulta las instrucciones publicadas por tu profesorado.")}</p><div class="task-footer"><span class="status">${state}</span>${item.programmingMode !== "none" ? `<a class="student-button" href="../programacion/?activity=${encodeURIComponent(item.id)}&return=${encodeURIComponent("../dashboard/alumno.html#programacion")}">Abrir proyecto</a>` : ""}</div></article>`;
  };
  const person = (item, controls = "") => `<article class="task person"><div><h3>${esc(item.name)} ${item.online ? '<span class="online">En línea</span>' : ""}</h3><p>${esc(item.course || "Alumno")} ${item.classGroup ? "· " + esc(item.classGroup) : ""}</p></div><div class="person-actions">${controls}</div></article>`;

  function renderHome() {
    const next = active()[0];
    const m = metrics();
    const userName = me.email.split("@")[0];
    const planData = plan();
    const nextBlock = next
      ? `<div class="next-step"><span class="next-step-index">01</span><div><h3>${esc(next.title)}</h3><p>${esc(next.subject || "Actividad disponible")} · ${next.durationMinutes || "—"} min</p></div>${next.programmingMode !== "none" ? `<a class="student-button" href="../programacion/?activity=${encodeURIComponent(next.id)}&return=${encodeURIComponent("../dashboard/alumno.html#programacion")}">Continuar</a>` : `<a class="student-button" href="#tareas">Ver tarea</a>`}</div>`
      : empty("No hay actividades pendientes. Cuando se publique una, aparecerá aquí como tu próximo paso.");
    main.innerHTML = hero("Resumen personal", `Hola, ${userName}`, overview.classGroup ? `${overview.course || "Tu curso"} · Grupo ${overview.classGroup}` : "Tu espacio para avanzar paso a paso.", `<div class="student-hero-action"><strong>${planData.goal ? "Objetivo activo" : "Plan personal"}</strong><span>${esc(planData.goal || "Define tu foco")}</span></div>`)
      + `<section class="student-grid"><article class="student-card metric"><strong>${m.availableActivities || active().length}</strong><span>actividades disponibles</span></article><article class="student-card metric"><strong>${m.programmingInProgress || 0}</strong><span>proyectos en curso</span></article><article class="student-card metric"><strong>${m.programmingSubmitted || submitted().length}</strong><span>entregas realizadas</span></article></section>`
      + `<section class="student-card"><div class="student-card-head"><div><h2>Tu próximo paso</h2><p>Una acción clara es mejor que una lista interminable.</p></div><a class="student-link" href="#tareas">Ver todas</a></div>${nextBlock}</section>`
      + `<section class="student-grid two"><article class="student-card"><div class="student-card-head"><div><h2>Trabajo reciente</h2><p>Actividades publicadas para tu aula.</p></div></div><div class="task-list">${overview.recent?.length ? overview.recent.slice(0, 3).map(task).join("") : empty("Todavía no hay actividad reciente.")}</div></article><article class="student-card"><div class="student-card-head"><div><h2>Tu foco</h2><p>Una nota privada para organizarte.</p></div><a class="student-link" href="#plan">Editar</a></div>${planData.note ? `<p class="student-muted">${esc(planData.note)}</p>` : empty("Aún no has añadido una nota de estudio.")}</article></section>`;
  }

  function renderTasks() {
    const todo = active(), done = submitted();
    main.innerHTML = hero("Organiza tu trabajo", "Mis tareas", "Aquí solo aparecen actividades publicadas por tu profesorado. No se muestran fechas ni calificaciones que no existan en tu aula.")
      + `<section class="student-grid two"><article class="student-card"><div class="student-card-head"><div><h2>Para avanzar ahora</h2><p>${todo.length} actividad${todo.length === 1 ? "" : "es"} pendiente${todo.length === 1 ? "" : "s"} o en curso.</p></div><span class="student-chip">${todo.length} abiertas</span></div><div class="task-list">${todo.length ? todo.map(task).join("") : empty("Todo al día. No tienes actividades abiertas.")}</div></article><article class="student-card"><div class="student-card-head"><div><h2>Entregadas</h2><p>Un registro de trabajo que ya marcaste como entregado.</p></div><span class="student-chip muted">${done.length} completadas</span></div><div class="task-list">${done.length ? done.map(task).join("") : empty("Cuando entregues un proyecto, aparecerá aquí.")}</div></article></section>`;
  }

  function renderProjects() {
    const projects = coding();
    main.innerHTML = hero("Crear y experimentar", "Mis proyectos", "Abre los proyectos de programación publicados para ti. Tus entregas siguen vinculadas a cada actividad.")
      + `<section class="student-card"><div class="student-card-head"><div><h2>Proyectos de programación</h2><p>Scratch, web u otras experiencias que haya publicado tu profesorado.</p></div><span class="student-chip">${projects.length} disponibles</span></div><div class="task-list">${projects.length ? projects.map(task).join("") : empty("Aún no hay proyectos de programación publicados.")}</div></section>`;
  }

  function renderPlan() {
    const saved = plan();
    const total = activities.length, complete = submitted().length;
    main.innerHTML = hero("Autonomía y ritmo", "Mi plan", "Define un objetivo sencillo y revisa cómo vas. Este plan se guarda solo en este dispositivo; no se envía a tu profesorado.")
      + `<section class="student-grid two"><article class="student-card"><h2>Mi objetivo</h2><form id="studentPlanForm" class="plan-form"><label>Objetivo de esta etapa<input name="goal" maxlength="100" value="${esc(saved.goal || "")}" placeholder="Ej.: terminar mi proyecto de programación"></label><label>Nota para mí<textarea name="note" maxlength="500" placeholder="¿Qué me ayudará a avanzar?">${esc(saved.note || "")}</textarea></label><button class="student-button" type="submit">Guardar mi plan</button></form><p class="student-disclosure"><strong>Privado en este dispositivo.</strong> Se borra si limpias los datos del navegador.</p></article><article class="student-card"><h2>Revisión de mi trabajo</h2><div class="progress-list"><div class="progress-row"><div><b>Actividades entregadas</b><span>${complete} de ${total}</span></div><div class="progress-track"><i style="width:${percent(complete, total)}%"></i></div></div><div class="progress-row"><div><b>Proyectos abiertos</b><span>${metrics().programmingInProgress || 0}</span></div><div class="progress-track"><i style="width:${Math.min(100, (metrics().programmingInProgress || 0) * 25)}%"></i></div></div></div><ul class="focus-list"><li><b>1</b><span>Elige una actividad que puedas empezar hoy.</span></li><li><b>2</b><span>Divide el trabajo en una primera acción pequeña.</span></li><li><b>3</b><span>Vuelve aquí para revisar qué terminaste.</span></li></ul></article></section>`;
  }

  function renderProgress() {
    const total = activities.length, complete = submitted().length, openProjects = metrics().programmingInProgress || 0;
    main.innerHTML = hero("Mira tu camino", "Mi progreso", "Un resumen transparente de tu actividad. No es una nota ni una comparación con otros alumnos.")
      + `<section class="student-grid"><article class="student-card metric"><strong>${complete}</strong><span>proyectos entregados</span></article><article class="student-card metric"><strong>${openProjects}</strong><span>proyectos en curso</span></article><article class="student-card metric"><strong>${total}</strong><span>actividades publicadas</span></article></section><section class="student-card"><div class="student-card-head"><div><h2>Estado del trabajo publicado</h2><p>La barra refleja solo actividades y entregas que ya existen en EduCraft.</p></div><span class="student-chip">${percent(complete, total)}% entregado</span></div><div class="progress-list"><div class="progress-row"><div><b>Actividades entregadas</b><span>${complete} de ${total}</span></div><div class="progress-track"><i style="width:${percent(complete, total)}%"></i></div></div></div></section>`;
  }

  function renderClasses() {
    const mates = social.classmates || [];
    const messages = classMessages.slice().reverse().map(item => `<div class="message ${item.senderId === me.id ? "mine" : ""}"><b>${esc(item.name || "Compañero")}</b><p>${esc(item.body)}</p><small>${item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES", {dateStyle:"short",timeStyle:"short"}) : ""}</small></div>`).join("");
    main.innerHTML = hero("Aprender con otros", "Mi clase", overview.classGroup ? `Grupo ${overview.classGroup}. Encuentra a tus compañeros y conversa sobre el trabajo de clase.` : "Aún no tienes un grupo asignado.")
      + `<section class="student-grid two"><article class="student-card"><div class="student-card-head"><div><h2>Compañeros</h2><p>Visibles en tu mismo grupo.</p></div><span class="student-chip">${mates.length}</span></div><div class="task-list">${mates.length ? mates.map(item => person(item, item.state === "friends" ? button("Mensaje","open-dm",item.id) : item.state === "none" ? button("Añadir","request",item.id) : `<span class="status">${item.state === "pending" ? "Solicitud pendiente" : ""}</span>`)).join("") : empty("No hay compañeros visibles en este grupo.")}</div></article><article class="student-card"><h2>Chat de clase</h2><p class="student-muted">Solo alumnado de tu grupo. Comparte ideas con respeto y no publiques datos personales.</p>${messages ? `<div class="message-list">${messages}</div>` : empty("Sé la primera persona en saludar a tu clase.")}<form class="chat-form" data-chat="class"><input name="body" maxlength="1000" placeholder="Escribe a tu clase" required><button class="student-button">Enviar</button></form></article></section>`;
  }

  function renderFriends() {
    const s = social;
    main.innerHTML = hero("Conexiones seguras", "Amigos", "Los mensajes privados solo se habilitan cuando ambas personas aceptan la amistad.")
      + `<section class="student-grid two"><article class="student-card"><div class="student-card-head"><div><h2>Mis amigos</h2><p>Contactos que ya aceptaron tu solicitud.</p></div><span class="student-chip">${s.friends.length}</span></div><div class="task-list">${s.friends.length ? s.friends.map(item => person(item, button("Mensaje","open-dm",item.id) + button("Eliminar","remove",item.id,"secondary") + button("Bloquear","block",item.id,"secondary"))).join("") : empty("Aún no tienes amistades. Puedes añadir compañeros desde Mi clase.")}</div></article><article class="student-card"><h2>Solicitudes recibidas</h2><div class="task-list">${s.incoming.length ? s.incoming.map(item => person(item, button("Aceptar","accept",item.id) + button("Rechazar","reject",item.id,"secondary"))).join("") : empty("No tienes solicitudes nuevas.")}</div><h2>Solicitudes enviadas</h2><div class="task-list">${s.outgoing.length ? s.outgoing.map(item => person(item, button("Cancelar","cancel",item.id,"secondary"))).join("") : empty("No hay solicitudes pendientes.")}</div></article></section>`;
  }

  async function renderChat() {
    const friends = social.friends || [], selected = friends.find(item => item.id === activeChat);
    if (!selected) { main.innerHTML = hero("Mensajes privados", "Chat", "Selecciona una amistad para iniciar una conversación.") + `<section class="student-card"><div class="task-list">${friends.length ? friends.map(item => person(item,button("Abrir chat","open-dm",item.id))).join("") : empty("Añade y acepta amistades para poder usar los mensajes privados.")}</div></section>`; return; }
    main.innerHTML = hero("Mensajes privados", `Chat con ${selected.name}`, selected.online ? "Está en línea" : "No está conectado ahora", button("Volver","close-chat","","secondary")) + `<section class="student-card"><div id="directMessages" class="message-list">Cargando mensajes…</div><form class="chat-form" data-chat="direct" data-id="${esc(selected.id)}"><input name="body" maxlength="1000" placeholder="Escribe un mensaje" required><button class="student-button">Enviar</button></form></section>`;
    try { const result = await request(`/dashboard/student/messages/${encodeURIComponent(selected.id)}`); const box = document.querySelector("#directMessages"); if (box) box.innerHTML = result.items?.length ? result.items.slice().reverse().map(item => `<div class="message ${item.senderId === me.id ? "mine" : ""}"><p>${esc(item.body)}</p><small>${item.createdAt ? new Date(item.createdAt).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"}) : ""}</small></div>`).join("") : empty("Todavía no hay mensajes."); } catch (error) { const box = document.querySelector("#directMessages"); if (box) box.textContent = error.message; }
  }

  function renderProfile() {
    main.innerHTML = hero("Tu cuenta", "Mi perfil", "Información académica asociada a tu cuenta.") + `<section class="student-grid two"><article class="student-card"><h2>Datos del alumno</h2><ul class="focus-list"><li><b>@</b><span><strong>Cuenta</strong><br>${esc(me.email)}</span></li><li><b>·</b><span><strong>Curso</strong><br>${esc(overview.course || "Sin asignar")}</span></li><li><b>#</b><span><strong>Grupo</strong><br>${esc(overview.classGroup || "Sin asignar")}</span></li></ul></article><article class="student-card"><h2>Qué puede ver tu clase</h2><p class="student-muted">Tu presencia y nombre aparecen únicamente donde corresponde: clase, amistades aceptadas y chats permitidos.</p><p class="student-disclosure">Para cambiar curso o grupo, habla con tu profesorado o con la persona TIC del centro.</p></article></section>`;
  }

  function render(view) {
    nav(view);
    if (view === "inicio") renderHome();
    else if (view === "tareas") renderTasks();
    else if (view === "programacion") renderProjects();
    else if (view === "plan") renderPlan();
    else if (view === "clases") renderClasses();
    else if (view === "amigos") renderFriends();
    else if (view === "chat") renderChat();
    else if (view === "progreso") renderProgress();
    else if (view === "perfil") renderProfile();
  }
  async function refreshSocial() { social = await request("/dashboard/student/social"); try { classMessages = (await request("/dashboard/student/class-messages")).items || []; } catch (_) { classMessages = []; } }
  function currentView() { return location.hash.slice(1) || "inicio"; }

  document.addEventListener("click", async event => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    try {
      if (control.dataset.action === "open-dm") { activeChat = control.dataset.id; location.hash = "chat"; return; }
      if (control.dataset.action === "close-chat") { activeChat = null; render("chat"); return; }
      await request(`/dashboard/student/social/${encodeURIComponent(control.dataset.id)}/${control.dataset.action}`, {method:"POST"});
      await refreshSocial(); render(currentView());
    } catch (error) { alert(error.message); }
  });
  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form.id === "studentPlanForm") { event.preventDefault(); localStorage.setItem(planKey, JSON.stringify({goal: form.elements.goal.value.trim(), note: form.elements.note.value.trim()})); renderPlan(); return; }
    if (!form.matches(".chat-form")) return;
    event.preventDefault();
    const input = form.elements.body;
    try {
      const path = form.dataset.chat === "class" ? "/dashboard/student/class-messages" : `/dashboard/student/messages/${encodeURIComponent(form.dataset.id)}`;
      await request(path, {method:"POST", body:{body:input.value}}); input.value = "";
      if (form.dataset.chat === "class") { await refreshSocial(); renderClasses(); } else renderChat();
    } catch (error) { alert(error.message); }
  });
  document.querySelectorAll(".student-nav a").forEach(link => link.addEventListener("click", () => setTimeout(() => render(currentView()), 0)));
  window.addEventListener("hashchange", () => { if (currentView() !== "comunidad") render(currentView()); });
  document.querySelector("#studentLogout")?.addEventListener("click", async () => { try { await request("/logout",{method:"POST"}); } catch (_) {} localStorage.removeItem("educraft.dashboard.accessToken"); localStorage.removeItem("educraft.dashboard.refreshToken"); location.href = "login.html"; });
  (async () => {
    if (!token) { location.href = "login.html"; return; }
    try {
      [me, overview, {items: activities}] = await Promise.all([request("/me"), request("/dashboard/student/overview"), request("/dashboard/student/activities")]);
      await refreshSocial();
      document.querySelector("#studentSessionLabel").textContent = overview.classGroup ? `Grupo ${overview.classGroup}` : "Portal del alumno";
      render(currentView());
      setInterval(async () => { try { await refreshSocial(); if (["clases","amigos","chat"].includes(currentView())) render(currentView()); } catch (_) {} }, 60000);
    } catch (_) { localStorage.removeItem("educraft.dashboard.accessToken"); location.href = "login.html"; }
  })();
})();
