const STORAGE_KEYS = {
	access: "educraft.dashboard.accessToken",
	refresh: "educraft.dashboard.refreshToken",
	expires: "educraft.dashboard.expiresAt",
	teacherPage: "educraft.dashboard.teacherPage",
	scheduleRows: "educraft.dashboard.scheduleRows"
};

const state = {
	token: localStorage.getItem(STORAGE_KEYS.access) || "",
	refreshToken: localStorage.getItem(STORAGE_KEYS.refresh) || "",
	me: null,
	summary: null,
	students: [],
	teachers: [],
	classServers: [],
	actions: [],
	activities: [],
	policy: null,
	livePolicy: null,
	route: null,
	actionFilter: "all",
	actionQuery: "",
	activityChat: [],
	activityDraft: null,
	studentImportRows: [],
	scheduleImportRows: []
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
const chartColors = ["#15986f", "#1d6ce3", "#b8652d", "#6f5bc6", "#c84f6a", "#257b84"];
const activityTemplates = [
	{
		key: "lua-intro",
		title: "Primer script Lua en el aula",
		subject: "Programacion",
		level: "ESO / iniciacion",
		durationMinutes: 30,
		programmingMode: "lua",
		tag: "Lua",
		objectives: "Entender variables, salida por consola y repeticion simple.\nRelacionar una instruccion escrita con un efecto visible en el mundo.\nCompletar un mini reto sin copiar comandos sueltos.",
		setupSteps: "1. Abrir el cliente EduCraft y entrar al servidor asignado.\n2. Abrir Programacion desde el menu de pausa.\n3. Seleccionar modo Lua.\n4. Mantener a los alumnos en una zona plana o aula de pruebas.",
		activityScript: "Inicio (5 min): el profesor muestra print y variables.\nPractica (10 min): cada alumno cambia un contador y observa la salida.\nReto (10 min): crear un while que cuente hasta 5 y diga una frase final.\nCierre (5 min): comparar soluciones y nombrar variable, condicion y bucle.",
		studentDeliverable: "Captura o copia del codigo final con un while funcional y una explicacion de que hace la condicion.",
		assessmentRubric: "3 puntos: usa variable y la actualiza.\n3 puntos: el while termina sin bucle infinito.\n2 puntos: usa print para explicar el progreso.\n2 puntos: puede explicar el codigo con sus palabras.",
		teacherNotes: "Codigo base sugerido:\nx = 0\nwhile x < 5 do\n  print(x)\n  x = x + 1\nend\nprint(\"terminado\")"
	},
	{
		key: "scratch-build",
		title: "Algoritmos con bloques Scratch",
		subject: "Pensamiento computacional",
		level: "Primaria avanzada / ESO",
		durationMinutes: 25,
		programmingMode: "scratch",
		tag: "Scratch",
		objectives: "Construir una secuencia de instrucciones.\nUsar repeticion para evitar pasos duplicados.\nTraducir bloques simples a comportamiento dentro del mundo.",
		setupSteps: "1. Abrir Programacion desde pausa.\n2. Cambiar a modo Scratch.\n3. Preparar una meta visible en el mapa.\n4. Dar una plantilla y pedir una variacion propia.",
		activityScript: "Inicio (5 min): explicar decir, avanzar, repetir y saltar.\nPractica (8 min): ejecutar una secuencia guiada.\nReto (8 min): llegar a una marca usando repetir.\nCierre (4 min): detectar que instrucciones se repiten.",
		studentDeliverable: "Programa Scratch textual que use al menos un repetir y una accion de movimiento.",
		assessmentRubric: "4 puntos: secuencia ordenada.\n3 puntos: usa repetir correctamente.\n2 puntos: ajusta el programa tras probarlo.\n1 punto: explica el patron repetido.",
		teacherNotes: "Ejemplo:\ndecir inicio\nrepetir 3 avanzar 1\nsaltar\ndecir listo"
	},
	{
		key: "chemistry-lab",
		title: "Laboratorio de elementos y compuestos",
		subject: "Quimica",
		level: "ESO",
		durationMinutes: 30,
		programmingMode: "none",
		tag: "STEM",
		objectives: "Identificar elementos por nombre y simbolo.\nObservar combinaciones cercanas y registrar un compuesto.\nTrabajar con normas de laboratorio digital.",
		setupSteps: "1. Preparar zona segura de laboratorio.\n2. Repartir roles: constructor, observador y relator.\n3. Activar modo aventura si hace falta.\n4. Usar bloques de elementos autorizados.",
		activityScript: "Inicio (5 min): normas del laboratorio.\nExploracion (10 min): inspeccionar elementos y anotar propiedades.\nConstruccion (10 min): probar combinaciones guiadas.\nCierre (5 min): cada grupo entrega una ficha de descubrimiento.",
		studentDeliverable: "Ficha con elementos usados, compuesto observado, captura del montaje y explicacion de seguridad.",
		assessmentRubric: "3 puntos: identifica elementos.\n3 puntos: registra observacion con evidencia.\n2 puntos: respeta normas de laboratorio.\n2 puntos: comunica el resultado con claridad.",
		teacherNotes: "Conviene tener acciones de aula listas: modo aventura, bloquear construccion y anuncio de clase."
	}
];

const $ = (selector) => document.querySelector(selector);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const registerStepState = { index: 0 };

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
	initRegisterStepper();
	$("#registerForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		const message = $("#registerMessage");
		const email = $("#registerEmail").value.trim();
		const password = $("#registerPassword").value;
		const payload = registerPayload(email, password);
		const validation = validateRegisterPayload(payload);
		if (validation) {
			setMessage(message, validation, "error");
			return;
		}
		setMessage(message, "Creando centro...", "");
		try {
			await request("/register", {
				method: "POST",
				auth: false,
				body: payload
			});
			setMessage(message, "Registro completado. Continuando...", "ok");
			await login(email, password, message);
		} catch (error) {
			setMessage(message, friendlyLoginError(error), "error");
		}
	});
}

function initRegisterStepper() {
	const steps = registerSteps();
	if (!steps.length) {
		return;
	}
	$("#registerPrev")?.addEventListener("click", () => setRegisterStep(registerStepState.index - 1));
	$("#registerNext")?.addEventListener("click", () => {
		if (validateRegisterStep(registerStepState.index)) {
			setRegisterStep(registerStepState.index + 1);
		}
	});
	setRegisterStep(0);
}

