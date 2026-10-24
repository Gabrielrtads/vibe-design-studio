#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════
 * CAPCUT NATIVE REMOTE CONTROL MCP SERVER (`capcut-native-mcp`)
 * ════════════════════════════════════════════════════════════════════════════
 * Servidor MCP Zero-Dependency (JSON-RPC 2.0 sobre stdio) que permite aos
 * agentes de IA (Claude Code, Antigravity, Codex, Cursor) pilotarem o
 * CapCut Desktop nativamente através de duas camadas:
 *
 * 1. Camada IPC Ao Vivo (`\\.\pipe\vecreator-lyra-cli-v1-capcut`):
 *    - Controle de Player (Play / Pause / Foco / Troca de aba)
 *    - Shadow Drafts invisíveis (`draft shadow create --from current`)
 *    - Inserção na Timeline ao vivo (`timeline add-draft` com append/ripple)
 *
 * 2. Camada Direta de Projeto (`draft_content.json` v360000):
 *    - Auto-Cut gratuito de silêncios (sem precisar de CapCut Pro)
 *    - Auto-Legendas gratuitas via Whisper (textos livres de flag VIP)
 *    - Raio-X e criação instantânea de rascunhos.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {
	buildCapcutDraftContent,
	buildFreeSubtitlesTrack,
	buildRoughCutSegments,
	sanitizeDraftForFreeExport,
} from '../integrations/capcut/capcutExporter.ts';
import {
	resolveDefaultCapcutDraftRoot,
	saveCapcutDraftToDisk,
} from '../integrations/capcut/capcutDraftDisk.mjs';

const CAPCUT_PIPE_WIN32 = '\\\\.\\pipe\\vecreator-lyra-cli-v1-capcut';

