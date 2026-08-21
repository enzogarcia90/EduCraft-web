import { EduCraftInterpreter } from "./interpreter.js";

const Blocks = window.Blockly;

const STORAGE_KEY = "educraft.studio.project.v1";
const MAX_FILE_SIZE = 100000;
const state = {
	mode: "blocks",
	activeFile: "html",
	workspace: null,
	interpreter: null,
	runTimer: null,
	project: defaultProject(),
	activityId: new URLSearchParams(location.search).get("activity") || "",
	apiBase: (window.EDUCRAFT_API_BASE_URL || "").replace(/\/+$/, ""),
	token: localStorage.getItem("educraft.dashboard.accessToken") || "",
	simulation: { x: 0, y: 0, direction: 90, placed: [] }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

boot();

function boot() {
	loadLocalProject();
	defineEduCraftBlocks();
	state.workspace = Blocks.inject("blocklyWorkspace", {
		toolbox: toolboxDefinition(),
		renderer: "zelos",
		media: "./vendor/blockly/media/",
		trashcan: true,
		comments: true,
		grid: { spacing: 24, length: 2, colour: "#d8e3de", snap: true },
		zoom: { controls: true, wheel: true, startScale: .82, maxScale: 1.5, minScale: .45, scaleSpeed: 1.12 }
	});
	restoreWorkspace();
	if (!state.workspace.getAllBlocks(false).length) addStarterBlocks();
	state.workspace.addChangeListener((event) => {
		if (event.isUiEvent) return;
		renderGeneratedProgram();
		scheduleSave();
	});
	bindEvents();
	resetSimulation();
	showFile("html");
	renderGeneratedProgram();
	refreshPreview();
	initCloudProject();
	window.addEventListener("resize", () => Blocks.svgResize(state.workspace));
}

function defineEduCraftBlocks() {
	Blocks.defineBlocksWithJsonArray([
		{ type:"educraft_start", message0:"al comenzar", nextStatement:null, colour:"#ffbf00", tooltip:"Punto de inicio del programa." },
		{ type:"educraft_say", message0:"decir %1", args0:[{type:"field_input",name:"TEXT",text:"¡Hola, EduCraft!"}], previousStatement:null,nextStatement:null,colour:"#9966ff" },
		{ type:"educraft_move", message0:"avanzar %1 pasos", args0:[{type:"field_number",name:"STEPS",value:1,min:-20,max:20,precision:1}],previousStatement:null,nextStatement:null,colour:"#4c97ff" },
		{ type:"educraft_turn", message0:"girar %1 grados", args0:[{type:"field_angle",name:"DEGREES",angle:90}],previousStatement:null,nextStatement:null,colour:"#4c97ff" },
		{ type:"educraft_place", message0:"colocar bloque de %1", args0:[{type:"field_dropdown",name:"MATERIAL",options:[["piedra","PIEDRA"],["madera","MADERA"],["cristal","CRISTAL"],["agua","AGUA"]]}],previousStatement:null,nextStatement:null,colour:"#0fbd8c" },
		{ type:"educraft_wait", message0:"esperar %1 segundos", args0:[{type:"field_number",name:"SECONDS",value:1,min:0,max:10,precision:.5}],previousStatement:null,nextStatement:null,colour:"#ffab19" },
		{ type:"educraft_repeat", message0:"repetir %1 veces",args0:[{type:"field_number",name:"TIMES",value:4,min:0,max:50,precision:1}],message1:"%1",args1:[{type:"input_statement",name:"BODY"}],previousStatement:null,nextStatement:null,colour:"#ffab19" },
		{ type:"educraft_if_path", message0:"si el camino está libre",message1:"%1",args1:[{type:"input_statement",name:"BODY"}],previousStatement:null,nextStatement:null,colour:"#ffab19" }
	]);
}

function toolboxDefinition() {
	return {
		kind: "categoryToolbox",
		contents: [
			{kind:"category",name:"Eventos",colour:"#ffbf00",secondaryColour:"#cc9900",tertiaryColour:"#b38600",contents:[{kind:"block",type:"educraft_start"}]},
			{kind:"category",name:"Movimiento",colour:"#4c97ff",secondaryColour:"#3373cc",tertiaryColour:"#285ca3",contents:[{kind:"block",type:"educraft_move"},{kind:"block",type:"educraft_turn"}]},
			{kind:"category",name:"Construcción",colour:"#0fbd8c",secondaryColour:"#0b8e69",tertiaryColour:"#087553",contents:[{kind:"block",type:"educraft_place"}]},
			{kind:"category",name:"Apariencia",colour:"#9966ff",secondaryColour:"#774dcb",tertiaryColour:"#5f3da3",contents:[{kind:"block",type:"educraft_say"}]},
			{kind:"category",name:"Control",colour:"#ffab19",secondaryColour:"#cf8b17",tertiaryColour:"#a97012",contents:[{kind:"block",type:"educraft_wait"},{kind:"block",type:"educraft_repeat"},{kind:"block",type:"educraft_if_path"}]}
		]
	};
}

function addStarterBlocks() {
	const xml = Blocks.utils.xml.textToDom(`<xml xmlns="https://developers.google.com/blockly/xml"><block type="educraft_start" x="70" y="55"><next><block type="educraft_say"><field name="TEXT">Voy a construir</field><next><block type="educraft_repeat"><field name="TIMES">4</field><statement name="BODY"><block type="educraft_place"><field name="MATERIAL">PIEDRA</field><next><block type="educraft_move"><field name="STEPS">2</field></block></next></block></statement></block></next></block></next></block></xml>`);
	Blocks.Xml.domToWorkspace(xml, state.workspace);
}

function bindEvents() {
	$$('[data-mode]').forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
	$$('[data-file]').forEach((button) => button.addEventListener("click", () => showFile(button.dataset.file)));
	$("#runBlocks").addEventListener("click", runBlocks);
	$("#stopBlocks").addEventListener("click", stopBlocks);
	$("#resetBlocks").addEventListener("click", resetSimulation);
	$("#clearBlockConsole").addEventListener("click", () => clearConsole("#blockConsole"));
	$("#clearWebConsole").addEventListener("click", () => clearConsole("#webConsole"));
	$("#runWeb").addEventListener("click", refreshPreview);
	$("#openPreview").addEventListener("click", () => $("#webPreview").requestFullscreen?.());
	$("#codeEditor").addEventListener("input", onCodeInput);
	$("#codeEditor").addEventListener("scroll", syncLineNumberScroll);
	$("#codeEditor").addEventListener("click", updateCursorPosition);
	$("#codeEditor").addEventListener("keyup", updateCursorPosition);
	$("#codeEditor").addEventListener("keydown", handleEditorKeydown);
	$("#projectName").addEventListener("input", () => { state.project.name = $("#projectName").value; scheduleSave(); });
	$("#newProject").addEventListener("click", newProject);
	$("#downloadProject").addEventListener("click", downloadProject);
	$("#cloudSave").addEventListener("click", saveCloudProject);
	$("#openProject").addEventListener("change", importProject);
	window.addEventListener("message", receivePreviewMessage);
}

async function initCloudProject() {
	if (!state.activityId || !state.apiBase || !state.token) return;
	$("#cloudSave").hidden = false;
	try {
		const response = await cloudRequest("GET");
		if (!validProject(response.projectData)) return;
		state.project = response.projectData;
		$("#projectName").value = state.project.name;
		state.workspace.clear();
		restoreWorkspace();
		if (!state.workspace.getAllBlocks(false).length) addStarterBlocks();
		showFile(state.activeFile);
		refreshPreview();
		toast("Proyecto de la clase cargado");
	} catch (error) {
		if (error.status !== 404) toast(error.message || "No se pudo cargar el proyecto de la clase");
	}
}

async function saveCloudProject() {
	if (!state.activityId || !state.apiBase || !state.token) return;
	saveLocalProject();
	const button = $("#cloudSave");
	button.disabled = true;
	button.textContent = "Guardando…";
	try {
		await cloudRequest("PUT", {name:state.project.name,projectKind:"mixed",projectData:state.project});
		button.textContent = "Guardado en la clase";
		toast("Proyecto guardado en la clase");
	} catch (error) {
		button.textContent = "Reintentar guardado";
		toast(error.message || "No se pudo guardar en la clase");
	} finally {
		button.disabled = false;
	}
}

async function cloudRequest(method, body) {
	const response = await fetch(`${state.apiBase}/dashboard/activities/${encodeURIComponent(state.activityId)}/programming-project`, {
		method,
		headers: {Authorization:`Bearer ${state.token}`,...(body?{"Content-Type":"application/json"}:{})},
		body: body ? JSON.stringify(body) : undefined
	});
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		const error = new Error(payload.message || `Error HTTP ${response.status}`);
		error.status = response.status;
		throw error;
	}
	return response.json();
}

