const state = {
	token: localStorage.getItem("educraft.dashboard.accessToken") || "",
	refreshToken: localStorage.getItem("educraft.dashboard.refreshToken") || "",
	me: null,
	summary: null,
	students: []
};

const apiBase = (window.EDUCRAFT_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const views = {
	administracion: "Administracion",
	tic: "TIC",
	profesor: "Profesor"
};

const teacherActions = [
	["alert_student", "Alertar alumno", "Envia un aviso visible al alumno."],
	["clear_inventory", "Limpiar inventario", "Vaciar inventario del alumno."],
	["freeze_student", "Congelar alumno", "Bloquea movimiento temporalmente."],
	["unfreeze_student", "Descongelar alumno", "Restaura movimiento."],
	["teleport_to_teacher", "Traer al profesor", "Teleporta alumno a tu posicion."],
	["teleport_teacher_to_student", "Ir al alumno", "Teleporta al docente al alumno."],
	["return_to_spawn", "Enviar a spawn", "Devuelve al punto seguro."],
	["mute_chat", "Silenciar chat", "Evita mensajes del alumno."],
	["unmute_chat", "Activar chat", "Restaura permiso de chat."],
	["private_message", "Mensaje privado", "Manda aviso individual."],
	["assign_mission", "Asignar mision", "Vincula reto educativo."],
	["pause_mission", "Pausar mision", "Congela progreso de reto."],
	["resume_mission", "Reanudar mision", "Continua el reto."],
	["reset_mission", "Reiniciar mision", "Reinicia progreso del alumno."],
	["give_lab_kit", "Dar kit laboratorio", "Entrega materiales STEM."],
	["remove_lab_kit", "Quitar kit laboratorio", "Retira materiales del kit."],
	["open_element_guide", "Abrir guia elementos", "Muestra apoyo de quimica."],
	["lock_singleplayer", "Bloquear mundos locales", "Cierra entrada singleplayer."],
	["unlock_singleplayer", "Permitir mundos locales", "Activa permiso temporal."],
	["enable_resource_pack", "Activar recursos", "Fuerza recursos educativos."],
	["disable_resource_pack", "Desactivar recursos", "Quita recursos obligatorios."],
	["set_group", "Asignar grupo", "Mueve al alumno a grupo."],
	["remove_from_group", "Quitar de grupo", "Saca de grupo actual."],
	["mark_attendance", "Marcar asistencia", "Registra presencia en clase."],
	["flag_support", "Pedir soporte TIC", "Escala una incidencia tecnica."],
	["request_screenshot", "Pedir captura", "Solicita evidencia visual."],
	["start_focus_mode", "Modo enfoque", "Reduce distracciones del cliente."],
	["stop_focus_mode", "Quitar enfoque", "Restaura interfaz normal."],
	["limit_chat", "Limitar chat", "Solo mensajes educativos."],
	["restore_chat", "Restaurar chat", "Quita limite de chat."],
	["grant_build", "Permitir construir", "Da permiso de construccion."],
	["revoke_build", "Bloquear construccion", "Revoca construccion."],
	["grant_interact", "Permitir interactuar", "Activa uso de bloques."],
	["revoke_interact", "Bloquear interaccion", "Revoca uso de bloques."],
	["clear_effects", "Limpiar efectos", "Quita estados alterados."],
	["heal_student", "Curar alumno", "Restaura salud."],
	["feed_student", "Restaurar hambre", "Rellena comida."],
	["set_gamemode_adventure", "Modo aventura", "Evita roturas accidentales."],
	["set_gamemode_survival", "Modo supervivencia", "Vuelve a supervivencia."],
	["export_progress_note", "Nota de progreso", "Guarda observacion docente."],
	["send_class_announcement", "Anuncio de clase", "Mensaje para todo el aula."],
	["close_session", "Cerrar sesion", "Finaliza entrada del alumno."]
];

const $ = (selector) => document.querySelector(selector);

init();

function init() {
	$("#apiPill").textContent = `API: ${apiBase}`;
	bindEvents();
	renderTeacherActions();
	setView(location.hash.replace("#", "") || "administracion");
	if (state.token) {
		restoreSession();
	}
}

function bindEvents() {
	$("#loginForm").addEventListener("submit", async (event) => {
		event.preventDefault();
		await login();
	});

	$("#logoutButton").addEventListener("click", logout);
	$("#studentForm").addEventListener("submit", async (event) => {
		event.preventDefault();
		await createStudent();
	});
	$("#reloadStudents").addEventListener("click", loadStudents);

	for (const tab of document.querySelectorAll(".dash-tab")) {
		tab.addEventListener("click", () => setView(tab.dataset.view));
	}

	window.addEventListener("hashchange", () => {
		setView(location.hash.replace("#", "") || "administracion");
	});
}

async function login() {
	setMessage("#authMessage", "Entrando...", "");
	try {
		const response = await request("/login", {
			method: "POST",
			auth: false,
			body: {
				email: $("#emailInput").value,
				password: $("#passwordInput").value
			}
		});
		state.token = response.accessToken;
		state.refreshToken = response.refreshToken;
		state.me = response;
		localStorage.setItem("educraft.dashboard.accessToken", state.token);
		localStorage.setItem("educraft.dashboard.refreshToken", state.refreshToken);
		setMessage("#authMessage", "Sesion iniciada.", "ok");
		await hydrateDashboard();
		routeForRole(response.role);
	} catch (error) {
		setMessage("#authMessage", error.message, "error");
		setApiStatus(false);
	}
}

async function restoreSession() {
	try {
		state.me = await request("/me");
		await hydrateDashboard();
		routeForRole(state.me.role);
	} catch (_) {
		logout();
	}
}

async function hydrateDashboard() {
	if (state.me.role === "student") {
		logout();
		setMessage("#authMessage", "Tu cuenta de alumno no tiene acceso al dashboard privado.", "error");
		return;
	}

	$("#loginPanel").hidden = true;
	$("#identityPanel").hidden = false;
	$("#logoutButton").hidden = false;
	$("#sessionLabel").textContent = state.me.email || "Sesion activa";
	$("#identityEmail").textContent = state.me.email || "-";
	$("#identityRole").textContent = readableRole(state.me.role);
	$("#identityInstitution").textContent = shortId(state.me.institutionId);
	$("#identitySession").textContent = shortId(state.me.sessionId);
	setApiStatus(true);
	await Promise.all([loadSummary(), loadStudents()]);
}

async function loadSummary() {
	if (!state.token) {
		renderMetrics({});
		return;
	}
	try {
		state.summary = await request("/dashboard/summary");
		renderMetrics(state.summary.metrics || {});
		renderSignals();
	} catch (error) {
		setApiStatus(false);
		renderMetrics({});
	}
}

async function loadStudents() {
	if (!state.token) {
		renderStudents([]);
		return;
	}
	try {
		const response = await request("/dashboard/students");
		state.students = response.items || [];
		renderStudents(state.students);
		setApiStatus(true);
	} catch (error) {
		renderStudents([]);
		setMessage("#studentMessage", error.message, "error");
	}
}

async function createStudent() {
	setMessage("#studentMessage", "Creando alumno...", "");
	try {
		await request("/dashboard/students", {
			method: "POST",
			body: {
				email: $("#studentEmail").value,
				password: $("#studentPassword").value,
				institutionId: $("#studentInstitution").value
			}
		});
		$("#studentForm").reset();
		setMessage("#studentMessage", "Alumno creado.", "ok");
		await Promise.all([loadStudents(), loadSummary()]);
	} catch (error) {
		setMessage("#studentMessage", error.message, "error");
	}
}

async function disableStudent(id) {
	try {
		await request(`/dashboard/students/${encodeURIComponent(id)}`, { method: "DELETE" });
		await Promise.all([loadStudents(), loadSummary()]);
	} catch (error) {
		setMessage("#studentMessage", error.message, "error");
	}
}

async function queueAction(actionKey) {
	const targetUserId = $("#targetStudent").value;
	const reason = $("#actionReason").value;
	setMessage("#actionMessage", "Registrando accion...", "");
	try {
		const response = await request("/dashboard/teacher/actions", {
			method: "POST",
			body: { actionKey, targetUserId, reason }
		});
		setMessage("#actionMessage", `Accion en cola: ${shortId(response.id)}`, "ok");
		await loadSummary();
	} catch (error) {
		setMessage("#actionMessage", error.message, "error");
	}
}

function renderMetrics(metrics) {
	const labels = {
		institutions: "Centros",
		activeInstitutions: "Centros activos",
		users: "Usuarios",
		students: "Alumnos",
		teachers: "Profesores",
		activeStudents: "Alumnos activos",
		activeSessions: "Sesiones activas",
		queuedActions: "Acciones en cola"
	};
	const entries = Object.entries(metrics);
	$("#metricsGrid").innerHTML = entries.length ? entries.map(([key, value]) => `
		<article><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labels[key] || key)}</span></article>
	`).join("") : `
		<article><strong>-</strong><span>Inicia sesion para ver metricas</span></article>
	`;
}

function renderSignals() {
	const licenses = state.summary?.licenses || {};
	$("#licenseRack").innerHTML = Object.entries(licenses).length ? Object.entries(licenses).map(([key, total]) => `
		<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(String(total))}</strong></div>
	`).join("") : `<div><span>Licencias</span><strong>Sin datos</strong></div>`;

	$("#healthRack").innerHTML = (state.summary?.health || []).map((item) => `
		<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>
	`).join("");

	$("#activityRack").innerHTML = (state.summary?.activity || []).map((item) => `
		<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>
	`).join("");
}

function renderStudents(students) {
	const rows = students.map((student) => `
		<tr>
			<td>${escapeHtml(student.email)}</td>
			<td>${escapeHtml(student.status)}</td>
			<td>${escapeHtml(shortId(student.institutionId))}</td>
			<td><button type="button" data-disable-student="${escapeHtml(student.id)}">Desactivar</button></td>
		</tr>
	`).join("");
	$("#studentTableBody").innerHTML = rows || `<tr><td colspan="4">Sin alumnos visibles para este rol.</td></tr>`;
	$("#targetStudent").innerHTML = `<option value="">Toda la clase</option>` + students.map((student) => `
		<option value="${escapeHtml(student.id)}">${escapeHtml(student.email)}</option>
	`).join("");

	for (const button of document.querySelectorAll("[data-disable-student]")) {
		button.addEventListener("click", () => disableStudent(button.dataset.disableStudent));
	}
}

function renderTeacherActions() {
	$("#teacherActions").innerHTML = teacherActions.map(([key, label, description]) => `
		<button type="button" data-action-key="${key}">
			<strong>${escapeHtml(label)}</strong>
			<small>${escapeHtml(description)}</small>
		</button>
	`).join("");

	for (const button of document.querySelectorAll("[data-action-key]")) {
		button.addEventListener("click", () => queueAction(button.dataset.actionKey));
	}
}

function setView(view) {
	const next = views[view] ? view : "administracion";
	$("#viewTitle").textContent = views[next];
	for (const tab of document.querySelectorAll(".dash-tab")) {
		tab.classList.toggle("is-active", tab.dataset.view === next);
	}
	for (const panel of document.querySelectorAll("[data-view-panel]")) {
		panel.classList.toggle("is-active", panel.dataset.viewPanel === next);
	}
	if (location.hash.replace("#", "") !== next) {
		history.replaceState(null, "", `#${next}`);
	}
}

function routeForRole(role) {
	if (["teacher"].includes(role)) {
		setView("profesor");
	} else if (["institution_administrator", "director"].includes(role)) {
		setView("tic");
	} else {
		setView("administracion");
	}
}

async function request(path, options = {}) {
	const headers = {
		"Accept": "application/json",
		"Content-Type": "application/json"
	};
	if (options.auth !== false && state.token) {
		headers.Authorization = `Bearer ${state.token}`;
	}
	const response = await fetch(`${apiBase}${path}`, {
		method: options.method || "GET",
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined
	});
	const text = await response.text();
	const data = text ? JSON.parse(text) : {};
	if (!response.ok) {
		throw new Error(data.message || data.error || `HTTP ${response.status}`);
	}
	return data;
}

function logout() {
	state.token = "";
	state.refreshToken = "";
	state.me = null;
	state.summary = null;
	state.students = [];
	localStorage.removeItem("educraft.dashboard.accessToken");
	localStorage.removeItem("educraft.dashboard.refreshToken");
	$("#loginPanel").hidden = false;
	$("#identityPanel").hidden = true;
	$("#logoutButton").hidden = true;
	$("#sessionLabel").textContent = "Sin sesion";
	renderMetrics({});
	renderStudents([]);
	setApiStatus(false);
}

function setApiStatus(ok) {
	$("#apiPill").classList.toggle("is-ok", ok);
	$("#apiPill").classList.toggle("is-error", !ok);
}

function setMessage(selector, text, tone) {
	const node = $(selector);
	node.textContent = text;
	node.classList.toggle("is-ok", tone === "ok");
	node.classList.toggle("is-error", tone === "error");
}

function readableRole(role) {
	return ({
		owner: "Direccion global",
		lead_developer: "Direccion tecnica",
		developer: "Equipo EduCraft",
		institution_administrator: "TIC de centro",
		director: "Direccion de centro",
		teacher: "Profesor",
		student: "Alumno",
		support: "Soporte"
	})[role] || role || "-";
}

function shortId(value) {
	return value ? `${value.slice(0, 8)}...` : "-";
}

function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (char) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#039;"
	})[char]);
}
