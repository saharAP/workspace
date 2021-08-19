import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import { MockCurveMetapool, MockERC20, MockYearnV2Vault } from "../typechain";
import { HysiBatchInteraction } from "../typechain/HysiBatchInteraction";
import { MockBasicIssuanceModule } from "../typechain/MockBasicIssuanceModule";

const provider = waffle.provider;

interface Contracts {
  mock3Crv: MockERC20;
  mockCrvUSDX: MockERC20;
  mockCrvUST: MockERC20;
  mockSetToken: MockERC20;
  mockYearnVaultUSDX: MockYearnV2Vault;
  mockYearnVaultUST: MockYearnV2Vault;
  mockCurveMetapoolUSDX: MockCurveMetapool;
  mockCurveMetapoolUST: MockCurveMetapool;
  mockBasicIssuanceModule: MockBasicIssuanceModule;
  hysiBatchInteraction: HysiBatchInteraction;
}

enum BatchType {
  Mint,
  Redeem,
}

const DepositorInitial = parseEther("100000");
let owner: SignerWithAddress,
  depositor: SignerWithAddress,
  depositor1: SignerWithAddress,
  depositor2: SignerWithAddress,
  depositor3: SignerWithAddress,
  depositor4: SignerWithAddress,
  depositor5: SignerWithAddress;
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
  const mockCurveMetapoolUSDX = await (
    await MockCurveMetapool.deploy(mockCrvUSDX.address, mock3Crv.address)
  ).deployed();
  const mockCurveMetapoolUST = await (
    await MockCurveMetapool.deploy(mockCrvUST.address, mock3Crv.address)
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
      1800,
      parseEther("20000"),
      parseEther("200")
    )
  ).deployed()) as HysiBatchInteraction;

  await hysiBatchInteraction.connect(owner).setUnderylingToken([
    {
      crvToken: mockCrvUSDX.address,
      yToken: mockYearnVaultUSDX.address,
      curveMetaPool: mockCurveMetapoolUSDX.address,
    },
    {
      crvToken: mockCrvUST.address,
      yToken: mockYearnVaultUST.address,
      curveMetaPool: mockCurveMetapoolUST.address,
    },
  ]);

  return {
    mock3Crv,
    mockCrvUSDX,
    mockCrvUST,
    mockSetToken,
    mockYearnVaultUSDX,
    mockYearnVaultUST,
    mockCurveMetapoolUSDX,
    mockCurveMetapoolUST,
    mockBasicIssuanceModule,
    hysiBatchInteraction,
  };
}

