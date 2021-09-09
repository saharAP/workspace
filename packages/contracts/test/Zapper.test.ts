import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MockERC20,
  MockCurveThreepool,
  MockCurveMetapool,
  MockYearnV2Vault,
  Pool,
  Zapper,
} from "../typechain";
import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { deployMockContract, MockContract } from "ethereum-waffle";
import yearnRegistryABI from "../contracts/mocks/abis/yearnRegistry.json";
import curveAddressProviderABI from "../contracts/mocks/abis/curveAddressProvider.json";
import curveRegistryABI from "../contracts/mocks/abis/curveRegistry.json";

const { AddressZero } = ethers.constants;

interface Contracts {
  mockToken: MockERC20;
  mockLPToken: MockERC20;
  mock3crv: MockERC20;
  mockDai: MockERC20;
  mockUSDC: MockERC20;
  mockUSDT: MockERC20;
  mockCurveThreepool: MockCurveThreepool;
  mockCurveMetapool: MockCurveMetapool;
  mockCurveRegistry: MockContract;
  mockCurveAddressProvider: MockContract;
  mockYearnVault: MockYearnV2Vault;
  mockYearnRegistry: MockContract;
  pool: Pool;
  zapper: Zapper;
}

let owner: SignerWithAddress, depositor: SignerWithAddress, rewardsManager: SignerWithAddress;
let contracts: Contracts;

async function deployContracts(): Promise<Contracts> {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await (
    await MockERC20.deploy("Token", "Token", 18)
  ).deployed();

  const mockLPToken = await (
    await MockERC20.deploy("CrvToken", "CrvToken", 18)
  ).deployed();

  const mock3crv = await (
    await MockERC20.deploy("Mock 3crv", "3crv", 18)
  ).deployed();

  const mockDai = await (
    await MockERC20.deploy("Mock DAI", "DAI", 18)
  ).deployed();

  const mockUSDC = await (
    await MockERC20.deploy("Mock USDC", "USDC", 6)
  ).deployed();

  const mockUSDT = await (
    await MockERC20.deploy("Mock USDT", "USDT", 18)
  ).deployed();

  const MockCurveThreepool = await ethers.getContractFactory(
    "MockCurveThreepool"
  );
  const mockCurveThreepool = await (
    await MockCurveThreepool.deploy(
      mock3crv.address,
      mockDai.address,
      mockUSDC.address,
      mockUSDT.address
    )
  ).deployed();

  const MockCurveMetapool = await ethers.getContractFactory(
    "MockCurveMetapool"
  );
  const mockCurveMetapool = await (
    await MockCurveMetapool.deploy(
      mockToken.address,
      mockLPToken.address,
      mock3crv.address,
      mockDai.address,
      mockUSDC.address,
      mockUSDT.address
    )
  ).deployed();

  const mockCurveRegistry = await deployMockContract(owner, curveRegistryABI);
  await mockCurveRegistry.mock.get_lp_token.withArgs(mockCurveMetapool.address).returns(mockLPToken.address);
  await mockCurveRegistry.mock.get_pool_from_lp_token.withArgs(mockLPToken.address).returns(mockCurveMetapool.address);

  await mockCurveRegistry.mock.get_lp_token.withArgs(mockCurveThreepool.address).returns(mock3crv.address);
  await mockCurveRegistry.mock.get_pool_from_lp_token.withArgs(mock3crv.address).returns(mockCurveThreepool.address);

  await mockCurveRegistry.mock.get_coins.returns(
    [
      mockToken.address,
      mock3crv.address,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero
    ]
  );
  await mockCurveRegistry.mock.get_underlying_coins.returns(
    [
      mockToken.address,
      mockDai.address,
      mockUSDC.address,
      mockUSDT.address,
      AddressZero,
      AddressZero,
      AddressZero,
      AddressZero
    ]
  );

  const mockCurveAddressProvider = await deployMockContract(owner, curveAddressProviderABI);
  await mockCurveAddressProvider.mock.get_registry.returns(mockCurveRegistry.address);

  const Zapper = await ethers.getContractFactory("Zapper");
  const zapper = await (
    await Zapper.deploy(mockCurveAddressProvider.address)
  ).deployed();

  const MockYearnV2Vault = await ethers.getContractFactory("MockYearnV2Vault");
  const mockYearnVault = await (
    await MockYearnV2Vault.deploy(mockLPToken.address)
  ).deployed();

  const mockYearnRegistry = await deployMockContract(owner, yearnRegistryABI);
  await mockYearnRegistry.mock.latestVault.returns(mockYearnVault.address);
  await mockYearnRegistry.mock.numVaults.returns(1);
  await mockYearnRegistry.mock.vaults.returns(mockYearnVault.address);

  const Pool = await ethers.getContractFactory("Pool");
  const pool = await (
    await Pool.deploy(
      mockLPToken.address,
      mockYearnRegistry.address,
      rewardsManager.address
    )
  ).deployed();

  await pool.approveContractAccess(zapper.address);

  return {
    mockToken,
    mockLPToken,
    mock3crv,
    mockDai,
    mockUSDC,
    mockUSDT,
    mockCurveThreepool,
    mockCurveMetapool,
    mockCurveRegistry,
    mockCurveAddressProvider,
    mockYearnVault,
    mockYearnRegistry,
    pool,
    zapper,
  };
}

