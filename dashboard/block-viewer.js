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
			this.pointerId = null;
			this.lastPointer = [0, 0];
			this.sceneCenter = [0, 0, 0];
			this.sceneRadius = 12;
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
			this.onPointerDown = (event) => {
				this.dragging = true;
				this.pointerId = event.pointerId;
				this.lastPointer = [event.clientX, event.clientY];
				this.canvas.setPointerCapture(event.pointerId);
				this.canvas.focus();
			};
			this.onPointerMove = (event) => {
				if (!this.dragging || event.pointerId !== this.pointerId) return;
				this.yaw -= (event.clientX - this.lastPointer[0]) * .007;
				this.pitch = clamp(this.pitch + (event.clientY - this.lastPointer[1]) * .006, .08, 1.35);
				this.lastPointer = [event.clientX, event.clientY];
			};
			this.onPointerUp = (event) => {
				if (event.pointerId !== this.pointerId) return;
				this.dragging = false;
				this.pointerId = null;
			};
			this.onWheel = (event) => {
				event.preventDefault();
				this.distance = clamp(this.distance * Math.exp(event.deltaY * .0012), 3, Math.max(220, this.sceneRadius * 8));
			};
			this.canvas.addEventListener("keydown", this.onKeyDown);
			this.canvas.addEventListener("keyup", this.onKeyUp);
			this.canvas.addEventListener("pointerdown", this.onPointerDown);
			this.canvas.addEventListener("pointermove", this.onPointerMove);
			this.canvas.addEventListener("pointerup", this.onPointerUp);
			this.canvas.addEventListener("pointercancel", this.onPointerUp);
			this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
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
			this.target = this.sceneCenter.slice();
			this.distance = Math.max(8, this.sceneRadius * 2.35);
			this.yaw = .72;
			this.pitch = .58;
			this.canvas.focus();
		}

		setSnapshot(snapshot) {
			const server = snapshot?.servers?.[0];
			if (!server) return false;
			this.host.dataset.server = server.serverName || "paper";
			this.host.dataset.live = "true";
			if (!server.blocks?.length && !server.players?.length) {
				this.uploadBlocks([]);
				return true;
			}
			const focus = server.players?.[0] || server.blocks?.[0];
			const world = focus.world;
			const visibleBlocks = (server.blocks || []).filter((block) => block.world === world && !block.removed).slice(0, 24000);
			const points = visibleBlocks.concat((server.players || []).filter((player) => player.world === world));
			if (!points.length) {
				this.uploadBlocks([]);
				return true;
			}
			const bounds = boundsOf(points);
			const origin = [Math.floor((bounds.min[0] + bounds.max[0]) / 2), bounds.min[1], Math.floor((bounds.min[2] + bounds.max[2]) / 2)];
			const blocks = [];
			for (const block of visibleBlocks) {
				const position = [block.x-origin[0], block.y-origin[1], block.z-origin[2]];
				const appearance = materialAppearance(block.material);
				blocks.push({ position, color: appearance.color, texture: appearance.texture });
			}
			for (const player of server.players || []) {
				if (player.world !== world) continue;
				blocks.push({ position:[player.x-origin[0], player.y-origin[1], player.z-origin[2]], color:[.25,.5,1], texture:4 });
				blocks.push({ position:[player.x-origin[0], player.y-origin[1]+1, player.z-origin[2]], color:[1,.8,.3], texture:4 });
			}
			if (!blocks.length) {
				this.uploadBlocks([]);
				return true;
			}
			this.uploadBlocks(blocks);
			const localBounds = boundsOf(blocks.map((block) => ({ x: block.position[0], y: block.position[1], z: block.position[2] })));
			this.sceneCenter = localBounds.center;
			this.sceneRadius = Math.max(3, localBounds.radius);
			this.reset();
			return true;
		}

		uploadBlocks(blocks) {
			const gl = this.gl;
			gl.bindBuffer(gl.ARRAY_BUFFER, this.offsetBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flatMap((block) => block.position)), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.flatMap((block) => block.color)), gl.DYNAMIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.textureIndexBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(blocks.map((block) => block.texture || 0)), gl.DYNAMIC_DRAW);
			this.instanceCount = blocks.length;
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
			const speed = Math.max(3, this.distance * .38) * delta;
			const forward = [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
			const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
			if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) addScaled(this.target, forward, speed);
			if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) addScaled(this.target, forward, -speed);
			if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) addScaled(this.target, right, speed);
			if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) addScaled(this.target, right, -speed);
			if (this.keys.has("Space")) this.target[1] += speed;
			if (this.keys.has("ShiftLeft")) this.target[1] -= speed;
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
			const camera = orbitPosition(this.target, this.distance, this.yaw, this.pitch);
			gl.uniformMatrix4fv(this.projectionLocation, false, perspective(Math.PI / 3, this.canvas.width / this.canvas.height, .1, Math.max(240, this.distance + this.sceneRadius * 4)));
			gl.uniformMatrix4fv(this.viewLocation, false, lookAt(camera, this.target));
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
			this.canvas.removeEventListener("pointercancel", this.onPointerUp);
			this.canvas.removeEventListener("wheel", this.onWheel);
			this.gl.getExtension("WEBGL_lose_context")?.loseContext();
		}
	}

	function cubeGeometry() {
		const faces = [[0,0,1,[-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,.5,.5]],[0,0,-1,[.5,-.5,-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5]],[1,0,0,[.5,-.5,.5,.5,-.5,-.5,.5,.5,-.5,.5,-.5,.5,.5,.5,-.5,.5,.5,.5]],[-1,0,0,[-.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,-.5,-.5,-.5,.5,.5,-.5,.5,-.5]],[0,1,0,[-.5,.5,.5,.5,.5,.5,.5,.5,-.5,-.5,.5,.5,.5,.5,-.5,-.5,.5,-.5]],[0,-1,0,[-.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5]]];
		const faceUV = [0,1,1,1,1,0,0,1,1,0,0,0];
		return { positions: faces.flatMap((face) => face[3]), normals: faces.flatMap((face) => Array(6).fill(face.slice(0, 3)).flat()), uvs: faces.flatMap(() => faceUV) };
	}

	function attribute(gl, program, name, data, size, divisor) { const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(location, divisor); return buffer; }
	function materialAppearance(material) {
		const value=(material||"").toUpperCase();
		if(value.includes("GRASS")||value.includes("LEAVES"))return {texture:0,color:[.72,1,.68]};
		if(value.includes("DIRT"))return {texture:1,color:[.95,.83,.7]};
		if(value.includes("COBBLE"))return {texture:3,color:[.9,.9,.9]};
		if(value.includes("STONE")||value.includes("ORE"))return {texture:2,color:value.includes("ORE")?[1,.9,.62]:[.92,.94,.96]};
		if(value.includes("WOOD")||value.includes("LOG")||value.includes("PLANK"))return {texture:4,color:[1,.9,.72]};
		if(value.includes("GLASS"))return {texture:5,color:[.72,.94,1]};
		if(value.includes("WATER"))return {texture:6,color:[.55,.78,1]};
		if(value.includes("SAND"))return {texture:7,color:[1,.95,.7]};
		if(value.includes("BRICK"))return {texture:3,color:[1,.48,.38]};
		if(value.includes("WOOL"))return {texture:4,color:[.95,.95,.95]};
		return {texture:2,color:[.82,.86,.9]};
	}
	function shader(gl, type, source) { const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value)); return value; }
	function createProgram(gl, vertex, fragment) { const program = gl.createProgram(); gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)); return program; }
	function perspective(fov, aspect, near, far) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far); return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]); }
	function orbitPosition(target, distance, yaw, pitch) { const cp=Math.cos(pitch); return [target[0]+Math.sin(yaw)*cp*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*cp*distance]; }
	function lookAt(eye, target) { const f=normalize([target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]]), r=normalize(cross(f,[0,1,0])), u=cross(r,f); return new Float32Array([r[0],u[0],-f[0],0,r[1],u[1],-f[1],0,r[2],u[2],-f[2],0,-dot(r,eye),-dot(u,eye),dot(f,eye),1]); }
	function boundsOf(points) { const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity]; for(const point of points){const values=[Number(point.x),Number(point.y),Number(point.z)]; for(let i=0;i<3;i++){if(!Number.isFinite(values[i]))continue;min[i]=Math.min(min[i],values[i]);max[i]=Math.max(max[i],values[i]);}} for(let i=0;i<3;i++){if(!Number.isFinite(min[i]))min[i]=max[i]=0;} const center=min.map((value,i)=>(value+max[i])/2),radius=Math.hypot(max[0]-min[0],max[1]-min[1],max[2]-min[2])/2+.9; return {min,max,center,radius}; }
	function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
	function normalize(value) { const length=Math.hypot(value[0],value[1],value[2])||1; return value.map((item)=>item/length); }
	function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
	function addScaled(a,b,s) { a[0]+=b[0]*s; a[1]+=b[1]*s; a[2]+=b[2]*s; }
	function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }

	window.EduCraftBlockViewer = EduCraftBlockViewer;
})();
