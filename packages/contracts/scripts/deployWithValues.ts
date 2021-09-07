import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ElectionTerm, ProposalType } from "@popcorn/contracts/adapters";
import { getBytes32FromIpfsHash } from "@popcorn/utils";
import bluebird from "bluebird";
import { deployContract } from "ethereum-waffle";
import { Contract, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import getCreatedProposalId from "../adapters/GrantElection/getCreatedProposalId";
import GrantElectionAdapter, {
  ShareType,
} from "../adapters/GrantElection/GrantElectionAdapter";
import * as addressCidMap from "./addressCidMap.json";

const UniswapV2FactoryJSON = require("../artifactsUniswap/UniswapV2Factory.json");
const UniswapV2Router02JSON = require("../artifactsUniswap/UniswapV2Router.json");
const UniswapV2PairJSON = require("../artifactsUniswap/UniswapV2Pair.json");

// This script creates two beneficiaries and one quarterly grant that they are both eligible for. Run this
// Run this instead of the normal deploy.js script
const DEFAULT_REGION = "0x5757";

const VOTE_PERIOD_IN_SECONDS = 30;

interface Contracts {
  beneficiaryRegistry: Contract;
  mockPop: Contract;
  staking: Contract;
  randomNumberConsumer: Contract;
  grantElections: Contract;
  beneficiaryVaults: Contract;
  rewardsManager: Contract;
  mock3CRV: Contract;
  uniswapFactory: Contract;
  uniswapRouter: Contract;
  uniswapPair: Contract;
  beneficiaryGovernance: Contract;
  region: Contract;
  rewardsEscrow: Contract;
}

enum Vote {
  Yes,
  No,
}

const SECONDS_IN_DAY = 24 * 60 * 60;

export default async function deploy(ethers): Promise<void> {
  const overrides = {
    gasLimit: 9999999,
  };
  let accounts: SignerWithAddress[];
  let beneficiaries: SignerWithAddress[];
  let voters: SignerWithAddress[];
  let contracts: Contracts;
  let treasuryFund: SignerWithAddress;
  let insuranceFund: SignerWithAddress;

  const setSigners = async (): Promise<void> => {
    accounts = await ethers.getSigners();
    voters = accounts.slice(0, 4);
    beneficiaries = accounts.slice(1, 20);
    treasuryFund = accounts[18];
    insuranceFund = accounts[19];
  };

  const giveBeneficiariesETH = async (): Promise<void> => {
    console.log("giving ETH to beneficiaries ...");
    await Promise.all(
      beneficiaries.map(async (beneficiary: SignerWithAddress) => {
        const balance = await ethers.provider.getBalance(beneficiary.address);
        if (balance.lt(parseEther(".01"))) {
          await accounts[0].sendTransaction({
            to: beneficiary.address,
            value: utils.parseEther(".02"),
          });
        }
      })
    );
  };

  const deployContracts = async (): Promise<void> => {
    console.log("deploying contracts ...");

    const mockPop = await (
      await (
        await ethers.getContractFactory("MockERC20")
      ).deploy("TestPOP", "TPOP", 18)
    ).deployed();

    const beneficiaryVaults = await (
      await (
        await ethers.getContractFactory("BeneficiaryVaults")
      ).deploy(mockPop.address)
    ).deployed();

    const region = await (
      await (
        await ethers.getContractFactory("Region")
      ).deploy(beneficiaryVaults.address)
    ).deployed();

    const beneficiaryRegistry = await (
      await (
        await ethers.getContractFactory("BeneficiaryRegistry")
      ).deploy(region.address)
    ).deployed();

    const mock3CRV = await (
      await (
        await ethers.getContractFactory("MockERC20")
      ).deploy("3CURVE", "3CRV", 18)
    ).deployed();

    const WETH = await (
      await (await ethers.getContractFactory("WETH9")).deploy()
    ).deployed();

    const rewardsEscrow = await (
      await (
        await ethers.getContractFactory("RewardsEscrow")
      ).deploy(mockPop.address)
    ).deployed();

    const staking = await (
      await (
        await ethers.getContractFactory("Staking")
      ).deploy(mockPop.address, rewardsEscrow.address)
    ).deployed();

    const uniswapFactory = await deployContract(
      accounts[0],
      UniswapV2FactoryJSON,
      [accounts[0].address]
    );
    const uniswapRouter = await deployContract(
      accounts[0],
      UniswapV2Router02JSON,
      [uniswapFactory.address, WETH.address],
      overrides
    );

    await uniswapFactory.createPair(mock3CRV.address, mockPop.address);
    const uniswapPairAddress = await uniswapFactory.getPair(
      mock3CRV.address,
      mockPop.address
    );
    const uniswapPair = new Contract(
      uniswapPairAddress,
      JSON.stringify(UniswapV2PairJSON.abi),
      accounts[0]
    );

    const rewardsManager = await (
      await (
        await ethers.getContractFactory("RewardsManager")
      ).deploy(
        mockPop.address,
        staking.address,
        treasuryFund.address,
        insuranceFund.address,
        beneficiaryVaults.address,
        uniswapRouter.address
      )
    ).deployed();

    await staking.connect(accounts[0]).init(rewardsManager.address);

    const randomNumberConsumer = await (
      await (
        await ethers.getContractFactory("RandomNumberConsumer")
      ).deploy(
        process.env.ADDR_CHAINLINK_VRF_COORDINATOR,
        process.env.ADDR_CHAINLINK_LINK_TOKEN,
        process.env.ADDR_CHAINLINK_KEY_HASH
      )
    ).deployed();

    const beneficiaryGovernance = await (
      await (
        await ethers.getContractFactory("BeneficiaryGovernance")
      ).deploy(
        staking.address,
        beneficiaryRegistry.address,
        mockPop.address,
        region.address,
        accounts[0].address
      )
    ).deployed();

    const grantElections = await (
      await (
        await ethers.getContractFactory("GrantElections")
      ).deploy(
        staking.address,
        beneficiaryRegistry.address,
        randomNumberConsumer.address,
        mockPop.address,
        region.address,
        accounts[0].address
      )
    ).deployed();

    contracts = {
      beneficiaryRegistry,
      mockPop,
      staking,
      randomNumberConsumer,
      grantElections,
      beneficiaryVaults,
      rewardsManager,
      rewardsEscrow,
      mock3CRV,
      uniswapFactory,
      uniswapRouter,
      uniswapPair,
      beneficiaryGovernance,
      region,
    };
  };

  const addBeneficiariesToRegistry = async (): Promise<void> => {
    console.log(
      "adding beneficiaries to registry which'll be completed takedown proposals ..."
    );
    await bluebird.map(
      beneficiaries.slice(6, 12),
      async (beneficiary: SignerWithAddress) => {
        await contracts.beneficiaryRegistry.addBeneficiary(
          beneficiary.address,
          DEFAULT_REGION,
          getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
          { gasLimit: 3000000 }
        );
      },
      { concurrency: 1 }
    );
    console.log(
      "adding beneficiaries to registry which'll be vetoed takedown proposals ..."
    );
    await bluebird.map(
      beneficiaries.slice(14, 16),
      async (beneficiary: SignerWithAddress) => {
        await contracts.beneficiaryRegistry.addBeneficiary(
          beneficiary.address,
          DEFAULT_REGION,
          getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
          { gasLimit: 3000000 }
        );
      },
      { concurrency: 1 }
    );
    console.log(
      "adding beneficiaries to registry which'll be takedown proposals in open veto stage..."
    );
    await bluebird.map(
      beneficiaries.slice(18),
      async (beneficiary: SignerWithAddress) => {
        await contracts.beneficiaryRegistry.addBeneficiary(
          beneficiary.address,
          DEFAULT_REGION,
          getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
          { gasLimit: 3000000 }
        );
      },
      { concurrency: 1 }
    );
  };

  const mintPOP = async (): Promise<void> => {
    console.log("giving everyone POP (yay!) ...");
    await bluebird.map(
      accounts,
      async (account) => {
        await contracts.mockPop.mint(account.address, parseEther("1000000"));
      },
      { concurrency: 1 }
    );
    await bluebird.map(
      accounts,
      async (account) => {
        await contracts.mockPop
          .connect(account)
          .approve(contracts.grantElections.address, parseEther("1000000"));
      },
      { concurrency: 1 }
    );
    await bluebird.map(
      accounts,
      async (account) => {
        await contracts.mockPop
          .connect(account)
          .approve(
            contracts.beneficiaryGovernance.address,
            parseEther("10000")
          );
      },
      { concurrency: 1 }
    );
  };

  const approveForStaking = async (): Promise<void> => {
    console.log("approving all accounts for staking ...");
    await bluebird.map(
      accounts,
      async (account) => {
        await contracts.mockPop
          .connect(account)
          .approve(contracts.staking.address, utils.parseEther("100000000"));
      },
      { concurrency: 1 }
    );
  };

  const prepareUniswap = async (): Promise<void> => {
    console.log("Preparing Uniswap 3CRV-POP Pair...");
    const currentBlock = await ethers.provider.getBlock("latest");
    await contracts.mockPop.mint(accounts[0].address, parseEther("100000"));
    await contracts.mock3CRV.mint(accounts[0].address, parseEther("100000"));
    await contracts.mockPop
      .connect(accounts[0])
      .approve(contracts.uniswapRouter.address, parseEther("100000"));
    await contracts.mock3CRV
      .connect(accounts[0])
      .approve(contracts.uniswapRouter.address, parseEther("100000"));

    await contracts.uniswapRouter.addLiquidity(
      contracts.mockPop.address,
      contracts.mock3CRV.address,
      parseEther("100000"),
      parseEther("100000"),
      parseEther("100000"),
      parseEther("100000"),
      accounts[0].address,
      currentBlock.timestamp + 60
    );
  };

  const fundRewardsManager = async (): Promise<void> => {
    console.log("Funding RewardsManager...");
    await contracts.mockPop.mint(accounts[0].address, parseEther("5000"));
    await contracts.mock3CRV.mint(accounts[0].address, parseEther("10000"));
    await contracts.mockPop
      .connect(accounts[0])
      .transfer(contracts.rewardsManager.address, parseEther("10000"));
    await contracts.mock3CRV
      .connect(accounts[0])
      .transfer(contracts.rewardsManager.address, parseEther("5000"));
  };

  const stakePOP = async (): Promise<void> => {
    console.log("voters are staking POP ...");
    await bluebird.map(accounts, async (voter: SignerWithAddress) => {
      await contracts.staking
        .connect(voter)
        .stake(utils.parseEther("1000"), 86400 * 365 * 4);
    });
  };

  const transferBeneficiaryRegistryOwnership = async (): Promise<void> => {
    await contracts.beneficiaryRegistry.transferOwnership(
      contracts.beneficiaryGovernance.address
    );
  };

  const updateProposalSettings = async (): Promise<void> => {
    console.log(
      `Reducing proposal voting period and veto period to ${VOTE_PERIOD_IN_SECONDS}s`
    );
    await contracts.beneficiaryGovernance
      .connect(accounts[0])
      .setConfiguration(
        VOTE_PERIOD_IN_SECONDS,
        VOTE_PERIOD_IN_SECONDS,
        parseEther("2000")
      );
  };

  const addFinalizedProposalsAndBeneficiariesToRegistry =
    async (): Promise<void> => {
      const nominationProposalIds = await addProposals(
        beneficiaries.slice(0, 6),
        0
      );
      const takedownProposalIds = await addProposals(
        beneficiaries.slice(6, 12),
        1
      );
      const allProposalIds = nominationProposalIds.concat(takedownProposalIds);
      await voteOnNominationProposals(nominationProposalIds);
      await voteOnTakedownProposals(takedownProposalIds);
      await finalizeProposals(allProposalIds);
    };

  const addProposals = async (
    beneficiaries: SignerWithAddress[],
    proposalType: ProposalType
  ): Promise<number[]> => {
    console.log(
      `Adding ${beneficiaries.length} ${
        proposalType === 0 ? "nomination" : "takedown"
      } proposals...`
    );
    const proposalIds = await bluebird.map(
      beneficiaries,
      async (beneficiary) => {
        const tx = await contracts.beneficiaryGovernance
          .connect(beneficiary)
          .createProposal(
            beneficiary.address,
            DEFAULT_REGION,
            getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
            proposalType,
            { gasLimit: 3000000 }
          );
        const receipt = await tx.wait(1);
        const id = await getCreatedProposalId(
          receipt.transactionHash,
          ethers.provider
        );
        return id;
      },
      { concurrency: 1 }
    );
    return proposalIds;
  };

  const voteOnNominationProposals = async (
    proposalIds: number[]
  ): Promise<void> => {
    console.log("Voting on nomination proposals...");
    // These nomination proposals will pass
    await bluebird.map(
      proposalIds.slice(0, 4),
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(voters[0])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(voters[1])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(voters[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
    // These nomination proposals will fail
    await bluebird.map(
      proposalIds.slice(4, 6),
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(voters[0])
          .vote(proposalId, Vote.No);
        await contracts.beneficiaryGovernance
          .connect(voters[1])
          .vote(proposalId, Vote.No);
        await contracts.beneficiaryGovernance
          .connect(voters[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
  };

  const voteOnTakedownProposals = async (
    proposalIds: number[]
  ): Promise<void> => {
    console.log("Voting on takedown proposals");
    // These takedown proposals will pass
    await bluebird.map(
      proposalIds.slice(0, 4),
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(voters[0])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(voters[1])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(voters[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
    // These takedown proposals will fail
    await bluebird.map(
      proposalIds.slice(4, 6),
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(voters[0])
          .vote(proposalId, Vote.No);
        await contracts.beneficiaryGovernance
          .connect(voters[1])
          .vote(proposalId, Vote.No);
        await contracts.beneficiaryGovernance
          .connect(voters[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
  };

  const isInChallengePeriod = (status: number) => status === 1;
  const isPendingFinalization = (status: number) => status === 2;

  const finalizeProposals = async (proposalIds: number[]): Promise<void> => {
    console.log("finalizing nomination/takedown proposals");
    let allProposalsPendingFinalization = false;
    console.log("Waiting for proposals to be in finalisation period");
    while (!allProposalsPendingFinalization) {
      await new Promise((r) => setTimeout(r, 1000));
      const proposalStatuses: number[] = await bluebird.map(
        proposalIds,
        async (proposalId) => {
          await contracts.beneficiaryGovernance.refreshState(proposalId);
          const proposalStatus =
            await contracts.beneficiaryGovernance.getStatus(proposalId);
          return proposalStatus;
        },
        { concurrency: 1 }
      );
      allProposalsPendingFinalization = proposalStatuses.every(
        isPendingFinalization
      );
      console.log(
        "Waiting for all proposals to be in pending finalization period..."
      );
    }
    console.log("Finalising nomination and takedown proposals");
    await bluebird.map(
      proposalIds,
      async (x, i) => {
        await contracts.beneficiaryGovernance.connect(accounts[0]).finalize(i);
      },
      { concurrency: 1 }
    );
  };

  const addProposalsInVetoPeriod = async (): Promise<void> => {
    // Short open voting period
    await contracts.beneficiaryGovernance
      .connect(accounts[0])
      .setConfiguration(30, 2 * SECONDS_IN_DAY, parseEther("2000"));
    const nominationProposalIds = await addProposals(
      beneficiaries.slice(12, 14),
      0
    );
    const takedownProposalIds = await addProposals(
      beneficiaries.slice(14, 16),
      1
    );
    const allProposalIds = nominationProposalIds.concat(takedownProposalIds);
    console.log(
      "Voting in open period on nomination and takedown proposals..."
    );
    await bluebird.map(
      allProposalIds,
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[0])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[1])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
    let allProposalsInChallengePeriod = false;
    while (!allProposalsInChallengePeriod) {
      await new Promise((r) => setTimeout(r, 1000));
      const proposalStatuses: number[] = await bluebird.map(
        allProposalIds,
        async (proposalId) => {
          await contracts.beneficiaryGovernance.refreshState(proposalId);
          const proposalStatus =
            await contracts.beneficiaryGovernance.getStatus(proposalId);
          return proposalStatus;
        },
        { concurrency: 1 }
      );
      allProposalsInChallengePeriod =
        proposalStatuses.every(isInChallengePeriod);
      console.log("Waiting for all proposals to be in challenge period...");
    }
    console.log(
      "Voting in challenge period on nomination and takedown proposals..."
    );
    await bluebird.map(
      allProposalIds,
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[3])
          .vote(proposalId, Vote.No);
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[4])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
    await bluebird.map(
      allProposalIds,
      async (proposalId) => {
        await contracts.beneficiaryGovernance.refreshState(proposalId);
      },
      { concurrency: 1 }
    );
  };

  const addProposalsInOpenPeriod = async (): Promise<void> => {
    await contracts.beneficiaryGovernance
      .connect(accounts[0])
      .setConfiguration(
        2 * SECONDS_IN_DAY,
        2 * SECONDS_IN_DAY,
        parseEther("2000")
      );
    const nominationProposalIds = await addProposals(
      beneficiaries.slice(16, 18),
      0
    );
    const takedownProposalIds = await addProposals(beneficiaries.slice(18), 1);
    const allProposalIds = nominationProposalIds.concat(takedownProposalIds);
    console.log(
      "Voting in open period on nomination and takedown proposals..."
    );
    await bluebird.map(
      allProposalIds,
      async (proposalId) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[0])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[1])
          .vote(proposalId, Vote.Yes);
        await contracts.beneficiaryGovernance
          .connect(beneficiaries[2])
          .vote(proposalId, Vote.No);
      },
      { concurrency: 1 }
    );
  };

  const registerBeneficiariesForElection = async (
    grantTerm,
    beneficiaries
  ): Promise<void> => {
    console.log("getting election id");
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      grantTerm
    );
    console.log(`registering beneficiaries for election (${grantTerm}) ...`);
    await bluebird.map(
      beneficiaries,
      async (beneficiary: string) => {
        await contracts.grantElections.registerForElection(
          beneficiary,
          electionId,
          { gasLimit: 3000000 }
        );
      },
      { concurrency: 1 }
    );
  };

  const refreshElectionState = async (
    electionTerm: ElectionTerm
  ): Promise<void> => {
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      electionTerm
    );
    await contracts.grantElections.refreshElectionState(electionId);
  };

  const initializeMonthlyElection = async (): Promise<void> => {
    const electionTerm = ElectionTerm.Monthly;
    console.log(`setting election config for: ${electionTerm} ...`);
    await contracts.grantElections.connect(accounts[0]).setConfiguration(
      electionTerm,
      2,
      5,
      false, // VRF
      7 * SECONDS_IN_DAY, // Registration period - default
      7 * SECONDS_IN_DAY, // Voting period - default
      21 * SECONDS_IN_DAY, // cooldown period - default
      parseEther("100"),
      true,
      parseEther("2000"),
      true,
      ShareType.EqualWeight
    );

    console.log(`initializing election : ${electionTerm} ...`);
    const activeBeneficiaryAddresses = await getActiveBeneficiaries();
    await contracts.grantElections.initialize(electionTerm, DEFAULT_REGION);
    await registerBeneficiariesForElection(
      electionTerm,
      activeBeneficiaryAddresses.slice(0, 4)
    );
  };

  const initializeQuarterlyElection = async (): Promise<void> => {
    const electionTerm = ElectionTerm.Quarterly;
    console.log(`setting election config for: ${electionTerm} ...`);
    console.log(
      `Reducing reg period to 1s, voting to 120s and cooldown to 100s`
    );
    await contracts.grantElections.connect(accounts[0]).setConfiguration(
      electionTerm,
      2,
      5,
      false, // VRF
      10, // Registration period - reduced
      20, // Voting period - reduced
      83 * SECONDS_IN_DAY, // cooldown period - default
      parseEther("100"),
      true,
      parseEther("2000"),
      true,
      ShareType.EqualWeight
    );
    console.log(`initializing election : ${electionTerm} ...`);
    const activeBeneficiaryAddresses = await getActiveBeneficiaries();
    await contracts.grantElections.initialize(electionTerm, DEFAULT_REGION);
    await registerBeneficiariesForElection(
      electionTerm,
      activeBeneficiaryAddresses.slice(0, 4)
    );
  };

  const initializeYearlyElection = async (): Promise<void> => {
    const electionTerm = ElectionTerm.Yearly;
    console.log(`setting election config for: ${electionTerm} ...`);
    await contracts.grantElections.connect(accounts[0]).setConfiguration(
      electionTerm,
      2,
      5,
      false, // VRF
      10, // Registration period - reduced
      30 * SECONDS_IN_DAY, // Voting period - default
      358 * SECONDS_IN_DAY, // cooldown period - default
      parseEther("100"),
      true,
      parseEther("2000"),
      true,
      ShareType.EqualWeight
    );

    console.log(`initializing election : ${electionTerm} ...`);
    const activeBeneficiaryAddresses = await getActiveBeneficiaries();
    await contracts.grantElections.initialize(electionTerm, DEFAULT_REGION);
    await registerBeneficiariesForElection(
      electionTerm,
      activeBeneficiaryAddresses.slice(0, 4)
    );
  };

  const voteInQuarterlyElection = async (): Promise<void> => {
    console.log("Getting quarterly election meta data");
    let electionMetadata = await GrantElectionAdapter(
      contracts.grantElections
    ).getElectionMetadata(ElectionTerm.Quarterly);

    console.log("Refreshing election state");
    while (electionMetadata.electionState != 1) {
      await new Promise((r) => setTimeout(r, 1000));
      await contracts.grantElections.refreshElectionState(
        ElectionTerm.Quarterly
      );
      electionMetadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(ElectionTerm.Quarterly);
      console.log("Waiting for quarterly election to enter voting period...");
    }
    console.log("Quarterly election in voting period. Voting...");
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      ElectionTerm.Quarterly
    );
    const activeBeneficiaryAddresses = await getActiveBeneficiaries();
    await bluebird.map(
      voters,
      async (voter: SignerWithAddress) => {
        await contracts.grantElections.connect(voter).vote(
          activeBeneficiaryAddresses
            .slice(0, 4)
            .map((beneficiary) => beneficiary),
          [
            utils.parseEther("100"),
            utils.parseEther("200"),
            utils.parseEther("300"),
            utils.parseEther("350"),
          ],
          electionId
        );
      },
      { concurrency: 1 }
    );

    while (electionMetadata.votes.length < 4) {
      await new Promise((r) => setTimeout(r, 1000));
      electionMetadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(ElectionTerm.Quarterly);
      console.log(
        "Waiting for confirmation of all votes in quarterly election..."
      );
    }

    console.log("Refreshing election state");
    while (electionMetadata.electionState != 2) {
      await contracts.grantElections.refreshElectionState(
        ElectionTerm.Quarterly
      );
      electionMetadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(ElectionTerm.Quarterly);
      await new Promise((r) => setTimeout(r, 1000));
      console.log("Waiting for quarterly election to close...");
    }

    console.log(
      `Quarterly Election metadata: `,
      await GrantElectionAdapter(contracts.grantElections).getElectionMetadata(
        ElectionTerm.Quarterly
      )
    );
  };

  const voteInYearlyElection = async (): Promise<void> => {
    console.log("Getting yearly election meta data");
    let electionMetadata = await GrantElectionAdapter(
      contracts.grantElections
    ).getElectionMetadata(ElectionTerm.Yearly);

    console.log("Refreshing election state");
    while (electionMetadata.electionState != 1) {
      await new Promise((r) => setTimeout(r, 1000));
      await contracts.grantElections.refreshElectionState(ElectionTerm.Yearly);
      electionMetadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(ElectionTerm.Yearly);
      console.log("Waiting for Yearly election to enter voting period...");
    }
    console.log("Yearly election in voting period. Voting...");
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      ElectionTerm.Yearly
    );
    const activeBeneficiaryAddresses = await getActiveBeneficiaries();
    await bluebird.map(
      voters,
      async (voter: SignerWithAddress) => {
        await contracts.grantElections.connect(voter).vote(
          activeBeneficiaryAddresses
            .slice(0, 4)
            .map((beneficiary) => beneficiary),
          [
            utils.parseEther("100"),
            utils.parseEther("200"),
            utils.parseEther("300"),
            utils.parseEther("350"),
          ],
          electionId
        );
      },
      { concurrency: 1 }
    );

    while (electionMetadata.votes.length < 4) {
      await new Promise((r) => setTimeout(r, 1000));
      electionMetadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(ElectionTerm.Yearly);
      console.log(
        "Waiting for confirmation of all votes in yearly election..."
      );
    }
  };

  const closeQuarterlyElectionState = async (): Promise<void> => {
    console.log(`closing quarterly election...`);
    await refreshElectionState(ElectionTerm.Quarterly);
  };

  const logResults = async (): Promise<void> => {
    console.log(`
Paste this into your .env file:

ADDR_BENEFICIARY_REGISTRY=${contracts.beneficiaryRegistry.address}
ADDR_POP=${contracts.mockPop.address}
ADDR_STAKING=${contracts.staking.address}
ADDR_RANDOM_NUMBER=${contracts.randomNumberConsumer.address}
ADDR_BENEFICIARY_GOVERNANCE=${contracts.beneficiaryGovernance.address}
ADDR_GOVERNANCE=${accounts[0].address}
ADDR_GRANT_ELECTION=${contracts.grantElections.address}
ADDR_BENEFICIARY_VAULT=${contracts.beneficiaryVaults.address}
ADDR_REWARDS_MANAGER=${contracts.rewardsManager.address}
ADDR_UNISWAP_ROUTER=${contracts.uniswapRouter.address}
ADDR_3CRV=${contracts.mock3CRV.address}
ADDR_REGION=${contracts.region.address}
ADDR_REWARDS_ESCROW=${contracts.rewardsEscrow.address}
    `);
  };

  const getActiveBeneficiaries = async (): Promise<string[]> => {
    const beneficiaryAddresses =
      await contracts.beneficiaryRegistry.getBeneficiaryList();
    // Remove revoked beneficiaries
    return beneficiaryAddresses.filter(
      (address) => address !== "0x0000000000000000000000000000000000000000"
    );
  };

  await setSigners();
  await giveBeneficiariesETH();
  await deployContracts();
  await addBeneficiariesToRegistry();
  await mintPOP();
  await approveForStaking();
  await prepareUniswap();
  await fundRewardsManager();
  await stakePOP();
  await transferBeneficiaryRegistryOwnership();
  await updateProposalSettings();
  await addFinalizedProposalsAndBeneficiariesToRegistry();
  await initializeMonthlyElection();
  await initializeQuarterlyElection();
  await initializeYearlyElection();
  await voteInQuarterlyElection();
  await voteInYearlyElection();
  await closeQuarterlyElectionState();
  await addProposalsInVetoPeriod();
  await addProposalsInOpenPeriod();
  await logResults();
}