describe("HysiBatchInteraction", function () {
  beforeEach(async function () {
    [
      owner,
      depositor,
      depositor1,
      depositor2,
      depositor3,
      depositor4,
      depositor5,
    ] = await ethers.getSigners();
    contracts = await deployContracts();
  });
  describe("mint", function () {
    context("depositing", function () {
      it("deposits 3crv in the current mintBatch", async function () {
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        const result = await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("10000"));
        expect(result)
          .to.emit(contracts.hysiBatchInteraction, "Deposit")
          .withArgs(depositor.address, parseEther("10000"));
        expect(
          await contracts.mock3Crv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).to.equal(parseEther("10000"));
        const currentMintBatchId =
          await contracts.hysiBatchInteraction.currentMintBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentMintBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("10000"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("10000"));
      });
      it("adds the mintBatch to the users batches", async function () {
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("10000"));

        const currentMintBatchId =
          await contracts.hysiBatchInteraction.currentMintBatchId();
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          )
        ).to.equal(currentMintBatchId);
      });
      it("allows multiple deposits", async function () {
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("10000"));
        await contracts.mock3Crv
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForMint(parseEther("10000"));
        await contracts.mock3Crv
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("5000"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("5000"));
        const currentMintBatchId =
          await contracts.hysiBatchInteraction.currentMintBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentMintBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("30000"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("30000"));
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          )
        ).to.equal(currentMintBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor1.address,
            0
          )
        ).to.equal(currentMintBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor2.address,
            0
          )
        ).to.equal(currentMintBatchId);
      });
    });
    context("batch minting", function () {
      context("reverts", function () {
        it("reverts when minting too early", async function () {
          await contracts.mock3Crv
            .connect(depositor)
            .approve(
              contracts.hysiBatchInteraction.address,
              parseEther("10000")
            );
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("10000"));
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchMint()
          ).to.be.revertedWith("can not execute batch action yet");
        });
      });
      context("success", function () {
        it("batch mints", async function () {
          await contracts.mock3Crv
            .connect(depositor)
            .approve(
              contracts.hysiBatchInteraction.address,
              parseEther("10000")
            );
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("10000"));
          await provider.send("evm_increaseTime", [1800]);
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchMint();
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchMinted")
            .withArgs(parseEther("100"));
          expect(
            await contracts.mockSetToken.balanceOf(
              contracts.hysiBatchInteraction.address
            )
          ).to.equal(parseEther("100"));
        });
        it("mints early when mintThreshold is met", async function () {
          await contracts.mock3Crv
            .connect(depositor)
            .approve(
              contracts.hysiBatchInteraction.address,
              parseEther("10000")
            );
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("10000"));
          await contracts.mock3Crv
            .connect(depositor1)
            .approve(
              contracts.hysiBatchInteraction.address,
              parseEther("10000")
            );
          await contracts.hysiBatchInteraction
            .connect(depositor1)
            .depositForMint(parseEther("10000"));
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchMint()
          ).to.emit(contracts.hysiBatchInteraction, "BatchMinted");
        });
        it("advances to the next batch", async function () {
          await contracts.mock3Crv
            .connect(depositor)
            .approve(
              contracts.hysiBatchInteraction.address,
              parseEther("10000")
            );
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("10000"));
          await provider.send("evm_increaseTime", [1800]);

          const previousMintBatchId =
            await contracts.hysiBatchInteraction.currentMintBatchId();
          await contracts.hysiBatchInteraction.batchMint();

          const previousBatch = await contracts.hysiBatchInteraction.batches(
            previousMintBatchId
          );
          expect(previousBatch.claimable).to.equal(true);

          const currentMintBatchId =
            await contracts.hysiBatchInteraction.currentMintBatchId();
          expect(currentMintBatchId).to.not.equal(previousMintBatchId);
        });
      });
    });
    context("claim batch", function () {
      beforeEach(async function () {
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("10000"));
        await contracts.mock3Crv
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForMint(parseEther("10000"));
        await contracts.mock3Crv
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("10000"));
        await contracts.mock3Crv
          .connect(depositor3)
          .approve(contracts.hysiBatchInteraction.address, parseEther("10000"));
        await contracts.hysiBatchInteraction
          .connect(depositor3)
          .depositForMint(parseEther("10000"));
      });
      it("reverts when batch is not yet claimable", async function () {
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        await expect(
          contracts.hysiBatchInteraction.claim(batchId, BatchType.Redeem)
        ).to.be.revertedWith("not yet claimable");
      });
      it("claim batch successfully", async function () {
        await provider.send("evm_increaseTime", [1800]);

        await contracts.hysiBatchInteraction.connect(owner).batchMint();
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        expect(
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .claim(batchId, BatchType.Mint)
        )
          .to.emit(contracts.hysiBatchInteraction, "Claimed")
          .withArgs(depositor.address, parseEther("10000"));
        expect(
          await contracts.mockSetToken.balanceOf(depositor.address)
        ).to.equal(parseEther("100"));
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(parseEther("30000"));
        expect(batch.claimableToken).to.equal(parseEther("300"));
      });
    });
  });
  describe("redeem", function () {
    beforeEach(async function () {
      await contracts.mockSetToken.mint(depositor.address, parseEther("100"));
      await contracts.mockSetToken.mint(depositor1.address, parseEther("100"));
      await contracts.mockSetToken.mint(depositor2.address, parseEther("100"));
      await contracts.mockSetToken.mint(depositor3.address, parseEther("100"));
      await contracts.mockYearnVaultUSDX.mint(
        contracts.mockBasicIssuanceModule.address,
        parseEther("20000")
      );
      await contracts.mockYearnVaultUST.mint(
        contracts.mockBasicIssuanceModule.address,
        parseEther("20000")
      );
    });
    context("depositing", function () {
      it("deposits setToken in the current redeemBatch", async function () {
        await contracts.mockSetToken
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        const result = await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(parseEther("100"));
        expect(result)
          .to.emit(contracts.hysiBatchInteraction, "Deposit")
          .withArgs(depositor.address, parseEther("100"));
        expect(
          await contracts.mockSetToken.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).to.equal(parseEther("100"));
        const currentRedeemBatchId =
          await contracts.hysiBatchInteraction.currentRedeemBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentRedeemBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("100"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("100"));
      });
      it("adds the redeemBatch to the users batches", async function () {
        await contracts.mockSetToken
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(parseEther("100"));

        const currentRedeemBatchId =
          await contracts.hysiBatchInteraction.currentRedeemBatchId();
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          )
        ).to.equal(currentRedeemBatchId);
      });
      it("allows multiple deposits", async function () {
        await contracts.mockSetToken
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForRedeem(parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForRedeem(parseEther("50"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForRedeem(parseEther("50"));
        const currentRedeemBatchId =
          await contracts.hysiBatchInteraction.currentRedeemBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentRedeemBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("300"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("300"));
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          )
        ).to.equal(currentRedeemBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor1.address,
            0
          )
        ).to.equal(currentRedeemBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor2.address,
            0
          )
        ).to.equal(currentRedeemBatchId);
      });
    });
    context("batch redeeming", function () {
      beforeEach(async function () {
        await contracts.mockSetToken.mint(depositor.address, parseEther("100"));
        await contracts.mockSetToken.mint(
          depositor1.address,
          parseEther("100")
        );
        await contracts.mockSetToken.mint(
          depositor2.address,
          parseEther("100")
        );
        await contracts.mockSetToken.mint(
          depositor3.address,
          parseEther("100")
        );
        await contracts.mockCrvUSDX.mint(
          contracts.mockYearnVaultUSDX.address,
          parseEther("20000")
        );
        await contracts.mockCrvUST.mint(
          contracts.mockYearnVaultUST.address,
          parseEther("20000")
        );
      });

      context("reverts", function () {
        it("reverts when redeeming too early", async function () {
          await contracts.mockSetToken
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(parseEther("100"));
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchRedeem()
          ).to.be.revertedWith("can not execute batch action yet");
        });
      });
      context("success", function () {
        it("batch redeems", async function () {
          await contracts.mockSetToken
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(parseEther("100"));

          await provider.send("evm_increaseTime", [1800]);
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchRedeem();
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchRedeemed")
            .withArgs(parseEther("100"));
          expect(
            await contracts.mock3Crv.balanceOf(
              contracts.hysiBatchInteraction.address
            )
          ).to.equal(parseEther("9990"));
        });
        it("mints early when redeemThreshold is met", async function () {
          await contracts.mockSetToken
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(parseEther("100"));
          await contracts.mockSetToken
            .connect(depositor1)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor1)
            .depositForRedeem(parseEther("100"));
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchRedeem();
          expect(result).to.emit(
            contracts.hysiBatchInteraction,
            "BatchRedeemed"
          );
        });
        it("advances to the next batch", async function () {
          await contracts.mockSetToken
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(parseEther("100"));
          await provider.send("evm_increaseTime", [1800]);

          const previousRedeemBatchId =
            await contracts.hysiBatchInteraction.currentRedeemBatchId();
          await contracts.hysiBatchInteraction.batchRedeem();

          const previousBatch = await contracts.hysiBatchInteraction.batches(
            previousRedeemBatchId
          );
          expect(previousBatch.claimable).to.equal(true);

          const currentRedeemBatchId =
            await contracts.hysiBatchInteraction.currentRedeemBatchId();
          expect(currentRedeemBatchId).to.not.equal(previousRedeemBatchId);
        });
      });
    });
    context("claim batch", function () {
      beforeEach(async function () {
        await contracts.mockSetToken
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForRedeem(parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForRedeem(parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor3)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor3)
          .depositForRedeem(parseEther("100"));
        await contracts.mockCrvUSDX.mint(
          contracts.mockYearnVaultUSDX.address,
          parseEther("20000")
        );
        await contracts.mockCrvUST.mint(
          contracts.mockYearnVaultUST.address,
          parseEther("20000")
        );
      });
      it("reverts when batch is not yet claimable", async function () {
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        await expect(
          contracts.hysiBatchInteraction.claim(batchId, BatchType.Redeem)
        ).to.be.revertedWith("not yet claimable");
      });
      it("claim batch successfully", async function () {
        await provider.send("evm_increaseTime", [1800]);
        await contracts.hysiBatchInteraction.connect(owner).batchRedeem();
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        expect(
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .claim(batchId, BatchType.Redeem)
        )
          .to.emit(contracts.hysiBatchInteraction, "Claimed")
          .withArgs(depositor.address, parseEther("100"));
        expect(await contracts.mock3Crv.balanceOf(depositor.address)).to.equal(
          parseEther("109990")
        );
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(parseEther("300"));
      });
    });
  });
});
