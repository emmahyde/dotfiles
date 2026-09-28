import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Server } from "bun";
import { MCPManager } from "@oh-my-pi/pi-coding-agent/mcp/manager";
import { installMcpPromptRepair } from "../lib/mcp-prompts";

let server: Server<undefined>;
let manager: MCPManager;
let release: (() => void) | undefined;
let lastArguments: unknown;

beforeEach(async () => {
	lastArguments = undefined;
	server = Bun.serve({
		hostname: "127.0.0.1", port: 0,
		async fetch(request) {
			if (request.method !== "POST") return new Response(null, { status: 405 });
			const message = await request.json();
			if (!Object.hasOwn(message, "id")) return new Response(null, { status: 202 });
			let result;
			switch (message.method) {
				case "initialize":
					result = { protocolVersion: "2024-11-05", capabilities: { tools: {}, prompts: {} }, serverInfo: { name: "prompt-protocol-fixture", version: "1" } }; break;
				case "tools/list": result = { tools: [] }; break;
				case "prompts/list": result = { prompts: [{ name: "no-args" }, { name: "topic" }, { name: "empty" }] }; break;
				case "prompts/get":
					lastArguments = message.params.arguments;
					if (!Object.hasOwn(message.params, "arguments")) result = { description: "Request.Params.Arguments is null", messages: [] };
					else if (message.params.name === "empty") result = { description: "Response data is null", messages: [] };
					else result = { messages: [{ role: "user", content: { type: "text", text: message.params.name === "topic" ? `Discuss ${message.params.arguments.subject}.` : "Draw surface normals." } }] };
					break;
				default: return Response.json({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Unknown method" } });
			}
			return Response.json({ jsonrpc: "2.0", id: message.id, result });
		},
	});
	manager = new MCPManager(process.cwd());
	await manager.connectServers({ fixture: { type: "http", url: `http://127.0.0.1:${server.port}/mcp` } }, {}, undefined, 0);
});

afterEach(async () => {
	release?.(); release = undefined;
	await manager.disconnectAll();
	server.stop(true);
});

test("parameterless prompts include an empty argument object on the wire", async () => {
	const before = await manager.executePrompt("fixture", "no-args", {});
	expect(before?.description).toBe("Request.Params.Arguments is null");
	release = installMcpPromptRepair(manager);
	const result = await manager.executePrompt("fixture", "no-args");
	expect(lastArguments).toEqual({});
	expect(result?.messages).toEqual([{ role: "user", content: { type: "text", text: "Draw surface normals." } }]);
});

test("prompt arguments keep spaces, line breaks and equals signs", async () => {
	release = installMcpPromptRepair(manager);
	const args = { subject: "surface normals\nscale=2" };
	const result = await manager.executePrompt("fixture", "topic", args);
	expect(lastArguments).toEqual(args);
	expect(result?.messages[0].content).toEqual({ type: "text", text: "Discuss surface normals\nscale=2." });
});

test("an empty server response surfaces its explanation instead of consuming the command", async () => {
	release = installMcpPromptRepair(manager);
	await expect(manager.executePrompt("fixture", "empty")).rejects.toThrow("MCP prompt fixture:empty returned no usable text: Response data is null");
});

test("one session releasing the repair does not break another session; the last release restores the host", async () => {
	const original = manager.executePrompt;
	const first = installMcpPromptRepair(manager);
	release = installMcpPromptRepair(manager);
	first(); first();
	expect((await manager.executePrompt("fixture", "no-args"))?.messages[0].content).toEqual({ type: "text", text: "Draw surface normals." });
	release();
	expect(manager.executePrompt).toBe(original);
	expect((await manager.executePrompt("fixture", "no-args"))?.description).toBe("Request.Params.Arguments is null");
});

test("a disconnected server fails explicitly", async () => {
	release = installMcpPromptRepair(manager);
	await manager.disconnectServer("fixture");
	await expect(manager.executePrompt("fixture", "no-args")).rejects.toThrow("MCP server fixture is not connected");
});
