import { installRmj } from './rmj-hydro';
import { installLuogu } from './luogu-hydro';
import { installAtCoder } from './atcoder-hydro';
import { install } from './hydro';
export const name = 'remote-judge-sync';
export async function apply(context: unknown): Promise<void> { await install(context); await installAtCoder(context); await installLuogu(context); await installRmj(context); }
export * from './models/types';
export * from './providers/base';
export * from './services/status';
