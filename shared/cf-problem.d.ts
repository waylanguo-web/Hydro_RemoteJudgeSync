export function parseCFProblem(input: string): { contestId: number; index: string };
export function cfUrl(problem: { contestId: number; index: string }): string;
export function parseVJudgeProblem(input: string): { oj: string; probNum: string; target: string; url: string };
