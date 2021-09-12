import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployMockContract, MockContract } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import yearnRegistryABI from "../contracts/mocks/abis/yearnRegistry.json";
import {
  BlockLockHelper,
  MockERC20,
  MockYearnV2Vault,
  Pool,
  PoolDefendedHelper,
} from "../typechain";

const provider = waffle.provider;

interface Contracts {
  mockToken: MockERC20;
  mockYearnVault: MockYearnV2Vault;
  mockYearnRegistry: MockContract;
  pool: Pool;
  blockLockHelper: BlockLockHelper;
  defendedHelper: PoolDefendedHelper;
}

const DepositorInitial = parseEther("100000");
let owner: SignerWithAddress,
  depositor: SignerWithAddress,
  depositor1: SignerWithAddress,
  depositor2: SignerWithAddress,
  depositor3: SignerWithAddress,
  depositor4: SignerWithAddress,
  depositor5: SignerWithAddress,
  rewardsManager: SignerWithAddress;
let contracts: Contracts;

async function deployContracts(): Promise<Contracts> {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await (
    await MockERC20.deploy("Token", "Token", 18)
  ).deployed();
  await mockToken.mint(depositor.address, DepositorInitial);
  await mockToken.mint(depositor1.address, DepositorInitial);
  await mockToken.mint(depositor2.address, DepositorInitial);
  await mockToken.mint(depositor3.address, DepositorInitial);
  await mockToken.mint(depositor4.address, DepositorInitial);
  await mockToken.mint(depositor5.address, DepositorInitial);

  const MockYearnV2Vault = await ethers.getContractFactory("MockYearnV2Vault");
  const mockYearnVault = await (
    await MockYearnV2Vault.deploy(mockToken.address)
  ).deployed();

  const mockYearnRegistry = await deployMockContract(owner, yearnRegistryABI);
  await mockYearnRegistry.mock.latestVault.returns(mockYearnVault.address);
  await mockYearnRegistry.mock.numVaults.returns(1);
  await mockYearnRegistry.mock.vaults.returns(mockYearnVault.address);

  const Pool = await ethers.getContractFactory("Pool");
  const pool = await (
    await Pool.deploy(
      mockToken.address,
      mockYearnRegistry.address,
      rewardsManager.address
    )
  ).deployed();

  const PoolDefendedHelper = await ethers.getContractFactory(
    "PoolDefendedHelper"
  );
  const defendedHelper = await (
    await PoolDefendedHelper.deploy(mockToken.address, pool.address)
  ).deployed();

  await mockToken.mint(defendedHelper.address, DepositorInitial);

  const BlockLockHelper = await ethers.getContractFactory("BlockLockHelper");
  const blockLockHelper = await (
    await BlockLockHelper.deploy(pool.address, mockToken.address)
  ).deployed();

  await pool.approveContractAccess(blockLockHelper.address);

  return {
    mockToken,
    mockYearnVault,
    mockYearnRegistry,
    pool,
    blockLockHelper,
    defendedHelper,
  };
}

