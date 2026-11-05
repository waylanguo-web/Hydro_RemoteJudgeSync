import type { AcceptedSubmission, RemoteProblem } from '../models/types';
/** Historical AC is allowed unless the caller supplies an assignment time window. */
export function findAcceptance(
    problem: RemoteProblem,
    submissions: readonly AcceptedSubmission[],
    window: { start?: number; end?: number } = {},
): AcceptedSubmission | undefined {
    return submissions.filter(s => s.platform === problem.platform
        && s.remoteId === problem.remoteId
        && Number.isFinite(s.submittedAt)
        && (window.start === undefined || s.submittedAt >= window.start)
        && (window.end === undefined || s.submittedAt <= window.end))
        .sort((a, b) => a.submittedAt - b.submittedAt)[0];
}