function registerSteps() {
	return Array.from(document.querySelectorAll("[data-register-step]"));
}

function setRegisterStep(index) {
	const steps = registerSteps();
	if (!steps.length) {
		return;
	}
	registerStepState.index = Math.min(Math.max(index, 0), steps.length - 1);
	steps.forEach((step, stepIndex) => {
		const active = stepIndex === registerStepState.index;
		step.classList.toggle("is-active", active);
		for (const field of step.querySelectorAll("input, select")) {
			field.disabled = !active;
		}
	});
	const current = registerStepState.index + 1;
	$("#registerStepText").textContent = `Paso ${current}/${steps.length}`;
	$("#registerProgressBar").style.width = `${(current / steps.length) * 100}%`;
	$("#registerPrev").disabled = registerStepState.index === 0;
	$("#registerNext").hidden = registerStepState.index === steps.length - 1;
	$("#registerSubmit").hidden = registerStepState.index !== steps.length - 1;
	setMessage($("#registerMessage"), "", "");
}

function validateRegisterStep(index) {
	const step = registerSteps()[index];
	if (!step) {
		return true;
	}
	for (const field of step.querySelectorAll("input, select")) {
		if (!field.checkValidity()) {
			field.reportValidity();
			return false;
		}
	}
	return true;
}

function registerPayload(email, password) {
	return {
		institutionName: $("#registerInstitution").value,
		legalName: $("#registerLegalName").value,
		institutionType: $("#registerInstitutionType").value,
		taxId: $("#registerTaxId").value,
		website: $("#registerWebsite").value,
		domain: $("#registerDomain").value,
		country: $("#registerCountry").value,
		region: $("#registerRegion").value,
		city: $("#registerCity").value,
		postalCode: $("#registerPostalCode").value,
		addressLine: $("#registerAddress").value,
		timezone: $("#registerTimezone").value,
		studentCount: Number($("#registerStudentCount").value),
		teacherCount: Number($("#registerTeacherCount").value),
		grades: $("#registerGrades").value,
		contactName: $("#registerName").value,
		contactTitle: $("#registerContactTitle").value,
		contactPhone: $("#registerContactPhone").value,
		email,
		technicalEmail: $("#registerTechnicalEmail").value,
		dataProtectionName: $("#registerDataProtectionName").value,
		dataProtectionEmail: $("#registerDataProtectionEmail").value,
		sisProvider: $("#registerSIS").value,
		ssoProvider: $("#registerSSO").value,
		authorityConfirmed: $("#registerAuthority").checked,
		domainOwnershipConfirmed: $("#registerDomainOwnership").checked,
		minorsConfirmed: $("#registerMinors").checked,
		termsAccepted: $("#registerTerms").checked,
		privacyAccepted: $("#registerPrivacy").checked,
		dpaAccepted: $("#registerDPA").checked,
		password
	};
}

function validateRegisterPayload(payload) {
	const required = [
		"institutionName", "legalName", "institutionType", "taxId", "website", "domain", "country", "region", "city",
		"postalCode", "addressLine", "timezone", "grades", "contactName", "contactTitle", "contactPhone", "email",
		"technicalEmail", "dataProtectionName", "dataProtectionEmail", "sisProvider", "ssoProvider", "password"
	];
	for (const field of required) {
		if (!String(payload[field] || "").trim()) {
			return "Faltan campos obligatorios.";
		}
	}
	if (!payload.email.endsWith(`@${payload.domain.replace(/^@/, "").toLowerCase()}`)) {
		return "El email TIC debe pertenecer al dominio del centro.";
	}
	if (payload.studentCount < 1 || payload.teacherCount < 1) {
		return "Indica alumnos y profesores mayores que cero.";
	}
	if (payload.password.length < 10 || !/[a-z]/.test(payload.password) || !/[A-Z]/.test(payload.password) || !/[0-9]/.test(payload.password)) {
		return "La contrasena necesita 10 caracteres, mayuscula, minuscula y numero.";
	}
	if (!payload.authorityConfirmed || !payload.domainOwnershipConfirmed || !payload.minorsConfirmed || !payload.termsAccepted || !payload.privacyAccepted || !payload.dpaAccepted) {
		return "Acepta todas las confirmaciones obligatorias.";
	}
	return "";
}

function bindDashboard() {
	$("#logoutButton")?.addEventListener("click", logout);
	bindTeacherPages();
	bindTicPages();
	$("#studentForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		try {
			await createStudent();
		} catch (error) {
			setMessage($("#studentMessage"), friendlyLoginError(error), "error");
		}
	});
	$("#reloadStudents")?.addEventListener("click", loadStudents);
	$("#reloadClassServers")?.addEventListener("click", loadClassServers);
	$("#studentImportPreview")?.addEventListener("click", previewStudentImport);
	$("#studentImportFile")?.addEventListener("change", resetStudentImport);
	$("#studentImportText")?.addEventListener("input", resetStudentImport);
	$("#studentImportForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await submitStudentImport();
	});
	$("#scheduleImportPreview")?.addEventListener("click", previewScheduleImport);
	$("#scheduleImportFile")?.addEventListener("change", resetScheduleImport);
	$("#scheduleImportText")?.addEventListener("input", resetScheduleImport);
	$("#scheduleImportForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await saveScheduleImport();
	});
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
	$("#activityForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await createActivity();
	});
	$("#activityAiForm")?.addEventListener("submit", async (event) => {
		event.preventDefault();
		await sendActivityChat();
	});
	$("[data-activity-manual-toggle]")?.addEventListener("click", () => {
		const panel = $("[data-manual-activity]");
		setManualActivityVisible(panel?.hidden ?? true);
	});
	$("[data-activity-review-toggle]")?.addEventListener("click", () => {
		fillActivityDraft(state.activityDraft || activityPayload());
		setManualActivityVisible(true);
		setMessage($("#activityMessage"), "Borrador listo para revisar y guardar.", "ok");
	});
	$("#activityReset")?.addEventListener("click", () => fillActivityTemplate(activityTemplates[0], true));
	renderActionFilters();
	renderTeacherActions();
	renderActivityTemplates();
	renderActivityChat();
}

