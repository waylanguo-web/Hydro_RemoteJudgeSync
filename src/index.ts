import { install } from './hydro';
export const name = 'remote-judge-sync';
export async function apply(context: unknown): Promise<void> { await install(context); }
export * from './models/types';
export * from './providers/base';
export * from './services/status';