describe("Pool", function () {
  beforeEach(async function () {
    [
      owner,
      depositor,
      depositor1,
      depositor2,
      depositor3,
      depositor4,
      depositor5,
      rewardsManager,
    ] = await ethers.getSigners();
    contracts = await deployContracts();
  });

  describe("constructor", async function () {
    it("should be constructed with correct addresses", async function () {
      expect(await contracts.pool.token()).to.equal(
        contracts.mockToken.address
      );
      expect(await contracts.pool.rewardsManager()).to.equal(
        rewardsManager.address
      );
    });
  });

  describe("pool token", async function () {
    it("has a token name", async function () {
      expect(await contracts.pool.name()).to.equal("Popcorn Token Pool");
    });

    it("has a token symbol", async function () {
      expect(await contracts.pool.symbol()).to.equal("popToken");
    });

    it("uses 18 decimals", async function () {
      expect(await contracts.pool.decimals()).to.equal(18);
    });
  });

  describe("deposits", async function () {
    it("accepts token deposits", async function () {
      let amount = parseEther("1000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(
        await contracts.mockToken
          .connect(depositor)
          .balanceOf(depositor.address)
      ).to.equal(parseEther("99000"));
    });

    it("reverts unapproved deposits", async function () {
      let amount = parseEther("1000");
      await expect(
        contracts.pool.connect(depositor).deposit(amount)
      ).to.be.revertedWith("transfer amount exceeds allowance");
    });

    it("returns pool tokens to depositor", async function () {
      let amount = parseEther("1000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(
        await contracts.pool.connect(depositor).balanceOf(depositor.address)
      ).to.equal(amount);
    });

    it("deposits tokens to Yearn in exchange for Yearn vault shares", async function () {
      let amount = parseEther("1000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(
        await contracts.mockYearnVault
          .connect(depositor)
          .balanceOf(contracts.pool.address)
      ).to.equal(parseEther("1000"));
    });

    it("should not allow non-whitelisted contracts to deposit", async function () {
      let amount = parseEther("1000");
      await expect(contracts.defendedHelper.deposit(amount)).to.revertedWith(
        "Access denied for caller"
      );
    });

    it("should allow whitelisted contracts to deposit", async function () {
      let amount = parseEther("1000");
      await contracts.pool.approveContractAccess(
        contracts.defendedHelper.address
      );
      await contracts.defendedHelper.deposit(amount);
      expect(
        await contracts.mockYearnVault.balanceOf(contracts.pool.address)
      ).to.equal(parseEther("1000"));
    });

    it("depositFor deposits and sends shares to address", async function () {
      let amount = parseEther("1000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool
        .connect(depositor)
        .depositFor(amount, depositor2.address);
      expect(
        await contracts.pool.connect(depositor2).balanceOf(depositor2.address)
      ).to.equal(amount);
    });
  });

  describe("calculating total assets", async function () {
    it("total assets is Yearn balance * Yearn price per share", async function () {
      let amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(await contracts.pool.totalValue()).to.equal(parseEther("10000"));
    });

    it("total assets change with Yearn price per share", async function () {
      let amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
      expect(await contracts.pool.totalValue()).to.equal(parseEther("15000"));
    });
  });

  describe("pool token accounting", async function () {
    it("depositor earns tokens equal to deposit when pool is empty", async function () {
      let depositAmount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, depositAmount);
      await contracts.pool.connect(depositor).deposit(depositAmount);
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        depositAmount
      );
    });

    it("deposits emit an event", async function () {
      let depositAmount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, depositAmount);
      await expect(contracts.pool.connect(depositor).deposit(depositAmount))
        .to.emit(contracts.pool, "Deposit")
        .withArgs(depositor.address, parseEther("10000"), parseEther("10000"));
    });

    it("depositors earn tokens proportional to contributions", async function () {
      let deposit1Amount = parseEther("2000");
      let deposit2Amount = parseEther("3000");
      let deposit3Amount = parseEther("90000");

      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      await contracts.mockToken
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);
      await contracts.mockToken
        .connect(depositor2)
        .approve(contracts.pool.address, deposit3Amount);
      await contracts.pool.connect(depositor2).deposit(deposit3Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        deposit1Amount
      );
      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("93000.000000000000048672")
      );
    });

    it("tokens convert 1:1 minus fees on withdrawal when underlying Yearn vault value is unchanged", async function () {
      let deposit1Amount = parseEther("10000");

      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mockToken.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );
      let withdrawal1Amount = parseEther("10000");

      expect(
        await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount)
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("50"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor1.address, parseEther("9950"));
      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("0")
      );

      let depositor1TokenBalance = await contracts.mockToken.balanceOf(
        depositor1.address
      );
      expect(depositor1TokenBalance).to.equal(parseEther("99950"));
    });

    it("tokens convert at higher rate on withdrawal when underlying Yearn vault value increases", async function () {
      let deposit = parseEther("10000");

      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, deposit);
      await contracts.pool.connect(depositor).deposit(deposit);

      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mockToken.balanceOf(depositor.address)).to.equal(
        parseEther("90000")
      );

      contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
      let withdrawal = parseEther("10000");
      await expect(contracts.pool.connect(depositor).withdraw(withdrawal))
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("90"))
        .and.to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("17910"))
        .and.to.emit(contracts.pool, "PerformanceFee")
        .withArgs(parseEther("2000"));
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        parseEther("0")
      );
      let depositorTokenBalance = await contracts.mockToken.balanceOf(
        depositor.address
      );
      expect(depositorTokenBalance).to.equal(parseEther("107910"));
    });

    it("handles multiple deposits", async function () {
      let deposits = [
        [
          depositor1,
          parseEther("1000"),
          parseEther("1000"),
          parseEther("99000"),
        ],
        [
          depositor1,
          parseEther("2000"),
          parseEther("3000.000000000000000004"),
          parseEther("97000"),
        ],
        [
          depositor2,
          parseEther("3000"),
          parseEther("3000.000000000000000007"),
          parseEther("97000"),
        ],
        [
          depositor1,
          parseEther("4000"),
          parseEther("7000.000000000000002015"),
          parseEther("93000"),
        ],
        [
          depositor1,
          parseEther("5000"),
          parseEther("12000.000000000000004697"),
          parseEther("88000"),
        ],
        [
          depositor2,
          parseEther("6000"),
          parseEther("9000.000000000000001894"),
          parseEther("91000"),
        ],
      ];

      for (let [depositor, deposit, poolBalance, threeCrvBalance] of deposits) {
        await contracts.mockToken
          .connect(depositor as SignerWithAddress)
          .approve(contracts.pool.address, deposit as BigNumber);
        await contracts.pool
          .connect(depositor as SignerWithAddress)
          .deposit(deposit as BigNumber);

        expect(
          await contracts.pool.balanceOf(
            (depositor as SignerWithAddress).address
          )
        ).to.equal(poolBalance);
        expect(
          await contracts.mockToken.balanceOf(
            (depositor as SignerWithAddress).address
          )
        ).to.equal(threeCrvBalance);
      }

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("21000")
      );
      let yearnPrice = await contracts.mockYearnVault.pricePerShare();
      await contracts.mockYearnVault.setPricePerFullShare(
        yearnPrice.mul(15).div(10)
      );

      let withdrawal1Amount = parseEther("12000");
      await expect(
        contracts.pool.connect(depositor1).withdraw(withdrawal1Amount)
      )
        .to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor1.address, parseEther("16715.999999999999996755"));

      let withdrawal2Amount = parseEther("9000");
      await expect(
        contracts.pool.connect(depositor2).withdraw(withdrawal2Amount)
      )
        .to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor2.address, parseEther("12536.999999999999997574"));
    });

    it("multiple small deposits", async function () {
      let deposit1Amount = parseEther("1000");
      for (let i = 0; i < 10; i++) {
        await contracts.mockToken
          .connect(depositor1)
          .approve(contracts.pool.address, deposit1Amount);
        await contracts.pool.connect(depositor1).deposit(deposit1Amount);
      }

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000.000000000000005456")
      );
      expect(await contracts.mockToken.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );

      let deposit2Amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);

      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("10000.000000000000008956")
      );
      expect(await contracts.mockToken.balanceOf(depositor2.address)).to.equal(
        parseEther("90000")
      );

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("20000")
      );
      contracts.mockYearnVault.increasePricePerFullShare(parseEther("2"));

      let withdrawal1Amount = await contracts.pool.balanceOf(
        depositor1.address
      );
      await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount);
      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("0")
      );
      let depositor1TokenBalance = await contracts.mockToken.balanceOf(
        depositor1.address
      );
      expect(depositor1TokenBalance).to.equal(
        parseEther("107909.999999999999995929")
      );

      let withdrawal2Amount = await contracts.pool.balanceOf(
        depositor2.address
      );
      await contracts.pool.connect(depositor2).withdraw(withdrawal2Amount);
      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("0")
      );
      let depositor2TokenBalance = await contracts.mockToken.balanceOf(
        depositor2.address
      );
      expect(depositor2TokenBalance).to.equal(
        parseEther("107910.000000000000002200")
      );
    });

    it("multiple small withdrawals", async function () {
      let deposit1Amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mockToken.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );

      let deposit2Amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);

      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("10000.000000000000005000")
      );
      expect(await contracts.mockToken.balanceOf(depositor2.address)).to.equal(
        parseEther("90000")
      );

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("20000")
      );
      contracts.mockYearnVault.increasePricePerFullShare(parseEther("2"));

      let withdrawal1Amount = parseEther("1000");
      for (let i = 0; i < 10; i++) {
        await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount);
      }
      let depositor1TokenBalance = await contracts.mockToken.balanceOf(
        depositor1.address
      );
      expect(depositor1TokenBalance).to.equal(
        parseEther("107909.999999999999992028")
      );

      let withdrawal2Amount = parseEther("10000");
      await contracts.pool.connect(depositor2).withdraw(withdrawal2Amount);
      let depositor2TokenBalance = await contracts.mockToken.balanceOf(
        depositor2.address
      );
      expect(depositor2TokenBalance).to.equal(
        parseEther("107909.999999999999992057")
      );
    });

    it("deposits at different magnitudes", async function () {
      async function _makeDeposit(depositor, amount) {
        let weiAmount = parseEther(amount);
        await contracts.mockToken.mint(depositor.address, weiAmount);
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, weiAmount);
        await contracts.pool.connect(depositor).deposit(weiAmount);
      }
      const makeDeposit = _makeDeposit.bind(this);
      let deposits = [
        [depositor1, "1000", "8.999999999999999989", "1790.999999999999997921"],
        [
          depositor2,
          "10000",
          "90.000000000000000025",
          "17910.000000000000005300",
        ],
        [
          depositor3,
          "100000",
          "900.000000000000000149",
          "179100.000000000000029758",
        ],
        [
          depositor4,
          "1000000",
          "9000.000000000000001645",
          "1791000.000000000000327857",
        ],
        [
          depositor5,
          "100000000",
          "900000.000000000000165869",
          "179100000.000000000033008216",
        ],
      ];

      for (let [depositor, deposit] of deposits) {
        await makeDeposit(depositor, deposit);
      }

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("101111000")
      );
      contracts.mockYearnVault.increasePricePerFullShare(parseEther("2"));

      async function _expectation(depositor, amount, fee, withdrawal) {
        let withdrawalAmount = await contracts.pool.balanceOf(
          depositor.address
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther(fee))
          .and.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor.address, parseEther(withdrawal));
        expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
          parseEther("0")
        );
      }
      const expectFeeAndWithdrawalForAmount = _expectation.bind(this);

      for (let [depositor, deposit, withdrawalFee, withdrawal] of deposits) {
        await expectFeeAndWithdrawalForAmount(
          depositor,
          deposit,
          withdrawalFee,
          withdrawal
        );
      }
    });
  });

  describe("calculating pool token value", async function () {
    it("when underlying vault value increases", async function () {
      let amount = parseEther("20000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
      await expect(
        contracts.pool.connect(depositor).withdraw(parseEther("10000"))
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("90"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("17910"));
      expect(
        await contracts.pool.connect(depositor).valueFor(parseEther("10000"))
      ).to.equal(parseEther("18000"));
    });

    it("is unchanged by other deposits", async function () {
      let amount = parseEther("10000");
      await contracts.mockToken.mint(depositor.address, amount);
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);

      let amount1 = parseEther("10000");
      await contracts.mockToken.mint(depositor1.address, amount);
      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor1).deposit(amount);

      let amount2 = parseEther("15000");
      await contracts.mockToken.mint(depositor2.address, amount);
      await contracts.mockToken
        .connect(depositor2)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor2).deposit(amount);

      let amount3 = parseEther("250000");
      await contracts.mockToken.mint(depositor3.address, amount);
      await contracts.mockToken
        .connect(depositor3)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor3).deposit(amount);

      let amount4 = parseEther("250000000");
      await contracts.mockToken.mint(depositor4.address, amount);
      await contracts.mockToken
        .connect(depositor4)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor4).deposit(amount);

      await expect(
        await contracts.pool.connect(depositor).withdraw(parseEther("10000"))
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("49.999999999999999962"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("9949.999999999999992537"));
      expect(
        await contracts.pool.connect(depositor).valueFor(parseEther("10000"))
      ).to.equal(parseEther("9999.999999999999993499"));
    });

    it("calculating value for a single pool token", async function () {
      let amount = parseEther("10000");
      await contracts.mockToken
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      let valueForOneShare = await contracts.pool.valueFor(parseEther("1"));
      let pricePerPoolToken = await contracts.pool.pricePerPoolToken();
      expect(pricePerPoolToken).to.equal(parseEther("1"));
      expect(valueForOneShare).to.equal(pricePerPoolToken);
    });
  });

  describe("fees", async function () {
    describe("management fees", async function () {
      beforeEach(async function () {
        await contracts.pool.connect(owner).setPerformanceFee(0);
      });

      it("management fee issues pool tokens to contract on deposit", async function () {
        let amount = parseEther("10000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);

        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        await contracts.pool.connect(depositor).deposit(amount);
        await provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await contracts.pool.takeFees();

        let managementTokenBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );
        expect(await contracts.pool.valueFor(managementTokenBalance)).to.equal(
          parseEther("199.999999999999999999")
        );
      });

      it("shorter periods issue fewer shares", async function () {
        let amount = parseEther("10000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);

        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        await contracts.pool.connect(depositor).deposit(amount);
        await provider.send("evm_increaseTime", [7 * 24 * 60 * 60]);
        await contracts.pool.takeFees();

        let managementTokenBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );
        expect(await contracts.pool.valueFor(managementTokenBalance)).to.equal(
          parseEther("3.835616438356164382")
        );
      });

      it("feesUpdatedAt is contract creation block for new pool", async function () {
        let deployBlock = await provider.getBlock(
          contracts.pool.deployTransaction.blockNumber
        );
        let deployTimestamp = deployBlock.timestamp;
        expect(await contracts.pool.feesUpdatedAt()).to.equal(deployTimestamp);
      });

      it("larger management fees dilute token value", async function () {
        await contracts.pool.connect(owner).setManagementFee(5000);

        let amount = parseEther("10000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);

        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        await contracts.pool.connect(depositor).deposit(amount);
        await provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await contracts.pool.takeFees();

        let managementTokenBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );

        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("0.500000000000000000")
        );
        expect(await contracts.pool.valueFor(managementTokenBalance)).to.equal(
          parseEther("5000")
        );
      });
    });

    describe("performance fees", async function () {
      beforeEach(async function () {
        await contracts.pool.connect(owner).setManagementFee(0);
      });

      it("takes no performance fee when value is unchanged", async function () {
        let amount = parseEther("20000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");
      });

      it("takes a performance fee when value increases", async function () {
        let amount = parseEther("20000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("2000"));
      });

      it("takes no performance fee when value decreases below HWM", async function () {
        let amount = parseEther("20000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.5")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("2000"));
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.25"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.166666666666666666")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");
      });

      it("takes a performance fee when value decreases below HWM, then increases above it", async function () {
        let amount = parseEther("30000");
        await contracts.mockToken
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.5")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("3000"));

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.25"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.166666666666666666")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.75"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.633333333333333332")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("566.666666666666663428"));
      });
    });

    describe("combined fees", async function () {
      it("combined fees over time", async function () {
        let initialDeposit = parseEther("10000");
        await contracts.mockToken
          .connect(depositor1)
          .approve(contracts.pool.address, initialDeposit);

        // Management fee:  None
        // Performance fee: None
        await expect(contracts.pool.connect(depositor1).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor1.address,
            parseEther("10000"),
            parseEther("10000")
          )
          .and.not.to.emit(contracts.pool, "ManagementFee")
          .and.not.to.emit(contracts.pool, "PerformanceFee");

        // yVault share price: $1.00
        // Pool token price:   $1.00
        // Total pool value:   $10,000
        // Pool share value:   $0
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1")
        );
        expect(await contracts.pool.totalValue()).to.equal(parseEther("10000"));
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("0")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("10000")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("0"));

        // Increase vault share value by 10% in each period
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.1"));
        // Fast forward 30 days in each period
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $11,000
        // Gain this period: $1,000
        expect(await contracts.pool.totalValue()).to.equal(parseEther("11000"));

        // We've had assets worth $11,000 under management for 30 days.
        // Management fee:  $18.08

        // We've earned $1000 profit this period
        // Performance fee: $196
        await contracts.mockToken
          .connect(depositor2)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor2).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor2.address,
            parseEther("10000"),
            parseEther("9271.677945091345085999")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("18.082191780821917808"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("196.706915477497255323"));

        // yVault share price: $1.10
        // Pool token price:   $1.07
        // Total pool value: $20,999
        // Pool share value: $214
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.078553424657534245")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("20999.999999999999991427")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("198.845739600479586651")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("19470.523684691824672650")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("214.465753424657533639"));

        let yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $23,099
        // Gain this period: $2,100
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("23099.999999999999972855")
        );

        // Management fee:  $38
        // Performance fee: $413
        await contracts.mockToken
          .connect(depositor3)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor3).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor3.address,
            parseEther("10000"),
            parseEther("8596.401191749326745270")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("37.972602739726027352"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("413.084522502744233634"));

        // yVault share price: $1.21
        // Pool token price:   $1.16
        // Total pool value: $33,099
        // Pool share value: $681
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.163277489840495400")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("33099.999999999999973372")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("586.008807849599672685")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("28454.087944690271503954")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("681.690855019703504805"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $36,409
        // Gain this period: $3,310
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("36409.999999999999939954")
        );

        // Management fee:  $59
        // Performance fee: $651
        await contracts.mockToken
          .connect(depositor4)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor4).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor4.address,
            parseEther("10000"),
            parseEther("7970.306333669918777123")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("59.852054794520547846"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("651.099890230515914336"));

        // yVault share price: $1.33
        // Pool token price:   $1.25
        // Total pool value: $46,409
        // Pool share value: $1,445
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.254656920494486315")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("46409.999999999999936980")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1151.806224051502386010")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("36990.191694562092994402")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("1445.121650074840320630"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $51,051
        // Gain this period: $5,100
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("51050.999999999999895633")
        );

        // Management fee:  $83
        // Performance fee: $912
        await contracts.mockToken
          .connect(depositor5)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor5).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor5.address,
            parseEther("10000"),
            parseEther("7389.811344950924512091")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("83.919452054794520376"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("912.916794731064750595"));

        // yVault share price: $1.46
        // Pool token price:   $1.35
        // Total pool value: $61,051
        // Pool share value: $2,553
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.353214518369603880")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("61050.999999999999903594")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1887.340426598374047045")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("45115.537242059889167528")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("2553.976466378801462034"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $67,156
        // Gain this period: $6,104
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("67156.099999999999847729")
        );

        // Withdrawal:      $14,522
        // Withdrawal fee:  $73
        // Management fee:  $110
        // Performance fee: $1,200
        var withdrawalAmount = await contracts.pool.balanceOf(
          depositor1.address
        );
        await expect(
          contracts.pool.connect(depositor1).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor1.address, parseEther("14522.165823184128910445"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("72.975707654191602565"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("110.393589041095890160"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("1200.915389681668485622"));

        // yVault share price: $1.61
        // Pool token price:   $1.45
        // Total pool value: $52,560
        // Pool share value: $4,063
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.459514153083832052")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("52560.958469161679361909")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("2784.443663635412013314")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("36012.640479096927133797")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("4063.934935540480891575"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $57,817
        // Gain this period: $5,253
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("57817.054316077847266179")
        );

        // Withdrawal:      $14,522
        // Withdrawal fee:  $73
        // Management fee:  $95
        // Performance fee: $1,033
        withdrawalAmount = await contracts.pool.balanceOf(depositor2.address);
        await expect(
          contracts.pool.connect(depositor2).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor2.address, parseEther("14522.165823184128922698"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("72.975707654191602625"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("95.041733122319748930"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("1033.910401500962992766"));

        // yVault share price: $1.77
        // Pool token price:   $1.57
        // Total pool value: $43,221
        // Pool share value: $5,510
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.574163988144707757")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("43221.912785239526762134")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("3500.539676738631809440")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("27457.058547108801843924")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("5510.423498193670730964"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $47,544
        // Gain this period: $4,319
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("47544.104063763479422438")
        );

        // Withdrawal:      $14,522
        // Withdrawal fee:  $73
        // Management fee:  $78
        // Performance fee: $850
        withdrawalAmount = await contracts.pool.balanceOf(depositor3.address);
        await expect(
          contracts.pool.connect(depositor3).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor3.address, parseEther("14522.165823184128934217"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("72.975707654191602683"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("78.154691611665993571"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("850.204914502186957579"));

        // yVault share price: $1.94
        // Pool token price:   $1.69
        // Total pool value: $32,948
        // Pool share value: $6,870
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.697819960386036692")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("32948.962532925158901446")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("4046.511588143983728256")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("19406.629266764827017470")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("6870.248144284256875422"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $36,243
        // Gain this period: $3,281
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("36243.858786217674772848")
        );

        // Withdrawal:      $14,522
        // Withdrawal fee:  $73
        // Management fee:  $59
        // Performance fee: $648
        withdrawalAmount = await contracts.pool.balanceOf(depositor4.address);
        await expect(
          contracts.pool.connect(depositor4).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor4.address, parseEther("14522.165823184128948982"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("72.975707654191602757"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("59.578945949946862640"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("648.128878803533306379"));

        // yVault share price: $2.14
        // Pool token price:   $1.83
        // Total pool value:   $21,648
        // Pool share value:   $8,116
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.831189532726279004")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("21648.717255379354232131")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("4432.404143114200214741")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("11822.215488065124726832")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("8116.572071683315383297"));

        yearnPrice = await contracts.mockYearnVault.pricePerShare();
        await contracts.mockYearnVault.setPricePerFullShare(
          yearnPrice.mul(110).div(100)
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $23,813
        // Gain this period: $2,155
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("23813.588980917289648101")
        );

        // Withdrawal:      $14,522
        // Withdrawal fee:  $73
        // Management fee:  $39
        // Performance fee: $425
        withdrawalAmount = await contracts.pool.balanceOf(depositor5.address);
        await expect(
          contracts.pool.connect(depositor5).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor5.address, parseEther("14522.165823184128956862"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("72.975707654191602797"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("39.145625722055818599"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("425.845239535014299595"));

        // yVault share price: $2.35
        // Pool token price:   $1.97
        // Total pool value:   $9,218
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.975035741718958105")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("9218.447450078969095027")
        );
        let poolBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );

        // All external depositors have withdrawn their pool tokens. The only remaining balance is owned by the pool.
        expect(poolBalance).to.equal(parseEther("4667.483861358255662385"));
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("4667.483861358255662385")
        );

        // $9,218 in management and performance fees drawn as pool tokens over pool lifetime
        expect(await contracts.pool.valueFor(poolBalance)).to.equal(
          parseEther("9218.447450078969095027")
        );

        // $365 in withdrawal fees sent as DAI to rewardsManager over pool lifetime
        expect(
          await contracts.mockToken.balanceOf(rewardsManager.address)
        ).to.equal(parseEther("364.878538270958013417"));
      });
    });
  });

  describe("governance", async function () {
    it("owner can set withdrawalFee", async function () {
      await contracts.pool.connect(owner).setWithdrawalFee(20);
      expect(await contracts.pool.withdrawalFee()).to.equal(20);
    });

    it("non-owner cannot set withdrawalFee", async function () {
      expect(
        contracts.pool.connect(depositor).setWithdrawalFee(20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set managementFee", async function () {
      await contracts.pool.connect(owner).setManagementFee(500);
      expect(await contracts.pool.managementFee()).to.equal(500);
    });

    it("non-owner cannot set managementFee", async function () {
      expect(
        contracts.pool.connect(depositor).setManagementFee(500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can set performanceFee", async function () {
      await contracts.pool.connect(owner).setPerformanceFee(5000);
      expect(await contracts.pool.performanceFee()).to.equal(5000);
    });

    it("non-owner cannot set performanceFee", async function () {
      expect(
        contracts.pool.connect(depositor).setPerformanceFee(500)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("owner can pause the contract", async function () {
      await expect(contracts.pool.connect(owner).pauseContract()).to.emit(
        contracts.pool,
        "Paused"
      );
    });

    it("non-owner cannot pause the contract", async function () {
      expect(
        contracts.pool.connect(depositor).pauseContract()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("deposits to the pool should not be allowed when paused", async function () {
      let deposit1Amount = parseEther("1000");
      await contracts.pool.connect(owner).pauseContract();
      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);

      expect(
        contracts.pool.connect(depositor1).deposit(deposit1Amount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("deposits to the pool can resume when paused and unpaused", async function () {
      let deposit1Amount = parseEther("1000");
      await contracts.pool.connect(owner).pauseContract();
      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);

      await contracts.pool.connect(owner).unpauseContract();
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.totalValue()).to.equal(parseEther("1000"));
    });

    it("withdrawals are allowed when the pool is paused", async function () {
      let deposit1Amount = parseEther("1000");
      await contracts.mockToken
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);
      await contracts.pool.connect(owner).pauseContract();

      expect(contracts.pool.connect(depositor1).withdraw(parseEther("1000")))
        .not.to.be.reverted;
    });

    describe("sending accrued fees to rewards manager", async function () {
      it("owner can withdraw accrued fees", async function () {
        let deposit1Amount = parseEther("10000");
        await contracts.mockToken
          .connect(depositor1)
          .approve(contracts.pool.address, deposit1Amount);
        await contracts.pool.connect(depositor1).deposit(deposit1Amount);
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
        await provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await contracts.pool.takeFees();
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1312.217194570135746604")
        );
        await contracts.pool.connect(owner).withdrawAccruedFees();
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        expect(
          await contracts.mockToken.balanceOf(rewardsManager.address)
        ).to.equal(parseEther("2624.434389140271493208"));
      });
    });
  });

  describe("block lock modifier", async function () {
    it("prevents a deposit and withdrawal in the same block", async function () {
      await contracts.mockToken.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenWithdraw()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a withdrawal and deposit in the same block", async function () {
      await contracts.mockToken.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await contracts.blockLockHelper.deposit();
      await expect(
        contracts.blockLockHelper.withdrawThenDeposit()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a deposit and a transfer in the same block", async function () {
      await contracts.mockToken.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenTransfer()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a deposit and transferFrom in the same block", async function () {
      await contracts.mockToken.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenTransferFrom()
      ).to.be.revertedWith("Locked until next block");
    });
  });
});
