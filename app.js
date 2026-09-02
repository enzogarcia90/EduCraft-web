const canvas = document.getElementById("heroScene");
const reducePageMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

initPageMotion();
initMobileNavigation();
initContactForm();
initHealthMonitor();

function initHealthMonitor() {
	const monitor = document.querySelector("[data-health-monitor]");
	if (!monitor) return;

	const fields = {
		overall: monitor.querySelector("[data-health-overall]"),
		checked: monitor.querySelector("[data-health-checked]"),
		source: monitor.querySelector("[data-health-source]"),
		runtime: monitor.querySelector("[data-health-runtime]"),
		services: monitor.querySelector("[data-health-services]")
	};
	const refresh = monitor.querySelector("[data-health-refresh]");
	let loading = false;

	function validHealth(data) {
		return data && ["ok", "degraded", "down"].includes(data.status) &&
			typeof data.timestamp === "string" && data.services && typeof data.services === "object";
	}

	async function requestHealth(url) {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 8000);
		try {
			const separator = url.includes("?") ? "&" : "?";
			const response = await fetch(`${url}${separator}t=${Date.now()}`, {
				cache: "no-store",
				headers: { Accept: "application/json" },
				signal: controller.signal
			});
			const data = await response.json();
			if (!response.ok && response.status !== 503) throw new Error(`HTTP ${response.status}`);
			if (!validHealth(data)) throw new Error("Respuesta de estado no válida");
			return data;
		} finally {
			window.clearTimeout(timeout);
		}
	}

	function duration(seconds) {
		const total = Math.max(0, Number(seconds) || 0);
		const days = Math.floor(total / 86400);
		const hours = Math.floor((total % 86400) / 3600);
		return days ? `${days} d ${hours} h` : `${hours} h ${Math.floor((total % 3600) / 60)} min`;
	}

	function render(data, source) {
		const timestamp = new Date(data.mirrored_at || data.timestamp);
		const ageMinutes = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 60000));
		const stale = source === "mirror" && (!Number.isFinite(timestamp.getTime()) || ageMinutes > 30);
		const services = Object.values(data.services);
		const affected = services.filter((service) => service.status !== "ok");
		const labels = { ok: "Operativo", degraded: "Degradado", down: "Incidencia crítica" };

		monitor.dataset.healthState = stale ? "stale" : data.status;
		fields.overall.textContent = stale ? "Sin datos recientes" : (labels[data.status] || data.status);
		fields.checked.textContent = Number.isFinite(timestamp.getTime())
			? `${timestamp.toLocaleString("es-ES")} (${ageMinutes === 0 ? "ahora" : `hace ${ageMinutes} min`})`
			: "Fecha no disponible";
		fields.source.textContent = source === "direct"
			? "Backend en directo"
			: stale ? "Copia de respaldo desactualizada" : "Copia de respaldo de GitHub";
		fields.runtime.textContent = `Versión ${data.version || "sin identificar"} · activo ${duration(data.uptime_seconds)}`;
		fields.services.textContent = affected.length
			? `${affected.length} de ${services.length} requieren atención: ${affected.map((service) => service.category || "servicio").join(", ")}`
			: `${services.length} de ${services.length} operativos`;
	}

	async function update() {
		if (loading) return;
		loading = true;
		if (refresh) refresh.disabled = true;
		fields.source.textContent = "Consultando el backend...";
		try {
			render(await requestHealth(monitor.dataset.healthDirect), "direct");
		} catch (_) {
			try {
				render(await requestHealth(monitor.dataset.healthMirror), "mirror");
			} catch (_) {
				monitor.dataset.healthState = "down";
				fields.overall.textContent = "No se puede verificar";
				fields.checked.textContent = new Date().toLocaleString("es-ES");
				fields.source.textContent = "Backend y copia de respaldo inaccesibles";
				fields.runtime.textContent = "Sin datos verificables";
				fields.services.textContent = "Estado desconocido";
			}
		} finally {
			loading = false;
			if (refresh) refresh.disabled = false;
		}
	}

	refresh?.addEventListener("click", update);
	update();
	window.setInterval(update, 60000);
}

function initContactForm() {
	const form = document.querySelector("[data-contact-form]");
	if (!form) return;
	const button = form.querySelector('button[type="submit"]');
	const status = form.querySelector(".form-status");
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (button.disabled) return;
		if (!form.reportValidity()) return;
		button.disabled = true;
		status.hidden = false;
		status.className = "form-status form-field-wide";
		status.textContent = "Enviando solicitud…";
		const data = new FormData(form);
		const payload = Object.fromEntries(["name", "email", "organization", "profile", "message", "website"].map((key) => [key, String(data.get(key) || "")]));
		try {
			const response = await fetch(form.action, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"}, body: JSON.stringify(payload)});
			if (!response.ok) throw new Error(`request failed: ${response.status}`);
			window.location.assign("gracias.html");
		} catch (_) {
			status.classList.add("is-error");
			status.textContent = "No hemos podido enviar la solicitud. Inténtalo de nuevo en unos minutos o escríbenos por correo.";
			button.disabled = false;
		}
	});
}