function switchMode(mode) {
	state.mode = mode === "web" ? "web" : "blocks";
	$$('[data-mode]').forEach((button) => button.classList.toggle("is-active", button.dataset.mode === state.mode));
	$("#blocksMode").classList.toggle("is-active", state.mode === "blocks");
	$("#webMode").classList.toggle("is-active", state.mode === "web");
	if (state.mode === "blocks") setTimeout(() => Blocks.svgResize(state.workspace), 0);
}

function workspaceProgram() {
	const starts = state.workspace.getTopBlocks(true).filter((block) => block.type === "educraft_start");
	return starts.flatMap((start) => instructionList(start.getNextBlock()));
}

function instructionList(block) {
	const instructions = [];
	let current = block;
	while (current) {
		const instruction = instructionFromBlock(current);
		if (instruction) instructions.push(instruction);
		current = current.getNextBlock();
	}
	return instructions;
}

function instructionFromBlock(block) {
	switch (block.type) {
		case "educraft_say": return {op:"say",text:block.getFieldValue("TEXT")};
		case "educraft_move": return {op:"move",steps:Number(block.getFieldValue("STEPS"))};
		case "educraft_turn": return {op:"turn",degrees:Number(block.getFieldValue("DEGREES"))};
		case "educraft_place": return {op:"place",material:block.getFieldValue("MATERIAL")};
		case "educraft_wait": return {op:"wait",seconds:Number(block.getFieldValue("SECONDS"))};
		case "educraft_repeat": return {op:"repeat",times:Number(block.getFieldValue("TIMES")),body:instructionList(block.getInputTargetBlock("BODY"))};
		case "educraft_if_path": return {op:"if_path",body:instructionList(block.getInputTargetBlock("BODY"))};
		default: return null;
	}
}

