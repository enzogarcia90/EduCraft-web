const STORAGE_KEYS = {
	access: "educraft.dashboard.accessToken",
	refresh: "educraft.dashboard.refreshToken"
};

const state = {
	token: localStorage.getItem(STORAGE_KEYS.access) || "",
	refreshToken: localStorage.getItem(STORAGE_KEYS.refresh) || "",
	me: null,
	summary: null,
	students: [],
	teachers: [],
	policy: null,
	livePolicy: null,
	route: null,
	actionFilter: "all",
	actionQuery: ""
};

const apiBase = (window.EDUCRAFT_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const currentPage = document.body.dataset.dashboardPage || "login";
const companyRoles = new Set(["owner", "lead_developer", "developer", "support"]);
const ticRoles = new Set(["institution_administrator", "institution_admin", "director"]);
const teacherActions = [
	{ key: "alert_student", category: "avisos", label: "Alertar alumno", description: "Envia un aviso visible al alumno." },
	{ key: "private_message", category: "avisos", label: "Mensaje privado", description: "Manda un aviso individual." },
	{ key: "send_class_announcement", category: "avisos", label: "Anuncio de clase", description: "Mensaje para toda la clase." },
	{ key: "mute_chat", category: "chat", label: "Silenciar chat", description: "Evita mensajes del alumno." },
	{ key: "unmute_chat", category: "chat", label: "Activar chat", description: "Restaura permiso de chat." },
	{ key: "limit_chat", category: "chat", label: "Limitar chat", description: "Solo mensajes esenciales." },
	{ key: "restore_chat", category: "chat", label: "Restaurar chat", description: "Quita el limite de chat." },
	{ key: "freeze_student", category: "moderacion", label: "Congelar alumno", description: "Bloquea movimiento temporalmente." },
	{ key: "unfreeze_student", category: "moderacion", label: "Descongelar alumno", description: "Restaura movimiento." },
	{ key: "clear_inventory", category: "moderacion", label: "Limpiar inventario", description: "Vacia el inventario del alumno." },
	{ key: "clear_effects", category: "moderacion", label: "Limpiar efectos", description: "Quita estados alterados." },
	{ key: "teleport_to_teacher", category: "posicion", label: "Traer al profesor", description: "Teleporta alumno a tu posicion." },
	{ key: "teleport_teacher_to_student", category: "posicion", label: "Ir al alumno", description: "Teleporta al docente al alumno." },
	{ key: "return_to_spawn", category: "posicion", label: "Enviar a spawn", description: "Devuelve al punto seguro." },
	{ key: "grant_build", category: "permisos", label: "Permitir construir", description: "Da permiso de construccion." },
	{ key: "revoke_build", category: "permisos", label: "Bloquear construccion", description: "Revoca construccion." },
	{ key: "grant_interact", category: "permisos", label: "Permitir interactuar", description: "Activa uso de bloques." },
	{ key: "revoke_interact", category: "permisos", label: "Bloquear interaccion", description: "Revoca uso de bloques." },
	{ key: "heal_student", category: "estado", label: "Curar alumno", description: "Restaura salud." },
	{ key: "feed_student", category: "estado", label: "Restaurar hambre", description: "Rellena comida." },
	{ key: "set_gamemode_adventure", category: "estado", label: "Modo aventura", description: "Evita roturas accidentales." },
	{ key: "set_gamemode_survival", category: "estado", label: "Modo supervivencia", description: "Vuelve a supervivencia." }
];
const actionCategories = [
	["all", "Todas"],
	["moderacion", "Moderacion"],
	["chat", "Chat"],
	["posicion", "Posicion"],
	["permisos", "Permisos"],
	["estado", "Estado"],
	["avisos", "Avisos"]
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
		const message = $("#authMessage");
		try {
			await login($("#emailInput").value, $("#passwordInput").value, message);
		} catch (error) {
			setMessage(message, friendlyLoginError(error), "error");
		}
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
			setMessage(message, "Registro completado. Continuando...", "ok");
			await login(email, password, message);
		} catch (error) {
			setMessage(message, friendlyLoginError(error), "error");
		}
	});
}

