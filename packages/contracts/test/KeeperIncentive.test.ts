import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import { KeeperIncentiveHelper, MockERC20 } from "../typechain";

let deployTimestamp;
let owner: SignerWithAddress, nonOwner: SignerWithAddress;
let mockPop: MockERC20;
let keeperIncentiveHelper: KeeperIncentiveHelper;
const dayInSec = 86400;
const incentive = parseEther("10");

describe("Keeper incentives", function () {
  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    const mockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockPop = (await (
      await mockERC20Factory.deploy("TestPOP", "TPOP", 18)
    ).deployed()) as MockERC20;
    await mockPop.mint(owner.address, parseEther("100"));
    await mockPop.mint(nonOwner.address, parseEther("10"));

    deployTimestamp = (await waffle.provider.getBlock("latest")).timestamp + 1;
    keeperIncentiveHelper = await (
      await (
        await ethers.getContractFactory("KeeperIncentiveHelper")
      ).deploy(mockPop.address)
    ).deployed();
  });
  it("should create incentives with the correct parameters", async function () {
    expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
      incentive,
      true,
      false,
    ]);
    await keeperIncentiveHelper.createIncentive(incentive, true, false);
    expect(await keeperIncentiveHelper.incentives(1)).to.deep.equal([
      incentive,
      true,
      false,
    ]);
  });
  it("functions should only be available for Governance", async function () {
    await expect(
      keeperIncentiveHelper
        .connect(nonOwner)
        .createIncentive(incentive, true, false)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
    await expect(
      keeperIncentiveHelper
        .connect(nonOwner)
        .updateIncentive(0, incentive, true, false)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
    await expect(
      keeperIncentiveHelper.connect(nonOwner).approveAccount(owner.address)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
    await expect(
      keeperIncentiveHelper.connect(nonOwner).removeApproval(owner.address)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
    await expect(
      keeperIncentiveHelper.connect(nonOwner).toggleApproval(0)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
    await expect(
      keeperIncentiveHelper.connect(nonOwner).toggleIncentive(0)
    ).to.be.revertedWith(
      "Only the contract governance may perform this action"
    );
  });
  describe("change incentives", function () {
    it("should change the whole incentive", async function () {
      const timestamp = (await waffle.provider.getBlock("latest")).timestamp;
      const result = await keeperIncentiveHelper
        .connect(owner)
        .updateIncentive(0, parseEther("100"), false, true);
      expect(result)
        .to.emit(keeperIncentiveHelper, "IncentiveChanged")
        .withArgs(0);
      expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
        parseEther("100"),
        false,
        true,
      ]);
    });
    it("should toggle if the incentive is enabled", async function () {
      const result = await keeperIncentiveHelper
        .connect(owner)
        .toggleIncentive(0);
      expect(result)
        .to.emit(keeperIncentiveHelper, "IncentiveToggled")
        .withArgs(0, false);
      expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
        incentive,
        false,
        false,
      ]);
      const result2 = await keeperIncentiveHelper
        .connect(owner)
        .toggleIncentive(0);
      expect(result2)
        .to.emit(keeperIncentiveHelper, "IncentiveToggled")
        .withArgs(0, true);
      expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
        incentive,
        true,
        false,
      ]);
    });
    it("should fund incentives", async function () {
      await mockPop
        .connect(nonOwner)
        .approve(keeperIncentiveHelper.address, incentive);
      const result = await keeperIncentiveHelper
        .connect(nonOwner)
        .fundIncentive(incentive);
      expect(result)
        .to.emit(keeperIncentiveHelper, "IncentiveFunded")
        .withArgs(incentive);
      expect(await mockPop.balanceOf(keeperIncentiveHelper.address)).to.equal(
        incentive
      );
      expect(await keeperIncentiveHelper.incentiveBudget()).to.equal(incentive);
    });
    context("approval", function () {
      it("should approve accounts", async function () {
        expect(
          await keeperIncentiveHelper
            .connect(owner)
            .approveAccount(nonOwner.address)
        )
          .to.emit(keeperIncentiveHelper, "Approved")
          .withArgs(nonOwner.address);
        expect(await keeperIncentiveHelper.approved(nonOwner.address)).to.equal(
          true
        );
      });
      it("should remove approval", async function () {
        await keeperIncentiveHelper
          .connect(owner)
          .approveAccount(nonOwner.address);
        expect(
          await keeperIncentiveHelper
            .connect(owner)
            .removeApproval(nonOwner.address)
        )
          .to.emit(keeperIncentiveHelper, "RemovedApproval")
          .withArgs(nonOwner.address);
        expect(await keeperIncentiveHelper.approved(nonOwner.address)).to.equal(
          false
        );
      });
      it("should toggle approval", async function () {
        expect(await keeperIncentiveHelper.connect(owner).toggleApproval(0))
          .to.emit(keeperIncentiveHelper, "ApprovalToggled")
          .withArgs(0, true);
        expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
          incentive,
          true,
          true,
        ]);
        expect(await keeperIncentiveHelper.connect(owner).toggleApproval(0))
          .to.emit(keeperIncentiveHelper, "ApprovalToggled")
          .withArgs(0, false);
        expect(await keeperIncentiveHelper.incentives(0)).to.deep.equal([
          incentive,
          true,
          false,
        ]);
      });
    });
  });
  describe("call incentivized functions", function () {
    it("should pay out keeper incentive rewards", async function () {
      const oldBalance = await mockPop.balanceOf(owner.address);

      await mockPop
        .connect(nonOwner)
        .approve(keeperIncentiveHelper.address, incentive);
      await keeperIncentiveHelper.connect(nonOwner).fundIncentive(incentive);

      expect(
        await keeperIncentiveHelper.connect(owner).defaultIncentivisedFunction()
      )
        .to.emit(keeperIncentiveHelper, "FunctionCalled")
        .withArgs(owner.address);
      const newBalance = await mockPop.balanceOf(owner.address);
      expect(newBalance).to.deep.equal(oldBalance.add(incentive));
    });
    it("should not pay out rewards if the incentive budget is not high enough", async function () {
      const oldBalance = await mockPop.balanceOf(owner.address);
      const result = await keeperIncentiveHelper
        .connect(owner)
        .defaultIncentivisedFunction();
      const newBalance = await mockPop.balanceOf(owner.address);
      expect(newBalance).to.equal(oldBalance);
    });
    context("approval", function () {
      it("should not be callable for non approved addresses", async function () {
        await expect(
          keeperIncentiveHelper.connect(nonOwner).defaultIncentivisedFunction()
        ).to.revertedWith("you are not approved as a keeper");
      });
      it("should be callable for non approved addresses if the incentive is open to everyone", async function () {
        await keeperIncentiveHelper.connect(owner).toggleApproval(0);
        await mockPop
          .connect(owner)
          .approve(keeperIncentiveHelper.address, parseEther("11"));
        await keeperIncentiveHelper
          .connect(owner)
          .fundIncentive(parseEther("11"));

        const oldBalance = await mockPop.balanceOf(nonOwner.address);
        const result = await keeperIncentiveHelper
          .connect(nonOwner)
          .defaultIncentivisedFunction();

        expect(result)
          .to.emit(keeperIncentiveHelper, "FunctionCalled")
          .withArgs(nonOwner.address);
        const newbalance = await mockPop.balanceOf(nonOwner.address);
        expect(newbalance).to.equal(oldBalance.add(incentive));
      });
    });
    context("should not do anything ", function () {
      it("if the incentive for this function wasnt set yet", async function () {
        await mockPop
          .connect(nonOwner)
          .approve(keeperIncentiveHelper.address, incentive);
        await keeperIncentiveHelper.connect(nonOwner).fundIncentive(incentive);

        const oldBalance = await mockPop.balanceOf(owner.address);
        expect(
          await keeperIncentiveHelper.connect(owner).incentivisedFunction()
        )
          .to.emit(keeperIncentiveHelper, "FunctionCalled")
          .withArgs(owner.address);

        const newBalance = await mockPop.balanceOf(owner.address);
        expect(newBalance).to.equal(oldBalance);
      });
    });
  });
});
