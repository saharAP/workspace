import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ElectionTerm, ProposalType } from "@popcorn/contracts/adapters";
import { getBytes32FromIpfsHash } from "@popcorn/utils";
import bluebird from "bluebird";
import { deployContract } from "ethereum-waffle";
import { Contract, utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import getCreatedProposalId from "../adapters/GrantElection/getCreatedProposalId";
import { ShareType } from "../adapters/GrantElection/GrantElectionAdapter";
import * as addressCidMap from "./addressCidMap.json";

const UniswapV2FactoryJSON = require("../artifactsUniswap/UniswapV2Factory.json");
const UniswapV2Router02JSON = require("../artifactsUniswap/UniswapV2Router.json");
const UniswapV2PairJSON = require("../artifactsUniswap/UniswapV2Pair.json");

// This script creates two beneficiaries and one quarterly grant that they are both eligible for. Run this
// Run this instead of the normal deploy.js script
const DEFAULT_REGION = "0x5757";
interface Contracts {
  beneficiaryRegistry: Contract;
  mockPop: Contract;
  staking: Contract;
  randomNumberConsumer: Contract;
  grantElections: Contract;
  beneficiaryVaults: Contract;
  rewardsEscrow: Contract;
  rewardsManager: Contract;
  mock3CRV: Contract;
  uniswapFactory: Contract;
  uniswapRouter: Contract;
  uniswapPair: Contract;
  beneficiaryGovernance: Contract;
  region: Contract;
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
      await (await ethers.getContractFactory("MockERC20")).deploy(
        "TestPOP",
        "TPOP",
        18
      )
    ).deployed();

    const beneficiaryVaults = await (
      await (await ethers.getContractFactory("BeneficiaryVaults")).deploy(
        mockPop.address
      )
    ).deployed();

    const region = await (
      await (await ethers.getContractFactory("Region")).deploy(
        beneficiaryVaults.address
      )
    ).deployed();

    const beneficiaryRegistry = await (
      await (await ethers.getContractFactory("BeneficiaryRegistry")).deploy(
        region.address
      )
    ).deployed();

    const mock3CRV = await (
      await (await ethers.getContractFactory("MockERC20")).deploy(
        "3CURVE",
        "3CRV",
        18
      )
    ).deployed();

    const WETH = await (
      await (await ethers.getContractFactory("WETH9")).deploy()
    ).deployed();

    const rewardsEscrow = await (
      await (await ethers.getContractFactory("RewardsEscrow")).deploy(
        mockPop.address
      )
    ).deployed();

    const staking = await (
      await (await ethers.getContractFactory("Staking")).deploy(
        mockPop.address,
        rewardsEscrow.address
      )
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
      await (await ethers.getContractFactory("RewardsManager")).deploy(
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
      await (await ethers.getContractFactory("RandomNumberConsumer")).deploy(
        process.env.ADDR_CHAINLINK_VRF_COORDINATOR,
        process.env.ADDR_CHAINLINK_LINK_TOKEN,
        process.env.ADDR_CHAINLINK_KEY_HASH
      )
    ).deployed();

    const beneficiaryGovernance = await (
      await (await ethers.getContractFactory("BeneficiaryGovernance")).deploy(
        staking.address,
        beneficiaryRegistry.address,
        mockPop.address,
        region.address,
        accounts[0].address
      )
    ).deployed();

    const grantElections = await (
      await (await ethers.getContractFactory("GrantElections")).deploy(
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

  const addClosedProposals = async (): Promise<void> => {
    await addProposals(beneficiaries.slice(0, 6), 0);
    await addProposals(beneficiaries.slice(6, 12), 1);
    console.log("getting number of proposals...");
    const numNominationProposals = await contracts.beneficiaryGovernance
      .connect(accounts[0])
      .getNumberOfProposals(0);
    const numTakedownProposals = await contracts.beneficiaryGovernance
      .connect(accounts[0])
      .getNumberOfProposals(1);
    await voteOnNominationProposals();
    await voteOnTakedownProposals();
    await finalizeProposals();
  };

  const addProposals = async (
    beneficiaries: SignerWithAddress[],
    proposalType: ProposalType
  ): Promise<void> => {
    console.log(
      `adding ${proposalType === 0 ? "nomination" : "takedown"} proposals...`
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
        console.log(receipt);
        const id = await getCreatedProposalId(
          receipt.transactionHash,
          ethers.provider
        );
        return id;
      },
      { concurrency: 1 }
    );
    console.log({ proposalIds });
  };

  const voteOnNominationProposals = async (): Promise<void> => {
    console.log("voting on nomination proposals");
    // These nomination proposals will pass
    await bluebird.map(beneficiaries.slice(0, 4), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(voters[0])
        .vote(i, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(voters[1])
        .vote(i, Vote.Yes);
      await contracts.beneficiaryGovernance.connect(voters[2]).vote(i, Vote.No);
    });
    // These nomination proposals will fail
    await bluebird.map(beneficiaries.slice(4, 6), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(voters[0])
        .vote(i + 4, Vote.No);
      await contracts.beneficiaryGovernance
        .connect(voters[1])
        .vote(i + 4, Vote.No);
      await contracts.beneficiaryGovernance
        .connect(voters[2])
        .vote(i + 4, Vote.No);
    });
  };

  const voteOnTakedownProposals = async (): Promise<void> => {
    console.log("voting on takedown proposals");
    // These takedown proposals will pass
    await bluebird.map(beneficiaries.slice(6, 10), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(voters[0])
        .vote(i + 6, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(voters[1])
        .vote(i + 6, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(voters[2])
        .vote(i + 6, Vote.No);
    });
    // These takedown proposals will fail
    await bluebird.map(beneficiaries.slice(10, 12), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(voters[0])
        .vote(i + 10, Vote.No);
      await contracts.beneficiaryGovernance
        .connect(voters[1])
        .vote(i + 10, Vote.No);
      await contracts.beneficiaryGovernance
        .connect(voters[2])
        .vote(i + 10, Vote.No);
    });
  };

  const finalizeProposals = async (): Promise<void> => {
    console.log("finalizing nomination/takedown proposals");
    await increaseEvmTimeAndMine(4);
    await bluebird.map(
      beneficiaries.slice(0, 12),
      async (x, i) => {
        await contracts.beneficiaryGovernance.connect(accounts[0]).finalize(i);
      },
      { concurrency: 1 }
    );
  };

  const addVetoProposals = async (): Promise<void> => {
    console.log("adding veto nomination proposals...");
    await bluebird.map(
      beneficiaries.slice(12, 14),
      async (beneficiary) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiary)
          .createProposal(
            beneficiary.address,
            DEFAULT_REGION,
            getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
            ProposalType.Nomination,
            { gasLimit: 3000000 }
          );
      },
      { concurrency: 1 }
    );
    console.log("adding veto takedown proposals...");
    await bluebird.map(
      beneficiaries.slice(14, 16),
      async (beneficiary) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiary)
          .createProposal(
            beneficiary.address,
            DEFAULT_REGION,
            getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
            ProposalType.Takedown,
            { gasLimit: 3000000 }
          );
      },
      { concurrency: 1 }
    );
    console.log("voting on nomination and takedown proposals");
    await bluebird.map(beneficiaries.slice(12, 16), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[0])
        .vote(i + 12, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[1])
        .vote(i + 12, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[2])
        .vote(i + 12, Vote.No);
    });

    await increaseEvmTimeAndMine(2);

    await bluebird.map(beneficiaries.slice(12, 16), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[3])
        .vote(i + 12, Vote.No);
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[4])
        .vote(i + 12, Vote.No);
    });
  };

  const addOpenProposals = async (): Promise<void> => {
    console.log("adding veto nomination proposals...");
    await bluebird.map(
      beneficiaries.slice(16, 18),
      async (beneficiary) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiary)
          .createProposal(
            beneficiary.address,
            DEFAULT_REGION,
            getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
            ProposalType.Nomination,
            { gasLimit: 3000000 }
          );
      },
      { concurrency: 1 }
    );
    console.log("adding veto takedown proposals...");
    await bluebird.map(
      beneficiaries.slice(18),
      async (beneficiary) => {
        await contracts.beneficiaryGovernance
          .connect(beneficiary)
          .createProposal(
            beneficiary.address,
            DEFAULT_REGION,
            getBytes32FromIpfsHash(addressCidMap[beneficiary.address]),
            ProposalType.Takedown,
            { gasLimit: 3000000 }
          );
      },
      { concurrency: 1 }
    );
    console.log("voting on nomination and takedown proposals");
    await bluebird.map(beneficiaries.slice(16), async (x, i) => {
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[0])
        .vote(i + 16, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[1])
        .vote(i + 16, Vote.Yes);
      await contracts.beneficiaryGovernance
        .connect(beneficiaries[2])
        .vote(i + 16, Vote.No);
    });
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
      14 * SECONDS_IN_DAY,
      14 * SECONDS_IN_DAY,
      83 * SECONDS_IN_DAY,
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
    await contracts.grantElections.connect(accounts[0]).setConfiguration(
      electionTerm,
      2,
      5,
      false, // VRF
      2 * SECONDS_IN_DAY,
      2 * SECONDS_IN_DAY,
      83 * SECONDS_IN_DAY,
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
      7 * SECONDS_IN_DAY,
      7 * SECONDS_IN_DAY,
      358 * SECONDS_IN_DAY,
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
    const electionTerm = ElectionTerm.Quarterly;
    console.log(`opening quarterly election...`);
    await increaseEvmTimeAndMine(3);
    await refreshElectionState(electionTerm);
    console.log(`voting in quarterly election...`);
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      electionTerm
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
  };

  const voteInYearlyElection = async (): Promise<void> => {
    const electionTerm = ElectionTerm.Yearly;
    console.log(`opening yearly election...`);
    await increaseEvmTimeAndMine(8);
    await refreshElectionState(electionTerm);
    console.log(`voting in yearly election...`);
    const electionId = await contracts.grantElections.activeElections(
      DEFAULT_REGION,
      electionTerm
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
    `);
  };

  const increaseEvmTimeAndMine = async (days: number): Promise<void> => {
    ethers.provider.send("evm_increaseTime", [days * SECONDS_IN_DAY]);
    ethers.provider.send("evm_mine", []);
  };

  const getActiveBeneficiaries = async (): Promise<string[]> => {
    const beneficiaryAddresses = await contracts.beneficiaryRegistry.getBeneficiaryList();
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
  await addClosedProposals();
  await initializeMonthlyElection();
  await initializeQuarterlyElection();
  await initializeYearlyElection();
  await voteInQuarterlyElection();
  await voteInYearlyElection();
  await closeQuarterlyElectionState();
  await addVetoProposals();
  await addOpenProposals();
  await logResults();
}