function bindDashboard() {
	$("#logoutButton")?.addEventListener("click", logout);
	$("#studentForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		try {
			await createStudent();
		} catch (error) {
			setMessage($("#studentMessage"), friendlyLoginError(error), "error");
		}
	});
	$("#reloadStudents")?.addEventListener("click", loadStudents);
	$("#teacherForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		try {
			await createTeacher();
		} catch (error) {
			setMessage($("#teacherMessage"), error.message, "error");
		}
	});
	$("#reloadTeachers")?.addEventListener("click", loadTeachers);
	$("#actionSearch")?.addEventListener("input", (event) => {
		state.actionQuery = event.target.value.trim().toLowerCase();
		renderTeacherActions();
	});
	renderActionFilters();
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
		throw new Error("portal_access_denied");
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
		await Promise.all([loadSummary(), loadPortalContext()]);
		if (currentPage === "tic" || currentPage === "profesor") {
			await loadStudents();
		}
		if (currentPage === "tic") {
			await loadTeachers();
		}
	} catch (_) {
		logout();
	}
}

async function loadSummary() {
	state.summary = await request("/dashboard/summary");
	renderMetrics(state.summary.metrics || {});
	renderSignals();
	renderOperations();
}

async function loadPortalContext() {
	const optional = async (path) => {
		try {
			return await request(path);
		} catch (_) {
			return null;
		}
	};
	const [policy, livePolicy, route] = await Promise.all([
		optional("/client/policy"),
		optional("/client/live-policy"),
		optional("/minecraft/session-route")
	]);
	state.policy = policy;
	state.livePolicy = livePolicy;
	state.route = route;
	renderContextPanels();
}

async function loadStudents() {
	if (!$("#studentTableBody") && !$("#targetStudent")) {
		return;
	}
	try {
		const response = await request("/dashboard/students");
		state.students = response.items || [];
		renderStudents();
		renderContextPanels();
	} catch (error) {
		setMessage($("#studentMessage") || $("#actionMessage"), error.message, "error");
	}
}

