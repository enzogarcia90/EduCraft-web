const STORAGE_KEYS = {
	access: "educraft.dashboard.accessToken",
	refresh: "educraft.dashboard.refreshToken"
};

const state = {
	token: localStorage.getItem(STORAGE_KEYS.access) || "",
	refreshToken: localStorage.getItem(STORAGE_KEYS.refresh) || "",
	me: null,
	summary: null,
	students: []
};

const apiBase = (window.EDUCRAFT_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const currentPage = document.body.dataset.dashboardPage || "login";
const companyRoles = new Set(["owner", "lead_developer", "developer", "support"]);
const ticRoles = new Set(["institution_administrator", "director"]);
const teacherActions = [
	["alert_student", "Alertar alumno", "Envia un aviso visible al alumno."],
	["clear_inventory", "Limpiar inventario", "Vacia el inventario del alumno."],
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

init().catch((error) => {
	const node = $("#authMessage") || $("#registerMessage") || $("#studentMessage") || $("#actionMessage");
	if (node) {
		setMessage(node, error.message || "No se pudo cargar el portal.", "error");
	}
});

async function init() {
	if (currentPage === "login") {
		bindLogin();
		if (state.token) {
			await restoreAndRedirect();
		}
		return;
	}

	if (currentPage === "registro") {
		bindRegister();
		if (state.token) {
			await restoreAndRedirect();
		}
		return;
	}

	bindDashboard();
	await requireDashboardSession();
}

function bindLogin() {
	$("#loginForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await login($("#emailInput").value, $("#passwordInput").value, $("#authMessage"));
	});
	const email = new URLSearchParams(location.search).get("email");
	if (email && $("#emailInput")) {
		$("#emailInput").value = email;
	}
}

function bindRegister() {
	$("#registerForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const message = $("#registerMessage");
		const email = $("#registerEmail").value.trim();
		const password = $("#registerPassword").value;
		setMessage(message, "Creando centro...", "");
		try {
			await request("/register", {
				method: "POST",
				auth: false,
				body: {
					institutionName: $("#registerInstitution").value,
					contactName: $("#registerName").value,
					email,
					password
				}
			});
			setMessage(message, "Centro creado. Entrando al panel TIC...", "ok");
			await login(email, password, message);
		} catch (error) {
			setMessage(message, error.message, "error");
		}
	});
}

function bindDashboard() {
	$("#logoutButton")?.addEventListener("click", logout);
	$("#studentForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await createStudent();
	});
	$("#reloadStudents")?.addEventListener("click", loadStudents);
	renderTeacherActions();
}

async function login(email, password, messageNode) {
	setMessage(messageNode, "Validando credenciales...", "");
	const response = await request("/login", {
		method: "POST",
		auth: false,
		body: { email: email.trim(), password }
	});
	storeSession(response);
	const destination = pageForRole(response.role);
	if (!destination) {
		clearSession();
		throw new Error("Esta cuenta no tiene acceso al portal privado.");
	}
	location.replace(destination);
}

async function restoreAndRedirect() {
	try {
		state.me = await request("/me");
		const destination = pageForRole(state.me.role);
		if (!destination) {
			clearSession();
			return;
		}
		location.replace(destination);
	} catch (_) {
		clearSession();
	}
}

async function requireDashboardSession() {
	if (!state.token) {
		location.replace("login.html");
		return;
	}
	try {
		state.me = await request("/me");
		const destination = pageForRole(state.me.role);
		if (!destination) {
			logout();
			return;
		}
		if (pageName(destination) !== currentPage) {
			location.replace(destination);
			return;
		}
		renderIdentity();
		await loadSummary();
		if (currentPage === "tic" || currentPage === "profesor") {
			await loadStudents();
		}
	} catch (_) {
		logout();
	}
}

async function loadSummary() {
	state.summary = await request("/dashboard/summary");
	renderMetrics(state.summary.metrics || {});
	renderSignals();
}

async function loadStudents() {
	if (!$("#studentTableBody") && !$("#targetStudent")) {
		return;
	}
	try {
		const response = await request("/dashboard/students");
		state.students = response.items || [];
		renderStudents();
	} catch (error) {
		setMessage($("#studentMessage") || $("#actionMessage"), error.message, "error");
	}
}

