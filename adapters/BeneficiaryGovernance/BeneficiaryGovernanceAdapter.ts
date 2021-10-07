import { IIpfsClient } from "@popcorn/utils";
import { BigNumber, Contract } from "ethers";

export enum ProposalStatus {
  Open,
  Challenge,
  Completed,
  Passed,
  Failed,
  All,
}

export enum ProposalType {
  Nomination,
  Takedown,
}

export interface BeneficiaryImage {
  image: string;
  description: string;
}

export interface ImpactReport {
  fileName: string;
  reportCid: string;
}
export interface BeneficiaryApplication {
  organizationName: string;
  projectName?: string;
  missionStatement: string;
  beneficiaryAddress: string;
  files: {
    profileImage: BeneficiaryImage;
    headerImage?: BeneficiaryImage;
    impactReports?: ImpactReport[];
    additionalImages?: BeneficiaryImage[];
    video: string;
  };
  links: {
    twitterUrl?: string;
    linkedinUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    githubUrl?: string;
    proofOfOwnership?: string;
    contactEmail: string;
    website: string;
  };
  version: string;
}
export interface Proposal {
  application: BeneficiaryApplication;
  id: string;
  status: ProposalStatus;
  stageDeadline: Date;
  proposalType: ProposalType;
  votes: {
    for: BigNumber;
    against: BigNumber;
  };
}
export class BeneficiaryGovernanceAdapter {
  constructor(private contract: Contract, private IpfsClient: IIpfsClient) {}

  public async getProposal(id: number): Promise<Proposal> {
    const proposal = await this.contract.proposals(id);
    return {
      application: await this.IpfsClient.get(proposal.applicationCid),
      id: id.toString(),
      proposalType: proposal.proposalType,
      status: Number(proposal.status.toString()),
      stageDeadline: new Date(
        (Number(proposal.startTime.toString()) +
          Number(proposal.configurationOptions.votingPeriod.toString()) +
          Number(proposal.configurationOptions.vetoPeriod.toString())) *
          1000
      ),
      votes: {
        for: proposal.yesCount,
        against: proposal.noCount,
      },
    };
  }

  public async getAllProposals(
    proposalType: ProposalType
  ): Promise<Proposal[]> {
    const proposalCount = await this.contract.getNumberOfProposals(
      proposalType
    );

    const proposalTypeName =
      proposalType === ProposalType.Nomination ? "nominations" : "takedowns";

    const proposalIds = await Promise.all(
      new Array(Number(proposalCount)).fill(undefined).map(async (x, i) => {
        return this.contract[proposalTypeName](i);
      })
    );

    return Promise.all(
      proposalIds.map(async (id) => {
        return this.getProposal(Number(id));
      })
    );
  }

  public async hasVoted(proposalId: number, account: string): Promise<boolean> {
    return await this.contract.hasVoted(proposalId, account);
  }
}
export default BeneficiaryGovernanceAdapter;