async function loadTeachers() {
	if (!$("#teacherTableBody")) {
		return;
	}
	try {
		const response = await request("/dashboard/teachers");
		state.teachers = response.items || [];
		renderTeachers();
		renderContextPanels();
	} catch (error) {
		setMessage($("#teacherMessage"), error.message, "error");
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

async function createTeacher() {
	const message = $("#teacherMessage");
	setMessage(message, "Creando profesor...", "");
	try {
		await request("/dashboard/teachers", {
			method: "POST",
			body: {
				email: $("#teacherEmail").value,
				password: $("#teacherPassword").value,
				institutionId: $("#teacherInstitution").value
			}
		});
		$("#teacherForm").reset();
		setMessage(message, "Profesor creado.", "ok");
		await Promise.all([loadSummary(), loadTeachers()]);
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

async function disableTeacher(id) {
	try {
		await request(`/dashboard/teachers/${encodeURIComponent(id)}`, { method: "DELETE" });
		await Promise.all([loadSummary(), loadTeachers()]);
	} catch (error) {
		setMessage($("#teacherMessage"), error.message, "error");
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
}

function renderOperations() {
	renderSignalList("#operationsRack", [
		{ label: "Alcance", value: readableScope(state.summary?.scope) },
		{ label: "Generado", value: formatDateTime(state.summary?.generatedAt) },
		{ label: "Acciones docentes", value: `${state.summary?.metrics?.queuedActions || 0} en cola` },
		{ label: "Sesiones", value: `${state.summary?.metrics?.activeSessions || 0} activas` }
	], "Operacion");
}

function renderContextPanels() {
	renderPolicyPanel();
	renderRoutePanel();
	renderInstitutionPanel();
	renderActionOpsPanel();
	renderClassPanel();
	renderStudentBreakdown();
	renderTeacherBreakdown();
}

function renderPolicyPanel() {
	const policy = state.policy || {};
	const live = state.livePolicy || {};
	const resourcePack = policy.resourcePack || {};
	const skin = policy.skin || {};
	renderSignalList("#policyRack", [
		{ label: "Mundos locales", value: boolLabel(live.allowSingleplayerWorlds ?? policy.allowSingleplayerWorlds) },
		{ label: "Fin permiso local", value: live.localWorldsExpiresAt ? formatDateTime(live.localWorldsExpiresAt) : "sin permiso temporal" },
		{ label: "Resource pack", value: resourcePack.enabled ? (resourcePack.required ? "obligatorio" : "activo") : "inactivo" },
		{ label: "Skin", value: skin.forceCommon ? `comun ${skin.mode || ""}`.trim() : "libre" }
	], "Politica");
}

function renderRoutePanel() {
	renderSignalList("#routeRack", [
		{ label: "Servidor asignado", value: state.route?.serverName || "sin ruta" },
		{ label: "Centro", value: shortId(state.route?.institutionId || state.me?.institutionId) }
	], "Ruta");
}

function renderInstitutionPanel() {
	renderSignalList("#institutionRack", [
		{ label: "Centro", value: shortId(state.me?.institutionId) },
		{ label: "Alumnos", value: String(state.summary?.metrics?.students || state.students.length || 0) },
		{ label: "Profesores", value: String(state.summary?.metrics?.teachers || state.teachers.length || 0) },
		{ label: "Sesiones", value: String(state.summary?.metrics?.activeSessions || 0) }
	], "Centro");
}

function renderActionOpsPanel() {
	const queued = state.summary?.metrics?.queuedActions || 0;
	renderSignalList("#actionOpsRack", [
		{ label: "Pendientes", value: String(queued) },
		{ label: "Moderacion", value: `${teacherActions.length} acciones soportadas` },
		{ label: "Objetivo", value: "alumno o clase" },
		{ label: "Auditoria", value: "motivo registrado" }
	], "Acciones");
}

function renderClassPanel() {
	const metrics = state.summary?.metrics || {};
	renderSignalList("#classRack", [
		{ label: "Alumnos visibles", value: String(state.students.length || metrics.students || 0) },
		{ label: "Activos", value: String(metrics.activeStudents || activeStudentsCount()) },
		{ label: "Sesiones", value: String(metrics.activeSessions || 0) },
		{ label: "Acciones en cola", value: String(metrics.queuedActions || 0) }
	], "Clase");
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

	if ($("#teacherStudentTableBody")) {
		$("#teacherStudentTableBody").innerHTML = state.students.length ? state.students.slice(0, 12).map((student) => `
			<tr>
				<td>${escapeHtml(student.email)}</td>
				<td>${escapeHtml(readableStatus(student.status))}</td>
			</tr>
		`).join("") : `<tr><td colspan="2">Sin alumnos visibles.</td></tr>`;
	}

	if ($("#targetStudent")) {
		$("#targetStudent").innerHTML = `<option value="">Toda la clase</option>` + state.students.map((student) => `
			<option value="${escapeHtml(student.id)}">${escapeHtml(student.email)}</option>
		`).join("");
	}
	renderStudentBreakdown();
}

function renderTeachers() {
	if (!$("#teacherTableBody")) {
		return;
	}
	$("#teacherTableBody").innerHTML = state.teachers.length ? state.teachers.map((teacher) => `
		<tr>
			<td>${escapeHtml(teacher.email)}</td>
			<td>${escapeHtml(readableStatus(teacher.status))}</td>
			<td>${escapeHtml(shortId(teacher.institutionId))}</td>
			<td><button type="button" data-disable-teacher="${escapeHtml(teacher.id)}">Desactivar</button></td>
		</tr>
	`).join("") : `<tr><td colspan="4">Sin profesores visibles para este rol.</td></tr>`;
	for (const button of document.querySelectorAll("[data-disable-teacher]")) {
		button.addEventListener("click", () => disableTeacher(button.dataset.disableTeacher));
	}
	renderTeacherBreakdown();
}

function renderStudentBreakdown() {
	const node = $("#studentBreakdown");
	if (!node) {
		return;
	}
	const total = state.students.length;
	const active = state.students.filter((student) => student.status === "active").length;
	const disabled = state.students.filter((student) => student.status === "disabled").length;
	node.innerHTML = `
		<span>Total <strong>${escapeHtml(String(total))}</strong></span>
		<span>Activos <strong>${escapeHtml(String(active))}</strong></span>
		<span>Desactivados <strong>${escapeHtml(String(disabled))}</strong></span>
		<span>Centro <strong>${escapeHtml(shortId(state.me?.institutionId))}</strong></span>
	`;
}

function renderTeacherBreakdown() {
	const node = $("#teacherBreakdown");
	if (!node) {
		return;
	}
	const total = state.teachers.length;
	const active = state.teachers.filter((teacher) => teacher.status === "active").length;
	const disabled = state.teachers.filter((teacher) => teacher.status === "disabled").length;
	node.innerHTML = `
		<span>Total <strong>${escapeHtml(String(total))}</strong></span>
		<span>Activos <strong>${escapeHtml(String(active))}</strong></span>
		<span>Desactivados <strong>${escapeHtml(String(disabled))}</strong></span>
		<span>Centro <strong>${escapeHtml(shortId(state.me?.institutionId))}</strong></span>
	`;
}

function renderActionFilters() {
	const node = $("#actionFilters");
	if (!node) {
		return;
	}
	node.innerHTML = actionCategories.map(([key, label]) => `
		<button type="button" class="${key === state.actionFilter ? "is-active" : ""}" data-action-filter="${key}">${escapeHtml(label)}</button>
	`).join("");
	for (const button of document.querySelectorAll("[data-action-filter]")) {
		button.addEventListener("click", () => {
			state.actionFilter = button.dataset.actionFilter || "all";
			renderActionFilters();
			renderTeacherActions();
		});
	}
}

function renderTeacherActions() {
	if (!$("#teacherActions")) {
		return;
	}
	const query = state.actionQuery;
	const filtered = teacherActions.filter((action) => {
		const inCategory = state.actionFilter === "all" || action.category === state.actionFilter;
		const haystack = `${action.label} ${action.description} ${action.category}`.toLowerCase();
		return inCategory && (!query || haystack.includes(query));
	});
	$("#teacherActions").innerHTML = filtered.length ? filtered.map((action) => `
		<button type="button" data-action-key="${escapeHtml(action.key)}">
			<strong>${escapeHtml(action.label)}</strong>
			<small>${escapeHtml(action.description)}</small>
			<em>${escapeHtml(readableCategory(action.category))}</em>
		</button>
	`).join("") : `<div class="empty-actions">Sin acciones para ese filtro.</div>`;
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

function friendlyLoginError(error) {
	const message = String(error?.message || "");
	if (message === "portal_access_denied" || message.includes("access denied")) {
		return "Esta cuenta no puede acceder aqui.";
	}
	if (message.includes("invalid") || message.includes("unauthorized") || message.includes("HTTP 401") || message.includes("HTTP 403")) {
		return "Credenciales no validas.";
	}
	if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
		return "No se pudo conectar. Intentalo de nuevo.";
	}
	return "No se pudo iniciar sesion.";
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
	state.teachers = [];
	state.policy = null;
	state.livePolicy = null;
	state.route = null;
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
		institution_admin: "TIC de centro",
		director: "Direccion de centro",
		teacher: "Profesor",
		student: "Alumno"
	};
	return labels[role] || role || "-";
}

function readableScope(scope) {
	return scope === "company" ? "global" : "centro";
}

function readableStatus(status) {
	const labels = {
		active: "activo",
		disabled: "desactivado",
		queued: "en cola"
	};
	return labels[status] || status || "-";
}

function readableCategory(category) {
	const labels = Object.fromEntries(actionCategories);
	return labels[category] || category || "-";
}

function boolLabel(value) {
	return value ? "permitido" : "bloqueado";
}

function activeStudentsCount() {
	return state.students.filter((student) => student.status === "active").length;
}

function formatDateTime(value) {
	if (!value) {
		return "-";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return date.toLocaleString("es-ES", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit"
	});
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
