export type Platform = 'codeforces';
export interface RemoteAccount {
    domainId: string;
    uid: number;
    platform: Platform;
    handle: string;
    verifiedAt?: number;
}
export interface RemoteProblem {
    platform: Platform;
    remoteId: string;
    remoteUrl: string;
}
export interface AcceptedSubmission {
    platform: Platform;
    remoteId: string;
    submissionId: string;
    /** Actual remote submission time in Unix seconds, not synchronization time. */
    submittedAt: number;
}