export const CAPCUT_MCP_TOOLS = [
	{
		name: 'capcut_list_projects',
		description:
			'Lista todos os projetos (rascunhos) salvos localmente no CapCut Desktop do usuário, retornando ID, nome, duração e caminho.',
		inputSchema: {
			type: 'object',
			properties: {
				draftRootDir: {
					type: 'string',
					description: 'Diretório opcional de rascunhos do CapCut (usa o padrão do sistema se omitido).',
				},
			},
		},
	},
	{
		name: 'capcut_inspect_draft',
		description:
			'Inspeciona a estrutura interna de um projeto do CapCut (draft_content.json), retornando resolução, duração, quantidade de cortes de vídeo, faixas de áudio e legendas.',
		inputSchema: {
			type: 'object',
			properties: {
				draftId: {
					type: 'string',
					description: 'ID da pasta do projeto no CapCut.',
				},
				draftRootDir: {
					type: 'string',
					description: 'Diretório raiz opcional dos drafts.',
				},
			},
			required: ['draftId'],
		},
	},
	{
		name: 'capcut_create_project',
		description:
			'Cria um projeto completo no CapCut Desktop já montado com vídeos fatiados (corte automático de silêncios gratuito), áudios e legendas sincronizadas livres de cadeado Pro.',
		inputSchema: {
			type: 'object',
			properties: {
				draftId: { type: 'string', description: 'Identificador único da pasta do rascunho.' },
				name: { type: 'string', description: 'Nome visível do projeto no CapCut.' },
				width: { type: 'number', description: 'Largura do vídeo (padrão 1080).' },
				height: { type: 'number', description: 'Altura do vídeo (padrão 1920).' },
				fps: { type: 'number', description: 'Taxa de quadros (padrão 30).' },
				videoClips: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							path: { type: 'string' },
							durationSec: { type: 'number' },
							speechRanges: {
								type: 'array',
								items: {
									type: 'object',
									properties: {
										startSec: { type: 'number' },
										endSec: { type: 'number' },
									},
									required: ['startSec', 'endSec'],
								},
							},
						},
						required: ['path'],
					},
				},
				captions: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							text: { type: 'string' },
							startSec: { type: 'number' },
							endSec: { type: 'number' },
							color: { type: 'string' },
						},
						required: ['text', 'startSec', 'endSec'],
					},
				},
			},
			required: ['draftId', 'name', 'videoClips'],
		},
	},
	{
		name: 'capcut_auto_rough_cut',
		description:
			'Aplica corte automático de silêncios (Ripple Cut) e injeta legendas gratuitas em um projeto existente do CapCut, preservando backup automático (.bak).',
		inputSchema: {
			type: 'object',
			properties: {
				draftId: { type: 'string', description: 'ID do projeto existente no CapCut.' },
				speechRanges: {
					type: 'array',
					description: 'Intervalos de fala em segundos a manter na faixa principal.',
					items: {
						type: 'object',
						properties: {
							startSec: { type: 'number' },
							endSec: { type: 'number' },
						},
						required: ['startSec', 'endSec'],
					},
				},
				captions: {
					type: 'array',
					description: 'Legendas opcionais para inserir gratuitamente na timeline.',
					items: {
						type: 'object',
						properties: {
							text: { type: 'string' },
							startSec: { type: 'number' },
							endSec: { type: 'number' },
							color: { type: 'string' },
						},
						required: ['text', 'startSec', 'endSec'],
					},
				},
			},
			required: ['draftId', 'speechRanges'],
		},
	},
	{
		name: 'capcut_live_control',
		description:
			'Envia comandos em tempo real para o CapCut Desktop aberto na tela através do Named Pipe oficial (lyra-cli-ipc): play, pause, focus, duplicate, shadow_create ou workspace_switch.',
		inputSchema: {
			type: 'object',
			properties: {
				action: {
					type: 'string',
					enum: ['play', 'pause', 'list', 'focus', 'duplicate', 'shadow_create', 'workspace_status', 'workspace_switch'],
					description: 'Ação ao vivo a executar na instância aberta do CapCut.',
				},
				draftId: {
					type: 'string',
					description: 'ID do rascunho ou shadow:<id> quando aplicável.',
				},
				tab: {
					type: 'string',
					enum: ['preview', 'canvas', 'timeline'],
					description: 'Aba alvo quando action = workspace_switch.',
				},
				previewDraft: {
					type: 'boolean',
					description: 'Se verdadeiro, abre o preview nativo no CapCut após a ação.',
				},
			},
			required: ['action'],
		},
	},
	{
		name: 'capcut_timeline_add_draft',
		description:
			'Insere um ativo ou sub-rascunho diretamente na linha do tempo focada do CapCut aberto usando lyra-cli-ipc timeline add-draft (suporta append, ripple e dry-run).',
		inputSchema: {
			type: 'object',
			properties: {
				assetId: { type: 'string', description: 'UUID do ativo no projeto.' },
				placement: { type: 'string', enum: ['append', 'at'], description: 'Modo de inserção (padrão append).' },
				positionUs: { type: 'integer', description: 'Posição em microssegundos quando placement = at.' },
				collision: { type: 'string', enum: ['ripple', 'overwrite'], description: 'Política de colisão (padrão ripple).' },
				dryRun: { type: 'boolean', description: 'Valida sem modificar a timeline (padrão true para segurança).' },
			},
			required: ['assetId'],
		},
	},
	{
		name: 'capcut_unlock_free_export',
		description:
			'Limpa travas e marcações VIP/Pro (pre_applied_vip_materials, enable_color_adjust_pro, function_assistant_info e purchase_info) de um projeto existente do CapCut para permitir exportação 100% gratuita sem cadeado Pro.',
		inputSchema: {
			type: 'object',
			properties: {
				draftId: {
					type: 'string',
					description: 'ID da pasta do projeto no CapCut (ex: 1017 ou Vibe_Kage_Bunshin_IA).',
				},
				draftRootDir: {
					type: 'string',
					description: 'Diretório raiz opcional dos drafts.',
				},
			},
			required: ['draftId'],
		},
	},
];

