import { MCPManager } from "@oh-my-pi/pi-coding-agent/mcp/manager";
import type { MCPGetPromptResult, MCPPromptContent } from "@oh-my-pi/pi-coding-agent/mcp/types";

type PromptRequest = MCPManager["executePrompt"];
type Installation = { original: PromptRequest; replacement: PromptRequest; users: number };
const installations = new WeakMap<MCPManager, Installation>();

/**
 * Keep the normal /server:prompt commands working through the host's own executePrompt, which
 * owns the connection, timeout, reconnect, and auth-refresh behaviour. The host omits
 * `arguments` when it is empty, and some servers reject prompts/get without one, so calls that
 * carry no arguments go straight to the transport with an explicit empty object instead.
 *
 * A prompt whose content the command cannot render (images or audio only) says so in text,
 * because the command drops non-text content and would otherwise return an empty result; a
 * response with no content at all fails visibly rather than consuming the command.
 *
 * Returns an idempotent release function for extension shutdown/reload.
 */
export function installMcpPromptRepair(manager: MCPManager): () => void {
	let installation = installations.get(manager);
	if (!installation) {
		const original = manager.executePrompt;
		const replacement: PromptRequest = async (server, name, args, options) => {
			if (args && Object.keys(args).length > 0) return original.call(manager, server, name, args, options);
			const connection = manager.getConnection(server);
			if (!connection) throw new Error(`MCP server ${server} is not connected. Use /mcp reconnect ${server}.`);
			const result = await connection.transport.request<MCPGetPromptResult>(
				"prompts/get",
				{ name, arguments: args ?? {} },
				options,
			);
			const content = (result?.messages ?? []).flatMap(message =>
				Array.isArray(message.content) ? message.content : [message.content]);
			const hasText = content.some(item =>
				item.type === "text" ? Boolean(item.text?.trim()) :
				item.type === "resource" && "text" in item.resource ? Boolean(item.resource.text?.trim()) : false);
			if (!hasText) {
				if (content.length === 0) {
					throw new Error(`MCP prompt ${server}:${name} returned no usable text: ${result?.description || "empty response"}`);
				}
				const kinds = [...new Set(content.map(item => item.type))].join("/");
				const note: MCPPromptContent = { type: "text", text: `[${kinds} content omitted]` };
				return { ...result, messages: [...result.messages, { role: "user", content: note }] };
			}
			return result;
		};
		installation = { original, replacement, users: 0 };
		installations.set(manager, installation);
		manager.executePrompt = replacement;
	}
	installation.users++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--installation.users !== 0) return;
		// A patch installed after this one sits on top of the chain: leave it (and this record)
		// in place, so a later release still restores the host function underneath it.
		if (manager.executePrompt !== installation.replacement) return;
		manager.executePrompt = installation.original;
		installations.delete(manager);
	};
}
