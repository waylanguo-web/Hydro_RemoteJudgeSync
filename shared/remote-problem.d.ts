export function parseAtCoderProblem(input: string): { contestId: string; taskId: string };
export function parseRemoteProblem(platform: string, input: string): {
    platform: string; target: string; label: string; url: string;
    contestId: any; index?: any; taskId?: any;
};
