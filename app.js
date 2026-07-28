const canvas = document.getElementById("heroScene");

if (canvas) {
	const ctx = canvas.getContext("2d");
	const palette = ["#1fa477", "#326ee8", "#e2b942", "#bd634b", "#7461cc", "#17201d"];
	let width = 0;
	let height = 0;
	let blocks = [];
	let links = [];

	function resize() {
		const ratio = window.devicePixelRatio || 1;
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.floor(width * ratio);
		canvas.height = Math.floor(height * ratio);
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		blocks = createBlocks();
		links = createLinks();
	}

	function createBlocks() {
		const list = [];
		const startX = width < 720 ? width * 0.12 : width * 0.48;
		const cols = Math.max(5, Math.ceil((width - startX) / 118));
		const rows = Math.max(5, Math.ceil(height / 98));
		for (let y = 0; y < rows; y += 1) {
			for (let x = 0; x < cols; x += 1) {
				if ((x + y) % 3 === 1) {
					continue;
				}
				list.push({
					x: startX + x * 118 + ((y % 2) * 34),
					y: y * 98 + 26,
					size: 24 + ((x + y) % 5) * 7,
					color: palette[(x * 2 + y) % palette.length],
					speed: 0.16 + ((x + y) % 5) * 0.03,
					offset: (x + y) * 0.68
				});
			}
		}
		return list;
	}

	function createLinks() {
		const list = [];
		const startX = width < 720 ? width * 0.18 : width * 0.55;
		const count = Math.max(6, Math.floor((width - startX) / 110));
		for (let i = 0; i < count; i += 1) {
			list.push({
				x: startX + i * 112,
				y: height * (0.2 + ((i * 29) % 52) / 100),
				offset: i * 0.8
			});
		}
		return list;
	}

	function draw(time) {
		const base = ctx.createLinearGradient(0, 0, width, height);
		base.addColorStop(0, "#f8f7ef");
		base.addColorStop(0.5, "#eef7f1");
		base.addColorStop(1, "#e9eefc");
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, width, height);

		drawNetwork(time);
		for (const block of blocks) {
			const lift = Math.sin(time * block.speed + block.offset) * 7;
			drawBlock(block.x, block.y + lift, block.size, block.color);
		}
	}

	function drawNetwork(time) {
		ctx.save();
		ctx.globalAlpha = 0.32;
		ctx.strokeStyle = "#17201d";
		ctx.lineWidth = 1.4;
		for (let i = 0; i < links.length - 1; i += 1) {
			const a = links[i];
			const b = links[i + 1];
			const ay = a.y + Math.sin(time * 0.28 + a.offset) * 9;
			const by = b.y + Math.sin(time * 0.28 + b.offset) * 9;
			ctx.beginPath();
			ctx.moveTo(a.x, ay);
			ctx.lineTo(b.x, by);
			ctx.stroke();
		}
		ctx.restore();
	}

	function drawBlock(x, y, size, color) {
		const depth = size * 0.42;
		ctx.save();
		ctx.translate(x, y);
		ctx.fillStyle = shade(color, 25);
		ctx.beginPath();
		ctx.moveTo(0, depth);
		ctx.lineTo(size, 0);
		ctx.lineTo(size + depth, depth * 0.55);
		ctx.lineTo(depth, depth * 1.55);
		ctx.closePath();
		ctx.fill();

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
		draw(ms / 1000);
		requestAnimationFrame(animate);
	}

	window.addEventListener("resize", resize);
	resize();
	requestAnimationFrame(animate);
}
