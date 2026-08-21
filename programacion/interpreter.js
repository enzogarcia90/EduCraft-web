const MAX_STEPS = 1000;

export class EduCraftInterpreter {
	constructor(handlers = {}) {
		this.handlers = handlers;
		this.cancelled = false;
		this.steps = 0;
	}

	stop() {
		this.cancelled = true;
	}

	async run(program) {
		this.cancelled = false;
		this.steps = 0;
		await this.executeList(Array.isArray(program) ? program : []);
		if (this.cancelled) throw new Error("Programa detenido");
		return { steps: this.steps };
	}

	async executeList(instructions) {
		for (const instruction of instructions) {
			this.guard();
			await this.execute(instruction || {});
		}
	}

	async execute(instruction) {
		this.steps++;
		switch (instruction.op) {
			case "say": return this.call("say", String(instruction.text || ""));
			case "move": return this.call("move", clampNumber(instruction.steps, -20, 20, 1));
			case "turn": return this.call("turn", clampNumber(instruction.degrees, -360, 360, 15));
			case "place": return this.call("place", String(instruction.material || "PIEDRA"));
			case "wait": return this.call("wait", clampNumber(instruction.seconds, 0, 10, 1));
			case "repeat": {
				const times = Math.floor(clampNumber(instruction.times, 0, 50, 1));
				for (let index = 0; index < times; index++) {
					this.guard();
					await this.executeList(instruction.body || []);
				}
				return;
			}
			case "if_path":
				if (await this.call("pathClear")) await this.executeList(instruction.body || []);
				return;
			default: throw new Error(`Instrucción desconocida: ${instruction.op || "vacía"}`);
		}
	}

	guard() {
		if (this.cancelled) throw new Error("Programa detenido");
		if (this.steps >= MAX_STEPS) throw new Error(`Límite de seguridad alcanzado (${MAX_STEPS} pasos)`);
	}

	async call(name, ...args) {
		this.guard();
		const handler = this.handlers[name];
		if (typeof handler === "function") return handler(...args);
	}
}

function clampNumber(value, min, max, fallback) {
	const number = Number(value);
	return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