function renderGeneratedProgram() {
	$("#generatedProgram").textContent = JSON.stringify(workspaceProgram(), null, 2);
}

async function runBlocks() {
	stopBlocks();
	resetSimulation();
	clearConsole("#blockConsole");
	const program = workspaceProgram();
	if (!program.length) {
		logTo("#blockConsole", "Conecta instrucciones debajo de «al comenzar».", "error");
		return;
	}
	setRunState("running", "Ejecutando");
	const delay = () => 80 + (10 - Number($("#runSpeed").value)) * 70;
	state.interpreter = new EduCraftInterpreter({
		say: async (text) => { logTo("#blockConsole", `Constructor: ${text}`); await pause(delay()); },
		move: async (steps) => { moveActor(steps); logTo("#blockConsole", `Avanza ${steps} paso${Math.abs(steps) === 1 ? "" : "s"}.`); await pause(delay()); },
		turn: async (degrees) => { state.simulation.direction = normalizeAngle(state.simulation.direction + degrees); renderSimulation(); logTo("#blockConsole", `Gira ${degrees}°.`); await pause(delay()); },
		place: async (material) => { placeBlock(material); logTo("#blockConsole", `Coloca ${material.toLowerCase()}.`); await pause(delay()); },
		wait: async (seconds) => { logTo("#blockConsole", `Espera ${seconds} s.`); await pause(Math.min(2000, seconds * delay())); },
		pathClear: async () => Math.abs(state.simulation.x) < 9 && Math.abs(state.simulation.y) < 6
	});
	try {
		const result = await state.interpreter.run(program);
		logTo("#blockConsole", `Programa terminado: ${result.steps} pasos.`, "success");
		setRunState("", "Completado");
	} catch (error) {
		const stopped = error.message === "Programa detenido";
		logTo("#blockConsole", error.message, stopped ? "" : "error");
		setRunState(stopped ? "" : "error", stopped ? "Detenido" : "Error");
	} finally {
		state.interpreter = null;
	}
}

function stopBlocks() {
	state.interpreter?.stop();
	clearTimeout(state.runTimer);
}

function pause(milliseconds) {
	return new Promise((resolve) => { state.runTimer = setTimeout(resolve, milliseconds); });
}

