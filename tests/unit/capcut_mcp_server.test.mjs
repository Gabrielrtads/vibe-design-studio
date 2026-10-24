import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const serverPath = path.join(root, 'src', 'mcp', 'capcut-mcp-server.mjs');

function runMcpSession(messages, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...envOverrides },
    });

    const responses = [];
    let buffer = '';
    const expectedResponses = messages.filter((m) => m.id !== undefined).length;

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout aguardando respostas MCP (${responses.length}/${expectedResponses})`));
    }, 5000);

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        responses.push(JSON.parse(line));
        if (responses.length >= expectedResponses) {
          clearTimeout(timer);
          proc.kill();
          resolve(responses);
        }
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    for (const msg of messages) {
      proc.stdin.write(`${JSON.stringify(msg)}\n`);
    }
  });
}

test('capcut-mcp-server: handshake JSON-RPC 2.0, ignora notificações e lista as 6 ferramentas', async () => {
  const responses = await runMcpSession([
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    },
    {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
  ]);

  assert.equal(responses.length, 2);
  assert.equal(responses[0].id, 1);
  assert.equal(responses[0].result.serverInfo.name, 'capcut-native-mcp');

  const tools = responses[1].result.tools.map((t) => t.name);
  assert.deepEqual(tools, [
    'capcut_list_projects',
    'capcut_inspect_draft',
    'capcut_create_project',
    'capcut_auto_rough_cut',
    'capcut_live_control',
    'capcut_timeline_add_draft',
    'capcut_unlock_free_export',
  ]);
});

test('capcut-mcp-server: cria, lista, inspeciona e aplica auto-cut em projeto CapCut via tools/call', async () => {
  const tmpDraftRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capcut-mcp-test-'));
  try {
    const responses = await runMcpSession(
      [
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'capcut_create_project',
            arguments: {
              draftId: 'projeto-kage-01',
              name: 'Reel Kage Bunshin',
              width: 1080,
              height: 1920,
              videoClips: [
                {
                  path: 'media/aula.mp4',
                  speechRanges: [
                    { startSec: 1.0, endSec: 4.0 },
                    { startSec: 6.0, endSec: 9.0 },
                  ],
                },
              ],
              captions: [
                { text: 'Clones em ação!', startSec: 0, endSec: 3.0, color: '#FFE600' },
              ],
            },
          },
        },
        {
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'capcut_list_projects',
            arguments: {},
          },
        },
        {
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: {
            name: 'capcut_inspect_draft',
            arguments: { draftId: 'projeto-kage-01' },
          },
        },
        {
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/call',
          params: {
            name: 'capcut_unlock_free_export',
            arguments: { draftId: 'projeto-kage-01' },
          },
        },
      ],
      { CAPCUT_DRAFT_ROOT: tmpDraftRoot }
    );

    const created = JSON.parse(responses[0].result.content[0].text);
    assert.equal(created.ok, true);
    assert.equal(created.draftId, 'projeto-kage-01');
    assert.equal(created.durationSeconds, 6);

    const listed = JSON.parse(responses[1].result.content[0].text);
    assert.equal(listed.projects.length, 1);
    assert.equal(listed.projects[0].draftId, 'projeto-kage-01');

    const inspected = JSON.parse(responses[2].result.content[0].text);
    assert.equal(inspected.ok, true);
    assert.equal(inspected.videoSegmentsCount, 2);
    assert.equal(inspected.subtitleSegmentsCount, 1);

    const unlocked = JSON.parse(responses[3].result.content[0].text);
    assert.equal(unlocked.ok, true);
    assert.equal(unlocked.draftId, 'projeto-kage-01');
  } finally {
    fs.rmSync(tmpDraftRoot, { recursive: true, force: true });
  }
});
