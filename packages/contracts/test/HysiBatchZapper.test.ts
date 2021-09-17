import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import {
  HysiBatchZapper,
  MockCurveMetapool,
  MockCurveThreepool,
  MockERC20,
  MockYearnV2Vault,
} from "../typechain";
import { HysiBatchInteraction } from "../typechain/HysiBatchInteraction";
import { MockBasicIssuanceModule } from "../typechain/MockBasicIssuanceModule";

const provider = waffle.provider;

interface Contracts {
  mock3Crv: MockERC20;
  mockDAI: MockERC20;
  mockUSDC: MockERC20;
  mockUSDT: MockERC20;
  mockCrvUSDX: MockERC20;
  mockCrvUST: MockERC20;
  mockSetToken: MockERC20;
  mockYearnVaultUSDX: MockYearnV2Vault;
  mockYearnVaultUST: MockYearnV2Vault;
  mockCurveMetapoolUSDX: MockCurveMetapool;
  mockCurveMetapoolUST: MockCurveMetapool;
  mockCurveThreePool: MockCurveThreepool;
  mockBasicIssuanceModule: MockBasicIssuanceModule;
  hysiBatchInteraction: HysiBatchInteraction;
  hysiBatchZapper: HysiBatchZapper;
}

const DAY = 60 * 60 * 24;

const DepositorInitial = parseEther("100");
let owner: SignerWithAddress, depositor: SignerWithAddress;
let contracts: Contracts;

async function deployContracts(): Promise<Contracts> {
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const mock3Crv = await (
    await MockERC20.deploy("3Crv", "3Crv", 18)
  ).deployed();
  const mockDAI = await (await MockERC20.deploy("DAI", "DAI", 18)).deployed();
  const mockUSDC = await (
    await MockERC20.deploy("USDC", "USDC", 18)
  ).deployed();
  const mockUSDT = await (
    await MockERC20.deploy("USDT", "USDT", 18)
  ).deployed();

  const mockBasicCoin = await (
    await MockERC20.deploy("Basic", "Basic", 18)
  ).deployed();

  const mockCrvUSDX = await (
    await MockERC20.deploy("crvUSDX", "crvUSDX", 18)
  ).deployed();
  const mockCrvUST = await (
    await MockERC20.deploy("crvUST", "crvUST", 18)
  ).deployed();

  const mockSetToken = await await MockERC20.deploy("setToken", "setToken", 18);

  const MockYearnV2Vault = await ethers.getContractFactory("MockYearnV2Vault");
  const mockYearnVaultUSDX = await (
    await MockYearnV2Vault.deploy(mockCrvUSDX.address)
  ).deployed();
  const mockYearnVaultUST = await (
    await MockYearnV2Vault.deploy(mockCrvUST.address)
  ).deployed();

  const MockCurveMetapool = await ethers.getContractFactory(
    "MockCurveMetapool"
  );

  //Besides crvUSDX and 3Crv no coins are needed in this test which is why i used the same token in the other places
  const mockCurveMetapoolUSDX = await (
    await MockCurveMetapool.deploy(
      mockBasicCoin.address,
      mockCrvUSDX.address,
      mock3Crv.address,
      mockBasicCoin.address,
      mockBasicCoin.address,
      mockBasicCoin.address
    )
  ).deployed();
  const mockCurveMetapoolUST = await (
    await MockCurveMetapool.deploy(
      mockBasicCoin.address,
      mockCrvUST.address,
      mock3Crv.address,
      mockBasicCoin.address,
      mockBasicCoin.address,
      mockBasicCoin.address
    )
  ).deployed();

  const MockCurveThreepool = await ethers.getContractFactory(
    "MockCurveThreepool"
  );
  const mockCurveThreePool = await (
    await MockCurveThreepool.deploy(
      mock3Crv.address,
      mockDAI.address,
      mockUSDC.address,
      mockUSDT.address
    )
  ).deployed();

  const mockBasicIssuanceModule = (await (
    await (
      await ethers.getContractFactory("MockBasicIssuanceModule")
    ).deploy([mockYearnVaultUSDX.address, mockYearnVaultUST.address], [50, 50])
  ).deployed()) as MockBasicIssuanceModule;

  const hysiBatchInteraction = (await (
    await (
      await ethers.getContractFactory("HysiBatchInteraction")
    ).deploy(
      mock3Crv.address,
      mockSetToken.address,
      mockBasicIssuanceModule.address,
      [mockYearnVaultUSDX.address, mockYearnVaultUST.address],
      [
        {
          curveMetaPool: mockCurveMetapoolUSDX.address,
          crvLPToken: mockCrvUSDX.address,
        },
        {
          curveMetaPool: mockCurveMetapoolUST.address,
          crvLPToken: mockCrvUST.address,
        },
      ],
      1800,
      parseEther("20000"),
      parseEther("200")
    )
  ).deployed()) as HysiBatchInteraction;

  const hysiBatchZapper = await (
    await (
      await ethers.getContractFactory("HysiBatchZapper")
    ).deploy(
      hysiBatchInteraction.address,
      mockCurveThreePool.address,
      mockDAI.address
    )
  ).deployed();

  await mockYearnVaultUSDX.mint(
    mockBasicIssuanceModule.address,
    parseEther("20000")
  );
  await mockYearnVaultUST.mint(
    mockBasicIssuanceModule.address,
    parseEther("20000")
  );
  await mockCrvUSDX.mint(mockYearnVaultUSDX.address, parseEther("20000"));
  await mockCrvUST.mint(mockYearnVaultUST.address, parseEther("20000"));

  await mockDAI.mint(depositor.address, DepositorInitial);
  await mockDAI
    .connect(depositor)
    .approve(hysiBatchZapper.address, DepositorInitial);
  await mockDAI
    .connect(depositor)
    .approve(mockCurveThreePool.address, DepositorInitial);

  await mockSetToken.mint(depositor.address, DepositorInitial);
  await mockSetToken
    .connect(depositor)
    .approve(hysiBatchZapper.address, DepositorInitial);

  return {
    mock3Crv,
    mockDAI,
    mockUSDC,
    mockUSDT,
    mockCrvUSDX,
    mockCrvUST,
    mockSetToken,
    mockYearnVaultUSDX,
    mockYearnVaultUST,
    mockCurveMetapoolUSDX,
    mockCurveMetapoolUST,
    mockCurveThreePool,
    mockBasicIssuanceModule,
    hysiBatchInteraction,
    hysiBatchZapper,
  };
}

