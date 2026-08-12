(function () {
	"use strict";

	const vertexSource = `#version 300 es
		in vec3 aPosition;
		in vec3 aNormal;
		in vec2 aTexCoord;
		in vec3 aOffset;
		in vec3 aColor;
		in float aTexture;
		uniform mat4 uProjection;
		uniform mat4 uView;
		out vec3 vColor;
		out float vLight;
		out vec2 vUV;
		flat out int vTexture;
		void main() {
			vec3 world = aPosition + aOffset;
			gl_Position = uProjection * uView * vec4(world, 1.0);
			vColor = aColor;
			vUV = aTexCoord;
			vTexture = int(aTexture + .5);
			vLight = 0.48 + max(dot(normalize(aNormal), normalize(vec3(.4, 1., .25))), 0.0) * .52;
		}`;
	const fragmentSource = `#version 300 es
		precision mediump float;
		precision highp sampler2DArray;
		in vec3 vColor;
		in float vLight;
		in vec2 vUV;
		flat in int vTexture;
		uniform sampler2DArray uTextures;
		out vec4 outColor;
		void main() { vec4 texel = texture(uTextures, vec3(vUV, float(vTexture))); if (texel.a < .12) discard; outColor = vec4(texel.rgb * vColor * vLight, texel.a); }`;
	const textureFiles = ["grass_top", "dirt", "stone", "cobblestone", "planks_oak", "glass", "water_still", "sand"];

	class EduCraftBlockViewer {
		constructor(host) {
			this.host = host;
			this.canvas = document.createElement("canvas");
			this.canvas.className = "block-viewer-canvas";
			this.canvas.tabIndex = 0;
			host.replaceChildren(this.canvas);
			this.gl = this.canvas.getContext("webgl2", { antialias: true, alpha: true, powerPreference: "high-performance" });
			if (!this.gl) throw new Error("WebGL 2 unavailable");
			this.gl.clearColor(0, 0, 0, 0);
			this.gl.clear(this.gl.COLOR_BUFFER_BIT);
			this.keys = new Set();
			this.dragging = false;
			this.lastPointer = [0, 0];
			this.resizeObserver = new ResizeObserver(() => this.resize());
			this.resizeObserver.observe(host);
			this.bindEvents();
			this.initScene();
			this.reset();
			this.lastFrame = performance.now();
			this.frame = requestAnimationFrame((time) => this.render(time));
		}

		bindEvents() {
			this.onKeyDown = (event) => {
				if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft"].includes(event.code)) {
					event.preventDefault();
					this.keys.add(event.code);
				}
			};
			this.onKeyUp = (event) => this.keys.delete(event.code);
			this.onPointerDown = (event) => { this.dragging = true; this.lastPointer = [event.clientX, event.clientY]; this.canvas.setPointerCapture(event.pointerId); };
			this.onPointerMove = (event) => {
				if (!this.dragging) return;
				this.yaw -= (event.clientX - this.lastPointer[0]) * .005;
				this.pitch = clamp(this.pitch - (event.clientY - this.lastPointer[1]) * .005, -.95, .95);
				this.lastPointer = [event.clientX, event.clientY];
			};
			this.onPointerUp = () => { this.dragging = false; };
			this.canvas.addEventListener("keydown", this.onKeyDown);
			this.canvas.addEventListener("keyup", this.onKeyUp);
			this.canvas.addEventListener("pointerdown", this.onPointerDown);
			this.canvas.addEventListener("pointermove", this.onPointerMove);
			this.canvas.addEventListener("pointerup", this.onPointerUp);
		}

		initScene() {
			const gl = this.gl;
			this.program = createProgram(gl, vertexSource, fragmentSource);
			const cube = cubeGeometry();
			const blocks = [];
			this.instanceCount = blocks.length;
			this.vao = gl.createVertexArray();
			gl.bindVertexArray(this.vao);
			attribute(gl, this.program, "aPosition", cube.positions, 3, 0);
			attribute(gl, this.program, "aNormal", cube.normals, 3, 0);
			attribute(gl, this.program, "aTexCoord", cube.uvs, 2, 0);
			this.offsetBuffer = attribute(gl, this.program, "aOffset", blocks.flatMap((block) => block.position), 3, 1);
			this.colorBuffer = attribute(gl, this.program, "aColor", blocks.flatMap((block) => block.color), 3, 1);
			this.textureIndexBuffer = attribute(gl, this.program, "aTexture", blocks.map((block) => block.texture || 0), 1, 1);
			this.projectionLocation = gl.getUniformLocation(this.program, "uProjection");
			this.viewLocation = gl.getUniformLocation(this.program, "uView");
			this.initTextures();
			gl.enable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.clearColor(0, 0, 0, 0);
		}

		initTextures() {
			const gl = this.gl;
			this.textureArray = gl.createTexture();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);
			gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 16, 16, textureFiles.length);
			gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
			const fallback = new Uint8Array(16 * 16 * 4).fill(255);
			for (let layer = 0; layer < textureFiles.length; layer++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 16, 16, 1, gl.RGBA, gl.UNSIGNED_BYTE, fallback);
			textureFiles.forEach((name, layer) => {
				const image = new Image();
				image.onload = () => {
					const canvas = document.createElement("canvas"); canvas.width = 16; canvas.height = 16;
					const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, 16, 16, 0, 0, 16, 16);
					gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);
					gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 16, 16, 1, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
				};
				image.src = `textures/blocks/${name}.png`;
			});
			gl.useProgram(this.program);
			gl.uniform1i(gl.getUniformLocation(this.program, "uTextures"), 0);
		}

		reset() {
			this.position = [10, 8, 14];
			this.yaw = -.62;
			this.pitch = -.28;
			this.canvas.focus();
		}

		setSnapshot(snapshot) {
			const server = snapshot?.servers?.[0];
			if (!server) return false;
			this.host.dataset.server = server.serverName || "paper";
			this.host.dataset.live = "true";
			if (!server.blocks?.length && !server.players?.length) return true;
			const focus = server.players?.[0] || server.blocks?.[0];
			const world = focus.world;
			const origin = [Math.floor(focus.x || 0), Math.floor(focus.y || 0), Math.floor(focus.z || 0)];
			const blocks = [];
			for (const block of server.blocks || []) {
				if (block.world !== world || block.removed || blocks.length >= 24000) continue;
				const position = [block.x-origin[0], block.y-origin[1], block.z-origin[2]];
				if (Math.abs(position[0]) > 64 || Math.abs(position[1]) > 40 || Math.abs(position[2]) > 64) continue;
				blocks.push({ position, color: [1,1,1], texture: materialTexture(block.material) });
			}
			for (const player of server.players || []) {
				if (player.world !== world) continue;
				blocks.push({ position:[player.x-origin[0], player.y-origin[1], player.z-origin[2]], color:[.25,.5,1], texture:4 });
				blocks.push({ position:[player.x-origin[0], player.y-origin[1]+1, player.z-origin[2]], color:[1,.8,.3], texture:4 });
			}
			if (!blocks.length) return true;
			const gl = this.gl;
			gl.bindBuffer(gl.ARRAY_BUFFER, this.offsetBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flatMap((block) => block.position)), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flatMap((block) => block.color)), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.textureIndexBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.map((block) => block.texture || 0)), gl.DYNAMIC_DRAW);
			this.instanceCount = blocks.length;
			this.position = [10, 8, 14];
			return true;
		}

		resize() {
			const ratio = Math.min(devicePixelRatio || 1, 2);
			const width = Math.max(1, Math.floor(this.host.clientWidth * ratio));
			const height = Math.max(1, Math.floor(this.host.clientHeight * ratio));
			if (this.canvas.width !== width || this.canvas.height !== height) {
				this.canvas.width = width;
				this.canvas.height = height;
			}
		}

		update(delta) {
			const speed = 7 * delta;
			const forward = [Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
			const right = [Math.cos(this.yaw), 0, Math.sin(this.yaw)];
			if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) addScaled(this.position, forward, speed);
			if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) addScaled(this.position, forward, -speed);
			if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) addScaled(this.position, right, speed);
			if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) addScaled(this.position, right, -speed);
			if (this.keys.has("Space")) this.position[1] += speed;
			if (this.keys.has("ShiftLeft")) this.position[1] -= speed;
		}

		render(time) {
			const gl = this.gl;
			this.resize();
			this.update(Math.min((time - this.lastFrame) / 1000, .05));
			this.lastFrame = time;
			gl.viewport(0, 0, this.canvas.width, this.canvas.height);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			gl.useProgram(this.program);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.textureArray);
			gl.bindVertexArray(this.vao);
			gl.uniformMatrix4fv(this.projectionLocation, false, perspective(Math.PI / 3, this.canvas.width / this.canvas.height, .1, 160));
			gl.uniformMatrix4fv(this.viewLocation, false, viewMatrix(this.position, this.yaw, this.pitch));
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.instanceCount);
			this.frame = requestAnimationFrame((next) => this.render(next));
		}

		destroy() {
			cancelAnimationFrame(this.frame);
			this.resizeObserver.disconnect();
			this.canvas.removeEventListener("keydown", this.onKeyDown);
			this.canvas.removeEventListener("keyup", this.onKeyUp);
			this.canvas.removeEventListener("pointerdown", this.onPointerDown);
			this.canvas.removeEventListener("pointermove", this.onPointerMove);
			this.canvas.removeEventListener("pointerup", this.onPointerUp);
			this.gl.getExtension("WEBGL_lose_context")?.loseContext();
		}
	}

	function cubeGeometry() {
		const faces = [[0,0,1,[-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,.5,.5]],[0,0,-1,[.5,-.5,-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5]],[1,0,0,[.5,-.5,.5,.5,-.5,-.5,.5,.5,-.5,.5,-.5,.5,.5,.5,-.5,.5,.5,.5]],[-1,0,0,[-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,-.5,-.5,-.5,.5,.5,-.5,.5,-.5]],[0,1,0,[-.5,.5,.5,.5,.5,.5,.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,-.5]],[0,-1,0,[-.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5]]];
		const faceUV = [0,1,1,1,1,0,0,1,1,0,0,0];
		return { positions: faces.flatMap((face) => face[3]), normals: faces.flatMap((face) => Array(6).fill(face.slice(0, 3)).flat()), uvs: faces.flatMap(() => faceUV) };
	}

	function attribute(gl, program, name, data, size, divisor) { const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(location, divisor); return buffer; }
	function materialTexture(material) { const value=(material||"").toUpperCase(); if(value.includes("GRASS")||value.includes("LEAVES"))return 0; if(value.includes("DIRT"))return 1; if(value.includes("COBBLE"))return 3; if(value.includes("STONE")||value.includes("ORE"))return 2; if(value.includes("WOOD")||value.includes("LOG")||value.includes("PLANK"))return 4; if(value.includes("GLASS"))return 5; if(value.includes("WATER"))return 6; if(value.includes("SAND"))return 7; return 2; }
	function shader(gl, type, source) { const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value)); return value; }
	function createProgram(gl, vertex, fragment) { const program = gl.createProgram(); gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)); return program; }
	function perspective(fov, aspect, near, far) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]); }
	function viewMatrix(position, yaw, pitch) { const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch); const f=[sy*cp,sp,-cy*cp], r=[cy,0,sy], u=[-sy*sp,cp,cy*sp]; return new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,position),-dot(u,position),dot(f,position),1]); }
	function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
	function addScaled(a,b,s) { a[0]+=b[0]*s; a[1]+=b[1]*s; a[2]+=b[2]*s; }
	function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }

	window.EduCraftBlockViewer = EduCraftBlockViewer;
})();
