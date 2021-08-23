import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import {
  BlockLockHelper,
  DefendedHelper,
  MockCurveAddressProvider,
  MockCurveMetapool,
  MockCurveRegistry,
  MockERC20,
  MockYearnV1Vault,
  Pool,
} from "../typechain";

const provider = waffle.provider;

interface Contracts {
  mock3Crv: MockERC20;
  mockCrvUSDX: MockERC20;
  mockYearnVault: MockYearnV1Vault;
  mockCurveMetapool: MockCurveMetapool;
  mockCurveRegistry: MockCurveRegistry;
  mockCurveAddressProvider: MockCurveAddressProvider;
  pool: Pool;
  blockLockHelper: BlockLockHelper;
  defendedHelper: DefendedHelper;
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
  const mock3Crv = await (
    await MockERC20.deploy("3Crv", "3Crv", 18)
  ).deployed();
  await mock3Crv.mint(depositor.address, DepositorInitial);
  await mock3Crv.mint(depositor1.address, DepositorInitial);
  await mock3Crv.mint(depositor2.address, DepositorInitial);
  await mock3Crv.mint(depositor3.address, DepositorInitial);
  await mock3Crv.mint(depositor4.address, DepositorInitial);
  await mock3Crv.mint(depositor5.address, DepositorInitial);

  const mockCrvUSDX = await (
    await MockERC20.deploy("crvUSDX", "crvUSDX", 18)
  ).deployed();
  const MockYearnV1Vault = await ethers.getContractFactory("MockYearnV1Vault");
  const mockYearnVault = await (
    await MockYearnV1Vault.deploy(mockCrvUSDX.address)
  ).deployed();

  const MockCurveMetapool = await ethers.getContractFactory(
    "MockCurveMetapool"
  );
  const mockCurveMetapool = await (
    await MockCurveMetapool.deploy(mockCrvUSDX.address, mock3Crv.address)
  ).deployed();

  const MockCurveRegistry = await ethers.getContractFactory(
    "MockCurveRegistry"
  );
  const mockCurveRegistry = await (
    await MockCurveRegistry.deploy(mockCurveMetapool.address)
  ).deployed();

  const MockCurveAddressProvider = await ethers.getContractFactory(
    "MockCurveAddressProvider"
  );
  const mockCurveAddressProvider = await (
    await MockCurveAddressProvider.deploy(mockCurveRegistry.address)
  ).deployed();

  const Pool = await ethers.getContractFactory("Pool");
  const pool = await (
    await Pool.deploy(
      mock3Crv.address,
      mockYearnVault.address,
      mockCurveAddressProvider.address,
      rewardsManager.address
    )
  ).deployed();

  const Staking = await ethers.getContractFactory("Staking");
  const mockStaking = await waffle.deployMockContract(
    owner,
    Staking.interface.format() as any
  );

  const DefendedHelper = await ethers.getContractFactory("DefendedHelper");
  const defendedHelper = await (
    await DefendedHelper.deploy(
      mock3Crv.address,
      mockStaking.address,
      pool.address
    )
  ).deployed();

  await mock3Crv.mint(defendedHelper.address, DepositorInitial);

  const BlockLockHelper = await ethers.getContractFactory("BlockLockHelper");
  const blockLockHelper = await (
    await BlockLockHelper.deploy(pool.address, mock3Crv.address)
  ).deployed();

  await pool.approveContractAccess(blockLockHelper.address);

  return {
    mock3Crv,
    mockCrvUSDX,
    mockYearnVault,
    mockCurveMetapool,
    mockCurveRegistry,
    mockCurveAddressProvider,
    pool,
    blockLockHelper,
    defendedHelper,
  };
}

