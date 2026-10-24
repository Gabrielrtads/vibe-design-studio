/**
 * Camada de I/O de disco para rascunhos do CapCut Desktop (Node.js).
 */
import crypto from 'node:crypto';
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

function makeUuidUpper() {
	return crypto.randomUUID().toUpperCase();
}

/**
 * Grava o projeto no diretório de drafts do CapCut com backup automático (.bak)
 * e registra na `root_meta_info.json` para aparecer na tela inicial do CapCut Desktop.
 */
export function saveCapcutDraftToDisk(params) {
	const rootDir = params.draftRootDir ? path.resolve(params.draftRootDir) : resolveDefaultCapcutDraftRoot();
	const safeDraftId = String(params.draftId || 'draft').replace(/[^A-Za-z0-9_-]/g, '_');
	const draftFolder = path.join(rootDir, safeDraftId);

	fs.mkdirSync(draftFolder, { recursive: true });

	const contentPath = path.join(draftFolder, 'draft_content.json');
	const backupPath = path.join(draftFolder, 'draft_content.json.bak');
	const metaPath = path.join(draftFolder, 'draft_meta_info.json');
	const virtualStorePath = path.join(draftFolder, 'draft_virtual_store.json');
	const settingsPath = path.join(draftFolder, 'draft_settings');
	const layoutPath = path.join(draftFolder, 'timeline_layout.json');

	if (fs.existsSync(contentPath)) {
		fs.copyFileSync(contentPath, backupPath);
	}

	const serializedContent = JSON.stringify(params.content, null, 2);
	fs.writeFileSync(contentPath, serializedContent, 'utf8');

	const nowSec = Math.floor(Date.now() / 1000);
	const nowUs = Date.now() * 1000;
	const durationUs = typeof params.content?.duration === 'number' ? params.content.duration : 0;
	const forwardFoldPath = draftFolder.replace(/\\/g, '/');

	const videos = Array.isArray(params.content?.materials?.videos)
		? params.content.materials.videos
		: [];

	const draftMaterialValues = videos.map((v, idx) => {
		const localId = v.local_material_id || crypto.randomUUID().toLowerCase();
		const filePath = String(v.path || '').replace(/\\/g, '/');
		const fileName = path.basename(filePath);
		const clipDur = typeof v.duration === 'number' ? v.duration : 0;
		return {
			ai_group_type: '',
			create_time: nowSec,
			duration: clipDur,
			enter_from: 0,
			extra_info: fileName,
			file_Path: filePath,
			height: typeof v.height === 'number' ? v.height : 1920,
			id: localId,
			import_time: nowSec + idx,
			import_time_ms: nowUs + idx * 1000,
			item_source: 1,
			material_color_tag: '',
			md5: '',
			metetype: 'video',
			roughcut_time_range: { duration: clipDur, start: 0 },
			sub_time_range: { duration: -1, start: -1 },
			type: 0,
			width: typeof v.width === 'number' ? v.width : 1080,
		};
	});

	const draftUuid =
		typeof params.content?.id === 'string' && params.content.id.includes('-')
			? params.content.id
			: makeUuidUpper();

	const metaInfo = {
		cloud_draft_cover: false,
		cloud_draft_sync: false,
		cloud_package_completed_time: '',
		draft_cloud_capcut_purchase_info: '',
		draft_cloud_last_action_download: false,
		draft_cloud_package_type: '',
		draft_cloud_purchase_info: '',
		draft_cloud_template_id: '',
		draft_cloud_tutorial_info: '',
		draft_cloud_videocut_purchase_info: '',
		draft_cover: 'draft_cover.jpg',
		draft_deeplink_url: '',
		draft_enterprise_info: {
			draft_enterprise_extra: '',
			draft_enterprise_id: '',
			draft_enterprise_name: '',
			enterprise_material: [],
		},
		draft_fold_path: forwardFoldPath,
		draft_id: safeDraftId,
		draft_uuid: draftUuid,
		draft_is_ae_produce: false,
		draft_is_ai_packaging_used: false,
		draft_is_ai_shorts: false,
		draft_is_ai_translate: false,
		draft_is_article_video_draft: false,
		draft_is_cloud_temp_draft: false,
		draft_is_from_deeplink: 'false',
		draft_is_invisible: false,
		draft_is_pippit_draft: false,
		draft_is_web_article_video: false,
		draft_materials: [
			{ type: 0, value: draftMaterialValues },
			{ type: 1, value: [] },
			{ type: 2, value: [] },
			{ type: 3, value: [] },
			{ type: 6, value: [] },
			{ type: 7, value: [] },
			{ type: 8, value: [] },
		],
		draft_materials_copied_info: [],
		draft_name: params.draftName,
		draft_need_rename_folder: false,
		draft_new_version: '',
		draft_removable_storage_device: '',
		draft_root_path: rootDir,
		draft_segment_extra_info: [],
		draft_timeline_materials_size_: 0,
		draft_type: '',
		draft_web_article_video_enter_from: '',
		pippit_avatar_url: '',
		pippit_extra_info: '',
		pippit_id: '',
		pippit_user_name: '',
		tm_draft_cloud_completed: '',
		tm_draft_cloud_entry_id: -1,
		tm_draft_cloud_modified: 0,
		tm_draft_cloud_parent_entry_id: -1,
		tm_draft_cloud_space_id: -1,
		tm_draft_cloud_user_id: -1,
		tm_draft_create: nowUs,
		tm_draft_modified: nowUs,
		tm_draft_removed: 0,
		tm_duration: durationUs,
	};
	fs.writeFileSync(metaPath, JSON.stringify(metaInfo), 'utf8');

	const virtualStore = {
		draft_materials: [],
		draft_virtual_store: [
			{
				type: 0,
				value: [
					{
						creation_time: 0,
						display_name: '',
						filter_type: 0,
						id: '',
						import_time: 0,
						import_time_us: 0,
						material_color_tag: '',
						sort_sub_type: 0,
						sort_type: 0,
						subdraft_filter_type: 0,
					},
				],
			},
			{
				type: 1,
				value: draftMaterialValues.map((m) => ({ child_id: m.id, parent_id: '' })),
			},
			{ type: 2, value: [] },
		],
	};
	fs.writeFileSync(virtualStorePath, JSON.stringify(virtualStore), 'utf8');

	const settingsContent = `[General]\ndraft_create_time=${nowSec}\ndraft_last_edit_time=${nowSec}\nreal_edit_seconds=1\nreal_edit_keys=1\n`;
	fs.writeFileSync(settingsPath, settingsContent, 'utf8');

	const timelineLayout = {
		dockItems: [
			{
				dockIndex: 0,
				ratio: 1,
				timelineIds: [draftUuid],
				timelineNames: ['Linha do tempo 01'],
			},
		],
		layoutOrientation: 1,
	};
	fs.writeFileSync(layoutPath, JSON.stringify(timelineLayout), 'utf8');

	// Atualiza root_meta_info.json (índice da tela inicial do CapCut Desktop) com backup automático
	const rootMetaPath = path.join(rootDir, 'root_meta_info.json');
	const rootMetaBackupPath = path.join(rootDir, 'root_meta_info.json.bak');
	let rootMetaUpdated = false;

	if (params.updateRootMeta !== false) {
		try {
			let rootMeta = {
				all_draft_store: [],
				draft_ids: 0,
				root_path: rootDir.replace(/\\/g, '/'),
			};
			if (fs.existsSync(rootMetaPath)) {
				fs.copyFileSync(rootMetaPath, rootMetaBackupPath);
				const rawRoot = fs.readFileSync(rootMetaPath, 'utf8');
				const parsed = JSON.parse(rawRoot);
				if (parsed && Array.isArray(parsed.all_draft_store)) {
					rootMeta = parsed;
				}
			}

			const rootStoreEntry = {
				cloud_draft_cover: false,
				cloud_draft_sync: false,
				draft_cloud_last_action_download: false,
				draft_cloud_purchase_info: '',
				draft_cloud_template_id: '',
				draft_cloud_tutorial_info: '',
				draft_cloud_videocut_purchase_info: '',
				draft_cover: `${forwardFoldPath}\\draft_cover.jpg`,
				draft_fold_path: forwardFoldPath,
				draft_id: draftUuid,
				draft_is_ai_shorts: false,
				draft_is_cloud_temp_draft: false,
				draft_is_invisible: false,
				draft_is_pippit_draft: false,
				draft_is_web_article_video: false,
				draft_json_file: `${forwardFoldPath}\\draft_content.json`,
				draft_name: params.draftName,
				draft_new_version: '',
				draft_root_path: rootDir,
				draft_timeline_materials_size: 0,
				draft_type: '',
				draft_web_article_video_enter_from: '',
				pippit_avatar_url: '',
				pippit_extra_info: '',
				pippit_id: '',
				pippit_user_name: '',
				streaming_edit_draft_ready: true,
				tm_draft_cloud_completed: '',
				tm_draft_cloud_entry_id: -1,
				tm_draft_cloud_modified: 0,
				tm_draft_cloud_parent_entry_id: -1,
				tm_draft_cloud_space_id: -1,
				tm_draft_cloud_user_id: -1,
				tm_draft_create: nowUs,
				tm_draft_modified: nowUs,
				tm_draft_removed: 0,
				tm_duration: durationUs,
			};

			const filtered = rootMeta.all_draft_store.filter(
				(item) =>
					item.draft_fold_path !== forwardFoldPath &&
					item.draft_name !== params.draftName &&
					item.draft_id !== safeDraftId,
			);
			rootMeta.all_draft_store = [rootStoreEntry, ...filtered];
			rootMeta.draft_ids = rootMeta.all_draft_store.length;
			fs.writeFileSync(rootMetaPath, JSON.stringify(rootMeta), 'utf8');
			rootMetaUpdated = true;
		} catch {
			rootMetaUpdated = false;
		}
	}

	return {
		draftId: safeDraftId,
		draftFolder,
		contentPath,
		backupPath,
		metaPath,
		rootMetaPath,
		rootMetaUpdated,
	};
}