/**
 * Envia um frame JSON-RPC sobre o Named Pipe nativo do CapCut (`vecreator-lyra-cli-v1-capcut`).
 */
export function sendLyraIpcRequest(payload, endpoint = process.env.CAPCUT_IPC_ENDPOINT || CAPCUT_PIPE_WIN32, timeoutMs = 4000) {
	return new Promise((resolve) => {
		const client = net.createConnection(endpoint);
		let buffer = '';
		let settled = false;

		const finish = (res) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			client.destroy();
			resolve(res);
		};

		const timer = setTimeout(() => {
			finish({
				ok: false,
				code: 'ipc_socket_timeout',
				message: 'Timeout aguardando resposta do Named Pipe do CapCut Desktop.',
			});
		}, timeoutMs);

		client.once('connect', () => {
			client.write(`${JSON.stringify(payload)}\n`);
		});

		client.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			const nl = buffer.indexOf('\n');
			if (nl >= 0) {
				const raw = buffer.slice(0, nl).trim();
				try {
					finish({ ok: true, response: JSON.parse(raw) });
				} catch {
					finish({ ok: false, code: 'invalid_json', raw });
				}
			}
		});

		client.on('error', (err) => {
			finish({
				ok: false,
				code: 'capcut_not_running_or_pipe_closed',
				message: `CapCut IPC pipe indisponível (${err.message}). Você pode usar capcut_create_project e capcut_auto_rough_cut diretamente nos arquivos de projeto mesmo com o CapCut fechado.`,
			});
		});
	});
}