const deployAndAssignContracts = async () => {
  [owner, depositor] = await ethers.getSigners();
  contracts = await deployContracts();
  await contracts.mock3Crv
    .connect(depositor)
    .approve(contracts.hysiBatchInteraction.address, parseEther("100000000"));
};

describe("HysiBatchZapper", function () {
  beforeEach(async function () {
    await deployAndAssignContracts();
  });
  describe("zapIntoQueue", function () {
    // it("zaps into a mint queue", async function () {
    //   console.log(
    //     await (await contracts.mockDAI.balanceOf(depositor.address))
    //       .div(parseEther("1"))
    //       .toString()
    //   );
    //   const result = await contracts.hysiBatchZapper
    //     .connect(depositor)
    //     .zapIntoQueue([parseEther("1"), 0, 0], 0);

    //   expect(result)
    //     .to.emit(contracts.hysiBatchZapper, "ZappedIntoQueue")
    //     .withArgs(parseEther("1"), depositor.address);

    //   expect(result)
    //     .to.emit(contracts.hysiBatchInteraction, "Deposit")
    //     .withArgs(depositor.address, parseEther("1"));
    // });
    it("echoes", async function () {
      const result = await contracts.hysiBatchZapper.echo(
        [parseEther("1"), 0, 0],
        0
      );
      expect(result).to.emit(contracts.hysiBatchZapper, "Echo");
      expect(result)
        .to.emit(contracts.mockCurveThreePool, "EchoValues")
        .withArgs(0);
    });
    it.skip("tests", async function () {
      console.log(
        await (await contracts.mockDAI.balanceOf(depositor.address)).toString()
      );

      const result0 = await contracts.mockCurveThreePool
        .connect(depositor)
        .add_liquidity([parseEther("1"), 0, 0], 0);
      const result = await contracts.hysiBatchZapper
        .connect(depositor)
        .testPool([parseEther("1"), 0, 0], 0);
      const result1 = await contracts.hysiBatchZapper
        .connect(depositor)
        .testPoolForContract([parseEther("1"), 0, 0], 0);

      expect(result)
        .to.emit(contracts.mockCurveThreePool, "LiquidityAdded")
        .withArgs(parseEther("1"), depositor.address);

      console.log(
        await (await contracts.mockDAI.balanceOf(depositor.address)).toString()
      );
      console.log(
        await (await contracts.mock3Crv.balanceOf(depositor.address)).toString()
      );
      console.log(
        await (
          await contracts.mock3Crv.balanceOf(contracts.hysiBatchZapper.address)
        ).toString()
      );
    });
  });
});