async function createStudent() {
	const message = $("#studentMessage");
	setMessage(message, "Creando alumno...", "");
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
		setMessage(message, "Alumno creado.", "ok");
		await Promise.all([loadSummary(), loadStudents()]);
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function disableStudent(id) {
	try {
		await request(`/dashboard/students/${encodeURIComponent(id)}`, { method: "DELETE" });
		await Promise.all([loadSummary(), loadStudents()]);
	} catch (error) {
		setMessage($("#studentMessage"), error.message, "error");
	}
}

async function queueAction(actionKey) {
	const message = $("#actionMessage");
	setMessage(message, "Registrando accion...", "");
	try {
		const response = await request("/dashboard/teacher/actions", {
			method: "POST",
			body: {
				actionKey,
				targetUserId: $("#targetStudent")?.value || "",
				reason: $("#actionReason")?.value || ""
			}
		});
		setMessage(message, `Accion en cola: ${shortId(response.id)}`, "ok");
		await loadSummary();
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

function renderIdentity() {
	$("#sessionLabel").textContent = state.me.email || "Sesion activa";
	$("#identityPanel").innerHTML = `
		<dl>
			<div><dt>Email</dt><dd>${escapeHtml(state.me.email || "-")}</dd></div>
			<div><dt>Rol</dt><dd>${escapeHtml(readableRole(state.me.role))}</dd></div>
			<div><dt>Institucion</dt><dd>${escapeHtml(shortId(state.me.institutionId))}</dd></div>
			<div><dt>Sesion</dt><dd>${escapeHtml(shortId(state.me.sessionId))}</dd></div>
		</dl>
	`;
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
	const preferred = [
		"institutions",
		"activeInstitutions",
		"users",
		"students",
		"teachers",
		"activeStudents",
		"activeSessions",
		"queuedActions"
	];
	const entries = preferred.filter((key) => Object.hasOwn(metrics, key)).map((key) => [key, metrics[key]]);
	$("#metricsGrid").innerHTML = entries.length ? entries.map(([key, value]) => `
		<article><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(labels[key] || key)}</span></article>
	`).join("") : `<article><strong>-</strong><span>Sin metricas para este rol</span></article>`;
}

function renderSignals() {
	renderSignalList("#licenseRack", Object.entries(state.summary?.licenses || {}).map(([label, value]) => ({ label, value })), "Licencias");
	renderSignalList("#healthRack", state.summary?.health || [], "Salud");
	renderSignalList("#activityRack", state.summary?.activity || [], "Actividad");
}

function renderSignalList(selector, items, fallback) {
	const node = $(selector);
	if (!node) {
		return;
	}
	node.innerHTML = items.length ? items.map((item) => `
		<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}</strong></div>
	`).join("") : `<div><span>${escapeHtml(fallback)}</span><strong>Sin datos</strong></div>`;
}

function renderStudents() {
	if ($("#studentTableBody")) {
		$("#studentTableBody").innerHTML = state.students.length ? state.students.map((student) => `
			<tr>
				<td>${escapeHtml(student.email)}</td>
				<td>${escapeHtml(student.status)}</td>
				<td>${escapeHtml(shortId(student.institutionId))}</td>
				<td><button type="button" data-disable-student="${escapeHtml(student.id)}">Desactivar</button></td>
			</tr>
		`).join("") : `<tr><td colspan="4">Sin alumnos visibles para este rol.</td></tr>`;
		for (const button of document.querySelectorAll("[data-disable-student]")) {
			button.addEventListener("click", () => disableStudent(button.dataset.disableStudent));
		}
	}

	if ($("#targetStudent")) {
		$("#targetStudent").innerHTML = `<option value="">Toda la clase</option>` + state.students.map((student) => `
			<option value="${escapeHtml(student.id)}">${escapeHtml(student.email)}</option>
		`).join("");
	}
}

function renderTeacherActions() {
	if (!$("#teacherActions")) {
		return;
	}
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

async function request(path, options = {}) {
	const headers = {
		Accept: "application/json",
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

function pageForRole(role) {
	if (companyRoles.has(role)) {
		return "administracion.html";
	}
	if (ticRoles.has(role)) {
		return "tic.html";
	}
	if (role === "teacher") {
		return "profesor.html";
	}
	return "";
}

function pageName(path) {
	return path.replace(".html", "");
}

function storeSession(response) {
	state.token = response.accessToken;
	state.refreshToken = response.refreshToken;
	state.me = response;
	localStorage.setItem(STORAGE_KEYS.access, state.token);
	localStorage.setItem(STORAGE_KEYS.refresh, state.refreshToken || "");
}

function clearSession() {
	state.token = "";
	state.refreshToken = "";
	state.me = null;
	state.summary = null;
	state.students = [];
	localStorage.removeItem(STORAGE_KEYS.access);
	localStorage.removeItem(STORAGE_KEYS.refresh);
}

function logout() {
	clearSession();
	location.replace("login.html");
}

function setMessage(node, text, tone) {
	if (!node) {
		return;
	}
	node.textContent = text || "";
	node.classList.toggle("is-ok", tone === "ok");
	node.classList.toggle("is-error", tone === "error");
}

function readableRole(role) {
	const labels = {
		owner: "Administracion EduCraft",
		lead_developer: "Direccion tecnica",
		developer: "Equipo tecnico EduCraft",
		support: "Soporte EduCraft",
		institution_administrator: "TIC de centro",
		director: "Direccion de centro",
		teacher: "Profesor",
		student: "Alumno"
	};
	return labels[role] || role || "-";
}

function shortId(value) {
	if (!value) {
		return "-";
	}
	return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function escapeHtml(value) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&#039;");
}
