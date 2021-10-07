import { MockContract } from "@ethereum-waffle/mock-contract";
import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { GrantElectionAdapter } from "@popcorn/contracts/adapters";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import {
  ElectionMetadata,
  ShareType,
} from "../adapters/GrantElection/GrantElectionAdapter";
import { calculateVaultShare, rankAwardees } from "../scripts/finalizeElection";
import {
  BeneficiaryVaults,
  GrantElections,
  MockERC20,
  RandomNumberHelper,
} from "../typechain";

interface Contracts {
  mockPop: MockERC20;
  mockStaking: MockContract;
  mockBeneficiaryRegistry: MockContract;
  beneficiaryVaults: BeneficiaryVaults;
  randomNumberHelper: RandomNumberHelper;
  grantElections: GrantElections;
}

let owner: SignerWithAddress,
  nonOwner: SignerWithAddress,
  beneficiary: SignerWithAddress,
  beneficiary2: SignerWithAddress,
  beneficiary3: SignerWithAddress,
  beneficiary4: SignerWithAddress,
  beneficiary5: SignerWithAddress,
  voter1: SignerWithAddress,
  voter2: SignerWithAddress,
  voter3: SignerWithAddress,
  voter4: SignerWithAddress,
  voter5: SignerWithAddress,
  voter6: SignerWithAddress,
  governance: SignerWithAddress;

let contracts: Contracts;

const GRANT_TERM = { MONTH: 0, QUARTER: 1, YEAR: 2 };
const ONE_DAY = 86400;
const DEFAULT_REGION = "0x5757";
const ElectionState = { Registration: 0, Voting: 1, Closed: 2 };
const registrationBondMonth = parseEther("50");
const registrationBondQuarter = parseEther("100");
const electionId = 0;

async function deployContracts(): Promise<Contracts> {
  const mockPop = await (
    await (
      await ethers.getContractFactory("MockERC20")
    ).deploy("TestPOP", "TPOP", 18)
  ).deployed();
  await mockPop.mint(owner.address, parseEther("6500"));
  await mockPop.mint(beneficiary.address, parseEther("500"));
  await mockPop.mint(beneficiary2.address, parseEther("500"));
  await mockPop.mint(beneficiary3.address, parseEther("500"));
  await mockPop.mint(beneficiary4.address, parseEther("500"));
  await mockPop.mint(beneficiary5.address, parseEther("500"));

  const stakingFactory = await ethers.getContractFactory("Staking");
  const mockStaking = await waffle.deployMockContract(
    owner,
    stakingFactory.interface.format() as any[]
  );

  const beneficiaryRegistryFactory = await ethers.getContractFactory(
    "BeneficiaryRegistry"
  );
  const mockBeneficiaryRegistry = await waffle.deployMockContract(
    owner,
    beneficiaryRegistryFactory.interface.format() as any[]
  );

  const randomNumberHelper = await (
    await (
      await ethers.getContractFactory("RandomNumberHelper")
    ).deploy(
      owner.address,
      mockPop.address,
      ethers.utils.formatBytes32String("secret")
    )
  ).deployed();

  await mockPop
    .connect(owner)
    .transfer(randomNumberHelper.address, parseEther("500"));

  const beneficiaryVaults = await (
    await (
      await ethers.getContractFactory("BeneficiaryVaults")
    ).deploy(mockPop.address)
  ).deployed();

  await beneficiaryVaults
    .connect(owner)
    .setBeneficiaryRegistry(mockBeneficiaryRegistry.address);

  const region = await (
    await (
      await ethers.getContractFactory("Region")
    ).deploy(beneficiaryVaults.address)
  ).deployed();

  const grantElections = (await (
    await (
      await ethers.getContractFactory("GrantElections")
    ).deploy(
      mockStaking.address,
      mockBeneficiaryRegistry.address,
      randomNumberHelper.address,
      mockPop.address,
      region.address,
      governance.address
    )
  ).deployed()) as GrantElections;

  await mockPop
    .connect(owner)
    .approve(grantElections.address, parseEther("100000"));
  await grantElections.connect(owner).contributeReward(parseEther("2000"));
  await beneficiaryVaults.transferOwnership(grantElections.address);

  return {
    mockPop,
    mockStaking,
    mockBeneficiaryRegistry,
    beneficiaryVaults,
    randomNumberHelper,
    grantElections,
  };
}

