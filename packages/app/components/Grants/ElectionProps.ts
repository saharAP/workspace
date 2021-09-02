import { ElectionMetadata } from '@popcorn/contracts/adapters';
import { PendingVotes, Vote } from 'pages/grant-elections/[type]';

export interface ElectionProps {
  election: ElectionMetadata;
  votesAssignedByUser?: number;
  pendingVotes: PendingVotes;
  assignVotes?: (grantTerm: number, vote: Vote) => void;
  maxVotes?: number;
  voiceCredits?: number;
  totalVotes: number;
}
