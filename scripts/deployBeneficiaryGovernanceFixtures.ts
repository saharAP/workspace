import { Signer, utils } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BeneficiaryGovernance, BeneficiaryGovernanceFactory, MockErc20, MockErc20Factory, Staking, StakingFactory } from "../typechain";
import bluebird from "bluebird";

enum ProposalStatus {
  New,
  ChallengePeriod,
  PendingFinalization,
  Passed,
  Failed,
}

enum Vote {
  Yes,
  No,
}

enum ProposalType {
  BeneficiaryNominationProposal,
  BeneficiaryTakedownProposal,
}

interface Args {
  beneficiaryGovernance: string; // address
  mockPOP: string; // address
  staking: string; // address
}

interface Contracts {
    BeneficiaryGovernance: BeneficiaryGovernance;
    MockPOP: MockErc20;
    Staking: Staking;
}
export default async function run(args: Args, hre: HardhatRuntimeEnvironment) {
  const [
    deployer,
    voter1,
    voter2,
    voter3,
    voter4,
    voter5,
    voter6,
    voter7,
    voter8,
    voter9,
  ] = await hre.ethers.getSigners();

  const contracts: Contracts = {
    BeneficiaryGovernance: await BeneficiaryGovernanceFactory.connect(
        args.beneficiaryGovernance,
        hre.ethers.provider
      ),
    MockPOP: await MockErc20Factory.connect(
        args.mockPOP,
        hre.ethers.provider
      ),
    Staking: await StakingFactory.connect(
        args.staking,
        hre.ethers.provider
      )
  };

  const approveForStaking = async (voters: Signer[]): Promise<void> => {
    console.log("approving all accounts for staking ...");
    await bluebird.map(
      voters,
      async (account) => {
        return contracts.MockPOP.connect(account).approve(
          contracts.Staking.address,
          utils.parseEther("100000000")
        );
      },
      { concurrency: 1 }
    );
  };

  const enableFastProposals = async () => {
    console.log("Enabling fast proposals");
    const tx = await contracts.BeneficiaryGovernance.setConfiguration(
      60, // seconds for voting period,
      60, // seconds for veto period
      0
    );
    await tx.wait();
  };

  const mintPOP = async (voters: Signer[]): Promise<void> => {
    console.log("giving everyone POP (yay!) ...");
    await bluebird.map(
      voters,
      async (account) => {
        return contracts.MockPOP.mint(account.address, utils.parseEther("10000"));
      },
      { concurrency: 1 }
    );
  };

  const voteOnProposal = async (proposalId, signer: Signer, vote: Vote) => {
    const voteToString = (vote: Vote) => (vote ? "Yes" : "No");

    console.log(`Voting ${voteToString(vote)} on proposal ${proposalId}.`);

    const tx = await contracts.BeneficiaryGovernance.connect(signer).vote(
      proposalId,
      vote
    );
    await tx.wait();
  };

  const stakePOP = async (voters): Promise<void> => {
    console.log("voters are staking POP ...");
    await bluebird.map(voters, async (voter) => {
      return contracts.Staking.connect(voter).stake(
        utils.parseEther("1000"),
        604800 * 52 * 4
      );
    });
  };

  // create proposal in desired state
  const createProposal = async (
    proposalType: ProposalType,
    targetStatus: ProposalStatus
  ) => {
    const beneficiary = hre.ethers.Wallet.createRandom();

    console.log(`Creating nomination proposal for ${beneficiary.address}`);

    const proposalId = (
      await contracts.BeneficiaryGovernance.getNumberOfProposals()
    ).toNumber();

    const proposal = await contracts.BeneficiaryGovernance.createProposal(
      beneficiary.address,
      hre.ethers.utils.formatBytes32String(`testCid.${beneficiary.address}`), // todo: create and upload actual json document
      proposalType
    );

    const receipt = await proposal.wait();
    console.log("events", receipt.events);

    if ((targetStatus = ProposalStatus.New)) {
      return;
    }

    // this would require that the proposal received a majority of no votes by the time the normal voting period has elapsed
    if ((targetStatus = ProposalStatus.Failed)) {
      await Promise.all(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
          voteOnProposal(proposalId, eval(`voter${val}`), Vote.No);
        })
      );
      console.log("Voting complete");
    }

    if ((targetStatus = ProposalStatus.Passed)) {
        await Promise.all(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
            voteOnProposal(proposalId, eval(`voter${val}`), Vote.Yes);
          })
        );
        console.log("Voting complete");
      }
  };

  await mintPOP(await hre.ethers.getSigners());
  await approveForStaking(await hre.ethers.getSigners());
  await stakePOP(await hre.ethers.getSigners());

  await enableFastProposals();

  await createProposal(
    ProposalType.BeneficiaryNominationProposal,
    ProposalStatus.New
  );
  await createProposal(
    ProposalType.BeneficiaryNominationProposal,
    ProposalStatus.ChallengePeriod
  );
  await createProposal(
    ProposalType.BeneficiaryNominationProposal,
    ProposalStatus.Passed
  );
  await createProposal(
    ProposalType.BeneficiaryNominationProposal,
    ProposalStatus.Failed
  );
}