async function prepareElection(
  grantTerm: number,
  electionId: number
): Promise<void> {
  await contracts.grantElections.initialize(grantTerm, DEFAULT_REGION);
  await contracts.mockStaking.mock.getVoiceCredits.returns(100);
  await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(true);
  await contracts.grantElections
    .connect(beneficiary)
    .registerForElection(beneficiary.address, electionId);
  await contracts.grantElections
    .connect(beneficiary)
    .registerForElection(beneficiary2.address, electionId);
  await contracts.grantElections
    .connect(beneficiary)
    .registerForElection(beneficiary3.address, electionId);
  await contracts.grantElections
    .connect(beneficiary)
    .registerForElection(beneficiary4.address, electionId);
  await contracts.grantElections
    .connect(beneficiary)
    .registerForElection(beneficiary5.address, electionId);
  ethers.provider.send("evm_increaseTime", [1000]);
  ethers.provider.send("evm_mine", []);
  await contracts.grantElections.vote(
    [
      beneficiary.address,
      beneficiary2.address,
      beneficiary3.address,
      beneficiary4.address,
      beneficiary5.address,
    ],
    [40, 15, 20, 15, 10],
    electionId
  );
}

describe("GrantElections", function () {
  beforeEach(async function () {
    [
      owner,
      nonOwner,
      beneficiary,
      beneficiary2,
      beneficiary3,
      beneficiary4,
      beneficiary5,
      voter1,
      voter2,
      voter3,
      voter4,
      voter5,
      voter6,
      governance,
    ] = await ethers.getSigners();
    contracts = await deployContracts();
  });

  describe("defaults", function () {
    it("should set correct monthly defaults", async function () {
      const monthly = await GrantElectionAdapter(
        contracts.grantElections
      ).electionDefaults(GRANT_TERM.MONTH);
      expect(monthly).to.deep.contains({
        registrationBondRequired: true,
        registrationBond: parseEther("50"),
        useChainLinkVRF: true,
        ranking: 3,
        awardees: 1,
        registrationPeriod: 7 * ONE_DAY,
        votingPeriod: 7 * ONE_DAY,
        cooldownPeriod: 21 * ONE_DAY,
        finalizationIncentive: parseEther("2000"),
        enabled: true,
        shareType: ShareType.EqualWeight,
      });
    });

    it("should set correct quarterly defaults", async function () {
      const quarterly = await GrantElectionAdapter(
        contracts.grantElections
      ).electionDefaults(GRANT_TERM.QUARTER);
      expect(quarterly).to.deep.contains({
        registrationBondRequired: true,
        registrationBond: parseEther("100"),
        useChainLinkVRF: true,
        ranking: 5,
        awardees: 2,
        registrationPeriod: 14 * ONE_DAY,
        votingPeriod: 14 * ONE_DAY,
        cooldownPeriod: 83 * ONE_DAY,
        finalizationIncentive: parseEther("2000"),
        enabled: true,
        shareType: ShareType.EqualWeight,
      });
    });
    it("should set correct yearly defaults", async function () {
      const yearly = await GrantElectionAdapter(
        contracts.grantElections
      ).electionDefaults(GRANT_TERM.YEAR);
      expect(yearly).to.deep.contains({
        registrationBondRequired: true,
        registrationBond: parseEther("1000"),
        useChainLinkVRF: true,
        ranking: 7,
        awardees: 3,
        registrationPeriod: 30 * ONE_DAY,
        votingPeriod: 30 * ONE_DAY,
        cooldownPeriod: 358 * ONE_DAY,
        finalizationIncentive: parseEther("2000"),
        enabled: true,
        shareType: ShareType.EqualWeight,
      });
    });

    it("should set configuration for grant elections", async function () {
      await contracts.grantElections
        .connect(governance)
        .setConfiguration(
          GRANT_TERM.QUARTER,
          15,
          10,
          false,
          100,
          100,
          100,
          0,
          false,
          parseEther("100"),
          true,
          0
        );
      const quarter = await GrantElectionAdapter(
        contracts.grantElections
      ).electionDefaults(GRANT_TERM.QUARTER);
      expect(quarter).to.deep.contains({
        ranking: 15,
        awardees: 10,
        useChainLinkVRF: false,
        registrationPeriod: 100,
        votingPeriod: 100,
        cooldownPeriod: 100,
        registrationBond: parseEther("0"),
        registrationBondRequired: false,
        finalizationIncentive: parseEther("100"),
        enabled: true,
        shareType: ShareType.EqualWeight,
      });
    });
  });

  describe("setters", function () {
    it("should prevent non-governance address from updating governance address", async function () {
      await expect(
        contracts.grantElections
          .connect(nonOwner)
          .nominateNewGovernance(nonOwner.address)
      ).to.be.revertedWith(
        "Only the contract governance may perform this action"
      );
    });

    it("should allow governance to set new governance address", async function () {
      await expect(
        contracts.grantElections
          .connect(governance)
          .nominateNewGovernance(nonOwner.address)
      )
        .to.emit(contracts.grantElections, "GovernanceNominated")
        .withArgs(nonOwner.address);
    });

    it("should allow to fund incentives", async function () {
      await contracts.grantElections
        .connect(owner)
        .fundKeeperIncentive(parseEther("4000"));
      const incentiveBudget = await contracts.grantElections.incentiveBudget();
      const balance = await contracts.mockPop.balanceOf(owner.address);
      expect(incentiveBudget).to.equal(parseEther("4000"));
      expect(balance).to.equal(parseEther("0"));
    });
  });

  describe("approver and proposer maintance", function () {
    context("proposer", function () {
      context("adding", function () {
        it("must be called by the governance", async function () {
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .addProposer(beneficiary.address)
          ).to.be.revertedWith(
            "Only the contract governance may perform this action"
          );
        });
        it("requires the account not to be a proposer already", async function () {
          await contracts.grantElections
            .connect(governance)
            .addProposer(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .addProposer(beneficiary.address)
          ).to.be.revertedWith("already registered");
        });
        it("requires the account not to be a approver already", async function () {
          await contracts.grantElections
            .connect(governance)
            .addApprover(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .addProposer(beneficiary.address)
          ).to.be.revertedWith("is already an approver");
        });
        it("adds the account as a proposer", async function () {
          await expect(
            contracts.grantElections
              .connect(governance)
              .addProposer(beneficiary.address)
          )
            .to.emit(contracts.grantElections, "ProposerAdded")
            .withArgs(beneficiary.address);
          expect(
            await contracts.grantElections.proposer(beneficiary.address)
          ).to.be.equal(true);
        });
      });
      context("removing", function () {
        it("must be called by the governance", async function () {
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .removeProposer(beneficiary.address)
          ).to.be.revertedWith(
            "Only the contract governance may perform this action"
          );
        });
        it("requires the account to be a proposer", async function () {
          await expect(
            contracts.grantElections
              .connect(governance)
              .removeProposer(beneficiary.address)
          ).to.be.revertedWith("not registered");
        });
        it("removes the proposer", async function () {
          await contracts.grantElections
            .connect(governance)
            .addProposer(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .removeProposer(beneficiary.address)
          )
            .to.emit(contracts.grantElections, "ProposerRemoved")
            .withArgs(beneficiary.address);
          expect(
            await contracts.grantElections.proposer(beneficiary.address)
          ).to.be.equal(false);
        });
      });
    });
    context("approver", function () {
      context("adding", function () {
        it("must be called by the governance", async function () {
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .addApprover(beneficiary.address)
          ).to.be.revertedWith(
            "Only the contract governance may perform this action"
          );
        });
        it("requires the account not to be a approver already", async function () {
          await contracts.grantElections
            .connect(governance)
            .addApprover(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .addApprover(beneficiary.address)
          ).to.be.revertedWith("already registered");
        });
        it("requires the account not to be a proposer already", async function () {
          await contracts.grantElections
            .connect(governance)
            .addProposer(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .addApprover(beneficiary.address)
          ).to.be.revertedWith("is already a proposer");
        });
        it("adds the account as a approver", async function () {
          await expect(
            contracts.grantElections
              .connect(governance)
              .addApprover(beneficiary.address)
          )
            .to.emit(contracts.grantElections, "ApproverAdded")
            .withArgs(beneficiary.address);
          expect(
            await contracts.grantElections.approver(beneficiary.address)
          ).to.be.equal(true);
        });
      });
      context("removing", function () {
        it("must be called by the governance", async function () {
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .removeApprover(beneficiary.address)
          ).to.be.revertedWith(
            "Only the contract governance may perform this action"
          );
        });
        it("requires the account to be a approver", async function () {
          await expect(
            contracts.grantElections
              .connect(governance)
              .removeApprover(beneficiary.address)
          ).to.be.revertedWith("not registered");
        });
        it("removes the approver", async function () {
          await contracts.grantElections
            .connect(governance)
            .addApprover(beneficiary.address);
          await expect(
            contracts.grantElections
              .connect(governance)
              .removeApprover(beneficiary.address)
          )
            .to.emit(contracts.grantElections, "ApproverRemoved")
            .withArgs(beneficiary.address);
          expect(
            await contracts.grantElections.approver(beneficiary.address)
          ).to.be.equal(false);
        });
      });
    });
  });

  describe("registration", function () {
    it("should allow beneficiary to register for election with no bond when bond disabled", async function () {
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections
        .connect(governance)
        .toggleRegistrationBondRequirement(GRANT_TERM.YEAR);
      await contracts.grantElections.initialize(
        GRANT_TERM.YEAR,
        DEFAULT_REGION
      );
      await contracts.grantElections.registerForElection(
        beneficiary.address,
        electionId
      );
      const metadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(electionId);
      expect(metadata).to.deep.contains({
        registeredBeneficiaries: [beneficiary.address],
      });
    });

    it("should prevent beneficiary to register for election without a bond", async function () {
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections.initialize(
        GRANT_TERM.YEAR,
        DEFAULT_REGION
      );
      await expect(
        contracts.grantElections
          .connect(beneficiary)
          .registerForElection(beneficiary.address, electionId)
      ).to.be.revertedWith("insufficient registration bond balance");
    });

    it("should allow beneficiary to register for election with a bond", async function () {
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections.initialize(
        GRANT_TERM.YEAR,
        DEFAULT_REGION
      );
      await contracts.mockPop.mint(beneficiary2.address, parseEther("1000"));
      await contracts.mockPop
        .connect(beneficiary2)
        .approve(contracts.grantElections.address, parseEther("1000"));

      await contracts.grantElections
        .connect(beneficiary2)
        .registerForElection(beneficiary2.address, electionId);

      const metadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(electionId);

      expect(metadata).to.deep.contains({
        registeredBeneficiaries: [beneficiary2.address],
      });

      const bennies = await contracts.grantElections.getRegisteredBeneficiaries(
        electionId
      );
      expect(bennies).to.deep.equal([beneficiary2.address]);
    });

    it("should transfer POP to election contract on registration", async function () {
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections.initialize(
        GRANT_TERM.YEAR,
        DEFAULT_REGION
      );
      await contracts.mockPop.mint(beneficiary2.address, parseEther("1000"));
      await contracts.mockPop
        .connect(beneficiary2)
        .approve(contracts.grantElections.address, parseEther("1000"));

      await contracts.grantElections
        .connect(beneficiary2)
        .registerForElection(beneficiary2.address, electionId);

      const popBalanceForElection = await contracts.mockPop.balanceOf(
        contracts.grantElections.address
      );
      expect(popBalanceForElection).to.equal(parseEther("3000"));
    });
  });

  describe("initialization", function () {
    it("should successfully initialize an election if one hasn't already been created", async function () {
      const currentBlock = await waffle.provider.getBlock("latest");
      const result = await contracts.grantElections.initialize(
        GRANT_TERM.QUARTER,
        DEFAULT_REGION
      );
      expect(result)
        .to.emit(contracts.grantElections, "ElectionInitialized")
        .withArgs(
          GRANT_TERM.QUARTER,
          DEFAULT_REGION,
          currentBlock.timestamp + 1
        );
      expect(result)
        .to.emit(contracts.grantElections, "VaultInitialized")
        .withArgs(
          ethers.utils.solidityKeccak256(
            ["uint8", "uint256"],
            [GRANT_TERM.QUARTER, currentBlock.timestamp + 1]
          )
        );
    });

    it("should set correct election metadata", async function () {
      const currentBlock = await waffle.provider.getBlock("latest");
      await contracts.grantElections.initialize(
        GRANT_TERM.QUARTER,
        DEFAULT_REGION
      );
      const metadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(electionId);
      expect(metadata).to.deep.equal({
        votes: [],
        electionTerm: GRANT_TERM.QUARTER,
        registeredBeneficiaries: [],
        electionState: ElectionState.Registration,
        electionStateStringLong: "open for registration",
        electionStateStringShort: "registration",
        bondRequirements: { required: true, amount: parseEther("100") },
        configuration: {
          awardees: 2,
          ranking: 5,
        },
        useChainlinkVRF: true,
        periods: {
          cooldownPeriod: 83 * ONE_DAY, // 83 days
          registrationPeriod: 14 * ONE_DAY, // 14 days
          votingPeriod: 14 * ONE_DAY, // 14 days
        },
        startTime: currentBlock.timestamp + 1,
        randomNumber: 0,
        shareType: 0,
      });
    });

    it("should prevent an election from initializing if it isn't finalized", async function () {
      await contracts.grantElections.initialize(
        GRANT_TERM.QUARTER,
        DEFAULT_REGION
      );
      await expect(
        contracts.grantElections.initialize(GRANT_TERM.QUARTER, DEFAULT_REGION)
      ).to.be.revertedWith("election not yet finalized");
    });
    it("should allow to create a new election for a term when the old one is finalized", async function () {
      await contracts.grantElections
        .connect(governance)
        .addProposer(beneficiary.address);
      await contracts.grantElections
        .connect(governance)
        .addApprover(owner.address);
      const merkleRoot = ethers.utils.formatBytes32String("merkleRoot");
      await contracts.grantElections
        .connect(governance)
        .setConfiguration(
          GRANT_TERM.QUARTER,
          4,
          2,
          false,
          1000,
          20 * 86400,
          100,
          0,
          false,
          parseEther("2000"),
          true,
          0
        );
      await prepareElection(GRANT_TERM.QUARTER, electionId);
      ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
      ethers.provider.send("evm_mine", []);
      await contracts.grantElections.refreshElectionState(electionId);
      await contracts.grantElections
        .connect(beneficiary)
        .proposeFinalization(electionId, merkleRoot);
      await contracts.grantElections
        .connect(owner)
        .approveFinalization(electionId, merkleRoot);
      const currentBlockNumber = await ethers.provider.getBlockNumber();
      const currentBlock = await ethers.provider._getBlock(currentBlockNumber);
      const result = contracts.grantElections.initialize(
        GRANT_TERM.QUARTER,
        DEFAULT_REGION
      );
      await expect(result)
        .to.emit(contracts.grantElections, "ElectionInitialized")
        .withArgs(
          GRANT_TERM.QUARTER,
          DEFAULT_REGION,
          currentBlock.timestamp + 1
        );

      await expect(result)
        .to.emit(contracts.beneficiaryVaults, "VaultClosed")
        .withArgs(GRANT_TERM.QUARTER);

      const activeElectionId = await contracts.grantElections.activeElections(
        DEFAULT_REGION,
        GRANT_TERM.QUARTER
      );
      expect(activeElectionId).to.equal(electionId + 1);
    });
    it("should not initialize a vault even the needed budget is larger than rewardBudget", async function () {
      await contracts.grantElections
        .connect(governance)
        .setRewardsBudget(parseEther("3000"));
      const currentBlock = await waffle.provider.getBlock("latest");
      const result = await contracts.grantElections.initialize(
        GRANT_TERM.QUARTER,
        DEFAULT_REGION
      );
      expect(result)
        .to.emit(contracts.grantElections, "ElectionInitialized")
        .withArgs(
          GRANT_TERM.QUARTER,
          DEFAULT_REGION,
          currentBlock.timestamp + 1
        );
      expect(result).to.not.emit(contracts.grantElections, "VaultInitialized");
      const election = await contracts.grantElections.elections(electionId);
      expect(election.vaultId).to.equal(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });
  });

  describe("voting", function () {
    beforeEach(async function () {
      await contracts.grantElections.initialize(
        GRANT_TERM.MONTH,
        DEFAULT_REGION
      );
    });
    it("should require voice credits", async function () {
      await expect(
        contracts.grantElections.vote([], [], electionId)
      ).to.be.revertedWith("Voice credits are required");
    });

    it("should require beneficiaries", async function () {
      await expect(
        contracts.grantElections.vote([], [1], electionId)
      ).to.be.revertedWith("Beneficiaries are required");
    });

    it("should require election open for voting", async function () {
      await expect(
        contracts.grantElections.vote([beneficiary.address], [1], electionId)
      ).to.be.revertedWith("Election not open for voting");
    });

    it("should require staked voice credits", async function () {
      ethers.provider.send("evm_increaseTime", [7 * ONE_DAY]);
      ethers.provider.send("evm_mine", []);
      await contracts.mockStaking.mock.getVoiceCredits.returns(0);
      await expect(
        contracts.grantElections.vote([beneficiary.address], [1], electionId)
      ).to.be.revertedWith("must have voice credits from staking");
    });

    it("should require eligible beneficiary", async function () {
      ethers.provider.send("evm_increaseTime", [7 * ONE_DAY]);
      ethers.provider.send("evm_mine", []);
      await contracts.mockStaking.mock.getVoiceCredits.returns(10);
      await expect(
        contracts.grantElections.vote([beneficiary.address], [1], electionId)
      ).to.be.revertedWith("ineligible beneficiary");
    });

    it("should vote successfully", async function () {
      await contracts.mockPop
        .connect(beneficiary)
        .approve(contracts.grantElections.address, registrationBondMonth);

      await contracts.mockStaking.mock.getVoiceCredits.returns(10);
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections
        .connect(beneficiary)
        .registerForElection(beneficiary.address, electionId);

      ethers.provider.send("evm_increaseTime", [7 * ONE_DAY]);
      ethers.provider.send("evm_mine", []);

      await contracts.grantElections.vote(
        [beneficiary.address],
        [5],
        electionId
      );
      const metadata = await GrantElectionAdapter(
        contracts.grantElections
      ).getElectionMetadata(GRANT_TERM.MONTH);
      expect(metadata["votes"][0]).to.deep.eq({
        voter: owner.address,
        beneficiary: beneficiary.address,
        weight: BigNumber.from(Math.round(Math.sqrt(5))),
      });
    });

    it("should not allow to vote twice for same address and grant term", async function () {
      await contracts.mockPop
        .connect(beneficiary)
        .approve(contracts.grantElections.address, registrationBondMonth);
      await contracts.mockStaking.mock.getVoiceCredits.returns(10);
      await contracts.mockBeneficiaryRegistry.mock.beneficiaryExists.returns(
        true
      );
      await contracts.grantElections
        .connect(beneficiary)
        .registerForElection(beneficiary.address, electionId);
      ethers.provider.send("evm_increaseTime", [7 * ONE_DAY]);
      ethers.provider.send("evm_mine", []);

      await contracts.grantElections.vote(
        [beneficiary.address],
        [5],
        electionId
      );
      await expect(
        contracts.grantElections.vote([beneficiary.address], [1], electionId)
      ).to.be.revertedWith("address already voted for election term");
    });
  });

  describe("finalization", function () {
    const merkleRoot = ethers.utils.formatBytes32String("merkleRoot");
    describe("without randomization", function () {
      beforeEach(async function () {
        await contracts.grantElections
          .connect(governance)
          .setConfiguration(
            GRANT_TERM.MONTH,
            4,
            2,
            false,
            1000,
            20 * 86400,
            100,
            0,
            false,
            parseEther("2000"),
            true,
            0
          );
        await prepareElection(GRANT_TERM.MONTH, electionId);
        await contracts.grantElections
          .connect(governance)
          .addProposer(beneficiary.address);
        await contracts.grantElections
          .connect(governance)
          .addApprover(owner.address);
      });
      describe("propose finalization", function () {
        it("require to be called by a proposer", async function () {
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await expect(
            contracts.grantElections
              .connect(beneficiary2)
              .proposeFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("not a proposer");
        });

        it("require election closed", async function () {
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("wrong election state");
        });

        it("require not finalized", async function () {
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId);
          await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot);
          await contracts.grantElections.approveFinalization(
            electionId,
            merkleRoot
          );
          await expect(
            contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("wrong election state");
        });

        it("overwrites merkleRoot when calling proposeFinalization twice", async function () {
          const newMerkleRoot =
            ethers.utils.formatBytes32String("newMerkleRoot");
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId);
          await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot);
          expect(
            await contracts.grantElections.getElectionMerkleRoot(electionId)
          ).to.equal(merkleRoot);
          await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, newMerkleRoot);
          expect(
            await contracts.grantElections.getElectionMerkleRoot(electionId)
          ).to.equal(newMerkleRoot);
        });

        it("propose finalization successfully", async function () {
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId);
          const result = await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot);
          expect(result)
            .to.emit(contracts.grantElections, "FinalizationProposed")
            .withArgs(electionId, merkleRoot);
          const election = await contracts.grantElections.elections(electionId);
          expect(election.electionState).to.equal(3);
        });
        describe("incentive payout", function () {
          it("doesnt pays out incentive if the incentiveBudget is too low", async function () {
            await contracts.grantElections
              .connect(owner)
              .fundKeeperIncentive(parseEther("1000"));
            ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
            ethers.provider.send("evm_mine", []);
            await contracts.grantElections.refreshElectionState(electionId);
            await contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot);
            const balance1 = await contracts.mockPop.balanceOf(
              beneficiary.address
            );
            expect(balance1).to.equal(parseEther("500"));
            const incentiveBudget1 =
              await contracts.grantElections.incentiveBudget();
            expect(incentiveBudget1).to.equal(parseEther("1000"));
          });

          it("pays out incentive", async function () {
            await contracts.grantElections
              .connect(owner)
              .fundKeeperIncentive(parseEther("2000"));
            ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
            ethers.provider.send("evm_mine", []);
            await contracts.grantElections.refreshElectionState(electionId);
            await contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot);
            const balance1 = await contracts.mockPop.balanceOf(
              beneficiary.address
            );
            expect(balance1).to.equal(parseEther("2500"));
            const incentiveBudget1 =
              await contracts.grantElections.incentiveBudget();
            expect(incentiveBudget1).to.equal(0);
          });

          it("doesnt pay out incentive when calling proposeFinalization again", async function () {
            //Enough pop to fund 2 incentives
            await contracts.grantElections
              .connect(owner)
              .fundKeeperIncentive(parseEther("4000"));
            ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
            ethers.provider.send("evm_mine", []);
            await contracts.grantElections.refreshElectionState(electionId);
            await contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot);
            const balance1 = await contracts.mockPop.balanceOf(
              beneficiary.address
            );
            expect(balance1).to.equal(parseEther("2500"));
            const incentiveBudget1 =
              await contracts.grantElections.incentiveBudget();
            expect(incentiveBudget1).to.equal(parseEther("2000"));

            await contracts.grantElections
              .connect(beneficiary)
              .proposeFinalization(electionId, merkleRoot);
            const balance2 = await contracts.mockPop.balanceOf(
              beneficiary.address
            );
            expect(balance2).to.equal(parseEther("2500"));
            const incentiveBudget2 =
              await contracts.grantElections.incentiveBudget();
            expect(incentiveBudget2).to.equal(parseEther("2000"));
          });
        });
      });
      describe("approve finalization", function () {
        it("approveFinalization needs an election in proposedFinalization state", async function () {
          await expect(
            contracts.grantElections
              .connect(owner)
              .approveFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("finalization not yet proposed");
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId);
          await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot);
          await contracts.grantElections
            .connect(owner)
            .approveFinalization(electionId, merkleRoot);
          await expect(
            contracts.grantElections
              .connect(owner)
              .approveFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("election already finalized");
        });

        it("approves finalization successfully", async function () {
          await expect(
            contracts.grantElections
              .connect(owner)
              .approveFinalization(electionId, merkleRoot)
          ).to.be.revertedWith("finalization not yet proposed");
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId);
          await contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot);
          const result = await contracts.grantElections
            .connect(owner)
            .approveFinalization(electionId, merkleRoot);
          expect(result)
            .to.emit(contracts.grantElections, "ElectionFinalized")
            .withArgs(electionId, merkleRoot);
          expect(result)
            .to.emit(contracts.beneficiaryVaults, "VaultOpened")
            .withArgs(0, merkleRoot);
          const election = await contracts.grantElections.elections(electionId);
          expect(election.electionState).to.equal(4);
        });
        it("merkle root contains correct winners with their equal weight share allocations", async function () {
          await contracts.grantElections
            .connect(governance)
            .setConfiguration(
              GRANT_TERM.QUARTER,
              4,
              2,
              false,
              1000,
              20 * 86400,
              100,
              0,
              false,
              parseEther("2000"),
              true,
              0
            );
          await prepareElection(GRANT_TERM.QUARTER, electionId + 1);
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId + 1);

          const electionMetaData: ElectionMetadata = await GrantElectionAdapter(
            contracts.grantElections
          ).getElectionMetadata(electionId + 1);
          let winner = rankAwardees(electionMetaData);
          winner = calculateVaultShare(winner, electionMetaData.shareType);
          expect(winner[0][0]).to.equal(beneficiary.address);
          expect(winner[1][0]).to.equal(beneficiary3.address);
          expect(winner[0][1]).to.equal(parseEther("50"));
          expect(winner[1][1]).to.equal(parseEther("50"));
        });
        it("merkle root contains correct winners with their dynamic weight share allocations", async function () {
          await contracts.grantElections
            .connect(governance)
            .setConfiguration(
              GRANT_TERM.QUARTER,
              4,
              2,
              false,
              1000,
              20 * 86400,
              100,
              0,
              false,
              parseEther("2000"),
              true,
              1
            );
          await prepareElection(GRANT_TERM.QUARTER, electionId + 1);
          ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
          ethers.provider.send("evm_mine", []);
          await contracts.grantElections.refreshElectionState(electionId + 1);

          const electionMetaData: ElectionMetadata = await GrantElectionAdapter(
            contracts.grantElections
          ).getElectionMetadata(electionId + 1);
          let winner = rankAwardees(electionMetaData);
          winner = calculateVaultShare(winner, electionMetaData.shareType);
          expect(winner[0][0]).to.equal(beneficiary.address);
          expect(winner[1][0]).to.equal(beneficiary3.address);
          expect(winner[0][1]).to.equal(parseEther("60"));
          expect(winner[1][1]).to.equal(parseEther("40"));
        });
      });
    });
    describe("with randomization", function () {
      beforeEach(async function () {
        await contracts.grantElections
          .connect(governance)
          .setConfiguration(
            GRANT_TERM.MONTH,
            4,
            2,
            true,
            1000,
            20 * 86400,
            100,
            0,
            false,
            parseEther("2000"),
            true,
            0
          );
        await prepareElection(GRANT_TERM.MONTH, electionId);
        ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
        ethers.provider.send("evm_mine", []);
        await contracts.grantElections.refreshElectionState(electionId);
        await contracts.grantElections
          .connect(governance)
          .addProposer(beneficiary.address);
        await contracts.grantElections
          .connect(governance)
          .addApprover(owner.address);
      });
      it("creates a random number", async function () {
        await contracts.randomNumberHelper.mockFulfillRandomness(7);
        await contracts.grantElections.getRandomNumber(electionId);
        const election = await contracts.grantElections.elections(electionId);
        expect(election.randomNumber).to.equal(8);
      });
      it("requires a random number to propose finalization", async function () {
        await expect(
          contracts.grantElections
            .connect(beneficiary)
            .proposeFinalization(electionId, merkleRoot)
        ).to.revertedWith("randomNumber required");
      });
      it("merkle root contains correct winners with their equal weight share allocations", async function () {
        await contracts.grantElections
          .connect(governance)
          .setConfiguration(
            GRANT_TERM.QUARTER,
            4,
            2,
            true,
            1000,
            20 * 86400,
            100,
            0,
            false,
            parseEther("2000"),
            true,
            0
          );
        await prepareElection(GRANT_TERM.QUARTER, electionId + 1);
        ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
        ethers.provider.send("evm_mine", []);
        await contracts.grantElections.refreshElectionState(electionId + 1);
        await contracts.randomNumberHelper.mockFulfillRandomness(96);
        await contracts.grantElections.getRandomNumber(electionId + 1);

        const electionMetaData: ElectionMetadata = await GrantElectionAdapter(
          contracts.grantElections
        ).getElectionMetadata(electionId + 1);
        let winner = rankAwardees(electionMetaData);
        winner = calculateVaultShare(winner, electionMetaData.shareType);
        expect(winner[0][0]).to.equal(beneficiary3.address);
        expect(winner[1][0]).to.equal(beneficiary2.address);
        expect(winner[0][1]).to.equal(parseEther("50"));
        expect(winner[1][1]).to.equal(parseEther("50"));
      });
      it("merkle root contains correct winners with their dynamic weight share allocations", async function () {
        await contracts.grantElections
          .connect(governance)
          .setConfiguration(
            GRANT_TERM.QUARTER,
            4,
            2,
            true,
            1000,
            20 * 86400,
            100,
            0,
            false,
            parseEther("2000"),
            true,
            1
          );
        await prepareElection(GRANT_TERM.QUARTER, electionId + 1);
        ethers.provider.send("evm_increaseTime", [30 * ONE_DAY]);
        ethers.provider.send("evm_mine", []);
        await contracts.grantElections.refreshElectionState(electionId + 1);
        await contracts.randomNumberHelper.mockFulfillRandomness(96);
        await contracts.grantElections.getRandomNumber(electionId + 1);

        const electionMetaData: ElectionMetadata = await GrantElectionAdapter(
          contracts.grantElections
        ).getElectionMetadata(electionId + 1);
        let winner = rankAwardees(electionMetaData);
        winner = calculateVaultShare(winner, electionMetaData.shareType);
        expect(winner[0][0]).to.equal(beneficiary3.address);
        expect(winner[1][0]).to.equal(beneficiary2.address);
        expect(winner[0][1]).to.equal(parseEther("57.142857142857142857"));
        expect(winner[1][1]).to.equal(parseEther("42.857142857142857142"));
      });
    });
  });
});