function initMobileNavigation() {
	const header = document.querySelector(".site-header");
	const nav = header?.querySelector(".nav");
	const actions = header?.querySelector(".header-actions");
	if (!header || !nav || !actions) return;

	const toggle = document.createElement("button");
	toggle.className = "nav-toggle";
	toggle.type = "button";
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-controls", "mobile-navigation");
	toggle.setAttribute("aria-label", "Abrir menú");
	toggle.innerHTML = '<span aria-hidden="true"></span><span class="nav-toggle-label">Menú</span>';
	nav.id = "mobile-navigation";
	header.insertBefore(toggle, nav);

	function setOpen(open) {
		header.classList.toggle("nav-open", open);
		toggle.setAttribute("aria-expanded", String(open));
		toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
		toggle.querySelector(".nav-toggle-label").textContent = open ? "Cerrar" : "Menú";
	}

	toggle.addEventListener("click", () => setOpen(!header.classList.contains("nav-open")));
	header.addEventListener("click", (event) => {
		if (event.target.closest(".nav a, .header-actions a")) setOpen(false);
	});
	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") setOpen(false);
	});
	window.matchMedia("(min-width: 981px)").addEventListener("change", (event) => {
		if (event.matches) setOpen(false);
	});
}

if (canvas) {
	const ctx = canvas.getContext("2d");
	const palette = ["#15986f", "#286fe3", "#d5a92f", "#bd6149", "#6557c8", "#16211d"];
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let width = 0;
	let height = 0;
	let blocks = [];
	let nodes = [];
	let lastFrame = 0;

	function resize() {
		const ratio = window.devicePixelRatio || 1;
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.floor(width * ratio);
		canvas.height = Math.floor(height * ratio);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		blocks = createBlocks();
		nodes = createNodes();
		draw(0);
	}

	function createBlocks() {
		const list = [];
		const startX = width < 720 ? width * 0.18 : width * 0.47;
		const cols = Math.max(5, Math.ceil((width - startX) / 108));
		const rows = Math.max(6, Math.ceil(height / 88));

		for (let y = 0; y < rows; y += 1) {
			for (let x = 0; x < cols; x += 1) {
				if ((x * 2 + y) % 5 === 2) {
					continue;
				}

				list.push({
					x: startX + x * 108 + ((y % 2) * 36),
					y: y * 88 + 18,
					size: 22 + ((x + y) % 5) * 7,
					color: palette[(x * 2 + y) % palette.length],
					speed: 0.12 + ((x + y) % 5) * 0.028,
					offset: (x * 1.7 + y * 0.9),
					tilt: ((x + y) % 4) - 1.5
				});
			}
		}

		return list;
	}

	function createNodes() {
		const list = [];
		const startX = width < 720 ? width * 0.1 : width * 0.52;
		const count = Math.max(9, Math.floor((width - startX) / 82));

		for (let i = 0; i < count; i += 1) {
			list.push({
				x: startX + i * 82,
				y: height * (0.18 + ((i * 23) % 58) / 100),
				radius: 3 + (i % 3),
				offset: i * 0.74
			});
		}

		return list;
	}

	function draw(time) {
		const base = ctx.createLinearGradient(0, 0, width, height);
		base.addColorStop(0, "#f8f7ef");
		base.addColorStop(0.46, "#edf6ef");
		base.addColorStop(1, "#dfeefe");
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, width, height);

		drawGrid(time);
		drawNetwork(time);

		for (const block of blocks) {
			const lift = Math.sin(time * block.speed + block.offset) * (reduceMotion.matches ? 0 : 7);
			drawBlock(block.x, block.y + lift, block.size, block.color, block.tilt);
		}
	}

	function drawGrid(time) {
		ctx.save();
		ctx.globalAlpha = 0.26;
		ctx.strokeStyle = "#16211d";
		ctx.lineWidth = 1;
		const drift = reduceMotion.matches ? 0 : (time * 8) % 52;

		for (let x = width * 0.43 - drift; x < width + 80; x += 52) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x - height * 0.32, height);
			ctx.stroke();
		}

		for (let y = -80 + drift; y < height + 80; y += 52) {
			ctx.beginPath();
			ctx.moveTo(width * 0.43, y);
			ctx.lineTo(width, y + (width * 0.22));
			ctx.stroke();
		}

		ctx.restore();
	}

	function drawNetwork(time) {
		ctx.save();
		ctx.globalAlpha = 0.36;
		ctx.strokeStyle = "#16211d";
		ctx.lineWidth = 1.35;

		for (let i = 0; i < nodes.length - 1; i += 1) {
			const a = nodes[i];
			const b = nodes[i + 1];
			const ay = nodeY(a, time);
			const by = nodeY(b, time);
			ctx.beginPath();
			ctx.moveTo(a.x, ay);
			ctx.lineTo(b.x, by);
			ctx.stroke();
		}

		for (const node of nodes) {
			ctx.fillStyle = palette[Math.floor(node.offset * 10) % palette.length];
			ctx.beginPath();
			ctx.arc(node.x, nodeY(node, time), node.radius, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	function nodeY(node, time) {
		return node.y + Math.sin(time * 0.28 + node.offset) * (reduceMotion.matches ? 0 : 10);
	}

	function drawBlock(x, y, size, color, tilt) {
		const depth = size * 0.42;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate((tilt * Math.PI) / 180);
		ctx.shadowColor = "rgba(22, 33, 29, 0.16)";
		ctx.shadowBlur = 16;
		ctx.shadowOffsetY = 12;

		ctx.fillStyle = shade(color, 24);
		ctx.beginPath();
		ctx.moveTo(0, depth);
		ctx.lineTo(size, 0);
		ctx.lineTo(size + depth, depth * 0.55);
		ctx.lineTo(depth, depth * 1.55);
		ctx.closePath();
		ctx.fill();

		ctx.shadowColor = "transparent";
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(0, depth);
		ctx.lineTo(depth, depth * 1.55);
		ctx.lineTo(depth, size + depth * 1.55);
		ctx.lineTo(0, size + depth);
		ctx.closePath();
		ctx.fill();

		ctx.fillStyle = shade(color, -18);
		ctx.beginPath();
		ctx.moveTo(depth, depth * 1.55);
		ctx.lineTo(size + depth, depth * 0.55);
		ctx.lineTo(size + depth, size + depth * 0.55);
		ctx.lineTo(depth, size + depth * 1.55);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
		ctx.lineWidth = 1;
		ctx.strokeRect(2, depth + 2, Math.max(4, size - 4), Math.max(4, size - 4));
		ctx.restore();
	}

	function shade(hex, amount) {
		const value = parseInt(hex.slice(1), 16);
		const r = clamp((value >> 16) + amount);
		const g = clamp(((value >> 8) & 255) + amount);
		const b = clamp((value & 255) + amount);
		return `rgb(${r}, ${g}, ${b})`;
	}

	function clamp(value) {
		return Math.max(0, Math.min(255, value));
	}

	function animate(ms) {
		const seconds = ms / 1000;
		if (seconds - lastFrame > 1 / 45) {
			draw(seconds);
			lastFrame = seconds;
		}
		requestAnimationFrame(animate);
	}

	window.addEventListener("resize", resize);
	reduceMotion.addEventListener("change", resize);
	resize();
	requestAnimationFrame(animate);
}

function initPageMotion() {
	const header = document.querySelector(".site-header");
	const revealTargets = document.querySelectorAll([
		".section",
		".page-hero",
		".stats-band",
		".notice-band",
		".product-strip",
		".data-table",
		".contact-layout"
	].join(","));

	for (const target of revealTargets) {
		target.classList.add("reveal");
	}

	if (reducePageMotion.matches) {
		for (const target of revealTargets) {
			target.classList.add("is-visible");
		}
	} else if ("IntersectionObserver" in window) {
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) {
					continue;
				}

				entry.target.classList.add("is-visible");
				observer.unobserve(entry.target);
			}
		}, {
			rootMargin: "0px 0px -12% 0px",
			threshold: 0.12
		});

		revealTargets.forEach((target, index) => {
			target.style.setProperty("--reveal-delay", `${Math.min(index * 35, 180)}ms`);
			observer.observe(target);
		});
	} else {
		for (const target of revealTargets) {
			target.classList.add("is-visible");
		}
	}

	function updateHeaderState() {
		if (!header) {
			return;
		}

		header.classList.toggle("is-scrolled", window.scrollY > 12);
	}

	updateHeaderState();
	window.addEventListener("scroll", updateHeaderState, { passive: true });

	document.addEventListener("click", (event) => {
		const link = event.target.closest("a[href]");

		if (!link || shouldSkipPageTransition(link, event)) {
			return;
		}

		const destination = new URL(link.getAttribute("href"), window.location.href);

		if (destination.hash && destination.pathname === window.location.pathname) {
			return;
		}

		event.preventDefault();
		document.body.classList.add("page-exit");
		window.setTimeout(() => {
			window.location.href = destination.href;
		}, reducePageMotion.matches ? 0 : 170);
	});
}

function shouldSkipPageTransition(link, event) {
	if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
		return true;
	}

	if (link.target && link.target !== "_self") {
		return true;
	}

	const href = link.getAttribute("href");

	if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
		return true;
	}

	const destination = new URL(href, window.location.href);

	return destination.origin !== window.location.origin;
}
