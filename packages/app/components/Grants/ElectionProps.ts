import { PendingVotes, Vote } from 'pages/grant-elections/[type]';
import { ElectionMetadata } from '@popcorn/contracts/adapters';

export interface ElectionProps {
  election: ElectionMetadata;
  votesAssignedByUser?: number;
  pendingVotes: PendingVotes;
  assignVotes?: (grantTerm: number, vote: Vote) => void;
  maxVotes?: number;
  voiceCredits?: number;
  totalVotes: number;
}