async function handleToolCall(name, args = {}) {
	const rootDir = args.draftRootDir ? path.resolve(args.draftRootDir) : resolveDefaultCapcutDraftRoot();

	if (name === 'capcut_list_projects') {
		if (!fs.existsSync(rootDir)) {
			return { ok: true, draftRootDir: rootDir, projects: [] };
		}
		const entries = fs.readdirSync(rootDir, { withFileTypes: true });
		const projects = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const folder = path.join(rootDir, entry.name);
			const contentPath = path.join(folder, 'draft_content.json');
			const metaPath = path.join(folder, 'draft_meta_info.json');
			if (!fs.existsSync(contentPath)) continue;

			let draftName = entry.name;
			let durationUs = 0;
			try {
				if (fs.existsSync(metaPath)) {
					const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
					draftName = meta.draft_name || draftName;
					durationUs = meta.tm_duration || 0;
				}
			} catch {
				// fallback silencioso
			}
			projects.push({
				draftId: entry.name,
				name: draftName,
				durationSeconds: Number((durationUs / 1_000_000).toFixed(2)),
				folder,
			});
		}
		return { ok: true, draftRootDir: rootDir, projects };
	}

	if (name === 'capcut_inspect_draft') {
		const safeId = String(args.draftId || '').replace(/[^A-Za-z0-9_-]/g, '_');
		const contentPath = path.join(rootDir, safeId, 'draft_content.json');
		if (!fs.existsSync(contentPath)) {
			throw new Error(`Projeto CapCut não encontrado: ${safeId}`);
		}
		const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
		const tracks = Array.isArray(content.tracks) ? content.tracks : [];
		const videoTrack = tracks.find((t) => t.type === 'video');
		const textTrack = tracks.find((t) => t.type === 'text');
		const audioTrack = tracks.find((t) => t.type === 'audio');

		return {
			ok: true,
			draftId: safeId,
			version: content.version,
			newVersion: content.new_version,
			canvas: content.canvas_config,
			durationSeconds: Number(((content.duration || 0) / 1_000_000).toFixed(2)),
			tracksCount: tracks.length,
			videoSegmentsCount: videoTrack?.segments?.length ?? 0,
			subtitleSegmentsCount: textTrack?.segments?.length ?? 0,
			audioSegmentsCount: audioTrack?.segments?.length ?? 0,
			videoMaterialsCount: content.materials?.videos?.length ?? 0,
		};
	}

	if (name === 'capcut_create_project') {
		const draft = buildCapcutDraftContent({
			name: args.name,
			width: args.width,
			height: args.height,
			fps: args.fps,
			videoClips: args.videoClips || [],
			audioClips: args.audioClips || [],
			captions: args.captions || [],
		});
		const saved = saveCapcutDraftToDisk({
			draftRootDir: rootDir,
			draftId: args.draftId,
			draftName: args.name,
			content: draft,
		});
		return {
			ok: true,
			draftId: saved.draftId,
			draftFolder: saved.draftFolder,
			contentPath: saved.contentPath,
			durationSeconds: Number(((draft.duration || 0) / 1_000_000).toFixed(2)),
		};
	}

	if (name === 'capcut_auto_rough_cut') {
		const safeId = String(args.draftId || '').replace(/[^A-Za-z0-9_-]/g, '_');
		const contentPath = path.join(rootDir, safeId, 'draft_content.json');
		if (!fs.existsSync(contentPath)) {
			throw new Error(`Projeto CapCut não encontrado para auto-cut: ${safeId}`);
		}
		const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
		const firstVideoMat = content.materials?.videos?.[0];
		if (!firstVideoMat) {
			throw new Error(`Projeto ${safeId} não possui material de vídeo para fatiar.`);
		}

		const cut = buildRoughCutSegments({
			materialId: firstVideoMat.id,
			speechRanges: args.speechRanges || [],
		});

		const videoTrack = content.tracks?.find((t) => t.type === 'video');
		if (videoTrack) {
			videoTrack.segments = cut.segments;
		}
		content.duration = cut.totalDurationUs;

		if (Array.isArray(args.captions) && args.captions.length > 0) {
			const sub = buildFreeSubtitlesTrack(args.captions);
			content.materials.texts = [...(content.materials.texts || []), ...sub.materials];
			content.tracks = [...(content.tracks || []).filter((t) => t.type !== 'text'), sub.track];
		}

		const saved = saveCapcutDraftToDisk({
			draftRootDir: rootDir,
			draftId: safeId,
			draftName: content.name || safeId,
			content,
		});

		return {
			ok: true,
			draftId: safeId,
			segmentsCreated: cut.segments.length,
			newDurationSeconds: Number((cut.totalDurationUs / 1_000_000).toFixed(2)),
			backupPath: saved.backupPath,
		};
	}

	if (name === 'capcut_live_control') {
		const action = args.action;
		let requestFrame;

		if (action === 'workspace_status') {
			requestFrame = {
				version: 2,
				requestId: `req-${crypto.randomUUID()}`,
				argv: ['workspace', 'status', '--output', 'json'],
				queueTimeoutMs: 15000,
			};
		} else if (action === 'workspace_switch') {
			requestFrame = {
				version: 2,
				requestId: `req-${crypto.randomUUID()}`,
				argv: ['workspace', 'switch', '--tab', args.tab || 'timeline', '--output', 'json'],
				queueTimeoutMs: 15000,
			};
		} else if (action === 'shadow_create') {
			requestFrame = {
				version: 1,
				requestId: `req-${crypto.randomUUID()}`,
				argv: [],
				commonAgentShadowDraft: true,
				commonAgentDraftAction: 'create',
				commonAgentCreateDraft: true,
				commonAgentDraftName: args.draftId || 'vibe-shadow-draft',
				commonAgentSourceDraftId: 'current',
				previewDraft: Boolean(args.previewDraft),
				queueTimeoutMs: 15000,
			};
		} else {
			requestFrame = {
				version: 1,
				requestId: `req-${crypto.randomUUID()}`,
				argv: [],
				commonAgentDraftAction: action,
				draftId: args.draftId,
				previewDraft: Boolean(args.previewDraft),
				queueTimeoutMs: 15000,
			};
		}

		return await sendLyraIpcRequest(requestFrame);
	}

	if (name === 'capcut_timeline_add_draft') {
		const argv = ['timeline', 'add-draft', '--asset-id', args.assetId, '--output', 'json'];
		if (args.placement) argv.push('--placement', args.placement);
		if (args.positionUs !== undefined) argv.push('--position-us', String(args.positionUs));
		if (args.collision) argv.push('--collision', args.collision);
		if (args.dryRun !== false) argv.push('--dry-run');

		return await sendLyraIpcRequest({
			version: 2,
			requestId: `req-${crypto.randomUUID()}`,
			argv,
			queueTimeoutMs: 15000,
		});
	}

	if (name === 'capcut_unlock_free_export') {
		const safeId = String(args.draftId || '').replace(/[^A-Za-z0-9_-]/g, '_');
		const draftFolder = path.join(rootDir, safeId);
		const contentPath = path.join(draftFolder, 'draft_content.json');
		const metaPath = path.join(draftFolder, 'draft_meta_info.json');
		if (!fs.existsSync(contentPath)) {
			throw new Error(`Projeto CapCut não encontrado para destravamento Pro: ${safeId}`);
		}

		// Backup seguro antes de limpar flags VIP
		const backupPath = `${contentPath}.bak`;
		fs.copyFileSync(contentPath, backupPath);

		const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
		const report = sanitizeDraftForFreeExport(content);
		fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf8');

		if (fs.existsSync(metaPath)) {
			try {
				fs.copyFileSync(metaPath, `${metaPath}.bak`);
				const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
				meta.draft_cloud_capcut_purchase_info = '';
				meta.draft_cloud_purchase_info = '';
				meta.draft_cloud_videocut_purchase_info = '';
				fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf8');
			} catch {
				// preserva meta se não for JSON válido
			}
		}

		return {
			ok: true,
			draftId: safeId,
			cleanedFlagsCount: report.cleanedFlagsCount,
			details: report.details,
			backupPath,
		};
	}

	throw new Error(`Ferramenta desconhecida: ${name}`);
}

