import type { AcceptedSubmission, Platform } from '../models/types';
export interface SubmissionPage {
    submissions: AcceptedSubmission[];
    nextCursor?: string;
}
/** Adapters must distinguish unavailable/private data from a successful empty page. */
export interface RemoteProvider {
    readonly platform: Platform;
    fetchAccepted(handle: string, cursor?: string): Promise<SubmissionPage>;
}