describe("Zapper", function () {
  beforeEach(async function () {
    [owner, depositor, rewardsManager] = await ethers.getSigners();
    contracts = await deployContracts();
  });

  describe("constructor", async function () {
    it("has the address of the Curve address provider", async function () {
      expect(await contracts.zapper.curveAddressProvider()).to.equal(
        contracts.mockCurveAddressProvider.address
      );
    });

    it("has the address of the Curve registry", async function () {
      expect(await contracts.zapper.curveAddressProvider()).to.equal(
        contracts.mockCurveAddressProvider.address
      );
    });
  });

  describe("finding supported tokens", async function () {
    it("gets LP token from pool", async function () {
      expect(await contracts.zapper.token(contracts.pool.address)).to.equal(
        contracts.mockLPToken.address
      );
    });

    it("gets Curve metapool for LP token", async function () {
      expect(
        await contracts.zapper.curveMetapoolAddress(contracts.pool.address)
      ).to.equal(contracts.mockCurveMetapool.address);
    });

    it("gets Curve base pool for LP token", async function () {
      expect(
        await contracts.zapper.curveBasepoolAddress(contracts.pool.address)
      ).to.equal(contracts.mockCurveThreepool.address);
    });

    it("gets supported deposit tokens for underlying Curve pool", async function () {
      expect(
        await contracts.zapper.supportedTokens(contracts.pool.address)
      ).to.eql([
        contracts.mockToken.address,
        contracts.mockDai.address,
        contracts.mockUSDC.address,
        contracts.mockUSDT.address,
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
        "0x0000000000000000000000000000000000000000",
      ]);
    });

    it("returns true if token is supported", async function () {
      expect(
        await contracts.zapper.canZap(
          contracts.pool.address,
          contracts.mockDai.address
        )
      ).to.be.true;
    });

    it("returns false if token is not supported", async function () {
      expect(
        await contracts.zapper.canZap(
          contracts.pool.address,
          contracts.mock3crv.address
        )
      ).to.be.false;
    });

    it("reverts on zero address", async function () {
      expect(
        contracts.zapper.canZap(
          contracts.pool.address,
          "0x0000000000000000000000000000000000000000"
        )
      ).to.be.reverted;
    });
  });

  describe("zapping in", async function () {
    it("reverts on unsupported tokens", async function () {
      expect(
        contracts.zapper.zapIn(
          contracts.pool.address,
          contracts.mock3crv.address,
          parseEther("1000")
        )
      ).to.be.reverted;
    });

    it("transfers in token on zapIn", async function () {
      await contracts.mockDai.mint(depositor.address, parseEther("1000"));
      expect(await contracts.mockDai.balanceOf(depositor.address)).to.equal(
        parseEther("1000")
      );
      await contracts.mockDai
        .connect(depositor)
        .approve(contracts.zapper.address, parseEther("1000"));
      await contracts.zapper
        .connect(depositor)
        .zapIn(
          contracts.pool.address,
          contracts.mockDai.address,
          parseEther("1000")
        );
      expect(await contracts.mockDai.balanceOf(depositor.address)).to.equal(
        parseEther("0")
      );
    });

    it("deposits to Pool on behalf of sender", async function () {
      await contracts.mockDai.mint(depositor.address, parseEther("1000"));
      await contracts.mockDai
        .connect(depositor)
        .approve(contracts.zapper.address, parseEther("1000"));
      await contracts.zapper
        .connect(depositor)
        .zapIn(
          contracts.pool.address,
          contracts.mockDai.address,
          parseEther("1000")
        );
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(
        parseEther("1000")
      );
    });
  });

  describe("zapping out", async function () {
    beforeEach(async () => {
      await contracts.mockDai.mint(depositor.address, parseEther("1000"));
      expect(await contracts.mockDai.balanceOf(depositor.address)).to.equal(
        parseEther("1000")
      );
      await contracts.mockDai
        .connect(depositor)
        .approve(contracts.zapper.address, parseEther("1000"));
      await contracts.zapper
        .connect(depositor)
        .zapIn(
          contracts.pool.address,
          contracts.mockDai.address,
          parseEther("1000")
        );
      await contracts.pool
        .connect(depositor)
        .approve(contracts.zapper.address, parseEther("1000"));
    });

    it("reverts on unsupported tokens", async function () {
      expect(
        contracts.zapper.zapOut(
          contracts.pool.address,
          contracts.mock3crv.address,
          parseEther("1000")
        )
      ).to.be.reverted;
    });

    it("transfers in shares on zapOut", async function () {
      await contracts.zapper
        .connect(depositor)
        .zapOut(
          contracts.pool.address,
          contracts.mockUSDC.address,
          parseEther("1000")
        );
      expect(await contracts.pool.balanceOf(depositor.address)).to.equal(0);
    });

    it("returns USDC to sender", async function () {
      await contracts.zapper
        .connect(depositor)
        .zapOut(
          contracts.pool.address,
          contracts.mockUSDC.address,
          parseEther("1000")
        );
      expect(await contracts.mockUSDC.balanceOf(depositor.address)).to.equal(
        parseEther("993.010995000000000000")
      );
    });
  });
});