function bindTeacherPages() {
	const buttons = Array.from(document.querySelectorAll("[data-teacher-page]"));
	if (!buttons.length) {
		return;
	}
	for (const button of buttons) {
		button.addEventListener("click", () => setTeacherPage(button.dataset.teacherPage, true));
	}
	const requested = new URLSearchParams(location.search).get("vista") || location.hash.replace("#", "");
	const defaultPage = document.body.dataset.teacherDefault || "clases";
	setTeacherPage(requested || defaultPage, false);
}

function setTeacherPage(page, persist) {
	const validPages = new Set(["info", "clases", "control"]);
	const nextPage = validPages.has(page) ? page : "clases";
	for (const button of document.querySelectorAll("[data-teacher-page]")) {
		const active = button.dataset.teacherPage === nextPage;
		button.classList.toggle("is-active", active);
		button.setAttribute("aria-selected", active ? "true" : "false");
	}
	for (const panel of document.querySelectorAll("[data-teacher-panel]")) {
		panel.hidden = panel.dataset.teacherPanel !== nextPage;
	}
	if (nextPage === "info") {
		renderDashboardCharts();
		renderContextPanels();
	}
	if (nextPage === "control") {
		renderTeacherActions();
		renderMinecraftActions();
	}
	if (persist) {
		localStorage.setItem(STORAGE_KEYS.teacherPage, nextPage);
	}
}

function bindTicPages() {
	const buttons = Array.from(document.querySelectorAll("[data-tic-page]"));
	if (!buttons.length) {
		return;
	}
	for (const button of buttons) {
		button.addEventListener("click", () => localStorage.setItem("educraft.dashboard.ticPage", button.dataset.ticPage || "resumen"));
	}
	const requested = new URLSearchParams(location.search).get("vista") || location.hash.replace("#", "");
	const defaultPage = document.body.dataset.ticDefault || localStorage.getItem("educraft.dashboard.ticPage") || "resumen";
	setTicPage(requested || defaultPage);
}

function setTicPage(page) {
	const validPages = new Set(["resumen", "alumnos", "profesores", "horario", "operacion"]);
	const nextPage = validPages.has(page) ? page : "resumen";
	for (const button of document.querySelectorAll("[data-tic-page]")) {
		const active = button.dataset.ticPage === nextPage;
		button.classList.toggle("is-active", active);
		button.setAttribute("aria-selected", active ? "true" : "false");
	}
	for (const panel of document.querySelectorAll("[data-tic-panel]")) {
		panel.hidden = panel.dataset.ticPanel !== nextPage;
	}
	if (nextPage === "resumen") {
		renderDashboardCharts();
		renderContextPanels();
	}
	if (nextPage === "operacion") {
		renderMinecraftActions();
		renderActionOpsPanel();
	}
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
			await loadSchedule();
		}
		if (currentPage === "tic" || currentPage === "profesor") {
			await loadTeacherActions();
		}
		if (currentPage === "profesor") {
			await loadActivities();
		}
	} catch (_) {
		logout();
	}
}

async function loadSummary() {
	state.summary = await request("/dashboard/summary");
	renderMetrics(state.summary.metrics || {});
	renderDashboardCharts();
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
		await loadClassServers();
	} catch (error) {
		setMessage($("#studentMessage") || $("#actionMessage"), error.message, "error");
	}
}

