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
  const mockBasicCoin = await (
    await MockERC20.deploy("Basic", "Basic", 18)
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
    context("withdraw from queue", function () {
      beforeEach(async function () {
        await contracts.mock3Crv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("100"));
      });
      context("revert", function () {
        it("reverts when the batch was already minted", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchMint(0);
          await expect(
            contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Mint, parseEther("10"))
          ).to.be.revertedWith("already processed");
        });
        it("reverts when trying to withdraw more than deposited", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );

          await expect(
            contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Mint, parseEther("101"))
          ).to.be.revertedWith("not enough shares");
        });
      });
      context("sucess", function () {
        it("withdraws the deposit", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          const balance = await contracts.mock3Crv.balanceOf(depositor.address);
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Mint, parseEther("100"))
          )
            .to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue")
            .withArgs(batchId, parseEther("100"), depositor.address);
          expect(
            await contracts.mock3Crv.balanceOf(depositor.address)
          ).to.equal(balance.add(parseEther("100")));
        });
        it("withdraws part of the deposit and continues to mint the rest", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Mint, parseEther("50"))
          ).to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue");
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchMint(0);
          expect(
            (await contracts.hysiBatchInteraction.batches(batchId))
              .claimableToken
          ).to.equal(parseEther("0.4980015"));
        });
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
            contracts.hysiBatchInteraction.connect(owner).batchMint(0)
          ).to.be.revertedWith("can not execute batch action yet");
        });
      });
      context("success", function () {
        it("batch mints", async function () {
          const batchId =
            await contracts.hysiBatchInteraction.currentMintBatchId();

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
            .batchMint(0);
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchMinted")
            .withArgs(batchId, parseEther("10000"), parseEther("50"));
          expect(
            await contracts.mockSetToken.balanceOf(
              contracts.hysiBatchInteraction.address
            )
          ).to.equal(parseEther("50"));
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
            contracts.hysiBatchInteraction.connect(owner).batchMint(0)
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
          await contracts.hysiBatchInteraction.batchMint(0);

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
          contracts.hysiBatchInteraction.claim(batchId)
        ).to.be.revertedWith("not yet claimable");
      });
      it("claim batch successfully", async function () {
        await provider.send("evm_increaseTime", [1800]);
        await provider.send("evm_mine", []);
        await contracts.hysiBatchInteraction.connect(owner).batchMint(0);
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        expect(
          await contracts.hysiBatchInteraction.connect(depositor).claim(batchId)
        )
          .to.emit(contracts.hysiBatchInteraction, "Claimed")
          .withArgs(
            depositor.address,
            BatchType.Mint,
            parseEther("10000"),
            parseEther("50")
          );
        expect(
          await contracts.mockSetToken.balanceOf(depositor.address)
        ).to.equal(parseEther("50"));
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(parseEther("30000"));
        expect(batch.claimableToken).to.equal(parseEther("150"));
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
    context("withdraw from queue", function () {
      beforeEach(async function () {
        await contracts.mockSetToken
          .connect(owner)
          .mint(depositor.address, parseEther("100"));
        await contracts.mockSetToken
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
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
      context("revert", function () {
        it("reverts when the batch was already redeemed", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchRedeem(0);
          await expect(
            contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, parseEther("10"))
          ).to.be.revertedWith("already processed");
        });
      });
      context("sucess", function () {
        it("withdraws the deposit", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, parseEther("100"))
          )
            .to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue")
            .withArgs(batchId, parseEther("100"), depositor.address);
          expect(
            await contracts.mockSetToken.balanceOf(depositor.address)
          ).to.equal(parseEther("200"));
        });
        it("withdraws part of the deposit and continues to redeem the rest", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          );
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, parseEther("50"))
          ).to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue");
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchRedeem(0);
          expect(
            (await contracts.hysiBatchInteraction.batches(batchId))
              .claimableToken
          ).to.equal(parseEther("4995"));
        });
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
            contracts.hysiBatchInteraction.connect(owner).batchRedeem(0)
          ).to.be.revertedWith("can not execute batch action yet");
        });
      });
      context("success", function () {
        it("batch redeems", async function () {
          const batchId =
            await contracts.hysiBatchInteraction.currentRedeemBatchId();

          await contracts.mockSetToken
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(parseEther("100"));

          await provider.send("evm_increaseTime", [1800]);
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchRedeem(0);
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchRedeemed")
            .withArgs(batchId, parseEther("100"), parseEther("9990"));
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
            .batchRedeem(0);
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
          await contracts.hysiBatchInteraction.batchRedeem(0);

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
          contracts.hysiBatchInteraction.claim(batchId)
        ).to.be.revertedWith("not yet claimable");
      });
      it("claim batch successfully", async function () {
        await provider.send("evm_increaseTime", [1800]);
        await contracts.hysiBatchInteraction.connect(owner).batchRedeem(0);
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          0
        );
        expect(
          await contracts.hysiBatchInteraction.connect(depositor).claim(batchId)
        )
          .to.emit(contracts.hysiBatchInteraction, "Claimed")
          .withArgs(
            depositor.address,
            BatchType.Redeem,
            parseEther("100"),
            parseEther("9990")
          );
        expect(await contracts.mock3Crv.balanceOf(depositor.address)).to.equal(
          parseEther("109990")
        );
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(parseEther("300"));
      });
    });
  });
});
