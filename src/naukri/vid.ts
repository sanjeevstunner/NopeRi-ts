import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { VID } from './constants.ts';

// Vendored, unmodified from Traverser25/NopeRi (src/utils/botguardSdk_v1.min.js).
let sdk: string | undefined;

/**
 * Generates the `vid` header Naukri's login expects. It is produced by Naukri's BotGuard
 * SDK, which we run in a sandbox with just enough browser globals stubbed for it to load.
 */
export async function generateVid(action = 'nlogin-login'): Promise<string> {
  sdk ??= readFileSync(new URL('./botguardSdk.min.js', import.meta.url), 'utf8');
  const location = { href: VID.pageUrl, pathname: new URL(VID.pageUrl).pathname };
  const sandbox: Record<string, unknown> = {
    document: { cookie: '' },
    navigator: { userAgent: 'Mozilla/5.0' },
    location,
    requirejs: Object.assign((_d: unknown, _cb: unknown, onError?: (e: Error) => void) => onError?.(new Error('no requirejs')), {
      config() {},
    }),
  };
  sandbox.window = sandbox.self = sandbox;
  vm.runInNewContext(sdk, sandbox);
  const shield = (sandbox.BotGuardSDK as any).createRequestShield({
    appId: VID.appId,
    publicKey: VID.publicKey,
    logger: { log() {} },
  });
  return shield.getDynamicToken(action);
}
