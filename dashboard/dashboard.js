const STORAGE_KEYS = {
	access: "educraft.dashboard.accessToken",
	refresh: "educraft.dashboard.refreshToken",
	expires: "educraft.dashboard.expiresAt",
	teacherPage: "educraft.dashboard.teacherPage",
	scheduleRows: "educraft.dashboard.scheduleRows"
};

const PREFERENCE_KEY = "educraft.dashboard.preferences.v1";
const defaultPreferences = {
	realtime: true,
	compactMode: false,
	reducedMotion: false,
	showHints: true,
	experimentalBlockViewer: false
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
	moderationAlerts: [],
	studentEvents: [],
	bookSubmissions: [],
	openBookSubmissions: new Set(),
	bookReviewDrafts: new Map(),
	activities: [],
	aiIntegrity: null,
	aiIntegritySettings: null,
	sysAdmin: null,
	dashboardSocket: null,
	dashboardLiveRetry: 0,
	dashboardSyncRunning: false,
	dashboardSyncPending: false,
	sysAdminServerError: null,
	sysServerConsoleId: "",
	policy: null,
	clientPolicySettings: null,
	livePolicy: null,
	worldView: null,
	route: null,
	actionFilter: "all",
	actionQuery: "",
	actionAdvanced: false,
	activityChat: [],
	activityDraft: null,
	studentImportRows: [],
	scheduleImportRows: [],
	billing: null
};
let sessionRefreshPromise = null;
let blockViewer = null;
let consoleTailTimer = null;