function send(msg) {
	process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function handleJsonRpcLine(line) {
	let req;
	try {
		req = JSON.parse(line);
	} catch {
		return;
	}

	// Notificações JSON-RPC não possuem `id` e não devem gerar resposta
	if (req.id === undefined || req.id === null) {
		return;
	}

	try {
		if (req.method === 'initialize') {
			send({
				jsonrpc: '2.0',
				id: req.id,
				result: {
					protocolVersion: '2024-11-05',
					capabilities: { tools: {} },
					serverInfo: {
						name: 'capcut-native-mcp',
						version: '1.0.0',
					},
				},
			});
			return;
		}

		if (req.method === 'tools/list') {
			send({
				jsonrpc: '2.0',
				id: req.id,
				result: {
					tools: CAPCUT_MCP_TOOLS,
				},
			});
			return;
		}

		if (req.method === 'tools/call') {
			const toolName = req.params?.name;
			const toolArgs = req.params?.arguments || {};
			const data = await handleToolCall(toolName, toolArgs);
			send({
				jsonrpc: '2.0',
				id: req.id,
				result: {
					content: [
						{
							type: 'text',
							text: JSON.stringify(data, null, 2),
						},
					],
				},
			});
			return;
		}

		send({
			jsonrpc: '2.0',
			id: req.id,
			error: {
				code: -32601,
				message: `Method not found: ${req.method}`,
			},
		});
	} catch (err) {
		send({
			jsonrpc: '2.0',
			id: req.id,
			error: {
				code: -32000,
				message: err instanceof Error ? err.message : String(err),
			},
		});
	}
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('capcut-mcp-server.mjs')) {
	let stdinBuf = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', (chunk) => {
		stdinBuf += chunk;
		let idx;
		while ((idx = stdinBuf.indexOf('\n')) >= 0) {
			const line = stdinBuf.slice(0, idx).trim();
			stdinBuf = stdinBuf.slice(idx + 1);
			if (line) {
				void handleJsonRpcLine(line);
			}
		}
	});
}
