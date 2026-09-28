import { MCPManager } from "@oh-my-pi/pi-coding-agent/mcp/manager";
import type { MCPGetPromptResult } from "@oh-my-pi/pi-coding-agent/mcp/types";

type PromptRequest = MCPManager["executePrompt"];
type Installation = { original: PromptRequest; replacement: PromptRequest; users: number };
const installations = new WeakMap<MCPManager, Installation>();

/**
 * Keep the normal /server:prompt commands and the host's authenticated connection.
 * OMP drops empty argument objects; some servers require arguments even for
 * parameterless prompts. Empty responses must fail visibly, not consume the command.
 * Returns an idempotent release function for extension shutdown/reload.
 */
export function installMcpPromptRepair(manager: MCPManager): () => void {
	let installation = installations.get(manager);
	if (!installation) {
		const original = manager.executePrompt;
		const replacement: PromptRequest = async (server, name, args, options) => {
			const connection = manager.getConnection(server);
			if (!connection) throw new Error(`MCP server ${server} is not connected. Use /mcp reconnect ${server}.`);
			const result = await connection.transport.request<MCPGetPromptResult>(
				"prompts/get",
				{ name, arguments: args ?? {} },
				options,
			);
			const hasText = result?.messages?.some(message => {
				const content = Array.isArray(message.content) ? message.content : [message.content];
				return content.some(item =>
					item?.type === "text" ? item.text?.trim() :
					item?.type === "resource" && "text" in item.resource ? item.resource.text?.trim() : false,
				);
			});
			if (!hasText) {
				throw new Error(`MCP prompt ${server}:${name} returned no usable text: ${result?.description || "empty response"}`);
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
		if (manager.executePrompt === installation.replacement) manager.executePrompt = installation.original;
		installations.delete(manager);
	};
}
