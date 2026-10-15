import { sdk, codemode } from './upstream.mjs';

export function validateScriptOptions(code, { maxDeadlineMs = 900000 } = {}) {
  const parsed = codemode.parseCodemodeSource(code);
  if (parsed.options.timeoutMs > maxDeadlineMs) throw new Error(`CODEMODE_TIMEOUT_CEILING: maximum ${maxDeadlineMs} ms`);
  return parsed;
}

export function withHostDeadline(execute, options = {}) {
  const { defaultDeadlineMs = 300000, maxDeadlineMs = 900000 } = options;
  if (!Number.isSafeInteger(defaultDeadlineMs) || defaultDeadlineMs <= 0 || defaultDeadlineMs > maxDeadlineMs) throw new Error('INVALID_HOST_DEADLINE');
  return async (id, input, signal, update, ctx) => {
    const parsed = validateScriptOptions(input.code, { maxDeadlineMs });
    const controller = new AbortController();
    let expired = false;
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    // Explicit timeouts belong to QuickJS; the host only bounds its cleanup grace.
    const delay = parsed.options.timeoutMs === undefined ? defaultDeadlineMs : Math.min(parsed.options.timeoutMs + 1000, maxDeadlineMs + 1000);
    const timer = setTimeout(() => { expired = true; controller.abort(new Error('HOST_DEADLINE')); }, delay);
    try {
      const result = await execute(id, input, controller.signal, update, ctx);
      if (!expired) return result;
      return { ...result, isError: true, details: { ...result.details, hostDeadline: 'HOST_DEADLINE', aborted: true } };
    } catch (error) {
      if (!expired) throw error;
      return { isError: true, content: [{ type: 'text', text: 'HOST_DEADLINE: script aborted by prototype host policy' }], details: { hostDeadline: 'HOST_DEADLINE', aborted: true } };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}

export function registerCodemode(pi, options = {}) {
  const factory = options.factory ?? sdk.createCodemodeExtension;
  const facade = new Proxy(pi, { get(target, key) {
    if (key === 'registerTool') return definition => {
      if (definition.name !== 'codemode') throw new Error('UNEXPECTED_CODEMODE_REGISTRATION');
      target.registerTool({ ...definition, execute: withHostDeadline(definition.execute, options) });
    };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  return factory({ mode: 'on', inlineBudget: 3000, models: false })(facade);
}
