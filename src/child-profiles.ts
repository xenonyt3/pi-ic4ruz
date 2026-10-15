import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const forbidden = new Set(['agents_spawn', 'agents_wait', 'sessions_send', 'sessions_cancel', 'brain_context', 'brain_search', 'brain_feedback', 'brain_note']);
const safeProfiles = new Set(['code_explorer', 'default']);
const readOnly = new Set(['read', 'grep', 'find', 'ls', 'codemode']);
const defaultCeiling = new Set(['read', 'grep', 'find', 'ls', 'codemode', 'edit', 'write', 'bash', 'powershell']);

export function loadChildProfiles(configPath: string) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.schemaVersion !== 1 || !config.profiles || !config.modelSlots) throw new Error('INVALID_CHILD_CONFIG');
  for (const [name, profile] of Object.entries<any>(config.profiles)) {
    if (!safeProfiles.has(name) || !Array.isArray(profile.tools) || typeof profile.systemPrompt !== 'string') throw new Error('INVALID_CHILD_PROFILE');
    if (profile.tools.some((tool: string) => forbidden.has(tool) || !defaultCeiling.has(tool))) throw new Error('FORBIDDEN_CHILD_TOOL');
    if (name === 'code_explorer' && profile.tools.some((tool: string) => !readOnly.has(tool))) throw new Error('EXPLORER_MUST_BE_READ_ONLY');
  }
  return config;
}

export function resolveChildSpec(config: any, input: any, parentGranted: Iterable<string>, runtimeTools: Iterable<string>) {
  const profileName = input.profile ?? 'default';
  const profile = config.profiles[profileName];
  if (!safeProfiles.has(profileName) || !profile) throw new Error('UNKNOWN_CHILD_PROFILE');
  const modelSlot = input.model_slot ?? 'primary';
  const model = config.modelSlots[modelSlot];
  if (!model || typeof model.provider !== 'string' || typeof model.model !== 'string') throw new Error('UNKNOWN_MODEL_SLOT');
  const granted = new Set(parentGranted), available = new Set(runtimeTools);
  const tools = profile.tools.filter((name: string) => granted.has(name) && available.has(name) && !forbidden.has(name));
  if (profileName === 'code_explorer' && tools.some((name: string) => !readOnly.has(name))) throw new Error('FORBIDDEN_CHILD_TOOL');
  const capabilityHash = crypto.createHash('sha256').update(JSON.stringify({ profile: profileName, modelSlot, model, tools })).digest('hex');
  return { profile: profileName, systemPrompt: profile.systemPrompt, tools, modelSlot, model, capabilityHash };
}

export function validateChildTask(task: any) {
  if (!task || typeof task !== 'object' || typeof task.prompt !== 'string' || task.prompt.length < 1 || task.prompt.length > 8000) throw new Error('INVALID_CHILD_PROMPT');
  if (task.title !== undefined && (typeof task.title !== 'string' || task.title.length > 80)) throw new Error('INVALID_CHILD_TITLE');
  return { title: task.title ?? task.prompt.slice(0, 80), prompt: task.prompt, profile: task.profile ?? 'default', model_slot: task.model_slot ?? 'primary', task_key: task.task_key };
}

export function childConfigPath(root: string) { return path.join(root, 'config', 'child-profiles.json'); }