const apiBase = (window.EDUCRAFT_API_BASE_URL || "").replace(/\/+$/, "");
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
	{ key: "set_gamemode_survival", category: "estado", label: "Modo supervivencia", description: "Vuelve a supervivencia." },
	{ key: "enable_pvp", category: "permisos", label: "Activar PVP", description: "Permite el combate entre jugadores." },
	{ key: "disable_pvp", category: "permisos", label: "Desactivar PVP", description: "Impide el combate entre jugadores." }
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
const quickTeacherActions = new Set(["send_class_announcement", "mute_chat", "unmute_chat", "freeze_student", "teleport_teacher_to_student", "grant_build", "revoke_build", "enable_pvp", "disable_pvp"]);
const disruptiveClassActions = new Set(["mute_chat", "limit_chat", "freeze_student", "clear_inventory", "return_to_spawn", "revoke_build", "revoke_interact", "set_gamemode_adventure", "set_gamemode_survival", "enable_pvp", "disable_pvp"]);
const classWideActions = new Set(["send_class_announcement", "enable_pvp", "disable_pvp"]);
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
		title: "Algoritmos visuales por bloques",
		subject: "Pensamiento computacional",
		level: "Primaria avanzada / ESO",
		durationMinutes: 25,
		programmingMode: "scratch",
		tag: "Bloques",
		objectives: "Construir una secuencia de instrucciones.\nUsar repeticion para evitar pasos duplicados.\nTraducir bloques simples a comportamiento dentro del mundo.",
		setupSteps: "1. Abrir EduCraft Studio.\n2. Seleccionar Bloques.\n3. Ejecutar la plantilla en el mundo de pruebas.\n4. Dar un reto y pedir una variacion propia.",
		activityScript: "Inicio (5 min): explicar decir, avanzar, repetir y saltar.\nPractica (8 min): ejecutar una secuencia guiada.\nReto (8 min): llegar a una marca usando repetir.\nCierre (4 min): detectar que instrucciones se repiten.",
		studentDeliverable: "Proyecto de bloques conectado que use al menos un repetir, una accion de movimiento y una prueba completada.",
		assessmentRubric: "4 puntos: secuencia ordenada.\n3 puntos: usa repetir correctamente.\n2 puntos: ajusta el programa tras probarlo.\n1 punto: explica el patron repetido.",
		teacherNotes: "Ejemplo visual: al comenzar → decir inicio → repetir 3 [colocar piedra → avanzar] → decir listo."
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
	},
	{
		key: "web-first-project",
		title: "Mi primera web interactiva",
		subject: "Tecnologia y programacion",
		level: "ESO / iniciacion",
		durationMinutes: 45,
		programmingMode: "web",
		tag: "Web",
		objectives: "Distinguir estructura, estilo y comportamiento.\nCrear una pagina con HTML semantico.\nAplicar CSS y comprobar una interaccion JavaScript.",
		setupSteps: "1. Abrir EduCraft Studio desde la clase.\n2. Seleccionar HTML · CSS · JS.\n3. Explicar las tres pestañas.\n4. Probar primero la plantilla sin modificarla.",
		activityScript: "Inicio (8 min): identificar HTML, CSS y JavaScript.\nPractica (12 min): cambiar titulo, colores y texto.\nReto (18 min): crear un boton con una respuesta propia.\nCierre (7 min): probar el proyecto de otra pareja y explicar un cambio.",
		studentDeliverable: "Proyecto EduCraft con HTML, CSS y JavaScript, una interaccion funcional y una explicacion breve de cada archivo.",
		assessmentRubric: "3 puntos: HTML claro y semantico.\n3 puntos: CSS propio y legible.\n3 puntos: interaccion JavaScript funcional.\n1 punto: explica la separacion entre archivos.",
		teacherNotes: "La vista previa bloquea red, formularios y acceso al dashboard. No pedir datos personales ni recursos externos."
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
		return;
	}

	if (currentPage === "registro") {
		bindRegister();
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
		let accountCreated = false;
		try {
			await request("/register", {
				method: "POST",
				auth: false,
				body: payload
			});
			accountCreated = true;
			setMessage(message, "Centro creado. Abriendo la prueba segura en Stripe...", "ok");
			await login(email, password, message, { redirect: false });
			const plan = document.querySelector('input[name="registerPlan"]:checked')?.value || "school";
			const checkout = await request("/api/billing/checkout", { method: "POST", body: { plan } });
			if (!safeHTTPSURL(checkout.url)) throw new Error("Stripe no devolvio una URL segura.");
			location.assign(checkout.url);
		} catch (error) {
			setMessage(message, accountCreated
				? "El centro ya esta creado, pero no se pudo abrir Stripe. Entra en tu cuenta y activa la prueba desde Facturacion."
				: friendlyLoginError(error), "error");
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
		trialConsent: $("#registerTrialConsent").checked,
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
	if (!payload.trialConsent) {
		return "Confirma las condiciones de la prueba y la renovacion automatica.";
	}
	if (!payload.authorityConfirmed || !payload.domainOwnershipConfirmed || !payload.minorsConfirmed || !payload.termsAccepted || !payload.privacyAccepted || !payload.dpaAccepted) {
		return "Acepta todas las confirmaciones obligatorias.";
	}
	return "";
}

function bindDashboard() {
	bindDashboardSettings();
	structureActivityEditor();
	enhanceCentreDashboard();
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
	$("#aiDetectionToggle")?.addEventListener("change", async (event) => {
		await updateAIIntegritySettings(event.target.checked);
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
	$("#sysRefreshButton")?.addEventListener("click", loadSysAdmin);
	$("#sysVelocityConsoleButton")?.addEventListener("click", loadVelocityConsole);
	$("#billingCheckoutButton")?.addEventListener("click", startBillingCheckout);
	$("#billingPortalButton")?.addEventListener("click", openBillingPortal);
	$("#billingReloadButton")?.addEventListener("click", loadBilling);
	if (currentPage === "administracion") startConsoleTail();
	$("#protectedRegionForm")?.addEventListener("submit", createProtectedRegion);
	$("[data-delete-protected-region]")?.addEventListener("click", deleteProtectedRegion);
	for (const button of document.querySelectorAll("[data-protection-toggle]")) button.addEventListener("click", () => queueProtectionAction(button.dataset.protectionToggle, {}));
	renderActionFilters();
	renderTeacherActions();
	renderActivityTemplates();
	renderActivityChat();
	document.addEventListener("change", (event) => {
		if (event.target.matches("[data-client-policy-setting]")) updateClientPolicySetting(event.target);
	});
}

function enhanceCentreDashboard() {
	if (currentPage !== "tic" && currentPage !== "profesor") return;
	const isTeacher = currentPage === "profesor";
	const items = isTeacher ? [
		["clases", "Preparar clases", "Crea o reutiliza una actividad", "Crear clase"],
		["control", "Controlar el aula", "Chat, permisos y acciones en directo", "Abrir control"],
		["seguimiento", "Ver el progreso", "Asistencia, entregas e incidencias", "Revisar progreso"],
		["integridad", "Revisar entregas", "Libros y señales orientativas de IA", "Ver entregas"],
		["info", "Comprobar el sistema", "Alumnos, sesiones y servidor", "Ver estado"]
	] : [
		["resumen", "Ver el centro", "Usuarios, licencias y estado general", "Ver resumen"],
		["alumnos", "Gestionar alumnado", "Altas, importación y grupos", "Añadir alumnos"],
		["profesores", "Gestionar profesorado", "Cuentas docentes y accesos", "Añadir profesor"],
		["horario", "Cargar el horario", "Importa Excel, CSV o Google Sheets", "Subir horario"],
		["operacion", "Revisar servidores", "Acciones pendientes y entregas", "Ver operación"],
		["facturacion", "Plan y facturas", "Renovaciones y pagos del centro", "Ver facturación"]
	];
	const nav = document.querySelector(isTeacher ? ".teacher-page-tabs:not(.tic-page-tabs)" : ".tic-page-tabs");
	if (!nav || nav.dataset.enhanced) return;
	nav.dataset.enhanced = "true";
	nav.classList.add("role-task-nav");
	for (const [page, title, description] of items) {
		const link = nav.querySelector(`[data-${isTeacher ? "teacher" : "tic"}-page="${page}"]`);
		if (link) link.innerHTML = `<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>`;
	}
	const quickItems = isTeacher ? items.slice(0, 3) : items.slice(1, 4);
	const quick = document.createElement("section");
	quick.className = "role-quick-start";
	quick.setAttribute("aria-label", "Tareas frecuentes");
	quick.innerHTML = `<div><p class="eyebrow">Accesos rápidos</p><h2>¿Qué necesitas hacer?</h2></div><div>${quickItems.map(([page, title, description, action], index) => {
		const source = nav.querySelector(`[data-${isTeacher ? "teacher" : "tic"}-page="${page}"]`);
		return `<a href="${escapeHtml(source?.getAttribute("href") || "#")}" data-quick-page="${page}"><span>${index + 1}</span><strong>${escapeHtml(action)}</strong><small>${escapeHtml(description)}</small></a>`;
	}).join("")}</div>`;
	nav.insertAdjacentElement("beforebegin", quick);
	if (isTeacher) {
		for (const link of quick.querySelectorAll("[data-quick-page]")) {
			link.addEventListener("click", (event) => {
				event.preventDefault();
				setTeacherPage(link.dataset.quickPage, true);
				nav.scrollIntoView({ behavior: dashboardPreferences().reducedMotion ? "auto" : "smooth", block: "start" });
			});
		}
	}
}

function protectedRegionPayload() {
	return {
		name: $("#protectedRegionName")?.value.trim() || "",
		world: $("#protectedRegionWorld")?.value.trim() || "world",
		x1: Number($("#protectedX1")?.value), y1: Number($("#protectedY1")?.value), z1: Number($("#protectedZ1")?.value),
		x2: Number($("#protectedX2")?.value), y2: Number($("#protectedY2")?.value), z2: Number($("#protectedZ2")?.value)
	};
}

async function createProtectedRegion(event) {
	event.preventDefault();
	await queueProtectionAction("create_protected_region", protectedRegionPayload());
}

async function deleteProtectedRegion() {
	const name = $("#protectedRegionName")?.value.trim();
	if (!name) { setMessage($("#protectionMessage"), "Indica el nombre de la zona.", "error"); return; }
	if (!window.confirm(`Vas a eliminar la proteccion «${name}». ¿Quieres continuar?`)) return;
	await queueProtectionAction("delete_protected_region", { name });
}

async function queueProtectionAction(actionKey, payload) {
	const message = $("#protectionMessage");
	if (actionKey === "disable_structure_protection" && !window.confirm("Vas a pausar todas las zonas protegidas de este servidor. ¿Quieres continuar?")) return;
	setMessage(message, "Enviando a Paper...", "");
	try {
		await request("/dashboard/teacher/actions", { method: "POST", body: { actionKey, reason: JSON.stringify(payload) } });
		const labels = { create_protected_region: "Zona enviada para crear", delete_protected_region: "Zona enviada para eliminar", enable_structure_protection: "Proteccion enviada para activar", disable_structure_protection: "Proteccion enviada para pausar" };
		setMessage(message, `✓ ${labels[actionKey]}.`, "ok");
		showToast(labels[actionKey] + ".", "ok");
		await loadTeacherActions();
	} catch (error) {
		setMessage(message, error.message, "error");
		showToast(`No se pudo actualizar la proteccion: ${error.message}`, "error");
	}
}

function dashboardPreferences() {
	try {
		return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(PREFERENCE_KEY) || "{}") };
	} catch (_) {
		return { ...defaultPreferences };
	}
}

function saveDashboardPreferences(preferences) {
	localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
	applyDashboardPreferences(preferences);
}

function bindDashboardSettings() {
	if ($("#dashboardSettingsButton")) return;
	const button = document.createElement("button");
	button.id = "dashboardSettingsButton";
	button.className = "dashboard-settings-button";
	button.type = "button";
	button.setAttribute("aria-label", "Abrir ajustes del dashboard");
	button.textContent = "⚙ Ajustes";
	document.body.append(button);

	const dialog = document.createElement("dialog");
	dialog.id = "dashboardSettingsDialog";
	dialog.className = "dashboard-settings-dialog";
	dialog.innerHTML = `
		<form method="dialog" class="dashboard-settings-card">
			<div class="settings-head"><div><p class="eyebrow">Preferencias</p><h2>Ajustes del dashboard</h2></div><button class="settings-close" value="close" aria-label="Cerrar">×</button></div>
			<div class="settings-list">
				${settingsToggle("realtime", "Tiempo real", "Mantiene los paneles sincronizados mediante WSS.")}
				${settingsToggle("compactMode", "Modo compacto", "Reduce espacios para mostrar más información.")}
				${settingsToggle("reducedMotion", "Reducir movimiento", "Desactiva transiciones y animaciones decorativas.")}
				${settingsToggle("showHints", "Ayudas contextuales", "Muestra explicaciones y avisos de uso.")}
			</div>
			<section class="experimental-settings">
				<div class="experimental-title"><span>Experimental</span><strong>Funciones en pruebas</strong></div>
				${settingsToggle("experimentalBlockViewer", "Visor 3D de bloques", "Activa un visor WebGL 2 para observar construcciones. Puede consumir más GPU.", true)}
			</section>
			<p class="settings-note">Los ajustes se guardan solo en este navegador. Las funciones experimentales están desactivadas por defecto.</p>
		</form>`;
	document.body.append(dialog);
	button.addEventListener("click", () => dialog.showModal());
	dialog.addEventListener("click", (event) => {
		if (event.target === dialog) dialog.close();
	});
	for (const input of dialog.querySelectorAll("[data-preference]")) {
		input.addEventListener("change", () => {
			const preferences = dashboardPreferences();
			preferences[input.dataset.preference] = input.checked;
			saveDashboardPreferences(preferences);
		});
	}
	applyDashboardPreferences(dashboardPreferences());
}

function settingsToggle(key, title, description, experimental = false) {
	return `<label class="settings-toggle${experimental ? " is-experimental" : ""}"><span><strong>${title}</strong><small>${description}</small></span><span class="switch"><input type="checkbox" data-preference="${key}"><span></span></span></label>`;
}

function applyDashboardPreferences(preferences) {
	document.body.classList.toggle("dashboard-compact", preferences.compactMode);
	document.body.classList.toggle("dashboard-reduced-motion", preferences.reducedMotion);
	document.body.classList.toggle("dashboard-hide-hints", !preferences.showHints);
	for (const input of document.querySelectorAll("[data-preference]")) {
		input.checked = Boolean(preferences[input.dataset.preference]);
	}
	if (!preferences.realtime && state.dashboardSocket) {
		state.dashboardSocket.close();
		state.dashboardSocket = null;
	}
	if (preferences.realtime && state.token) connectDashboardLive();
	setExperimentalBlockViewer(Boolean(preferences.experimentalBlockViewer));
}

function setExperimentalBlockViewer(enabled) {
	let host = $("#experimentalBlockViewer");
	if (!enabled || currentPage !== "profesor") {
		if (blockViewer?.destroy) blockViewer.destroy();
		blockViewer = null;
		host?.remove();
		return;
	}
	if (!host) {
		host = document.createElement("section");
		host.id = "experimentalBlockViewer";
		host.className = "experimental-block-viewer";
		host.innerHTML = `<div class="block-viewer-head"><div><p class="eyebrow">Experimental</p><h2>Visor 3D de bloques</h2><p>Arrastra para girar · rueda para acercar · WASD o flechas para desplazarte</p></div><div><button type="button" class="portal-ghost" data-viewer-reset>Ver todo</button><button type="button" class="portal-ghost" data-viewer-fullscreen>Pantalla completa</button></div></div><div class="block-viewer-stage" data-viewer-stage><div class="block-viewer-loading">Preparando WebGL 2…</div></div><p class="block-viewer-disclaimer"><strong>Experimental · Esperando Paper:</strong> inicia un servidor y entra con un alumno para recibir el mundo real.</p>`;
		const main = $(".portal-main");
		main?.insertBefore(host, main.children[2] || null);
	}
	loadBlockViewer().then(() => {
		if (!blockViewer && window.EduCraftBlockViewer && document.body.contains(host)) {
			blockViewer = new window.EduCraftBlockViewer(host.querySelector("[data-viewer-stage]"));
			if (state.worldView) applyWorldViewSnapshot(state.worldView);
			host.querySelector("[data-viewer-reset]")?.addEventListener("click", () => blockViewer?.reset());
			host.querySelector("[data-viewer-fullscreen]")?.addEventListener("click", () => host.requestFullscreen?.());
		}
	}).catch((error) => {
		const stage = host.querySelector("[data-viewer-stage]");
		if (stage) stage.innerHTML = `<div class="block-viewer-loading">No se pudo iniciar WebGL 2: ${escapeHtml(error?.message || "error desconocido")}</div>`;
	});
}

function loadBlockViewer() {
	if (window.EduCraftBlockViewer) return Promise.resolve();
	if (window.educraftBlockViewerPromise) return window.educraftBlockViewerPromise;
	window.educraftBlockViewerPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "block-viewer.js?v=20260821-viewer6";
		script.onload = resolve;
		script.onerror = reject;
		document.head.append(script);
	});
	return window.educraftBlockViewerPromise;
}

function bindTeacherPages() {
	const buttons = Array.from(document.querySelectorAll("[data-teacher-page]"));
	if (!buttons.length) {
		return;
	}
	for (const button of buttons) {
		button.addEventListener("click", (event) => {
			event.preventDefault();
			setTeacherPage(button.dataset.teacherPage, true);
		});
	}
	const requested = new URLSearchParams(location.search).get("vista") || location.hash.replace("#", "");
	const defaultPage = document.body.dataset.teacherDefault || "clases";
	setTeacherPage(requested || defaultPage, false);
}

function setTeacherPage(page, persist) {
	const validPages = new Set(["info", "clases", "control", "seguimiento", "integridad"]);
	const nextPage = validPages.has(page) ? page : "clases";
	for (const button of document.querySelectorAll("[data-teacher-page]")) {
		const active = button.dataset.teacherPage === nextPage;
		button.classList.toggle("is-active", active);
		button.setAttribute("aria-selected", active ? "true" : "false");
		if (active) button.setAttribute("aria-current", "page");
		else button.removeAttribute("aria-current");
	}
	renderSectionGuide("teacher", nextPage);
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
	if (nextPage === "seguimiento") {
		renderTracking();
	}
	if (nextPage === "integridad") {
		renderAIIntegrity();
	}
	if (persist) {
		localStorage.setItem(STORAGE_KEYS.teacherPage, nextPage);
		const url = new URL(location.href);
		url.searchParams.set("vista", nextPage);
		history.replaceState(null, "", url);
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
	const validPages = new Set(["resumen", "alumnos", "profesores", "horario", "operacion", "facturacion"]);
	const nextPage = validPages.has(page) ? page : "resumen";
	for (const button of document.querySelectorAll("[data-tic-page]")) {
		const active = button.dataset.ticPage === nextPage;
		button.classList.toggle("is-active", active);
		button.setAttribute("aria-selected", active ? "true" : "false");
		if (active) button.setAttribute("aria-current", "page");
		else button.removeAttribute("aria-current");
	}
	renderSectionGuide("tic", nextPage);
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

function renderSectionGuide(area, page) {
	const guides = {
		teacher: {
			info: ["Informacion del juego", "Consulta de un vistazo el estado de alumnos, sesiones y servidores."],
			clases: ["Preparar clases", "Crea una actividad nueva o reutiliza una de tu biblioteca."],
			control: ["Controlar la clase", "Gestiona alumnos, chat, alertas y acciones mientras la clase esta en marcha."],
			seguimiento: ["Revisar el progreso", "Comprueba asistencia, entregas, incidencias y actividad de cada alumno."],
			integridad: ["Revisar entregas", "Consulta libros entregados y usa las señales de IA solo como apoyo orientativo."]
		},
		tic: {
			resumen: ["Resumen del centro", "Comprueba usuarios, licencias, sesiones y estado general."],
			alumnos: ["Gestionar alumnos", "Crea cuentas, importa listas y revisa los grupos del centro."],
			profesores: ["Gestionar profesores", "Crea cuentas docentes y consulta su estado."],
			horario: ["Configurar horario", "Importa el horario completo desde Excel, CSV o Google Sheets."],
			operacion: ["Supervisar operacion", "Revisa acciones pendientes y su entrega a los servidores."],
			facturacion: ["Gestionar facturacion", "Consulta el plan, las renovaciones y las facturas del centro."]
		}
	};
	const nav = document.querySelector(area === "teacher" ? "[data-teacher-page]" : "[data-tic-page]")?.closest("nav");
	const content = guides[area]?.[page];
	if (!nav || !content) return;
	const workspace = document.querySelector(".workspace-head");
	if (workspace) {
		const eyebrow = workspace.querySelector(".eyebrow");
		const title = workspace.querySelector("h2");
		if (eyebrow) eyebrow.textContent = area === "teacher" ? "Panel del profesor" : "Gestión del centro";
		if (title) title.textContent = content[0];
	}
	let guide = nav.nextElementSibling;
	if (!guide?.classList.contains("section-guide")) {
		guide = document.createElement("div");
		guide.className = "section-guide";
		nav.insertAdjacentElement("afterend", guide);
	}
	guide.innerHTML = `<span>Estás aquí</span><div><strong>${escapeHtml(content[0])}</strong><p>${escapeHtml(content[1])}</p></div>`;
}

async function login(email, password, messageNode, options = {}) {
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
	if (options.redirect !== false) location.replace(destination);
	return response;
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
		if (isClientDestination(destination)) {
			clearSession();
			location.replace("login.html");
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
			if ($("#billingOverview")) await loadBilling();
		}
		if (currentPage === "tic" || currentPage === "profesor") {
			await loadTeacherActions();
		}
		if (currentPage === "profesor") {
			await loadModerationAlerts();
		}
		if (currentPage === "profesor") {
			await loadStudentEvents();
		}
		if (currentPage === "profesor") {
			await loadActivities();
		}
		if (currentPage === "profesor") {
			await loadAIIntegrity();
			await loadBookSubmissions();
		}
		if (currentPage === "administracion") {
			await loadSysAdmin();
		}
		connectDashboardLive();
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
	renderTracking();
}

async function loadBilling() {
	const message = $("#billingMessage");
	if (!$("#billingOverview")) return;
	setMessage(message, "Cargando facturacion...", "");
	try {
		state.billing = await request("/api/billing/summary");
		renderBilling();
		const checkoutState = new URLSearchParams(location.search).get("checkout");
		if (checkoutState === "success") setMessage(message, "Pago enviado. El estado se actualizara cuando Stripe confirme el webhook.", "ok");
		else if (checkoutState === "cancel") setMessage(message, "El proceso de pago se cancelo sin realizar cargos.", "");
		else if (!["not_configured", "canceled", "incomplete_expired"].includes(state.billing?.account?.subscriptionStatus)) setMessage(message, "Ya tienes un plan activo. Usa Cambiar o gestionar plan para elegir Academy, School o Campus sin crear una suscripcion duplicada.", "ok");
		else setMessage(message, "", "");
	} catch (error) {
		setMessage(message, error.message || "No se pudo consultar Stripe.", "error");
		$("#billingOverview").innerHTML = `<div class="billing-empty"><strong>Facturacion no disponible</strong><p>Prueba de nuevo en unos minutos.</p></div>`;
	}
}

function renderBilling() {
	const billing = state.billing || {};
	const account = billing.account || {};
	const configured = Boolean(billing.configured);
	const status = billingStatus(account.subscriptionStatus);
	const price = account.unitAmount == null ? "Precio pendiente" : formatMoney(account.unitAmount, account.currency);
	const frequency = billingFrequency(account.billingInterval, account.billingIntervalCount);
	const renewal = account.currentPeriodEnd ? formatBillingDate(account.currentPeriodEnd) : "Todavia sin fecha";
	const renewalLabel = account.subscriptionStatus === "trialing" ? "Fin de prueba y primer cobro" : "Proxima renovacion";
	const method = account.paymentMethodLast4 ? `${String(account.paymentMethodBrand || account.paymentMethodType || "Tarjeta").toUpperCase()} ·•••• ${escapeHtml(account.paymentMethodLast4)}` : "Sin metodo guardado";
	$("#billingModeChip").textContent = billing.testMode ? "Stripe TEST" : "Stripe";
	$("#billingOverview").innerHTML = `
		<div class="billing-plan-copy"><span class="billing-kicker">Plan actual</span><h3>${escapeHtml(billing.planName || "Sin plan")}</h3><div class="billing-price">${escapeHtml(price)} <small>${escapeHtml(frequency)}</small></div></div>
		<div class="billing-facts">
			<div><span>Estado</span><strong class="billing-state ${status.className}">${status.label}</strong></div>
			<div><span>${renewalLabel}</span><strong>${escapeHtml(renewal)}</strong></div>
			<div><span>Renovacion automatica</span><strong>${account.cancelAtPeriodEnd ? "Cancelacion programada" : "Activada"}</strong></div>
			<div><span>Metodo de pago</span><strong>${method}</strong></div>
		</div>`;
	const select = $("#billingPlanSelect");
	select.innerHTML = (billing.plans || []).map((plan) => `<option value="${escapeHtml(plan.key)}" ${plan.key === account.planKey ? "selected" : ""}>${escapeHtml(`${plan.name} · ${formatMoney(plan.unitAmount, plan.currency)}/${billingIntervalShort(plan.billingInterval)}`)}</option>`).join("");
	const canStart = configured && billing.canManage && (account.subscriptionStatus === "not_configured" || account.subscriptionStatus === "canceled" || account.subscriptionStatus === "incomplete_expired");
	const checkoutButton = $("#billingCheckoutButton");
	const portalButton = $("#billingPortalButton");
	select.disabled = !canStart;
	checkoutButton.disabled = !canStart || !select.options.length;
	checkoutButton.textContent = canStart
		? (account.subscriptionStatus === "not_configured" ? "Iniciar prueba de 30 dias" : "Contratar plan")
		: "Plan ya contratado";
	portalButton.disabled = !configured || !billing.canManage || account.subscriptionStatus === "not_configured";
	portalButton.textContent = canStart ? "Gestionar facturacion" : "Cambiar o gestionar plan";
	$("#billingConfigNotice").hidden = configured;
	$("#billingActions").classList.toggle("is-readonly", !billing.canManage);
	renderBillingInvoices(billing.invoices || []);
}

function renderBillingInvoices(invoices) {
	const host = $("#billingInvoices");
	if (!invoices.length) { host.innerHTML = `<div class="billing-empty"><strong>Aun no hay facturas</strong><p>Las facturas confirmadas por Stripe apareceran aqui.</p></div>`; return; }
	host.innerHTML = invoices.map((invoice) => {
		const status = billingInvoiceStatus(invoice.status);
		const links = [];
		if (safeHTTPSURL(invoice.hostedInvoiceUrl)) links.push(`<a class="portal-ghost" href="${escapeHtml(invoice.hostedInvoiceUrl)}" target="_blank" rel="noopener">Ver factura</a>`);
		if (safeHTTPSURL(invoice.invoicePdfUrl)) links.push(`<a class="portal-ghost" href="${escapeHtml(invoice.invoicePdfUrl)}" target="_blank" rel="noopener">Descargar PDF</a>`);
		return `<article class="billing-invoice"><div><span>${escapeHtml(invoice.number || "Factura Stripe")}</span><strong>${escapeHtml(formatMoney(invoice.amountDue, invoice.currency))}</strong><small>${escapeHtml(formatBillingDate(invoice.createdAt))}</small></div><div><span class="billing-state ${status.className}">${status.label}</span><div class="billing-invoice-actions">${links.join("")}</div></div></article>`;
	}).join("");
}

async function startBillingCheckout() {
	const button = $("#billingCheckoutButton");
	const message = $("#billingMessage");
	button.disabled = true;
	setMessage(message, "Preparando pago seguro en Stripe...", "");
	try {
		const response = await request("/api/billing/checkout", { method: "POST", body: { plan: $("#billingPlanSelect").value } });
		if (!safeHTTPSURL(response.url)) throw new Error("Stripe no devolvio una URL segura.");
		location.assign(response.url);
	} catch (error) {
		setMessage(message, error.message || "No se pudo iniciar el pago.", "error");
		button.disabled = false;
	}
}

async function openBillingPortal() {
	const button = $("#billingPortalButton");
	const message = $("#billingMessage");
	button.disabled = true;
	setMessage(message, "Abriendo el portal seguro...", "");
	try {
		const response = await request("/api/billing/portal", { method: "POST" });
		if (!safeHTTPSURL(response.url)) throw new Error("Stripe no devolvio una URL segura.");
		location.assign(response.url);
	} catch (error) {
		setMessage(message, error.message || "No se pudo abrir el portal.", "error");
		button.disabled = false;
	}
}

function billingStatus(value) {
	const values = {
		active: ["Activo", "is-success"], trialing: ["En prueba", "is-info"], past_due: ["Pago pendiente", "is-warning"],
		unpaid: ["Impagado", "is-danger"], canceled: ["Cancelado", "is-muted"], incomplete: ["Pago incompleto", "is-warning"],
		incomplete_expired: ["Pago caducado", "is-muted"], paused: ["Pausado", "is-warning"], not_configured: ["Sin contratar", "is-muted"]
	};
	const item = values[value] || ["Pendiente", "is-muted"];
	return { label: item[0], className: item[1] };
}

function billingInvoiceStatus(value) {
	const values = { paid: ["Pagada", "is-success"], open: ["Pendiente", "is-warning"], draft: ["Borrador", "is-info"], void: ["Anulada", "is-muted"], uncollectible: ["Incobrable", "is-danger"] };
	const item = values[value] || [value || "Pendiente", "is-muted"];
	return { label: item[0], className: item[1] };
}

function formatMoney(amount, currency) {
	try { return new Intl.NumberFormat("es-ES", { style: "currency", currency: String(currency || "EUR").toUpperCase() }).format(Number(amount || 0) / 100); }
	catch (_) { return `${(Number(amount || 0) / 100).toFixed(2)} ${String(currency || "EUR").toUpperCase()}`; }
}

function formatBillingDate(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function billingFrequency(interval, count) {
	if (!interval) return "";
	if (interval === "year") return Number(count || 1) === 1 ? "/ ano" : `/ ${count} anos`;
	if (interval === "month") return Number(count || 1) === 1 ? "/ mes" : `/ ${count} meses`;
	return `/ ${interval}`;
}

function billingIntervalShort(interval) {
	return interval === "year" ? "año" : interval === "month" ? "mes" : interval || "periodo";
}

function safeHTTPSURL(value) {
	try { return new URL(value).protocol === "https:"; } catch (_) { return false; }
}

async function loadPortalContext() {
	const optional = async (path) => {
		try {
			return await request(path);
		} catch (_) {
			return null;
		}
	};
	const [policy, livePolicy, route, clientPolicySettings] = await Promise.all([
		optional("/client/policy"),
		optional("/client/live-policy"),
		optional("/minecraft/session-route"),
		optional("/dashboard/client-policy-settings")
	]);
	state.policy = policy;
	state.livePolicy = livePolicy;
	state.route = route;
	state.clientPolicySettings = clientPolicySettings;
	renderContextPanels();
}

async function loadStudents() {
	if (!$("#studentTableBody") && !$("#targetStudent") && !$("#trackingStudentTableBody")) {
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
	if (!$("#minecraftActionRack") && !$("#trackingActionRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/teacher/actions");
		state.actions = response.items || [];
		renderMinecraftActions();
		renderTracking();
	} catch (error) {
		renderMinecraftActions(error);
	}
}

async function loadModerationAlerts() {
	if (!$("#moderationAlertRack") && !$("#trackingAlertRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/moderation/alerts");
		state.moderationAlerts = response.items || [];
		renderModerationAlerts();
		renderTracking();
	} catch (error) {
		renderModerationAlerts(error);
	}
}

async function loadStudentEvents() {
	if (!$("#trackingSummary") && !$("#trackingStudentTableBody") && !$("#trackingActionRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/student-events?limit=160");
		state.studentEvents = response.items || [];
		renderTracking();
		renderClassChat();
	} catch (error) {
		state.studentEvents = [];
		renderTracking(error);
		renderClassChat(error);
	}
}

function renderClassChat(error) {
	const node = $("#classChatList");
	if (!node) return;
	if (error) {
		node.innerHTML = `<div class="class-chat-empty"><strong>Chat no disponible</strong><span>${escapeHtml(error.message || "No se pudo cargar el historial.")}</span></div>`;
		return;
	}
	const messages = state.studentEvents.filter((event) => event.eventKind === "chat_message").slice(0, 80).reverse();
	node.innerHTML = messages.length ? messages.map((event) => `
		<div class="class-chat-message">
			<div><strong>${escapeHtml(event.username || "Alumno")}</strong><span>${escapeHtml(event.serverName || "Clase")} · ${escapeHtml(formatChatTime(event.createdAt))}</span></div>
			<p>${escapeHtml(event.sample || "")}</p>
		</div>
	`).join("") : `<div class="class-chat-empty"><strong>Aun no hay mensajes</strong><span>Los mensajes enviados en el chat de Minecraft apareceran aqui.</span></div>`;
	if (messages.length) node.scrollTop = node.scrollHeight;
}

function formatChatTime(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Ahora" : new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
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
	if (!$("#activityList") && !$("#trackingActivityRack")) {
		return;
	}
	try {
		const response = await request("/dashboard/activities");
		state.activities = response.items || [];
		renderActivities();
		renderTracking();
	} catch (error) {
		setMessage($("#activityMessage"), error.message, "error");
	}
}

async function loadAIIntegrity() {
	if (!$("#aiAverageChart")) {
		return;
	}
	try {
		const response = await request("/dashboard/ai-integrity/metrics");
		state.aiIntegrity = response;
		state.aiIntegritySettings = response.settings || null;
		renderAIIntegrity();
	} catch (error) {
		renderAIIntegrity(error);
	}
}

async function loadBookSubmissions() {
	if (!$("#bookSubmissionList")) {
		return;
	}
	try {
		const response = await request("/dashboard/book-submissions?limit=100");
		state.bookSubmissions = response.items || [];
		renderBookSubmissions();
	} catch (error) {
		state.bookSubmissions = [];
		renderBookSubmissions(error);
	}
}

async function loadSysAdmin() {
	if (!$("#sysBackendRack")) {
		return;
	}
	let serverError = null;
	try {
		const overview = await request("/dashboard/sysadmin/overview");
		state.sysAdmin = overview;
	} catch (error) {
		setMessage($("#sysAdminMessage"), error.message, "error");
		renderSysAdmin(error);
		return;
	}
	try {
		const servers = await request("/dashboard/sysadmin/servers");
		state.classServers = servers.items || [];
		state.sysAdminServerError = null;
		setMessage($("#sysAdminMessage"), "", "");
	} catch (error) {
		serverError = error;
		state.sysAdminServerError = error;
		state.classServers = [];
		setMessage($("#sysAdminMessage"), `Datos de backend cargados. Servidores: ${error.message}`, "error");
	}
	renderSysAdmin(null, serverError);
	if (!serverError && !state.sysServerConsoleId && state.classServers.length) {
		loadServerConsole(state.classServers[0].id);
		loadVelocityConsole();
	}
}

function connectDashboardLive() {
	if (!dashboardPreferences().realtime || !state.token || currentPage === "login" || currentPage === "registro") {
		return;
	}
	if (state.dashboardSocket && state.dashboardSocket.readyState <= WebSocket.OPEN) {
		return;
	}
	const socket = new WebSocket(`${webSocketBase()}/dashboard/live`, ["educraft.jwt", state.token]);
	state.dashboardSocket = socket;
	socket.addEventListener("open", () => {
		if (state.dashboardLiveRetry) {
			clearTimeout(state.dashboardLiveRetry);
			state.dashboardLiveRetry = 0;
		}
	});
	socket.addEventListener("message", (event) => {
		let message = null;
		try {
			message = JSON.parse(event.data);
		} catch (_) {
			return;
		}
		if (message?.type === "dashboard_sync") {
			if (message.sysadmin && currentPage === "administracion") {
				state.sysAdmin = message.sysadmin;
			}
			refreshDashboardFromLive();
			if (message.worldView) {
				state.worldView = message.worldView;
				applyWorldViewSnapshot(message.worldView);
			}
		}
		if (message?.type === "dashboard_connected" && currentPage === "administracion") {
			renderSysAdmin(null, state.sysAdminServerError);
		}
	});
	socket.addEventListener("close", scheduleDashboardLiveReconnect);
	socket.addEventListener("error", () => {
		socket.close();
	});
}

function applyWorldViewSnapshot(snapshot) {
	if (!blockViewer?.setSnapshot || !blockViewer.setSnapshot(snapshot)) return;
	const server = snapshot.servers?.[0];
	const disclaimer = $("#experimentalBlockViewer .block-viewer-disclaimer");
	if (!disclaimer || !server) return;
	const players = server.players?.length || 0;
	const blocks = server.blocks?.length || 0;
	disclaimer.innerHTML = players
		? `<strong>Experimental · En directo:</strong> ${escapeHtml(server.serverName || "Paper")} · ${players} alumno${players === 1 ? "" : "s"} · ${blocks} bloques recibidos.`
		: `<strong>Experimental · Paper conectado:</strong> esperando a que entre un alumno en ${escapeHtml(server.serverName || "Paper")}.`;
}

function scheduleDashboardLiveReconnect() {
	if (state.dashboardSocket) {
		state.dashboardSocket = null;
	}
	if (!state.token || state.dashboardLiveRetry) {
		return;
	}
	state.dashboardLiveRetry = setTimeout(() => {
		state.dashboardLiveRetry = 0;
		connectDashboardLive();
	}, 5000);
}

async function refreshDashboardFromLive() {
	if (document.visibilityState !== "visible" || !state.token) {
		return;
	}
	if (state.dashboardSyncRunning) {
		state.dashboardSyncPending = true;
		return;
	}
	state.dashboardSyncRunning = true;
	try {
		const loaders = [loadSummary, loadPortalContext];
		if (currentPage === "tic" || currentPage === "profesor") loaders.push(loadStudents, loadTeacherActions);
		if (currentPage === "tic") loaders.push(loadTeachers, loadSchedule);
		if (currentPage === "profesor") loaders.push(loadModerationAlerts, loadStudentEvents, loadActivities, loadAIIntegrity, loadBookSubmissions);
		if (currentPage === "administracion") loaders.push(loadSysAdminSnapshot);
		await Promise.allSettled(loaders.map((loader) => loader()));
	} finally {
		state.dashboardSyncRunning = false;
		if (state.dashboardSyncPending) {
			state.dashboardSyncPending = false;
			window.setTimeout(refreshDashboardFromLive, 100);
		}
	}
}

async function loadSysAdminSnapshot() {
	if (!$("#sysBackendRack")) return;
	try {
		const servers = await request("/dashboard/sysadmin/servers");
		state.classServers = servers.items || [];
		state.sysAdminServerError = null;
	} catch (error) {
		state.sysAdminServerError = error;
	}
	renderSysAdmin(null, state.sysAdminServerError);
}

function webSocketBase() {
	if (apiBase.startsWith("https://")) {
		return `wss://${apiBase.slice("https://".length)}`;
	}
	if (apiBase.startsWith("http://")) {
		return `ws://${apiBase.slice("http://".length)}`;
	}
	return apiBase;
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
	const durationIndex = findColumn(table.headers, ["duracion", "duración", "minutos", "duration", "durationminutes"]);
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
		notes: cleanCell(row[notesIndex]),
		durationMinutes: Math.max(15, Math.min(240, Number.parseInt(cleanCell(row[durationIndex]), 10) || 60))
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
	const action = teacherActions.find((item) => item.key === actionKey);
	const targetUserId = classWideActions.has(actionKey) ? "" : ($("#targetStudent")?.value || "");
	if (!targetUserId && disruptiveClassActions.has(actionKey) && !window.confirm(`Vas a ejecutar «${action?.label || actionKey}» para toda la clase. ¿Quieres continuar?`)) return;
	setMessage(message, "Registrando accion...", "");
	try {
		const response = await request("/dashboard/teacher/actions", {
			method: "POST",
			body: {
				actionKey,
				targetUserId,
				reason: $("#actionReason")?.value || ""
			}
		});
		const target = targetUserId ? selectedStudentLabel() : "toda la clase";
		setMessage(message, `✓ ${action?.label || "Accion"}: solicitud enviada para ${target}.`, "ok");
		showToast(`${action?.label || "Accion"}: solicitud enviada.`, "ok");
		await Promise.all([loadSummary(), loadTeacherActions()]);
	} catch (error) {
		setMessage(message, error.message, "error");
		showToast(`No se pudo completar la accion: ${error.message}`, "error");
	}
}