async function loadClassServers() {
	if (!$("#classServerRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/class-servers");
		state.classServers = response.items || [];
		renderClassServers();
	} catch (error) {
		state.classServers = [];
		renderClassServers(error);
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

async function loadTeacherActions() {
	if (!$("#minecraftActionRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/teacher/actions");
		state.actions = response.items || [];
		renderMinecraftActions();
	} catch (error) {
		renderMinecraftActions(error);
	}
}

async function loadSchedule() {
	if (!$("#scheduleImportPreviewTable")) {
		return;
	}
	try {
		const response = await request("/dashboard/schedule");
		state.scheduleImportRows = response.items || [];
		renderImportPreview("#scheduleImportPreviewTable", state.scheduleImportRows, ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
		localStorage.setItem(STORAGE_KEYS.scheduleRows, JSON.stringify(state.scheduleImportRows));
		if (state.scheduleImportRows.length) {
			setMessage($("#scheduleImportMessage"), `${state.scheduleImportRows.length} filas de horario cargadas.`, "ok");
		}
	} catch (_) {
		restoreSavedSchedule();
	}
}

async function loadActivities() {
	if (!$("#activityList")) {
		return;
	}
	try {
		const response = await request("/dashboard/activities");
		state.activities = response.items || [];
		renderActivities();
	} catch (error) {
		setMessage($("#activityMessage"), error.message, "error");
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
				institutionId: $("#studentInstitution").value,
				course: $("#studentCourse")?.value || "",
				classGroup: $("#studentClassGroup")?.value || ""
			}
		});
		$("#studentForm").reset();
		setMessage(message, "Alumno creado.", "ok");
		await Promise.all([loadSummary(), loadStudents()]);
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function previewStudentImport() {
	const message = $("#studentImportMessage");
	try {
		const text = await readImportText("studentImportFile", "studentImportText");
		const rows = parseStudentRows(text);
		state.studentImportRows = rows;
		renderImportPreview("#studentImportPreviewTable", rows, ["email", "password", "course", "classGroup", "institutionId"], "Sin alumnos para importar.");
		setMessage(message, `${rows.length} alumnos listos para crear.`, rows.length ? "ok" : "error");
	} catch (error) {
		state.studentImportRows = [];
		renderImportPreview("#studentImportPreviewTable", [], ["email", "password", "course", "classGroup", "institutionId"], "Sin alumnos para importar.");
		setMessage(message, error.message, "error");
	}
}

async function submitStudentImport() {
	const message = $("#studentImportMessage");
	if (!state.studentImportRows.length) {
		await previewStudentImport();
	}
	if (!state.studentImportRows.length) {
		return;
	}
	setMessage(message, `Creando ${state.studentImportRows.length} alumnos...`, "");
	let created = 0;
	const failures = [];
	for (const row of state.studentImportRows) {
		try {
			await request("/dashboard/students", {
				method: "POST",
				body: {
					email: row.email,
					password: row.password,
					institutionId: row.institutionId,
					course: row.course,
					classGroup: row.classGroup
				}
			});
			created += 1;
		} catch (error) {
			failures.push(`${row.email}: ${error.message}`);
		}
	}
	await Promise.all([loadSummary(), loadStudents()]);
	const result = failures.length ? `${created} creados, ${failures.length} con error. ${failures.slice(0, 2).join(" | ")}` : `${created} alumnos creados.`;
	setMessage(message, result, failures.length ? "error" : "ok");
}

async function previewScheduleImport() {
	const message = $("#scheduleImportMessage");
	try {
		const text = await readImportText("scheduleImportFile", "scheduleImportText");
		const rows = parseScheduleRows(text);
		state.scheduleImportRows = rows;
		renderImportPreview("#scheduleImportPreviewTable", rows, ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
		setMessage(message, `${rows.length} filas de horario listas.`, rows.length ? "ok" : "error");
	} catch (error) {
		state.scheduleImportRows = [];
		renderImportPreview("#scheduleImportPreviewTable", [], ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
		setMessage(message, error.message, "error");
	}
}

async function saveScheduleImport() {
	const message = $("#scheduleImportMessage");
	if (!state.scheduleImportRows.length) {
		await previewScheduleImport();
	}
	if (!state.scheduleImportRows.length) {
		return;
	}
	try {
		const response = await request("/dashboard/schedule", {
			method: "PUT",
			body: { items: state.scheduleImportRows }
		});
		state.scheduleImportRows = response.items || [];
		localStorage.setItem(STORAGE_KEYS.scheduleRows, JSON.stringify(state.scheduleImportRows));
		renderImportPreview("#scheduleImportPreviewTable", state.scheduleImportRows, ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
		setMessage(message, `${state.scheduleImportRows.length} filas de horario guardadas en el centro.`, "ok");
	} catch (error) {
		localStorage.setItem(STORAGE_KEYS.scheduleRows, JSON.stringify(state.scheduleImportRows));
		setMessage(message, `Guardado local. Backend no acepto el horario: ${error.message}`, "error");
	}
}

function restoreSavedSchedule() {
	const raw = localStorage.getItem(STORAGE_KEYS.scheduleRows);
	if (!raw) {
		return;
	}
	try {
		state.scheduleImportRows = JSON.parse(raw) || [];
		renderImportPreview("#scheduleImportPreviewTable", state.scheduleImportRows, ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
	} catch (_) {
		localStorage.removeItem(STORAGE_KEYS.scheduleRows);
	}
}

function resetStudentImport() {
	state.studentImportRows = [];
	setMessage($("#studentImportMessage"), "", "");
	renderImportPreview("#studentImportPreviewTable", [], ["email", "password", "course", "classGroup", "institutionId"], "Sin alumnos para importar.");
}

function resetScheduleImport() {
	state.scheduleImportRows = [];
	setMessage($("#scheduleImportMessage"), "", "");
	renderImportPreview("#scheduleImportPreviewTable", [], ["day", "time", "group", "subject", "teacher"], "Sin horario para importar.");
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

async function readImportText(fileInputId, textAreaId) {
	const typed = $(`#${textAreaId}`)?.value?.trim() || "";
	if (typed) {
		return typed;
	}
	const file = $(`#${fileInputId}`)?.files?.[0];
	if (!file) {
		throw new Error("Sube un CSV/TSV o pega datos desde la hoja.");
	}
	if (/\.(xlsx|xls)$/i.test(file.name)) {
		throw new Error("Exporta el Excel o Google Sheets como CSV/TSV y vuelve a subirlo.");
	}
	return await file.text();
}

function parseStudentRows(text) {
	const table = parseDelimitedTable(text);
	const emailIndex = findColumn(table.headers, ["email", "correo", "mail", "alumno", "usuario"]);
	const passwordIndex = findColumn(table.headers, ["password", "contrasena", "contraseña", "clave"]);
	const institutionIndex = findColumn(table.headers, ["centro", "institution", "institutionid", "institucion", "institución"]);
	const courseIndex = findColumn(table.headers, ["curso", "course", "nivel", "etapa"]);
	const classGroupIndex = findColumn(table.headers, ["clase", "grupo", "class", "classgroup", "grupo clase", "aula"]);
	if (emailIndex < 0) {
		throw new Error("No encuentro columna de email/correo.");
	}
	return table.rows.map((row, index) => ({
		email: cleanCell(row[emailIndex]).toLowerCase(),
		password: cleanCell(row[passwordIndex]) || defaultStudentPassword(index),
		course: cleanCell(row[courseIndex]),
		classGroup: cleanCell(row[classGroupIndex]),
		institutionId: cleanCell(row[institutionIndex])
	})).filter((row) => row.email.includes("@") && row.password.length >= 4);
}

function parseScheduleRows(text) {
	const table = parseDelimitedTable(text);
	const dayIndex = findColumn(table.headers, ["dia", "día", "day", "fecha"]);
	const timeIndex = findColumn(table.headers, ["hora", "time", "tramo", "slot"]);
	const groupIndex = findColumn(table.headers, ["grupo", "clase", "curso", "class"]);
	const subjectIndex = findColumn(table.headers, ["asignatura", "materia", "subject"]);
	const teacherIndex = findColumn(table.headers, ["profesor", "docente", "teacher"]);
	const roomIndex = findColumn(table.headers, ["aula", "sala", "room"]);
	const notesIndex = findColumn(table.headers, ["notas", "observaciones", "notes"]);
	if (dayIndex < 0 && timeIndex >= 0) {
		return parseScheduleMatrixRows(table, timeIndex);
	}
	if (dayIndex < 0 || timeIndex < 0) {
		throw new Error("El horario necesita al menos columnas de dia y hora.");
	}
	return table.rows.map((row) => ({
		day: cleanCell(row[dayIndex]),
		time: cleanCell(row[timeIndex]),
		group: cleanCell(row[groupIndex]),
		subject: cleanCell(row[subjectIndex]),
		teacher: cleanCell(row[teacherIndex]),
		room: cleanCell(row[roomIndex]),
		notes: cleanCell(row[notesIndex])
	})).filter((row) => row.day && row.time);
}

function parseScheduleMatrixRows(table, timeIndex) {
	const dayColumns = table.headers.map((header, index) => ({
		index,
		day: readableScheduleDay(header)
	})).filter((item) => item.index !== timeIndex && item.day);
	if (!dayColumns.length) {
		throw new Error("No encuentro columnas de dias como Lunes, Martes o Miercoles.");
	}
	return table.rows.flatMap((row) => {
		const time = cleanCell(row[timeIndex]);
		if (!time) {
			return [];
		}
		return dayColumns.map((column) => ({
			day: column.day,
			time,
			group: "",
			subject: cleanCell(row[column.index]),
			teacher: "",
			room: "",
			notes: ""
		})).filter((item) => item.subject);
	});
}

function readableScheduleDay(header) {
	const labels = {
		lunes: "Lunes",
		martes: "Martes",
		miercoles: "Miercoles",
		jueves: "Jueves",
		viernes: "Viernes",
		sabado: "Sabado",
		domingo: "Domingo"
	};
	return labels[header] || "";
}

function parseDelimitedTable(text) {
	const delimiter = detectDelimiter(text);
	const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim());
	if (lines.length < 2) {
		throw new Error("La hoja necesita cabecera y al menos una fila.");
	}
	return {
		headers: splitDelimitedLine(lines[0], delimiter).map(normalizeHeader),
		rows: lines.slice(1).map((line) => splitDelimitedLine(line, delimiter))
	};
}

function detectDelimiter(text) {
	const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
	const counts = {
		"\t": (firstLine.match(/\t/g) || []).length,
		";": (firstLine.match(/;/g) || []).length,
		",": (firstLine.match(/,/g) || []).length
	};
	return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitDelimitedLine(line, delimiter) {
	const cells = [];
	let cell = "";
	let quoted = false;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (char === "\"" && line[index + 1] === "\"") {
			cell += "\"";
			index += 1;
		} else if (char === "\"") {
			quoted = !quoted;
		} else if (char === delimiter && !quoted) {
			cells.push(cell);
			cell = "";
		} else {
			cell += char;
		}
	}
	cells.push(cell);
	return cells;
}

function findColumn(headers, aliases) {
	const cleanAliases = aliases.map(normalizeHeader);
	return headers.findIndex((header) => cleanAliases.includes(header));
}

function normalizeHeader(value) {
	return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function cleanCell(value) {
	return String(value || "").trim();
}

function defaultStudentPassword(index) {
	return `EduCraft${String(index + 1).padStart(3, "0")}`;
}

function renderImportPreview(selector, rows, columns, emptyText) {
	const node = $(selector);
	if (!node) {
		return;
	}
	if (!rows.length) {
		node.innerHTML = `<div class="chart-empty">${escapeHtml(emptyText)}</div>`;
		return;
	}
	node.innerHTML = `
		<table class="portal-table compact-table">
			<thead><tr>${columns.map((column) => `<th>${escapeHtml(importColumnLabel(column))}</th>`).join("")}</tr></thead>
			<tbody>${rows.slice(0, 8).map((row) => `
				<tr>${columns.map((column) => `<td>${escapeHtml(row[column] || "-")}</td>`).join("")}</tr>
			`).join("")}</tbody>
		</table>
		<p>${escapeHtml(String(rows.length))} filas detectadas${rows.length > 8 ? ", mostrando las primeras 8" : ""}.</p>
	`;
}

function importColumnLabel(column) {
	const labels = {
		email: "Email",
		password: "Contrasena",
		course: "Curso",
		classGroup: "Clase",
		institutionId: "Centro",
		day: "Dia",
		time: "Hora",
		group: "Grupo",
		subject: "Asignatura",
		teacher: "Profesor"
	};
	return labels[column] || column;
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
		await Promise.all([loadSummary(), loadTeacherActions()]);
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function createActivity() {
	const message = $("#activityMessage");
	setMessage(message, "Guardando actividad...", "");
	try {
		const response = await request("/dashboard/activities", {
			method: "POST",
			body: activityPayload()
		});
		setMessage(message, `Actividad guardada: ${shortId(response.id)}`, "ok");
		await Promise.all([loadActivities(), loadSummary()]);
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function sendActivityChat(messageOverride) {
	const message = $("#activityAiMessage");
	const prompt = (messageOverride || $("#activityAiPrompt")?.value || "").trim();
	if (!prompt) {
		setMessage(message, "Escribe que clase quieres preparar.", "error");
		return;
	}
	state.activityChat.push({ role: "user", content: prompt });
	renderActivityChat();
	setMessage(message, "Pensando borrador...", "");
	try {
		const response = await request("/dashboard/activities/chat", {
			method: "POST",
			body: {
				message: prompt,
				draft: state.activityDraft || {},
				history: state.activityChat.slice(-8)
			}
		});
		state.activityDraft = response.draft;
		state.activityChat.push({ role: "assistant", content: response.reply || "Borrador actualizado." });
		fillActivityDraft(response.draft);
		renderActivityChat(response.suggestions || []);
		if ($("#activityAiPrompt")) {
			$("#activityAiPrompt").value = "";
		}
		setMessage(message, "Borrador actualizado. Pulsa Revisar y guardar cuando quieras abrirlo.", "ok");
	} catch (error) {
		state.activityChat.push({ role: "assistant", content: "No he podido actualizar la clase: " + error.message });
		renderActivityChat();
		setMessage(message, error.message, "error");
	}
}

function renderActivityChat(suggestions = []) {
	const node = $("#activityAiChat");
	if (!node) {
		return;
	}
	const messages = state.activityChat.length ? state.activityChat : [
		{ role: "assistant", content: "Cuéntame qué clase quieres crear. Por ejemplo: una clase de 30 minutos sobre bucles en Lua para ESO, con reto final y rúbrica simple." }
	];
	node.innerHTML = messages.slice(-8).map((item) => `
		<div class="activity-chat-message ${escapeHtml(item.role)}">
			<strong>${item.role === "user" ? "Profesor" : "Asistente"}</strong>
			<p>${escapeHtml(item.content)}</p>
		</div>
	`).join("");
	const suggestionsNode = $("#activityAiSuggestions");
	if (suggestionsNode) {
		const items = suggestions.length ? suggestions : ["Hazla mas facil", "Adaptala a grupos", "Mejora la rubrica", "Cambiala a Scratch"];
		suggestionsNode.innerHTML = items.map((item) => `<button type="button" data-activity-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("");
		for (const button of suggestionsNode.querySelectorAll("[data-activity-suggestion]")) {
			button.addEventListener("click", () => sendActivityChat(button.dataset.activitySuggestion));
		}
	}
	node.scrollTop = node.scrollHeight;
}

function setManualActivityVisible(visible) {
	const panel = $("[data-manual-activity]");
	const toggle = $("[data-activity-manual-toggle]");
	if (!panel) {
		return;
	}
	panel.hidden = !visible;
	if (toggle) {
		toggle.textContent = visible ? "Ocultar manual" : "Hacer a mano";
		toggle.setAttribute("aria-expanded", visible ? "true" : "false");
	}
	if (visible) {
		panel.scrollIntoView({ block: "start", behavior: "smooth" });
	}
}

function renderIdentity() {
	$("#sessionLabel").textContent = state.me.email || "Sesion activa";
	$("#identityPanel").innerHTML = `
		<dl>
			<div><dt>Email</dt><dd>${escapeHtml(state.me.email || "-")}</dd></div>
			<div><dt>Rol</dt><dd>${escapeHtml(readableRole(state.me.role))}</dd></div>
			<div><dt>Centro</dt><dd>${state.me.institutionId ? "Asignado" : "Global"}</dd></div>
			<div><dt>Acceso</dt><dd>Privado</dd></div>
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
	const entries = preferred.filter((key) => hasOwn(metrics, key)).map((key) => [key, metrics[key]]);
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
		{ label: "Pack oficial", value: resourcePack.enabled ? (resourcePack.required ? "global obligatorio" : "global activo") : "inactivo" },
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

function renderMinecraftActions(error) {
	const node = $("#minecraftActionRack");
	if (!node) {
		return;
	}
	if (error) {
		node.innerHTML = `<div class="minecraft-action empty"><strong>Sin estado</strong><span>${escapeHtml(error.message || "No se pudo cargar la entrega.")}</span></div>`;
		return;
	}
	node.innerHTML = state.actions.length ? state.actions.slice(0, 8).map((action) => `
		<div class="minecraft-action ${escapeHtml(action.status || "queued")}">
			<strong>${escapeHtml(actionLabel(action.actionKey))}</strong>
			<span>${escapeHtml(actionTargetLabel(action))}</span>
			<small>${escapeHtml(actionDeliveryLabel(action))}</small>
		</div>
	`).join("") : `<div class="minecraft-action empty"><strong>Sin acciones recientes</strong><span>No hay entregas pendientes para la clase.</span></div>`;
}

function renderActivityTemplates() {
	const node = $("#activityTemplates");
	if (!node) {
		return;
	}
	node.innerHTML = activityTemplates.map((template, index) => `
		<button type="button" data-activity-template="${escapeHtml(template.key)}" class="${index === 0 ? "is-active" : ""}">
			<strong>${escapeHtml(template.title)}</strong>
			<span>${escapeHtml(template.subject)} · ${escapeHtml(String(template.durationMinutes))} min</span>
			<em>${escapeHtml(template.tag)}</em>
		</button>
	`).join("");
	for (const button of document.querySelectorAll("[data-activity-template]")) {
		button.addEventListener("click", () => {
			for (const item of document.querySelectorAll("[data-activity-template]")) item.classList.remove("is-active");
			button.classList.add("is-active");
			fillActivityTemplate(activityTemplates.find((template) => template.key === button.dataset.activityTemplate), true);
		});
	}
	if (!$("#activityTitle")?.value) {
		fillActivityTemplate(activityTemplates[0], false);
	}
}

function fillActivityTemplate(template, notify) {
	if (!template) {
		return;
	}
	$("#activityTitle").value = template.title;
	$("#activitySubject").value = template.subject;
	$("#activityLevel").value = template.level;
	$("#activityDuration").value = template.durationMinutes;
	$("#activityProgrammingMode").value = template.programmingMode;
	$("#activityStatus").value = "draft";
	$("#activityObjectives").value = template.objectives;
	$("#activitySetup").value = template.setupSteps;
	$("#activityScript").value = template.activityScript;
	$("#activityDeliverable").value = template.studentDeliverable;
	$("#activityRubric").value = template.assessmentRubric;
	$("#activityNotes").value = template.teacherNotes;
	$("#activityDraftHint").textContent = `${template.durationMinutes} min`;
	if (notify) {
		setMessage($("#activityMessage"), "Plantilla cargada. Ajusta detalles y guarda.", "ok");
	}
}

function fillActivityDraft(activity) {
	if (!activity) {
		return;
	}
	for (const item of document.querySelectorAll("[data-activity-template]")) item.classList.remove("is-active");
	$("#activityTitle").value = activity.title || "";
	$("#activitySubject").value = activity.subject || "";
	$("#activityLevel").value = activity.level || "";
	$("#activityDuration").value = activity.durationMinutes || 30;
	$("#activityProgrammingMode").value = activity.programmingMode || "lua";
	$("#activityStatus").value = activity.status || "draft";
	$("#activityObjectives").value = activity.objectives || "";
	$("#activitySetup").value = activity.setupSteps || "";
	$("#activityScript").value = activity.activityScript || "";
	$("#activityDeliverable").value = activity.studentDeliverable || "";
	$("#activityRubric").value = activity.assessmentRubric || "";
	$("#activityNotes").value = activity.teacherNotes || "";
	$("#activityDraftHint").textContent = "IA";
}

function renderActivities() {
	const node = $("#activityList");
	if (!node) {
		return;
	}
	node.innerHTML = state.activities.length ? state.activities.map((activity) => `
		<article class="activity-card ${escapeHtml(activity.status)}">
			<div>
				<strong>${escapeHtml(activity.title)}</strong>
				<span>${escapeHtml(activity.subject)} · ${escapeHtml(activity.level)} · ${escapeHtml(String(activity.durationMinutes))} min</span>
			</div>
			<p>${escapeHtml(firstLine(activity.objectives))}</p>
			<footer>
				<small>${escapeHtml(readableActivityStatus(activity.status))} · ${escapeHtml((activity.programmingMode || "none").toUpperCase())}</small>
				${activity.status === "published" ? `<button type="button" data-activity-status="${escapeHtml(activity.id)}" data-status="draft">Pasar a borrador</button>` : `<button type="button" data-activity-status="${escapeHtml(activity.id)}" data-status="published">Publicar</button>`}
			</footer>
		</article>
	`).join("") : `<article class="activity-card empty"><strong>Sin actividades</strong><p>Elige una plantilla, ajusta el guion y guarda la primera clase.</p></article>`;
	for (const button of document.querySelectorAll("[data-activity-status]")) {
		button.addEventListener("click", () => updateActivityStatus(button.dataset.activityStatus, button.dataset.status));
	}
}

async function updateActivityStatus(id, status) {
	try {
		await request(`/dashboard/activities/${encodeURIComponent(id)}/status`, {
			method: "PATCH",
			body: { status }
		});
		await loadActivities();
	} catch (error) {
		setMessage($("#activityMessage"), error.message, "error");
	}
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

function activityPayload() {
	return {
		title: $("#activityTitle").value,
		subject: $("#activitySubject").value,
		level: $("#activityLevel").value,
		durationMinutes: Number($("#activityDuration").value),
		templateKey: document.querySelector("[data-activity-template].is-active")?.dataset.activityTemplate || "custom",
		programmingMode: $("#activityProgrammingMode").value,
		status: $("#activityStatus").value,
		objectives: $("#activityObjectives").value,
		setupSteps: $("#activitySetup").value,
		activityScript: $("#activityScript").value,
		studentDeliverable: $("#activityDeliverable").value,
		assessmentRubric: $("#activityRubric").value,
		teacherNotes: $("#activityNotes").value
	};
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
				<td>${escapeHtml(student.course || "-")}</td>
				<td>${escapeHtml(student.classGroup || "-")}</td>
				<td>${escapeHtml(student.status)}</td>
				<td>${escapeHtml(shortId(student.institutionId))}</td>
				<td><button type="button" data-disable-student="${escapeHtml(student.id)}">Desactivar</button></td>
			</tr>
		`).join("") : `<tr><td colspan="6">Sin alumnos visibles para este rol.</td></tr>`;
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
	renderDashboardCharts();
}

function renderClassServers(error) {
	const rack = $("#classServerRack");
	if (!rack) {
		return;
	}
	if (error) {
		rack.innerHTML = `<div class="empty-state">${escapeHtml(error.message || "No se pudo cargar el sistema Paper.")}</div>`;
		return;
	}
	rack.innerHTML = state.classServers.length ? state.classServers.map((server) => {
		const stateLabel = server.status?.state || (server.record ? "creado" : "sin crear");
		const agentText = server.agentAvailable ? stateLabel : "agente sin configurar";
		return `
			<article class="class-server-item">
				<div>
					<h3>${escapeHtml(server.classGroup || server.displayName || server.classId)}</h3>
					<p>${escapeHtml(server.studentCount || 0)} alumnos · ${escapeHtml(server.serverName || server.id)} · ${escapeHtml(agentText)}</p>
				</div>
				<div class="class-server-actions">
					<button type="button" data-class-server-create="${escapeHtml(server.classGroup)}">Crear + arrancar</button>
					<button type="button" data-class-server-action="start" data-class-server-id="${escapeHtml(server.id)}">Arrancar</button>
					<button type="button" data-class-server-action="restart" data-class-server-id="${escapeHtml(server.id)}">Reiniciar</button>
					<button type="button" data-class-server-action="status" data-class-server-id="${escapeHtml(server.id)}">Estado</button>
				</div>
			</article>
		`;
	}).join("") : `<div class="empty-state">Sin clases con alumnos activos.</div>`;
	for (const button of document.querySelectorAll("[data-class-server-create]")) {
		button.addEventListener("click", () => provisionClassServer(button.dataset.classServerCreate));
	}
	for (const button of document.querySelectorAll("[data-class-server-action]")) {
		button.addEventListener("click", () => classServerAction(button.dataset.classServerId, button.dataset.classServerAction));
	}
}

async function provisionClassServer(classGroup) {
	const message = $("#classServerMessage");
	setMessage(message, `Preparando Paper para ${classGroup}...`, "");
	try {
		await request("/dashboard/class-servers", {
			method: "POST",
			body: { classGroup, start: true }
		});
		setMessage(message, `Paper de ${classGroup} creado y arrancado.`, "ok");
		await loadClassServers();
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function classServerAction(id, action) {
	const message = $("#classServerMessage");
	const method = action === "status" ? "GET" : "POST";
	setMessage(message, `${actionLabel(action)} ${id}...`, "");
	try {
		const response = await request(`/dashboard/class-servers/${encodeURIComponent(id)}/${action}`, { method });
		const stateLabel = response.status?.state ? ` Estado: ${response.status.state}.` : "";
		setMessage(message, `${actionLabel(action)} completado.${stateLabel}`, "ok");
		await loadClassServers();
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

function actionLabel(action) {
	return {
		start: "Arranque",
		restart: "Reinicio",
		stop: "Parada",
		status: "Consulta"
	}[action] || "Accion";
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
	renderDashboardCharts();
}

function renderDashboardCharts() {
	const metrics = state.summary?.metrics || {};
	safeChart("#roleChart", () => renderDonutChart("#roleChart", [
		{ label: "Alumnos", value: metrics.students || 0, color: "#15986f" },
		{ label: "Profesores", value: metrics.teachers || 0, color: "#1d6ce3" },
		{ label: "Otros usuarios", value: otherUsersCount(metrics), color: "#b8652d" }
	]));
	safeChart("#institutionChart", () => renderStackedChart("#institutionChart", [
		{ label: "Activos", value: metrics.activeInstitutions || 0, color: "#15986f" },
		{ label: "No activos", value: inactiveInstitutionsCount(metrics), color: "#8b9a95" }
	]));
	safeChart("#licenseChart", () => renderBarChart("#licenseChart", Object.entries(state.summary?.licenses || {}).map(([label, value], index) => ({
		label,
		value,
		color: chartColors[index % chartColors.length]
	}))));
	safeChart("#peopleChart", () => renderDonutChart("#peopleChart", [
		{ label: "Alumnos", value: metrics.students || state.students.length || 0, color: "#15986f" },
		{ label: "Profesores", value: metrics.teachers || state.teachers.length || 0, color: "#1d6ce3" }
	]));
	safeChart("#studentStatusChart", () => renderDonutChart("#studentStatusChart", statusSegments(state.students)));
	safeChart("#operationsChart", () => renderBarChart("#operationsChart", [
		{ label: "Sesiones activas", value: metrics.activeSessions || 0, color: "#15986f" },
		{ label: "Acciones en cola", value: metrics.queuedActions || 0, color: "#b8652d" },
		{ label: "Alumnos activos", value: metrics.activeStudents || activeStudentsCount(), color: "#1d6ce3" }
	]));
	safeChart("#teacherActionChart", () => renderStackedChart("#teacherActionChart", actionCategorySegments()));
}

function safeChart(selector, render) {
	const node = $(selector);
	if (!node) {
		return;
	}
	try {
		render();
	} catch (_) {
		renderEmptyChart(node);
	}
}

function renderDonutChart(selector, segments) {
	const node = $(selector);
	if (!node) {
		return;
	}
	const clean = cleanSegments(segments);
	const total = clean.reduce((sum, item) => sum + item.value, 0);
	if (!total) {
		renderEmptyChart(node);
		return;
	}
	let cursor = 0;
	const stops = clean.map((item) => {
		const start = cursor;
		const end = cursor + (item.value / total) * 100;
		cursor = end;
		return `${item.color} ${start}% ${end}%`;
	}).join(", ");
	node.innerHTML = `
		<div class="donut-chart" style="background: conic-gradient(${stops});"><strong>${escapeHtml(String(total))}</strong></div>
		${renderChartLegend(clean, total)}
	`;
}

function renderStackedChart(selector, segments) {
	const node = $(selector);
	if (!node) {
		return;
	}
	const clean = cleanSegments(segments);
	const total = clean.reduce((sum, item) => sum + item.value, 0);
	if (!total) {
		renderEmptyChart(node);
		return;
	}
	node.innerHTML = `
		<div class="stack-chart">${clean.map((item) => `
			<span style="--chart-color: ${item.color}; --chart-size: ${(item.value / total) * 100}%"></span>
		`).join("")}</div>
		${renderChartLegend(clean, total)}
	`;
}

function renderBarChart(selector, segments) {
	const node = $(selector);
	if (!node) {
		return;
	}
	const clean = cleanSegments(segments);
	const max = Math.max(...clean.map((item) => item.value), 0);
	if (!max) {
		renderEmptyChart(node);
		return;
	}
	node.innerHTML = `
		<div class="bar-chart">
			${clean.map((item) => `
				<div class="bar-row">
					<span>${escapeHtml(item.label)}</span>
					<div><i style="--chart-color: ${item.color}; --chart-size: ${(item.value / max) * 100}%"></i></div>
					<strong>${escapeHtml(String(item.value))}</strong>
				</div>
			`).join("")}
		</div>
	`;
}

function renderChartLegend(segments, total) {
	return `<div class="chart-legend">${segments.map((item) => `
		<span><i style="background:${item.color}"></i>${escapeHtml(item.label)} <strong>${escapeHtml(String(item.value))}</strong><em>${Math.round((item.value / total) * 100)}%</em></span>
	`).join("")}</div>`;
}

function renderEmptyChart(node) {
	node.innerHTML = `<div class="chart-empty">Sin datos reales disponibles.</div>`;
}

function cleanSegments(segments) {
	return segments
		.map((item, index) => ({
			label: item.label,
			value: Math.max(0, Number(item.value) || 0),
			color: item.color || chartColors[index % chartColors.length]
		}))
		.filter((item) => item.value > 0);
}

function statusSegments(users) {
	const active = users.filter((user) => user.status === "active").length;
	const disabled = users.filter((user) => user.status === "disabled").length;
	const other = Math.max(0, users.length - active - disabled);
	return [
		{ label: "Activos", value: active, color: "#15986f" },
		{ label: "Desactivados", value: disabled, color: "#b8652d" },
		{ label: "Otros estados", value: other, color: "#8b9a95" }
	];
}

function actionCategorySegments() {
	const totals = new Map();
	for (const action of teacherActions) {
		totals.set(action.category, (totals.get(action.category) || 0) + 1);
	}
	return Array.from(totals.entries()).map(([category, value], index) => ({
		label: readableCategory(category),
		value,
		color: chartColors[index % chartColors.length]
	}));
}

function otherUsersCount(metrics) {
	if (!hasOwn(metrics, "users")) {
		return 0;
	}
	return Math.max(0, (metrics.users || 0) - (metrics.students || 0) - (metrics.teachers || 0));
}

function inactiveInstitutionsCount(metrics) {
	if (!hasOwn(metrics, "institutions")) {
		return 0;
	}
	return Math.max(0, (metrics.institutions || 0) - (metrics.activeInstitutions || 0));
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
	let data = {};
	if (text) {
		try {
			data = JSON.parse(text);
		} catch (_) {
			const preview = text.replace(/\s+/g, " ").trim().slice(0, 120);
			throw new Error(preview || `HTTP ${response.status}`);
		}
	}
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
		return "profesor-clases.html";
	}
	if (role === "student") {
		return "../cliente/index.html";
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
	if (path.startsWith("profesor-")) {
		return "profesor";
	}
	return path.replace(".html", "");
}

function storeSession(response) {
	state.token = response.accessToken;
	state.refreshToken = response.refreshToken;
	state.me = response;
	localStorage.setItem(STORAGE_KEYS.access, state.token);
	localStorage.setItem(STORAGE_KEYS.refresh, state.refreshToken || "");
	localStorage.setItem(STORAGE_KEYS.expires, response.expiresAt || "");
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
	localStorage.removeItem(STORAGE_KEYS.expires);
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
		queued: "en cola",
		sent: "entregada",
		completed: "completada",
		failed: "fallida",
		cancelled: "cancelada"
	};
	return labels[status] || status || "-";
}

function actionLabel(actionKey) {
	const action = teacherActions.find((item) => item.key === actionKey);
	return action ? action.label : actionKey || "Accion";
}

function actionTargetLabel(action) {
	if (action.targetEmail) {
		return action.targetEmail;
	}
	return "Toda la clase";
}

function actionDeliveryLabel(action) {
	const status = readableStatus(action.status);
	const server = action.serverName ? ` · ${action.serverName}` : "";
	const result = action.resultMessage ? ` · ${action.resultMessage}` : "";
	return `${status}${server}${result}`;
}

function readableActivityStatus(status) {
	const labels = {
		draft: "Borrador",
		published: "Publicada",
		archived: "Archivada"
	};
	return labels[status] || status || "Actividad";
}

function firstLine(value) {
	return String(value || "").split("\n").find((line) => line.trim()) || "Sin objetivos.";
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