function resetSimulation() {
	state.simulation = { x: 0, y: 0, direction: 90, placed: [] };
	$("#trailLayer").replaceChildren();
	renderSimulation();
	setRunState("", "Listo");
}

function moveActor(steps) {
	const radians = state.simulation.direction * Math.PI / 180;
	state.simulation.x = clamp(state.simulation.x + Math.round(Math.cos(radians) * steps), -10, 10);
	state.simulation.y = clamp(state.simulation.y + Math.round(Math.sin(radians) * steps), -7, 7);
	renderSimulation();
}

function placeBlock(material) {
	const item = { x: state.simulation.x, y: state.simulation.y, material };
	state.simulation.placed.push(item);
	const node = document.createElement("i");
	node.className = `placed-block ${material}`;
	node.style.left = `${50 + item.x * 4}%`;
	node.style.top = `${67 - item.y * 4}%`;
	$("#trailLayer").append(node);
	renderSimulation();
}

function renderSimulation() {
	$("#builder").style.transform = `translate(${state.simulation.x * 24}px,${-state.simulation.y * 18}px) rotate(${90 - state.simulation.direction}deg)`;
	$("#actorX").textContent = state.simulation.x;
	$("#actorY").textContent = state.simulation.y;
	$("#actorDirection").textContent = `${state.simulation.direction}°`;
	$("#placedCount").textContent = state.simulation.placed.length;
}

function setRunState(className, label) {
	$("#runBadge").className = `status-badge ${className}`.trim();
	$("#runBadge").textContent = label;
	$("#runBlocks").disabled = className === "running";
	$("#stopBlocks").disabled = className !== "running";
}

function showFile(file) {
	if (!state.project.files[file]) return;
	state.activeFile = file;
	$$('[data-file]').forEach((button) => button.classList.toggle("is-active", button.dataset.file === file));
	$("#codeEditor").value = state.project.files[file];
	$("#languageMode").textContent = file.toUpperCase();
	updateLineNumbers();
	updateCursorPosition();
	$("#codeEditor").focus();
}

function onCodeInput() {
	state.project.files[state.activeFile] = $("#codeEditor").value.slice(0, MAX_FILE_SIZE);
	updateLineNumbers();
	scheduleSave();
	if ($("#autoPreview").checked) {
		clearTimeout(state.previewTimer);
		state.previewTimer = setTimeout(refreshPreview, 350);
	}
}

function handleEditorKeydown(event) {
	if (event.key !== "Tab") return;
	event.preventDefault();
	const editor = event.currentTarget;
	const start = editor.selectionStart;
	editor.setRangeText("  ", start, editor.selectionEnd, "end");
	onCodeInput();
}

function updateLineNumbers() {
	const count = Math.max(1, $("#codeEditor").value.split("\n").length);
	$("#lineNumbers").textContent = Array.from({length:count}, (_, index) => index + 1).join("\n");
}

function syncLineNumberScroll() {
	$("#lineNumbers").scrollTop = $("#codeEditor").scrollTop;
}

function updateCursorPosition() {
	const editor = $("#codeEditor");
	const before = editor.value.slice(0, editor.selectionStart).split("\n");
	$("#cursorPosition").textContent = `Ln ${before.length}, Col ${before.at(-1).length + 1}`;
}