function selectedStudentLabel() {
	const select = $("#targetStudent");
	return select?.selectedOptions?.[0]?.textContent || "el alumno";
}

function showToast(text, type = "") {
	let region = $("#dashboardToasts");
	if (!region) {
		region = document.createElement("div");
		region.id = "dashboardToasts";
		region.className = "dashboard-toasts";
		region.setAttribute("aria-live", "polite");
		document.body.append(region);
	}
	const toast = document.createElement("div");
	toast.className = `dashboard-toast ${type}`;
	toast.textContent = text;
	region.append(toast);
	setTimeout(() => toast.remove(), 4200);
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

async function updateAIIntegritySettings(enabled) {
	const message = $("#aiIntegrityMessage");
	setMessage(message, enabled ? "Activando Sapling..." : "Apagando Sapling...", "");
	try {
		state.aiIntegritySettings = await request("/dashboard/ai-integrity/settings", {
			method: "PATCH",
			body: { detectionEnabled: Boolean(enabled) }
		});
		await loadAIIntegrity();
		setMessage(message, enabled ? "Sapling activado para los libros firmados." : "Sapling apagado. Integrity sigue activo.", "ok");
	} catch (error) {
		setMessage(message, error.message, "error");
		if ($("#aiDetectionToggle") && state.aiIntegritySettings) {
			$("#aiDetectionToggle").checked = Boolean(state.aiIntegritySettings.detectionEnabled);
		}
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
		{ role: "assistant", content: "Cuéntame qué clase quieres crear y dime su dificultad del 1 al 10. Por ejemplo: una clase de 30 minutos sobre bucles en Lua para ESO, dificultad 5/10, con reto final y rúbrica simple." }
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
	const grid = $("#metricsGrid");
	if (!grid) {
		return;
	}
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
	grid.innerHTML = entries.length ? entries.map(([key, value]) => `
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

function renderSysAdmin(error, serverError) {
	const data = state.sysAdmin || {};
	const backend = data.backend || {};
	const database = data.database || {};
	const queues = data.queues || {};
	const security = data.security || {};
	const ai = data.ai || {};
	const servers = state.classServers || [];
	const runningServers = servers.filter((server) => ["running", "online", "ready"].includes(String(server.status?.state || "").toLowerCase())).length;
	const runtimeMetrics = $("#sysRuntimeMetrics");
	if (runtimeMetrics) {
		runtimeMetrics.innerHTML = [
			{ label: "Tiempo activo", value: formatDuration(backend.uptimeSeconds) },
			{ label: "Memoria backend", value: `${backend.memoryMb ?? 0} MB` },
			{ label: "Procesos Go", value: backend.goroutines ?? 0 },
			{ label: "Conexiones BD", value: database.openConnections ?? 0 },
			{ label: "Sesiones activas", value: security.activeSessions ?? 0 },
			{ label: "Entornos online", value: `${runningServers}/${servers.length}` }
		].map((item) => `<article><strong>${escapeHtml(String(item.value))}</strong><span>${escapeHtml(item.label)}</span></article>`).join("");
	}
	renderSignalList("#sysBackendRack", [
		{ label: "Estado", value: error ? "error" : backend.status || "sin datos" },
		{ label: "Disponibilidad", value: error ? "requiere atención" : "operativa" },
		{ label: "Tiempo activo", value: formatDuration(backend.uptimeSeconds) },
		{ label: "Memoria asignada", value: `${backend.memoryMb ?? 0} MB` },
		{ label: "Goroutines", value: backend.goroutines ?? 0 },
		{ label: "Runtime", value: backend.goVersion || "sin datos" },
		{ label: "Plataforma", value: backend.os && backend.arch ? `${backend.os}/${backend.arch}` : "sin datos" },
		{ label: "Actualizado", value: formatDateTime(data.generatedAt) }
	], "Servicio");
	renderSignalList("#sysDatabaseRack", [
		{ label: "Estado", value: database.status || "sin datos" },
		{ label: "Conexiones abiertas", value: database.openConnections ?? 0 },
		{ label: "Conexiones en uso", value: database.acquiredConnections ?? 0 },
		{ label: "Conexiones libres", value: database.idleConnections ?? 0 },
		{ label: "Servicios auxiliares", value: ai.detectorReady ? "disponibles" : "limitados" }
	], "Datos");
	renderSignalList("#sysQueueRack", [
		{ label: "Acciones docentes pendientes", value: queues.queuedActions ?? 0 },
		{ label: "Alertas de moderacion abiertas", value: queues.moderationAlerts ?? 0 },
		{ label: "Eventos de alumnos (24 h)", value: queues.studentEvents24h ?? 0 },
		{ label: "Analisis de IA (24 h)", value: queues.aiScans24h ?? 0 }
	], "Actividad");
	renderSignalList("#sysSecurityRack", [
		{ label: "Sesiones autenticadas activas", value: security.activeSessions ?? 0 },
		{ label: "Usuarios desactivados", value: security.disabledUsers ?? 0 },
		{ label: "Acceso del panel", value: "solo equipo EduCraft" },
		{ label: "Canal", value: "HTTPS + JWT" }
	], "Seguridad");
	renderSignalList("#sysAIRack", [
		{ label: "Detector", value: ai.detectorProvider || "no configurado" },
		{ label: "Disponibilidad", value: ai.detectorReady ? "preparado" : "limitado" },
		{ label: "Analisis en 24 h", value: queues.aiScans24h ?? 0 },
		{ label: "Estado de datos", value: error ? "sin actualizar" : "en directo" }
	], "IA");
	renderSysServerRack(serverError || error);
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
	const node = $("#policyRack");
	if (!node) return;
	const settings = state.clientPolicySettings || {};
	const teacher = currentPage === "profesor";
	node.innerHTML = `
		<label class="policy-control"><span><strong>Paquetes de recursos</strong><small>${resourcePack.url ? "Paquete oficial de EduCraft" : "Sin paquete configurado"}</small></span><span class="switch"><input type="checkbox" data-client-policy-setting="allowResourcePacks" ${(settings.allowResourcePacks ?? resourcePack.enabled) ? "checked" : ""}><span></span></span></label>
		<label class="policy-control"><span><strong>Mundos locales</strong><small>Permite abrir mundos de un jugador</small></span><span class="switch"><input type="checkbox" data-client-policy-setting="allowSingleplayerWorlds" ${(settings.allowSingleplayerWorlds ?? live.allowSingleplayerWorlds ?? policy.allowSingleplayerWorlds) ? "checked" : ""}><span></span></span></label>
		${teacher ? "" : `<label class="policy-control"><span><strong>Skins personalizadas</strong><small>${skin.forceCommon ? "Actualmente se usa la skin comun" : "Los usuarios pueden elegir skin"}</small></span><span class="switch"><input type="checkbox" data-client-policy-setting="allowCustomSkins" ${settings.allowCustomSkins ? "checked" : ""}><span></span></span></label>`}
		${teacher ? "" : `<form id="resourcePackUploadForm" class="resource-pack-config"><div><strong>Subir paquete del centro</strong><small>Selecciona el archivo .zip. EduCraft calcula y configura todo automaticamente (maximo 100 MB).</small></div><label class="resource-pack-drop"><span>Archivo ZIP</span><input id="resourcePackFile" name="resourcePack" type="file" accept=".zip,application/zip" required></label><button class="button primary" type="submit">Subir y activar</button></form><details class="resource-pack-advanced"><summary>Configuracion avanzada por URL</summary><form id="resourcePackConfigForm" class="resource-pack-config"><label><span>URL HTTPS del paquete</span><input id="resourcePackUrl" type="url" inputmode="url" placeholder="https://centro.example/pack.zip" value="${escapeHtml(settings.resourcePackUrl || "")}"></label><label><span>Hash SHA-1</span><input id="resourcePackHash" type="text" maxlength="40" pattern="[a-fA-F0-9]{40}" placeholder="40 caracteres hexadecimales" value="${escapeHtml(settings.resourcePackHash || "")}"></label><button class="portal-ghost" type="submit">Guardar URL</button></form></details>`}
		<p id="clientPolicyMessage" class="portal-message" role="status"></p>`;
	$("#resourcePackConfigForm")?.addEventListener("submit", saveResourcePackConfig);
	$("#resourcePackUploadForm")?.addEventListener("submit", uploadResourcePack);
}

async function uploadResourcePack(event) {
	event.preventDefault();
	const form = event.currentTarget;
	const file = $("#resourcePackFile")?.files?.[0];
	if (!file) return;
	if (file.size > 100 * 1024 * 1024) {
		setMessage($("#clientPolicyMessage"), "El archivo supera el limite de 100 MB.", "error");
		return;
	}
	const button = form.querySelector("button");
	button.disabled = true;
	button.textContent = "Subiendo...";
	setMessage($("#clientPolicyMessage"), "Subiendo y preparando el paquete...", "");
	try {
		const body = new FormData();
		body.append("resourcePack", file);
		const response = await fetch(`${apiBase}/dashboard/resource-pack`, { method: "POST", headers: { Authorization: `Bearer ${state.token}` }, body });
		const data = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
		state.clientPolicySettings = data;
		await loadPortalContext();
		setMessage($("#clientPolicyMessage"), "✓ Paquete subido y activado.", "ok");
		showToast("Paquete subido y activado.", "ok");
	} catch (error) {
		button.disabled = false;
		button.textContent = "Subir y activar";
		setMessage($("#clientPolicyMessage"), error.message, "error");
		showToast(`No se pudo subir el paquete: ${error.message}`, "error");
	}
}

async function saveResourcePackConfig(event) {
	event.preventDefault();
	const form = event.currentTarget;
	const button = form.querySelector("button");
	button.disabled = true;
	setMessage($("#clientPolicyMessage"), "Guardando paquete...", "");
	try {
		state.clientPolicySettings = await request("/dashboard/client-policy-settings", { method: "PATCH", body: { resourcePackUrl: $("#resourcePackUrl").value.trim(), resourcePackHash: $("#resourcePackHash").value.trim() } });
		await loadPortalContext();
		setMessage($("#clientPolicyMessage"), "✓ Paquete de recursos configurado.", "ok");
		showToast("Paquete de recursos configurado.", "ok");
	} catch (error) {
		button.disabled = false;
		setMessage($("#clientPolicyMessage"), error.message, "error");
		showToast(`No se pudo configurar el paquete: ${error.message}`, "error");
	}
}

async function updateClientPolicySetting(input) {
	const key = input.dataset.clientPolicySetting;
	const previous = !input.checked;
	input.disabled = true;
	setMessage($("#clientPolicyMessage"), "Guardando politica...", "");
	try {
		state.clientPolicySettings = await request("/dashboard/client-policy-settings", { method: "PATCH", body: { [key]: input.checked } });
		await loadPortalContext();
		setMessage($("#clientPolicyMessage"), "✓ Politica del cliente actualizada.", "ok");
		showToast("Politica del cliente actualizada.", "ok");
	} catch (error) {
		input.checked = previous;
		input.disabled = false;
		setMessage($("#clientPolicyMessage"), error.message, "error");
		showToast(`No se pudo actualizar la politica: ${error.message}`, "error");
	}
}

function renderRoutePanel() {
	renderSignalList("#routeRack", [
		{ label: "Siguiente salto", value: state.route?.serverName || "sin ruta" },
		{ label: "Proxy centro", value: state.route?.institutionProxyName || "sin proxy" },
		{ label: "Servidor clase", value: state.route?.classServerName || "sin clase" },
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
		<details class="minecraft-action action-delivery ${escapeHtml(action.status || "queued")}">
			<summary><span><strong>${escapeHtml(actionOutcomeLabel(action))}</strong><small>${escapeHtml(actionTargetLabel(action))}</small></span><em>${escapeHtml(readableStatus(action.status))}</em></summary>
			<dl class="technical-details"><div><dt>Accion</dt><dd>${escapeHtml(action.actionKey || "-")}</dd></div><div><dt>Servidor</dt><dd>${escapeHtml(action.serverName || "Sin asignar")}</dd></div><div><dt>Resultado</dt><dd>${escapeHtml(action.resultMessage || readableStatus(action.status))}</dd></div></dl>
		</details>
	`).join("") : `<div class="minecraft-action empty"><strong>Sin acciones recientes</strong><span>Las acciones realizadas apareceran aqui con un resumen claro.</span></div>`;
}

function renderModerationAlerts(error) {
	const node = $("#moderationAlertRack");
	if (!node) {
		return;
	}
	if (error) {
		node.innerHTML = `<div class="minecraft-action empty"><strong>Sin alertas</strong><span>${escapeHtml(error.message || "No se pudieron cargar las alertas.")}</span></div>`;
		return;
	}
	node.innerHTML = state.moderationAlerts.length ? state.moderationAlerts.slice(0, 8).map((alert) => `
		<div class="minecraft-action ${alert.severity === "critical" ? "failed" : "sent"}">
			<strong>${escapeHtml(alert.username || "Alumno")}</strong>
			<span>${escapeHtml(alert.reason || "Contenido no valido")}</span>
			<small>${escapeHtml(moderationAlertLabel(alert))}</small>
		</div>
	`).join("") : `<div class="minecraft-action empty"><strong>Sin alertas recientes</strong><span>No hay incidencias de entregas.</span></div>`;
	renderTracking();
}

function renderTracking(error) {
	if (!$("#trackingSummary") && !$("#trackingStudentTableBody") && !$("#trackingActionRack")) {
		return;
	}
	const presence = trackingPresence();
	const presentStudents = presence.present.size;
	const missingStudents = Math.max(0, state.students.length - presentStudents);
	const deliveredActions = state.studentEvents.filter((event) => event.eventKind === "answer_accepted").length;
	const rejectedAnswers = state.studentEvents.filter((event) => event.eventKind === "answer_rejected").length;
	const openAlerts = state.moderationAlerts.filter((alert) => alert.status === "open").length
		+ state.studentEvents.filter((event) => event.eventKind === "chat_blocked" || event.eventKind === "command_blocked").length;
	const publishedActivities = state.activities.filter((activity) => activity.status === "published").length;

	const summary = $("#trackingSummary");
	if (summary) {
		summary.innerHTML = [
			{ label: "Presentes", value: presentStudents },
			{ label: "Faltas visibles", value: missingStudents },
			{ label: "Respuestas", value: deliveredActions },
			{ label: "Rechazadas", value: rejectedAnswers },
			{ label: "Incidencias", value: openAlerts },
			{ label: "Clases publicadas", value: publishedActivities }
		].map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}</strong></article>`).join("");
	}

	const studentBody = $("#trackingStudentTableBody");
	if (studentBody) {
		studentBody.innerHTML = state.students.length ? state.students.map((student) => {
			const lastEvent = latestEventForStudent(student);
			const lastAction = latestActionForStudent(student);
			const present = lastEvent && lastEvent.eventKind !== "presence_quit";
			const absence = present ? "No" : "Revisar";
			const statusDetail = lastEvent ? studentEventLabel(lastEvent) : lastAction ? actionLabel(lastAction.actionKey) : readableStatus(student.status);
			return `
				<tr>
					<td>${escapeHtml(student.email)}</td>
					<td>${escapeHtml(student.classGroup || student.course || "-")}</td>
					<td>${escapeHtml(statusDetail)}</td>
					<td>${escapeHtml(absence)}</td>
				</tr>
			`;
		}).join("") : `<tr><td colspan="4">Sin alumnos visibles.</td></tr>`;
	}

	const actionRack = $("#trackingActionRack");
	if (actionRack) {
		const answerEvents = state.studentEvents.filter((event) => event.eventKind === "answer_accepted" || event.eventKind === "answer_rejected");
		actionRack.innerHTML = answerEvents.length ? answerEvents.map((event) => `
			<div class="minecraft-action ${event.status === "accepted" ? "completed" : "failed"}">
				<strong>${escapeHtml(event.username || "Alumno")}</strong>
				<span>${escapeHtml(studentEventLabel(event))}</span>
				<small>${escapeHtml(studentEventDetail(event))}</small>
			</div>
		`).join("") : state.actions.length ? state.actions.map((action) => `
			<div class="minecraft-action ${escapeHtml(action.status || "queued")}">
				<strong>${escapeHtml(actionLabel(action.actionKey))}</strong>
				<span>${escapeHtml(actionTargetLabel(action))}</span>
				<small>${escapeHtml(actionDeliveryLabel(action))}</small>
			</div>
		`).join("") : `<div class="minecraft-action empty"><strong>Sin respuestas</strong><span>No hay acciones ni entregas registradas.</span></div>`;
	}

	const alertRack = $("#trackingAlertRack");
	if (alertRack) {
		const blockedEvents = state.studentEvents.filter((event) => event.eventKind === "chat_blocked" || event.eventKind === "command_blocked");
		const eventHtml = blockedEvents.map((event) => `
			<div class="minecraft-action failed">
				<strong>${escapeHtml(event.username || "Alumno")}</strong>
				<span>${escapeHtml(studentEventLabel(event))}</span>
				<small>${escapeHtml(studentEventDetail(event))}</small>
			</div>
		`).join("");
		const alertHtml = state.moderationAlerts.map((alert) => `
			<div class="minecraft-action ${alert.severity === "critical" ? "failed" : "sent"}">
				<strong>${escapeHtml(alert.username || "Alumno")}</strong>
				<span>${escapeHtml(alert.reason || "Incidencia")}</span>
				<small>${escapeHtml(moderationAlertLabel(alert))}</small>
			</div>
		`).join("");
		alertRack.innerHTML = eventHtml || alertHtml ? eventHtml + alertHtml : `<div class="minecraft-action empty"><strong>Sin incidencias</strong><span>No hay faltas de convivencia registradas.</span></div>`;
	}

	const activityRack = $("#trackingActivityRack");
	if (activityRack) {
		activityRack.innerHTML = state.activities.length ? state.activities.map((activity) => `
			<div class="minecraft-action ${activity.status === "published" ? "completed" : "sent"}">
				<strong>${escapeHtml(activity.title || "Actividad")}</strong>
				<span>${escapeHtml(activity.subject || "Sin materia")} · ${escapeHtml(activity.level || "Sin nivel")}</span>
				<small>${escapeHtml(readableActivityStatus(activity.status))} · ${escapeHtml((activity.programmingMode || "none").toUpperCase())}</small>
			</div>
		`).join("") : `<div class="minecraft-action empty"><strong>Sin actividades</strong><span>No hay clases guardadas todavia.</span></div>`;
	}
	if (error && actionRack && !state.studentEvents.length) {
		actionRack.innerHTML = `<div class="minecraft-action empty"><strong>Eventos no disponibles</strong><span>${escapeHtml(error.message || "No se pudo cargar seguimiento real.")}</span></div>`;
	}
}

function latestActionForStudent(student) {
	return state.actions.find((action) => action.targetUserId === student.id || action.targetEmail === student.email);
}

function latestEventForStudent(student) {
	return state.studentEvents.find((event) => sameStudentIdentity(event, student));
}

function sameStudentIdentity(event, student) {
	const username = String(event.username || "").toLowerCase();
	const email = String(student.email || "").toLowerCase();
	const local = email.split("@")[0];
	return username === email || username === local || username === String(student.id || "").toLowerCase();
}

function trackingPresence() {
	const latest = new Map();
	for (const event of state.studentEvents) {
		if (event.eventKind !== "presence_join" && event.eventKind !== "presence_quit") {
			continue;
		}
		const key = String(event.username || event.playerUuid || "").toLowerCase();
		if (key && !latest.has(key)) {
			latest.set(key, event);
		}
	}
	const present = new Set();
	for (const [key, event] of latest.entries()) {
		if (event.eventKind === "presence_join") {
			present.add(key);
		}
	}
	return { latest, present };
}

function studentEventLabel(event) {
	const labels = {
		presence_join: "Entrada al servidor",
		presence_quit: "Salida del servidor",
		answer_accepted: "Respuesta aceptada",
		answer_rejected: "Respuesta rechazada",
		chat_blocked: "Chat bloqueado",
		command_blocked: "Comando bloqueado"
	};
	return labels[event.eventKind] || event.eventKind || "Evento";
}

function studentEventDetail(event) {
	const lesson = event.lessonTitle ? `${event.lessonTitle} · ` : "";
	const reason = event.reason ? `${event.reason}` : readableStatus(event.status);
	const sample = event.sample ? ` · ${event.sample}` : "";
	return `${lesson}${reason}${sample}`;
}

function moderationAlertLabel(alert) {
	const server = alert.serverName ? `${alert.serverName} · ` : "";
	const lesson = alert.lessonTitle ? `${alert.lessonTitle} · ` : "";
	const sample = alert.sample ? ` · ${alert.sample}` : "";
	return `${server}${lesson}${readableStatus(alert.status)}${sample}`;
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
	$("#activityDifficulty").value = template.difficulty || 5;
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
	$("#activityDifficulty").value = activity.difficulty || 5;
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
				<span>${escapeHtml(activity.subject)} · ${escapeHtml(activity.level)} · ${escapeHtml(String(activity.durationMinutes))} min · Dificultad ${escapeHtml(String(activity.difficulty || 5))}/10</span>
			</div>
			<p>${escapeHtml(firstLine(activity.objectives))}</p>
			<footer>
				<small>${escapeHtml(readableActivityStatus(activity.status))} · ${escapeHtml((activity.programmingMode || "none").toUpperCase())}</small>
				${activity.programmingMode !== "none" ? `<a class="activity-studio-link" href="../programacion/?activity=${encodeURIComponent(activity.id)}&title=${encodeURIComponent(activity.title || "Proyecto EduCraft")}" target="_blank" rel="noopener">Abrir Studio</a>` : ""}
				${activity.status === "published" ? `<button type="button" data-activity-status="${escapeHtml(activity.id)}" data-status="draft">Terminar clase</button>` : `<button type="button" data-activity-status="${escapeHtml(activity.id)}" data-status="published">Iniciar clase</button>`}
			</footer>
		</article>
	`).join("") : `<article class="activity-card empty"><strong>Sin actividades</strong><p>Elige una plantilla, ajusta el guion y guarda la primera clase.</p></article>`;
	for (const button of document.querySelectorAll("[data-activity-status]")) {
		button.addEventListener("click", () => updateActivityStatus(button.dataset.activityStatus, button.dataset.status));
	}
}

async function updateActivityStatus(id, status) {
	try {
		setMessage($("#activityMessage"), status === "published" ? "Iniciando clase: preparando libros y asientos..." : "Terminando la clase...", "");
		await request(`/dashboard/activities/${encodeURIComponent(id)}/status`, {
			method: "PATCH",
			body: { status }
		});
		await loadActivities();
		setMessage($("#activityMessage"), status === "published"
			? "Clase activada. Los alumnos conectados recibirán automáticamente el libro de clase y el libro de respuesta."
			: "Clase terminada.", "ok");
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

function renderAIIntegrity(error) {
	const settings = state.aiIntegritySettings || state.aiIntegrity?.settings || {};
	const toggle = $("#aiDetectionToggle");
	if (toggle) {
		toggle.checked = Boolean(settings.detectionEnabled);
	}
	const provider = $("#aiIntegrityProvider");
	if (provider) {
		const ready = settings.providerReady ? "Listo" : "Sin API";
		provider.textContent = `${settings.provider || "Sapling"} · ${ready}`;
	}
	if (error) {
		for (const selector of ["#aiAverageChart", "#aiBucketChart", "#aiTrendChart", "#aiStatusChart"]) {
			const node = $(selector);
			if (node) {
				node.innerHTML = `<div class="chart-empty">${escapeHtml(error.message || "Sin metricas.")}</div>`;
			}
		}
		return;
	}
	const metrics = state.aiIntegrity || {};
	safeChart("#aiAverageChart", () => renderGaugeChart("#aiAverageChart", metrics.averageScore || 0, "IA media"));
	safeChart("#aiBucketChart", () => renderBarChart("#aiBucketChart", (metrics.buckets || []).map((bucket, index) => ({
		label: bucket.label,
		value: bucket.count,
		color: chartColors[index % chartColors.length]
	}))));
	safeChart("#aiTrendChart", () => renderBarChart("#aiTrendChart", (metrics.recent || []).map((point, index) => ({
		label: point.date?.slice(5) || `Dia ${index + 1}`,
		value: Math.round(point.averageScore || 0),
		color: "#1d6ce3"
	}))));
	safeChart("#aiStatusChart", () => renderDonutChart("#aiStatusChart", Object.entries(metrics.status || {}).map(([label, value], index) => ({
		label: readableAIStatus(label),
		value,
		color: chartColors[index % chartColors.length]
	}))));
}

function renderBookSubmissions(error) {
	const node = $("#bookSubmissionList");
	if (!node) {
		return;
	}
	let focusedDraft = null;
	for (const textarea of node.querySelectorAll("textarea[data-review-reason]")) {
		state.bookReviewDrafts.set(textarea.dataset.reviewReason, textarea.value);
		if (document.activeElement === textarea) {
			focusedDraft = {
				id: textarea.dataset.reviewReason,
				start: textarea.selectionStart,
				end: textarea.selectionEnd
			};
		}
	}
	if (error) {
		node.innerHTML = `<div class="book-submission-empty">${escapeHtml(error.message || "No se pudieron cargar las entregas.")}</div>`;
		return;
	}
	if (!state.bookSubmissions.length) {
		node.innerHTML = `<div class="book-submission-empty">Todavia no hay libros firmados por alumnos.</div>`;
		return;
	}
	node.innerHTML = state.bookSubmissions.map((item) => {
		const completed = item.aiStatus === "completed" && Number.isFinite(Number(item.aiScore));
		const integrity = completed ? `${Math.round(Number(item.aiScore))}% señal IA` : readableAIStatus(item.aiStatus || "pending");
		const status = item.reviewStatus || "pending";
		const statusLabel = status === "accepted" ? "Aceptada" : status === "rejected" ? "Devuelta" : "Pendiente";
		const reviewDraft = state.bookReviewDrafts.get(item.id) || "";
		const review = status === "pending" ? `
			<div class="book-review-actions">
				<label><span>Motivo o comentario para el alumno</span><textarea data-review-reason="${escapeHtml(item.id)}" maxlength="500" rows="3" placeholder="Explica qué está bien o qué debe revisar..." required>${escapeHtml(reviewDraft)}</textarea></label>
				<div><button type="button" class="review-reject" data-review-decision="rejected" data-submission-id="${escapeHtml(item.id)}">Devolver para revisar</button><button type="button" class="review-accept" data-review-decision="accepted" data-submission-id="${escapeHtml(item.id)}">Aceptar y dar recompensa</button></div>
				<p class="portal-message" data-review-message="${escapeHtml(item.id)}"></p>
			</div>` : `
			<div class="book-review-result ${escapeHtml(status)}"><strong>${escapeHtml(statusLabel)}</strong><span>${escapeHtml(item.reviewReason || "Sin comentario")}</span>${item.rewardName ? `<span>Recompensa: ${escapeHtml(item.rewardName)}</span>` : ""}</div>`;
		return `<details class="book-submission" data-submission-id="${escapeHtml(item.id)}" ${state.openBookSubmissions.has(item.id) ? "open" : ""}>
			<summary>
				<span><strong>${escapeHtml(item.username || "Alumno")}</strong><small>${escapeHtml(item.lessonTitle || item.bookTitle || "Libro firmado")} · Dificultad ${escapeHtml(String(item.difficulty || 5))}/10 · Revisión ${escapeHtml(String(item.revisionNumber || 1))} · ${escapeHtml(formatDateTime(item.createdAt))}</small></span>
				<span class="book-summary-badges"><span class="book-review-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span><span class="book-integrity ${completed && Number(item.aiScore) >= 70 ? "is-warning" : ""}">${escapeHtml(integrity)}</span></span>
			</summary>
			<div class="book-submission-body">
				<div class="book-meta"><span>Libro: ${escapeHtml(item.bookTitle || "Entrega EduCraft")}</span><span>Servidor: ${escapeHtml(item.serverName || "-")}</span></div>
				<pre>${escapeHtml(item.bookText || "Sin texto")}</pre>
				${review}
			</div>
		</details>`;
	}).join("");
	for (const detail of node.querySelectorAll("details[data-submission-id]")) {
		detail.addEventListener("toggle", () => {
			if (detail.open) {
				state.openBookSubmissions.add(detail.dataset.submissionId);
			} else {
				state.openBookSubmissions.delete(detail.dataset.submissionId);
			}
		});
	}
	for (const button of document.querySelectorAll("[data-review-decision]")) {
		button.addEventListener("click", () => reviewBookSubmission(button.dataset.submissionId, button.dataset.reviewDecision));
	}
	for (const textarea of node.querySelectorAll("textarea[data-review-reason]")) {
		textarea.addEventListener("input", () => state.bookReviewDrafts.set(textarea.dataset.reviewReason, textarea.value));
	}
	if (focusedDraft) {
		const textarea = node.querySelector(`[data-review-reason="${CSS.escape(focusedDraft.id)}"]`);
		if (textarea) {
			textarea.focus({ preventScroll: true });
			textarea.setSelectionRange(focusedDraft.start, focusedDraft.end);
		}
	}
}

async function reviewBookSubmission(id, decision) {
	const reasonNode = document.querySelector(`[data-review-reason="${CSS.escape(id)}"]`);
	const messageNode = document.querySelector(`[data-review-message="${CSS.escape(id)}"]`);
	const reason = reasonNode?.value.trim() || "";
	if (reason.length < 3) {
		setMessage(messageNode, "Escribe un motivo de al menos 3 caracteres para el alumno.", "error");
		reasonNode?.focus();
		return;
	}
	try {
		setMessage(messageNode, decision === "accepted" ? "Preparando la recompensa..." : "Devolviendo el libro...", "");
		await request(`/dashboard/book-submissions/${encodeURIComponent(id)}/review`, { method: "POST", body: { decision, reason } });
		state.bookReviewDrafts.delete(id);
		await loadBookSubmissions();
	} catch (error) {
		setMessage(messageNode, error.message, "error");
	}
}

function activityPayload() {
	return {
		title: $("#activityTitle").value,
		subject: $("#activitySubject").value,
		level: $("#activityLevel").value,
		durationMinutes: Number($("#activityDuration").value),
		difficulty: Number($("#activityDifficulty").value),
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
				<td><span class="student-row-status">${escapeHtml(readableStatus(student.status))}</span><button type="button" class="student-more-button" data-student-actions="${escapeHtml(student.id)}" aria-label="Acciones para ${escapeHtml(student.email)}">•••</button></td>
			</tr>
		`).join("") : `<tr><td colspan="2">Sin alumnos visibles.</td></tr>`;
		for (const button of document.querySelectorAll("[data-student-actions]")) {
			button.addEventListener("click", () => {
				if ($("#targetStudent")) $("#targetStudent").value = button.dataset.studentActions;
				state.actionAdvanced = true;
				document.body.classList.add("show-advanced-actions");
				renderTeacherActions();
				$("#teacherActions")?.scrollIntoView({ behavior: "smooth", block: "start" });
			});
		}
	}

	if ($("#targetStudent")) {
		$("#targetStudent").innerHTML = `<option value="">Toda la clase</option>` + state.students.map((student) => `
			<option value="${escapeHtml(student.id)}">${escapeHtml(student.email)}</option>
		`).join("");
	}
	renderStudentBreakdown();
	renderDashboardCharts();
	renderTracking();
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

async function sysClassServerAction(id, action) {
	const message = $("#sysAdminMessage");
	const method = action === "status" ? "GET" : "POST";
	setMessage(message, `${actionLabel(action)} ${id}...`, "");
	try {
		const response = await request(`/dashboard/class-servers/${encodeURIComponent(id)}/${action}`, { method });
		const stateLabel = response.status?.state ? ` Estado: ${response.status.state}.` : "";
		setMessage(message, `${actionLabel(action)} completado.${stateLabel}`, "ok");
		await loadSysAdmin();
	} catch (error) {
		setMessage(message, error.message, "error");
	}
}

async function loadServerConsole(id, quiet = false) {
	state.sysServerConsoleId = id;
	const target = $("#sysServerConsoleTarget");
	if (target) {
		target.textContent = id;
	}
	const node = $("#sysServerConsole");
	if (node && !quiet) {
		node.textContent = "Leyendo consola...";
	}
	try {
		const response = await request(`/dashboard/class-servers/${encodeURIComponent(id)}/console?lines=220`);
		if (node) {
			updateConsoleNode(node, response.lines, "Sin lineas de consola.");
		}
	} catch (error) {
		if (node) {
			node.textContent = error.message;
		}
	}
}

async function loadVelocityConsole(quiet = false) {
	const node = $("#sysVelocityConsole");
	if (node && !quiet) {
		node.textContent = "Leyendo Velocity...";
	}
	try {
		const response = await request("/dashboard/velocity/console?lines=220");
		if (node) {
			updateConsoleNode(node, response.lines, "Sin lineas de Velocity.");
		}
	} catch (error) {
		if (node) {
			node.textContent = error.message;
		}
	}
}

function updateConsoleNode(node, lines, emptyText) {
	const followTail = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
	const cleanLines = (lines || []).map((line) => {
		const text = String(line || "");
		const htmlStart = text.search(/<!doctype|<html/i);
		return htmlStart >= 0 ? `${text.slice(0, htmlStart).trim()} [detalle HTML omitido]` : text;
	});
	let proxyErrors = 0;
	const visibleLines = cleanLines.filter((line) => {
		if (line.includes("[EduCraftPaper]") && line.includes("HTTP 502")) {
			proxyErrors += 1;
			return false;
		}
		return true;
	});
	if (proxyErrors) visibleLines.push(`[EduCraft] ${proxyErrors} avisos HTTP 502 del reinicio agrupados. El backend ya esta disponible.`);
	node.innerHTML = visibleLines.length ? visibleLines.map(renderLogLine).join("") : `<div class="log-empty">${escapeHtml(emptyText)}</div>`;
	if (followTail) node.scrollTop = node.scrollHeight;
}

function renderLogLine(line) {
	const text = String(line || "");
	const marker = text.match(/^---\s+(.+?)\s+---$/);
	if (marker) return `<div class="log-file-marker"><span>${escapeHtml(marker[1])}</span></div>`;
	const parsed = text.match(/^\[([^\]]+)\]\s+\[([^\]/]+)(?:\/([^\]]+))?\]:\s?(.*)$/);
	if (!parsed) {
		const stack = /^\s*(at |Caused by:|\.\.\. \d+ more)/.test(text);
		return `<div class="log-line ${stack ? "is-stack" : "is-plain"}"><span class="log-message">${escapeHtml(text || " ")}</span></div>`;
	}
	const [, time, source, levelRaw = "INFO", message] = parsed;
	const level = levelRaw.toUpperCase();
	const levelClass = level === "ERROR" || level === "SEVERE" ? "error" : level === "WARN" || level === "WARNING" ? "warn" : level === "DEBUG" ? "debug" : "info";
	const stack = /^\s*(at |Caused by:|\.\.\. \d+ more)/.test(message);
	return `<div class="log-line level-${levelClass}${stack ? " is-stack" : ""}"><time>${escapeHtml(time)}</time><span class="log-level">${escapeHtml(level)}</span><span class="log-source" title="${escapeHtml(source)}">${escapeHtml(source)}</span><span class="log-message">${escapeHtml(message || " ")}</span></div>`;
}

function startConsoleTail() {
	if (consoleTailTimer) return;
	consoleTailTimer = window.setInterval(() => {
		if (document.hidden) return;
		if (state.sysServerConsoleId) loadServerConsole(state.sysServerConsoleId, true);
		loadVelocityConsole(true);
	}, 5000);
}

function renderSysServerRack(error) {
	const rack = $("#sysServerRack");
	if (!rack) {
		return;
	}
	if (error) {
		rack.innerHTML = `<div class="empty-state">${escapeHtml(error.message || "No se pudo cargar sysadmin.")}</div>`;
		return;
	}
	rack.innerHTML = state.classServers.length ? state.classServers.map((server) => {
		const stateLabel = server.status?.state || (server.record ? "creado" : "sin crear");
		const readOnly = server.status?.managedBy === "external";
		return `
			<article class="class-server-item sys-server-item">
				<div>
					<h3>${escapeHtml(server.serverName || server.id)}</h3>
					<p>${escapeHtml(server.classGroup || server.displayName || "-")} · ${escapeHtml(String(server.port || "-"))} · ${escapeHtml(stateLabel)}</p>
				</div>
				<div class="class-server-actions">
					<button type="button" data-sys-console="${escapeHtml(server.id)}">Consola</button>
					<button type="button" data-sys-server-action="status" data-sys-server-id="${escapeHtml(server.id)}">Estado</button>
					<button type="button" data-sys-server-action="start" data-sys-server-id="${escapeHtml(server.id)}" ${readOnly ? "disabled title=\"Gestionado por Windows\"" : ""}>Start</button>
					<button type="button" data-sys-server-action="restart" data-sys-server-id="${escapeHtml(server.id)}" ${readOnly ? "disabled title=\"Gestionado por Windows\"" : ""}>Restart</button>
					<button type="button" data-sys-server-action="stop" data-sys-server-id="${escapeHtml(server.id)}" ${readOnly ? "disabled title=\"Gestionado por Windows\"" : ""}>Stop</button>
				</div>
			</article>
		`;
	}).join("") : `<div class="empty-state">Sin entornos de clase creados.</div>`;
	for (const button of document.querySelectorAll("[data-sys-console]")) {
		button.addEventListener("click", () => loadServerConsole(button.dataset.sysConsole));
	}
	for (const button of document.querySelectorAll("[data-sys-server-action]")) {
		button.addEventListener("click", () => sysClassServerAction(button.dataset.sysServerId, button.dataset.sysServerAction));
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

function formatDuration(seconds) {
	const value = Number(seconds) || 0;
	const days = Math.floor(value / 86400);
	const hours = Math.floor((value % 86400) / 3600);
	const minutes = Math.floor((value % 3600) / 60);
	if (days > 0) {
		return `${days}d ${hours}h`;
	}
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
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

function renderGaugeChart(selector, value, label) {
	const node = $(selector);
	if (!node) {
		return;
	}
	const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
	const color = percent >= 80 ? "#c84f6a" : percent >= 60 ? "#b8652d" : percent >= 35 ? "#1d6ce3" : "#15986f";
	node.innerHTML = `
		<div class="gauge-chart" style="--gauge-color: ${color}; --gauge-size: ${percent}%">
			<strong>${escapeHtml(String(percent))}%</strong>
			<span>${escapeHtml(label)}</span>
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
		{ label: "Sapling apagado", value: disabled, color: "#b8652d" },
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

function readableAIStatus(status) {
	const labels = {
		pending: "Pendiente",
		completed: "Analizados",
		disabled: "Sapling apagado",
		provider_unavailable: "Sin API",
		failed: "Fallidos"
	};
	return labels[status] || status || "Estado";
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
		<span>Sapling apagado <strong>${escapeHtml(String(disabled))}</strong></span>
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
		<span>Sapling apagado <strong>${escapeHtml(String(disabled))}</strong></span>
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
		const visibleByLevel = state.actionAdvanced || query || state.actionFilter !== "all" || quickTeacherActions.has(action.key);
		return visibleByLevel && inCategory && (!query || haystack.includes(query));
	});
	$("#teacherActions").innerHTML = `<div class="action-level-head"><div><p class="eyebrow">${state.actionAdvanced ? "Todas las herramientas" : "Uso frecuente"}</p><h2>${state.actionAdvanced ? "Mas acciones" : "Acciones rapidas"}</h2></div><button type="button" class="portal-ghost" data-toggle-advanced-actions aria-expanded="${state.actionAdvanced}">${state.actionAdvanced ? "Ver solo rapidas" : "Mas acciones"}</button></div>` + (filtered.length ? filtered.map((action) => `
		<button type="button" data-action-key="${escapeHtml(action.key)}">
			<strong>${escapeHtml(action.label)}</strong>
			<small>${escapeHtml(action.description)}</small>
			<em>${escapeHtml(readableCategory(action.category))}</em>
		</button>
	`).join("") : `<div class="empty-actions">Sin acciones para ese filtro.</div>`);
	$("[data-toggle-advanced-actions]")?.addEventListener("click", () => {
		state.actionAdvanced = !state.actionAdvanced;
		document.body.classList.toggle("show-advanced-actions", state.actionAdvanced);
		renderTeacherActions();
	});
	for (const button of document.querySelectorAll("[data-action-key]")) {
		button.addEventListener("click", () => queueAction(button.dataset.actionKey));
	}
}

function structureActivityEditor() {
	const form = $("#activityForm");
	if (!form || form.dataset.structured) return;
	form.dataset.structured = "true";
	const groups = [
		["Informacion basica", [".activity-fields"]],
		["Diseno de la clase", ["#activityObjectives", "#activitySetup", "#activityScript"]],
		["Evaluacion", ["#activityDeliverable", "#activityRubric"]],
		["Solo para el profesor", ["#activityNotes"]]
	];
	for (const [title, selectors] of groups) {
		const section = document.createElement("fieldset");
		section.className = "activity-form-section";
		section.innerHTML = `<legend>${title}</legend>`;
		for (const selector of selectors) {
			const item = form.querySelector(selector);
			const node = item?.matches("input, textarea, select") ? item.closest("label") : item;
			if (node) section.append(node);
		}
		form.insertBefore(section, form.querySelector(".builder-actions"));
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
	if (response.status === 401 && options.auth !== false && !options.sessionRetried && state.refreshToken) {
		const renewed = await renewDashboardSession();
		if (renewed) {
			return request(path, { ...options, sessionRetried: true });
		}
		clearSession();
		location.replace("login.html?session=expired");
		throw new Error("Sesion caducada. Inicia sesion de nuevo.");
	}
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

async function renewDashboardSession() {
	if (!state.refreshToken) {
		return false;
	}
	if (!sessionRefreshPromise) {
		sessionRefreshPromise = fetch(`${apiBase}/refresh`, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({ refreshToken: state.refreshToken })
		}).then(async (response) => {
			if (!response.ok) {
				return false;
			}
			const data = await response.json();
			if (!data.accessToken) {
				return false;
			}
			storeSession(data);
			return true;
		}).catch(() => false).finally(() => {
			sessionRefreshPromise = null;
		});
	}
	return sessionRefreshPromise;
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
		return clientUrlWithSession("../cliente/index.html");
	}
	return "";
}

function clientUrlWithSession(path) {
	const destination = new URL(path, location.href);
	destination.searchParams.set("server", "wss://play.educraftes.duckdns.org/");
	if (!state.token || !state.refreshToken) {
		return destination.href;
	}
	const params = new URLSearchParams();
	params.set("accessToken", state.token);
	params.set("refreshToken", state.refreshToken);
	const expiresAt = localStorage.getItem(STORAGE_KEYS.expires) || "";
	if (expiresAt) {
		params.set("expiresAt", expiresAt);
	}
	destination.hash = params.toString();
	return destination.href;
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

function isClientDestination(path) {
	return path.includes("/cliente/") || path.startsWith("../cliente/");
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
	if (state.dashboardSocket) {
		state.dashboardSocket.onclose = null;
		state.dashboardSocket.close();
		state.dashboardSocket = null;
	}
	if (state.dashboardLiveRetry) {
		clearTimeout(state.dashboardLiveRetry);
		state.dashboardLiveRetry = 0;
	}
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

async function logout() {
	if (state.token) {
		try {
			await fetch(`${apiBase}/logout`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${state.token}`,
					Accept: "application/json"
				}
			});
		} catch (_) {
			// ignore network errors during logout
		}
	}
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
		cancelled: "cancelada",
		open: "abierta",
		reviewed: "revisada",
		dismissed: "descartada"
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

function actionOutcomeLabel(action) {
	const label = actionLabel(action.actionKey);
	if (action.status === "failed") return `No se pudo completar: ${label.toLowerCase()}`;
	if (action.status === "completed") return `${label} completada`;
	if (action.status === "sent") return `${label} enviada`;
	return `${label} pendiente`;
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
	if (value === null || value === undefined) {
		return "";
	}
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll("\"", "&quot;")
		.replaceAll("'", "&#039;");
}
