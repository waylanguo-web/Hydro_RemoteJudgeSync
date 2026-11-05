/** Hydro plugin entry. Routes and persistence will be added after host-version validation. */
export const name = 'remote-judge-sync';
export function apply(_context: unknown): void {
    // Initialization scaffold: deliberately does not change native judging or grades.
}
export * from './models/types';
export * from './providers/base';
export * from './services/status';
