import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { MockContract } from "ethereum-waffle";
import { ethers, waffle } from "hardhat";
import { Region } from "../typechain";

let owner: SignerWithAddress, nonOwner: SignerWithAddress;

let contract: Region;
let mockBeneficiaryVaults: MockContract;
const DEFAULT_REGION = "0x5757";
const newRegion = "0x1111";

describe("Region", function () {
  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    const BeneficiaryVaults = await ethers.getContractFactory(
      "BeneficiaryVaults"
    );
    mockBeneficiaryVaults = await waffle.deployMockContract(
      owner,
      BeneficiaryVaults.interface.format() as any
    );
    const regionFactory = await ethers.getContractFactory("Region");
    contract = await (
      await regionFactory.deploy(mockBeneficiaryVaults.address)
    ).deployed();
  });
  it("initates correct default values", async function () {
    expect(await contract.regionExists(DEFAULT_REGION)).to.be.equal(true);
    expect(await contract.regions(0)).to.be.equal(DEFAULT_REGION);
  });
  context("region creation", function () {
    it("reverts when not called by governance", async function () {
      await expect(
        contract
          .connect(nonOwner)
          .addRegion(newRegion, mockBeneficiaryVaults.address)
      ).to.be.revertedWith(
        "Only the contract governance may perform this action"
      );
    });
    it("reverts when the region already exists", async function () {
      await expect(
        contract.addRegion(DEFAULT_REGION, mockBeneficiaryVaults.address)
      ).to.be.revertedWith("region already exists");
    });
    it("creates a region", async function () {
      const result = await contract.addRegion(
        newRegion,
        mockBeneficiaryVaults.address
      );
      expect(result).to.emit(contract, "RegionAdded").withArgs(newRegion);
      expect(await contract.getAllRegions()).to.be.deep.equal([
        DEFAULT_REGION,
        newRegion,
      ]);
      expect(await contract.regionExists(newRegion)).to.be.equal(true);
    });
  });
  it("returns all regions", async function () {
    expect(await contract.getAllRegions()).to.be.deep.equal([DEFAULT_REGION]);
    await contract.addRegion(newRegion, mockBeneficiaryVaults.address);
    expect(await contract.getAllRegions()).to.be.deep.equal([
      DEFAULT_REGION,
      newRegion,
    ]);
  });
});