function calculatePoolShareValue(
  amount: BigNumber,
  yearnBalance: BigNumber,
  totalSupply: BigNumber,
  yearnSharePrice: BigNumber,
  crvVirtualPrice: BigNumber
): BigNumber {
  const poolShare = amount.mul(parseEther("1")).div(totalSupply);
  const yearnShares = yearnBalance.mul(poolShare).div(parseEther("1"));
  const crvLPTokens = yearnSharePrice.mul(yearnShares).div(parseEther("1"));

  return crvLPTokens.mul(crvVirtualPrice).div(parseEther("1"));
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
      expect(await contracts.pool.threeCrv()).to.equal(
        contracts.mock3Crv.address
      );
      expect(await contracts.pool.curveAddressProvider()).to.equal(
        contracts.mockCurveAddressProvider.address
      );
      expect(await contracts.pool.rewardsManager()).to.equal(
        rewardsManager.address
      );
    });

    it("finds the Curve metapool for the associated LP token", async function () {
      expect(await contracts.pool.curveRegistry()).to.equal(
        contracts.mockCurveRegistry.address
      );
      expect(await contracts.pool.curveMetapool()).to.equal(
        contracts.mockCurveMetapool.address
      );
    });
  });

  describe("pool token", async function () {
    it("has a token name", async function () {
      expect(await contracts.pool.name()).to.equal("Popcorn 3Crv Pool");
    });

    it("has a token symbol", async function () {
      expect(await contracts.pool.symbol()).to.equal("pop3Crv");
    });

    it("uses 18 decimals", async function () {
      expect(await contracts.pool.decimals()).to.equal(18);
    });
  });

  describe("deposits", async function () {
    it("accepts 3Crv deposits", async function () {
      let amount = parseEther("1000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(
        await contracts.mock3Crv.connect(depositor).balanceOf(depositor.address)
      ).to.equal(parseEther("99000"));
    });

    it("reverts unapproved deposits", async function () {
      let amount = parseEther("1000");
      await expect(
        contracts.pool.connect(depositor).deposit(amount)
      ).to.be.revertedWith("transfer amount exceeds allowance");
    });

    it("returns pop3Crv to depositor", async function () {
      let amount = parseEther("1000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(
        await contracts.pool.connect(depositor).balanceOf(depositor.address)
      ).to.equal(amount);
    });

    it("deposits crvUSDX to Yearn in exchange for yvUSDX", async function () {
      let amount = parseEther("1000");
      await contracts.mock3Crv
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
  });

  describe("calculating total assets", async function () {
    it("total assets is Yearn balance * Yearn price per share * Curve virtual price", async function () {
      let amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      expect(await contracts.pool.totalValue()).to.equal(parseEther("10000"));
    });

    it("total assets change with Yearn price per share", async function () {
      let amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
      expect(await contracts.pool.totalValue()).to.equal(parseEther("15000"));
    });

    it("total assets change with Curve virtual price", async function () {
      let amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await contracts.mockCurveMetapool.setVirtualPrice(parseEther("1.05"));
      expect(await contracts.pool.totalValue()).to.equal(parseEther("10500"));
    });
  });

  describe("pool token accounting", async function () {
    it("depositor earns tokens equal to deposit when pool is empty", async function () {
      let depositAmount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, depositAmount);
      await contracts.pool.connect(depositor).deposit(depositAmount);
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        depositAmount
      );
    });

    it("deposits emit an event", async function () {
      let depositAmount = parseEther("10000");
      await contracts.mock3Crv
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

      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      await contracts.mock3Crv
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);
      await contracts.mock3Crv
        .connect(depositor2)
        .approve(contracts.pool.address, deposit3Amount);
      await contracts.pool.connect(depositor2).deposit(deposit3Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        deposit1Amount
      );
      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("93000.000231961650583225")
      );
    });

    it("tokens convert 1:1 minus fees on withdrawal when underlying Yearn vault value is unchanged", async function () {
      let deposit1Amount = parseEther("10000");

      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );
      let withdrawal1Amount = parseEther("10000");

      expect(
        await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount)
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("49.949999968342950238"))
        .and.emit(contracts.pool, "ManagementFee")
        .withArgs(parseEther("0.000006337747701362"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor1.address, parseEther("9940.049993700247097462"));
      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("0")
      );

      let depositor13CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor1.address
      );
      expect(depositor13CrvBalance).to.equal(
        parseEther("99940.049993700247097462")
      );
    });

    it("tokens convert at higher rate on withdrawal when underlying Yearn vault value increases", async function () {
      let deposit = parseEther("10000");

      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, deposit);
      await contracts.pool.connect(depositor).deposit(deposit);

      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor.address)).to.equal(
        parseEther("90000")
      );

      contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
      let withdrawal = parseEther("10000");
      await expect(contracts.pool.connect(depositor).withdraw(withdrawal))
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("90.818181713530417847"))
        .and.to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("18072.818160992553151633"))
        .and.to.emit(contracts.pool, "PerformanceFee")
        .withArgs(parseEther("1999.999997464899074118"))
        .and.to.emit(contracts.pool, "ManagementFee")
        .withArgs(parseEther("0.000025350990805449"));
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        parseEther("0")
      );
      let depositor3CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor.address
      );
      expect(depositor3CrvBalance).to.equal(
        parseEther("108072.818160992553151633")
      );
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
          parseEther("3000.000002535100003213"),
          parseEther("97000"),
        ],
        [
          depositor2,
          parseEther("3000"),
          parseEther("3000.000007605300019280"),
          parseEther("97000"),
        ],
        [
          depositor1,
          parseEther("4000"),
          parseEther("7000.000017745716061053"),
          parseEther("93000"),
        ],
        [
          depositor1,
          parseEther("5000"),
          parseEther("12000.000043096766189588"),
          parseEther("88000"),
        ],
        [
          depositor2,
          parseEther("6000"),
          parseEther("9000.000045631890260283"),
          parseEther("91000"),
        ],
      ];

      for (let [depositor, deposit, poolBalance, threeCrvBalance] of deposits) {
        await contracts.mock3Crv
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
          await contracts.mock3Crv.balanceOf(
            (depositor as SignerWithAddress).address
          )
        ).to.equal(threeCrvBalance);
      }

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("21000")
      );
      contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));

      let withdrawal1Amount = parseEther("12000");
      await expect(
        contracts.pool.connect(depositor1).withdraw(withdrawal1Amount)
      )
        .to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor1.address, parseEther("16773.834263376130016313"));

      let withdrawal2Amount = parseEther("9000");
      await expect(
        contracts.pool.connect(depositor2).withdraw(withdrawal2Amount)
      )
        .to.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor2.address, parseEther("12580.375689558972816713"));
    });

    it("multiple small deposits", async function () {
      let deposit1Amount = parseEther("1000");
      for (let i = 0; i < 10; i++) {
        await contracts.mock3Crv
          .connect(depositor1)
          .approve(contracts.pool.address, deposit1Amount);
        await contracts.pool.connect(depositor1).deposit(deposit1Amount);
      }

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000.000057039755457900")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );

      let deposit2Amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);

      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("10000.000126755001606683")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor2.address)).to.equal(
        parseEther("90000")
      );

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("20000")
      );
      contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));

      let withdrawal1Amount = await contracts.pool.balanceOf(
        depositor1.address
      );
      await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount);
      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("0")
      );
      let depositor13CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor1.address
      );
      expect(depositor13CrvBalance).to.equal(
        parseEther("108072.818055823130548334")
      );

      let withdrawal2Amount = await contracts.pool.balanceOf(
        depositor2.address
      );
      await contracts.pool.connect(depositor2).withdraw(withdrawal2Amount);
      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("0")
      );
      let depositor23CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor2.address
      );
      expect(depositor23CrvBalance).to.equal(
        parseEther("108072.818170364129617973")
      );
    });

    it("multiple small withdrawals", async function () {
      let deposit1Amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.balanceOf(depositor1.address)).to.equal(
        parseEther("10000")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor1.address)).to.equal(
        parseEther("90000")
      );

      let deposit2Amount = parseEther("10000");
      await contracts.mock3Crv
        .connect(depositor2)
        .approve(contracts.pool.address, deposit2Amount);
      await contracts.pool.connect(depositor2).deposit(deposit2Amount);

      expect(await contracts.pool.balanceOf(depositor2.address)).to.equal(
        parseEther("10000.000012675500016066")
      );
      expect(await contracts.mock3Crv.balanceOf(depositor2.address)).to.equal(
        parseEther("90000")
      );

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("20000")
      );
      contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));

      let withdrawal1Amount = parseEther("1000");
      for (let i = 0; i < 10; i++) {
        await contracts.pool.connect(depositor1).withdraw(withdrawal1Amount);
      }
      let depositor13CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor1.address
      );
      expect(depositor13CrvBalance).to.equal(
        parseEther("108072.818088623487624407")
      );

      let withdrawal2Amount = parseEther("10000");
      await contracts.pool.connect(depositor2).withdraw(withdrawal2Amount);
      let depositor23CrvBalance = await contracts.mock3Crv.balanceOf(
        depositor2.address
      );
      expect(depositor23CrvBalance).to.equal(
        parseEther("108072.818025625959262892")
      );
    });

    it("deposits at different magnitudes", async function () {
      async function _makeDeposit(depositor, amount) {
        let weiAmount = parseEther(amount);
        await contracts.mock3Crv.mint(depositor.address, weiAmount);
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.pool.address, weiAmount);
        await contracts.pool.connect(depositor).deposit(weiAmount);
      }
      const makeDeposit = _makeDeposit.bind(this);
      let deposits = [
        [depositor1, "1000", "9.081818108608730563", "1807.281803613137382053"],
        [
          depositor2,
          "10000",
          "90.818181201211623327",
          "18072.818059041113042109",
        ],
        [
          depositor3,
          "100000",
          "908.181813163291857804",
          "180728.180819495079703126",
        ],
        [
          depositor4,
          "1000000",
          "9081.818143145389612876",
          "1807281.810485932532962407",
        ],
        [
          depositor5,
          "100000000",
          "908181.815466069292556697",
          "180728181.277747789218782716",
        ],
      ];

      for (let [depositor, deposit] of deposits) {
        await makeDeposit(depositor, deposit);
      }

      expect(await contracts.mockYearnVault.balance()).to.equal(
        parseEther("101111000")
      );
      contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));

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
    it("calculated value is greater than realized withdrawal amount due to fees", async function () {
      let amount = parseEther("20000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await expect(
        contracts.pool.connect(depositor).withdraw(parseEther("10000"))
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("49.949999968342950238"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("9940.049993700247097462"));
      expect(
        await contracts.pool.connect(depositor).valueFor(parseEther("10000"))
      ).to.equal(parseEther("9999.999993662252301966"));
    });

    it("when underlying vault value increases", async function () {
      let amount = parseEther("20000");
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);
      await contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
      await expect(
        contracts.pool.connect(depositor).withdraw(parseEther("10000"))
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("90.818181713530500364"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("18072.818160992569572596"));
      expect(
        await contracts.pool.connect(depositor).valueFor(parseEther("10000"))
      ).to.equal(parseEther("18181.818160866967073418"));
    });

    it("is unchanged by other deposits", async function () {
      let amount = parseEther("10000");
      await contracts.mock3Crv.mint(depositor.address, amount);
      await contracts.mock3Crv
        .connect(depositor)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor).deposit(amount);

      let amount1 = parseEther("10000");
      await contracts.mock3Crv.mint(depositor1.address, amount);
      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor1).deposit(amount);

      let amount2 = parseEther("15000");
      await contracts.mock3Crv.mint(depositor2.address, amount);
      await contracts.mock3Crv
        .connect(depositor2)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor2).deposit(amount);

      let amount3 = parseEther("250000");
      await contracts.mock3Crv.mint(depositor3.address, amount);
      await contracts.mock3Crv
        .connect(depositor3)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor3).deposit(amount);

      let amount4 = parseEther("250000000");
      await contracts.mock3Crv.mint(depositor4.address, amount);
      await contracts.mock3Crv
        .connect(depositor4)
        .approve(contracts.pool.address, amount);
      await contracts.pool.connect(depositor4).deposit(amount);

      await expect(
        await contracts.pool.connect(depositor).withdraw(parseEther("10000"))
      )
        .to.emit(contracts.pool, "WithdrawalFee")
        .withArgs(rewardsManager.address, parseEther("49.949999588457686018"))
        .and.emit(contracts.pool, "Withdrawal")
        .withArgs(depositor.address, parseEther("9940.049918103079517632"));
      expect(
        await contracts.pool.connect(depositor).valueFor(parseEther("10000"))
      ).to.equal(parseEther("9999.999917609146360367"));
    });

    it("calculating value for a single pool token", async function () {
      let amount = parseEther("10000");
      await contracts.mock3Crv
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
        await contracts.mock3Crv
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
          parseEther("195.950797560009930000")
        );
      });

      it("shorter periods issue fewer shares", async function () {
        let amount = parseEther("10000");
        await contracts.mock3Crv
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
          parseEther("3.831601130322330000")
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
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.pool.address, amount);

        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        await contracts.pool.connect(depositor).deposit(amount);
        await provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        const feesUpdatedAt = await contracts.pool.feesUpdatedAt();
        const totalValue = await contracts.pool.totalValue();
        const pricePerPoolToken = await contracts.pool.pricePerPoolToken();
        const totalSupply = await contracts.pool.totalSupply();

        await contracts.pool.takeFees();
        const currentBlock = await waffle.provider.getBlock("latest");
        const period = BigNumber.from(String(currentBlock.timestamp)).sub(
          feesUpdatedAt
        );
        const fee = parseEther("5000")
          .mul(totalValue)
          .mul(period)
          .div(BigNumber.from("31556952").mul(parseEther("10000")));

        const minted = fee.mul(parseEther("1")).div(pricePerPoolToken);
        let managementTokenBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );
        const yearnSharePrice =
          await contracts.mockYearnVault.getPricePerFullShare();
        const crvVirtualPrice =
          await contracts.mockCurveMetapool.get_virtual_price();

        const mintedValue = calculatePoolShareValue(
          minted,
          amount,
          totalSupply.add(minted),
          yearnSharePrice,
          crvVirtualPrice
        );

        const expectedPricePerPoolToken = calculatePoolShareValue(
          parseEther("1"),
          amount,
          totalSupply.add(minted),
          yearnSharePrice,
          crvVirtualPrice
        );
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          expectedPricePerPoolToken
        );
        expect(await contracts.pool.valueFor(managementTokenBalance)).to.equal(
          mintedValue
        );
      });
    });

    describe("performance fees", async function () {
      beforeEach(async function () {
        await contracts.pool.connect(owner).setManagementFee(0);
      });

      it("takes no performance fee when value is unchanged", async function () {
        let amount = parseEther("20000");
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");
      });

      it("takes a performance fee when value increases", async function () {
        let amount = parseEther("20000");
        await contracts.mock3Crv
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
        await contracts.mock3Crv
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
          parseEther("1.171874999999999218")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");
      });

      it("takes a performance fee when value decreases below HWM, then increases above it", async function () {
        let amount = parseEther("30000");
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.pool.address, amount);
        await contracts.pool.connect(depositor).deposit(amount);

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.5"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.499999999999985000")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("2999.999999999910000000"));

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.25"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.171874999999987616")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        ).not.to.emit(contracts.pool, "PerformanceFee");

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.75"));
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.640624999999990022")
        );
        await expect(
          contracts.pool.connect(depositor).withdraw(parseEther("10000"))
        )
          .to.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("562.500000000009844199"));
      });
    });

    describe("combined fees", async function () {
      it("combined fees over time", async function () {
        let initialDeposit = parseEther("10000");
        await contracts.mock3Crv
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
        // Management fee:  $18.07

        // We've earned $1000 profit this period
        // Performance fee: $196
        await contracts.mock3Crv
          .connect(depositor2)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor2).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor2.address,
            parseEther("10000"),
            parseEther("9268.684182739424164739")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("18.070200189169093390"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("196.714509056494691150"));

        // yVault share price: $1.10
        // Pool token price:   $1.07
        // Total pool value: $20,999
        // Pool share value: $210
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.078901794779290999")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("20999.999999999999999999")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("195.552601013312919691")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("19464.236783752737084430")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("210.982052207022683999"));

        await contracts.mockYearnVault.setPricePerFullShare(parseEther("1.21"));
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $23,099
        // Gain this period: $2,100
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("23099.999999999999980907")
        );

        // Management fee:  $38
        // Performance fee: $413
        await contracts.mock3Crv
          .connect(depositor3)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor3).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor3.address,
            parseEther("10000"),
            parseEther("8590.850647936403988756")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("37.947420397255096088"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("413.100469018671896216"));

        // yVault share price: $1.21
        // Pool token price:   $1.16
        // Total pool value: $33,099
        // Pool share value: $670
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.164029082777953898")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("33099.999999999999972643")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("576.180813993524413211")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("28435.715644669352566706")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("670.691224427153681645"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("1.331")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $36,409
        // Gain this period: $3,310
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("36409.999999999999972643")
        );

        // Management fee:  $59
        // Performance fee: $651
        await contracts.mock3Crv
          .connect(depositor4)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor4).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor4.address,
            parseEther("10000"),
            parseEther("7962.588151680626739316")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("59.812362626149699076"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("651.125024977092699983"));

        // yVault share price: $1.33
        // Pool token price:   $1.25
        // Total pool value: $46,409
        // Pool share value: $1,421
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.255873066584435389")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("46409.999999999999999997")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1132.248629592609527246")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("36954.371611949064420057")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("1421.960558582517159569"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("1.4641")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $51,509
        // Gain this period: $5,100
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("51050.999999999999965129")
        );

        // Management fee:  $83
        // Performance fee: $912
        await contracts.mock3Crv
          .connect(depositor5)
          .approve(contracts.pool.address, initialDeposit);
        await expect(contracts.pool.connect(depositor5).deposit(initialDeposit))
          .to.emit(contracts.pool, "Deposit")
          .withArgs(
            depositor5.address,
            parseEther("10000"),
            parseEther("7380.271485514908578001")
          )
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("83.863799077933762366"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("912.952036531259911967"));

        // yVault share price: $1.46
        // Pool token price:   $1.35
        // Total pool value: $61,051
        // Pool share value: $2,513
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.354963705552911186")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("61050.999999999999958298")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1854.900978345582084005")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("45057.295446216945554817")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("2513.323503052915070634"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("1.6105")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $67,155
        // Gain this period: $6,104
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("67155.683013455365028990")
        );

        // Withdrawal:      $14,531
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
          .withArgs(depositor1.address, parseEther("14531.014389071920408612"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("73.020172809406635219"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("110.319651610560690151"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("1200.878359670507442544"));

        // yVault share price: $1.61
        // Pool token price:   $1.46
        // Total pool value: $52,537
        // Pool share value: $3,999
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.461865321509609514")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("52537.029798358941570768")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("2735.957051477138623771")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("35938.351519348502094583")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("3999.600734694200341682"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("1.77155")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $57,790
        // Gain this period: $5,253
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("57790.732778194835731107")
        );

        // Withdrawal:      $14,531
        // Withdrawal fee:  $73
        // Management fee:  $95
        // Performance fee: $1,033
        withdrawalAmount = await contracts.pool.balanceOf(depositor2.address);
        await expect(
          contracts.pool.connect(depositor2).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor2.address, parseEther("14531.014396621263740531"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("73.020172847343033872"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("94.935427953760421735"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("1033.479609066377901922"));

        // yVault share price: $1.77
        // Pool token price:   $1.57
        // Total pool value: $43,170
        // Pool share value: $5,423
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.577209119921754896")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("43172.079555503537691253")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("3438.740844014982475820")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("27372.451129146921781893")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("5423.613420227922796924"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("1.948705")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $47,489
        // Gain this period: $4,319
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("47489.287511053891436009")
        );

        // Withdrawal:      $14,531
        // Withdrawal fee:  $73
        // Management fee:  $78
        // Performance fee: $849
        withdrawalAmount = await contracts.pool.balanceOf(depositor3.address);
        await expect(
          contracts.pool.connect(depositor3).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor3.address, parseEther("14531.014404170597252971"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("73.020172885279383180"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("78.012781917556041316"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("849.257448943225220778"));

        // yVault share price: $1.94
        // Pool token price:   $1.70
        // Total pool value: $32,876
        // Pool share value: $6,762
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.701653751109902531")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("32870.634280767728644562")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("3974.016230957624413311")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("19316.875868153159730628")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("6762.399626380791344490"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("2.1435755")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $36,157
        // Gain this period: $3,281
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("36157.697708844501510705")
        );

        // Withdrawal:      $14,531
        // Withdrawal fee:  $73
        // Management fee:  $59
        // Performance fee: $646
        withdrawalAmount = await contracts.pool.balanceOf(depositor4.address);
        await expect(
          contracts.pool.connect(depositor4).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor4.address, parseEther("14531.014411720133218912"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("73.020172923216749843"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("59.397871264007155545"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("646.613072658360970655"));

        // yVault share price: $2.14
        // Pool token price:   $1.83
        // Total pool value:   $21,539
        // Pool share value:   $7,989
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.835917287119214652")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("21539.044470963270327618")
        );
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("4351.762752672665867679")
        );
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("11732.034238187574445680")
        );
        expect(
          await contracts.pool.valueFor(
            await contracts.pool.balanceOf(contracts.pool.address)
          )
        ).to.equal(parseEther("7989.476467073319460124"));

        await contracts.mockYearnVault.setPricePerFullShare(
          parseEther("2.3579330499999998")
        );
        await provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        // Total pool value: $23,693
        // Gain this period: $2,155
        //expect(await contracts.pool.totalValue()).to.equal(parseEther("23692948918059595340694"));

        // Withdrawal:      $14,531
        // Withdrawal fee:  $73
        // Management fee:  $38
        // Performance fee: $423
        withdrawalAmount = await contracts.pool.balanceOf(depositor5.address);
        await expect(
          contracts.pool.connect(depositor5).withdraw(withdrawalAmount)
        )
          .to.emit(contracts.pool, "Withdrawal")
          .withArgs(depositor5.address, parseEther("14531.014419269154460980"))
          .and.emit(contracts.pool, "WithdrawalFee")
          .withArgs(rewardsManager.address, parseEther("73.020172961151529954"))
          .and.emit(contracts.pool, "ManagementFee")
          .withArgs(parseEther("38.921469531378942543"))
          .and.emit(contracts.pool, "PerformanceFee")
          .withArgs(parseEther("423.704258595388095259"));

        // yVault share price: $2.35
        // Pool token price:   $1.98
        // Total pool value:   $9,074
        expect(await contracts.pool.pricePerPoolToken()).to.equal(
          parseEther("1.980774457168340005")
        );
        expect(await contracts.pool.totalValue()).to.equal(
          parseEther("9074.295672583813578036")
        );
        let poolBalance = await contracts.pool.balanceOf(
          contracts.pool.address
        );

        // All external depositors have withdrawn their pool tokens. The only remaining balance is owned by the pool.
        expect(poolBalance).to.equal(parseEther("4581.185727503861003163"));
        expect(await contracts.pool.totalSupply()).to.equal(
          parseEther("4581.185727503861003163")
        );

        // $9,074 in management and performance fees drawn as pool tokens over pool lifetime
        expect(await contracts.pool.valueFor(poolBalance)).to.equal(
          parseEther("9074.295672583813578036")
        );

        // $365 in withdrawal fees sent as DAI to rewardsManager over pool lifetime
        expect(
          await contracts.mock3Crv.balanceOf(rewardsManager.address)
        ).to.equal(parseEther("365.100864426397332068"));
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
      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);

      expect(
        contracts.pool.connect(depositor1).deposit(deposit1Amount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("deposits to the pool can resume when paused and unpaused", async function () {
      let deposit1Amount = parseEther("1000");
      await contracts.pool.connect(owner).pauseContract();
      await contracts.mock3Crv
        .connect(depositor1)
        .approve(contracts.pool.address, deposit1Amount);

      await contracts.pool.connect(owner).unpauseContract();
      await contracts.pool.connect(depositor1).deposit(deposit1Amount);

      expect(await contracts.pool.totalValue()).to.equal(parseEther("1000"));
    });

    it("withdrawals are allowed when the pool is paused", async function () {
      let deposit1Amount = parseEther("1000");
      await contracts.mock3Crv
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
        await contracts.mock3Crv
          .connect(depositor1)
          .approve(contracts.pool.address, deposit1Amount);
        await contracts.pool.connect(depositor1).deposit(deposit1Amount);
        await contracts.mockYearnVault.setPricePerFullShare(parseEther("2"));
        await provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
        await contracts.pool.takeFees();
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          parseEther("1199.467748800196974433")
        );
        await contracts.pool.withdrawAccruedFees();
        expect(await contracts.pool.balanceOf(contracts.pool.address)).to.equal(
          0
        );
        expect(
          await contracts.mock3Crv.balanceOf(rewardsManager.address)
        ).to.equal(parseEther("2139.866479243654574040"));
      });
    });
  });

  describe("block lock modifier", async function () {
    it("prevents a deposit and withdrawal in the same block", async function () {
      await contracts.mock3Crv.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenWithdraw()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a withdrawal and deposit in the same block", async function () {
      await contracts.mock3Crv.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await contracts.blockLockHelper.deposit();
      await expect(
        contracts.blockLockHelper.withdrawThenDeposit()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a deposit and a transfer in the same block", async function () {
      await contracts.mock3Crv.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenTransfer()
      ).to.be.revertedWith("Locked until next block");
    });

    it("prevents a deposit and transferFrom in the same block", async function () {
      await contracts.mock3Crv.mint(
        contracts.blockLockHelper.address,
        parseEther("1000")
      );
      await expect(
        contracts.blockLockHelper.depositThenTransferFrom()
      ).to.be.revertedWith("Locked until next block");
    });
  });
});
