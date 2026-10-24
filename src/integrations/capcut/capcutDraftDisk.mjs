/**
 * Camada de I/O de disco para rascunhos do CapCut Desktop (Node.js).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Resolve dinamicamente o diretório padrão de projetos do CapCut Desktop
 * sem embutir nomes de usuário fixos no código.
 */
export function resolveDefaultCapcutDraftRoot() {
	if (process.env.CAPCUT_DRAFT_ROOT) {
		return path.resolve(process.env.CAPCUT_DRAFT_ROOT);
	}
	if (process.platform === 'win32') {
		const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
		return path.join(localAppData, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
	}
	if (process.platform === 'darwin') {
		return path.join(os.homedir(), 'Movies', 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
	}
	return path.join(os.tmpdir(), 'capcut-drafts');
}

/**
 * Grava o projeto no diretório de drafts do CapCut com backup automático (.bak)
 * se já existir um `draft_content.json` anterior.
 */
export function saveCapcutDraftToDisk(params) {
	const rootDir = params.draftRootDir ? path.resolve(params.draftRootDir) : resolveDefaultCapcutDraftRoot();
	const safeDraftId = String(params.draftId || 'draft').replace(/[^A-Za-z0-9_-]/g, '_');
	const draftFolder = path.join(rootDir, safeDraftId);

	fs.mkdirSync(draftFolder, { recursive: true });

	const contentPath = path.join(draftFolder, 'draft_content.json');
	const backupPath = path.join(draftFolder, 'draft_content.json.bak');
	const metaPath = path.join(draftFolder, 'draft_meta_info.json');

	if (fs.existsSync(contentPath)) {
		fs.copyFileSync(contentPath, backupPath);
	}

	const serializedContent = JSON.stringify(params.content, null, 2);
	fs.writeFileSync(contentPath, serializedContent, 'utf8');

	const nowUs = Date.now() * 1000;
	const metaInfo = {
		draft_id: safeDraftId,
		draft_name: params.draftName,
		draft_fold_path: draftFolder.replace(/\\/g, '/'),
		tm_draft_create: nowUs,
		tm_draft_modified: nowUs,
		tm_duration: typeof params.content.duration === 'number' ? params.content.duration : 0,
	};
	fs.writeFileSync(metaPath, JSON.stringify(metaInfo, null, 2), 'utf8');

	return {
		draftId: safeDraftId,
		draftFolder,
		contentPath,
		backupPath,
		metaPath,
	};
}