function refreshPreview() {
	clearConsole("#webConsole");
	const html = state.project.files.html;
	const css = state.project.files.css.replace(/<\/style/gi, "<\\/style");
	const js = state.project.files.js.replace(/<\/script/gi, "<\\/script");
	const bridge = `(function(){const send=(level,args)=>parent.postMessage({source:'educraft-preview',level,message:args.map(v=>{try{return typeof v==='object'?JSON.stringify(v):String(v)}catch(e){return String(v)}}).join(' ')},'*');['log','info','warn','error'].forEach(level=>{const original=console[level];console[level]=(...args)=>{send(level,args);original.apply(console,args)}});addEventListener('error',e=>send('error',[e.message+' · línea '+e.lineno]));addEventListener('unhandledrejection',e=>send('error',['Promesa rechazada: '+e.reason]));})();`;
	const policy = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
	$("#webPreview").srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${css}</style><script>${bridge}<\/script></head><body>${html}<script>${js}<\/script></body></html>`;
	logTo("#webConsole", "Vista actualizada.", "success");
}

function receivePreviewMessage(event) {
	if (event.source !== $("#webPreview").contentWindow || event.data?.source !== "educraft-preview") return;
	logTo("#webConsole", event.data.message, event.data.level === "error" ? "error" : "");
}

function scheduleSave() {
	$("#saveState").textContent = "Guardando…";
	clearTimeout(state.saveTimer);
	state.saveTimer = setTimeout(saveLocalProject, 350);
}

function saveLocalProject() {
	try {
		state.project.workspace = Blocks.serialization.workspaces.save(state.workspace);
		state.project.updatedAt = new Date().toISOString();
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
		$("#saveState").textContent = "Guardado en este dispositivo";
	} catch (error) {
		$("#saveState").textContent = "No se pudo guardar";
	}
}

function loadLocalProject() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (validProject(saved)) state.project = saved;
	} catch (_) {}
	$("#projectName").value = state.project.name;
}

function restoreWorkspace() {
	if (!state.project.workspace) return;
	try { Blocks.serialization.workspaces.load(state.project.workspace, state.workspace); }
	catch (_) { state.project.workspace = null; }
}

function newProject() {
	if (!confirm("¿Crear un proyecto nuevo? El proyecto actual seguirá disponible si lo descargas antes.")) return;
	stopBlocks();
	state.project = defaultProject();
	$("#projectName").value = state.project.name;
	state.workspace.clear();
	addStarterBlocks();
	showFile("html");
	refreshPreview();
	saveLocalProject();
	toast("Proyecto nuevo creado");
}

function downloadProject() {
	saveLocalProject();
	const blob = new Blob([JSON.stringify(state.project, null, 2)], {type:"application/json"});
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = `${slug(state.project.name) || "proyecto"}.educraft`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importProject(event) {
	const file = event.target.files?.[0];
	event.target.value = "";
	if (!file || file.size > 1000000) return toast("El archivo no es válido o es demasiado grande");
	try {
		const project = JSON.parse(await file.text());
		if (!validProject(project)) throw new Error("Formato no reconocido");
		state.project = project;
		$("#projectName").value = project.name;
		state.workspace.clear();
		restoreWorkspace();
		showFile("html");
		refreshPreview();
		saveLocalProject();
		toast("Proyecto abierto");
	} catch (error) { toast(error.message || "No se pudo abrir el proyecto"); }
}

function validProject(project) {
	return project && project.version === 1 && typeof project.name === "string" && project.files && ["html","css","js"].every((key) => typeof project.files[key] === "string" && project.files[key].length <= MAX_FILE_SIZE);
}

function defaultProject() {
	return {
		version: 1,
		name: "Mi proyecto",
		updatedAt: new Date().toISOString(),
		workspace: null,
		files: {
			html: `<main class="tarjeta">\n  <span>Proyecto EduCraft</span>\n  <h1>¡Hola, mundo!</h1>\n  <p>Modifica el código y crea tu primera web.</p>\n  <button id="saludar">Probar JavaScript</button>\n</main>`,
			css: `body {\n  min-height: 100vh;\n  margin: 0;\n  display: grid;\n  place-items: center;\n  font-family: system-ui, sans-serif;\n  color: #102a24;\n  background: linear-gradient(135deg, #dff5e9, #dcecff);\n}\n\n.tarjeta {\n  width: min(420px, 80vw);\n  padding: 32px;\n  border: 3px solid #102a24;\n  border-radius: 16px;\n  background: white;\n  box-shadow: 10px 10px 0 #41b883;\n}\n\nbutton { padding: 10px 14px; cursor: pointer; }`,
			js: `const boton = document.querySelector('#saludar');\n\nboton.addEventListener('click', () => {\n  console.log('¡El botón funciona!');\n  boton.textContent = '¡Muy bien!';\n});`
		}
	};
}

function clearConsole(selector) { $(selector).replaceChildren(); }
function logTo(selector, message, type = "") { const line=document.createElement("p"); line.className=type?`console-${type}`:""; line.textContent=String(message); $(selector).append(line); $(selector).scrollTop=$(selector).scrollHeight; }
function toast(message) { const node=$("#toast"); node.textContent=message; node.classList.add("show"); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>node.classList.remove("show"),2200); }
function normalizeAngle(value) { return ((Math.round(value) % 360) + 360) % 360; }
function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60); }
