import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, waffle } from "hardhat";
import CurveMetapoolAbi from "../../lib/Curve/CurveMetapoolAbi.json";
import BasicIssuanceModuleAbi from "../../lib/SetToken/vendor/set-protocol/artifacts/BasicIssuanceModule.json";
import SetTokenAbi from "../../lib/SetToken/vendor/set-protocol/artifacts/SetToken.json";
import { BasicIssuanceModule } from "../../lib/SetToken/vendor/set-protocol/types/BasicIssuanceModule";
import { SetToken } from "../../lib/SetToken/vendor/set-protocol/types/SetToken";
import {
  CurveMetapool,
  ERC20,
  Faucet,
  HysiBatchInteraction,
  MockERC20,
  MockYearnV2Vault,
  Test,
  Test2,
} from "../../typechain";

const provider = waffle.provider;

interface Contracts {
  threeCrv: ERC20;
  crvDUSD: ERC20;
  crvFrax: ERC20;
  faucet: Faucet;
  test: Test;
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
  rewardsManager: SignerWithAddress;
let contracts: Contracts;

const HYSI_TOKEN_ADDRESS = "0x8d1621a27bb8c84e59ca339cf9b21e15b907e408";

const SET_BASIC_ISSUANCE_MODULE_ADDRESS =
  "0xd8EF3cACe8b4907117a45B0b125c68560532F94D";

const THREE_CRV_TOKEN_ADDRESS = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";

const CRV_DUSD_TOKEN_ADDRESS = "0x3a664ab939fd8482048609f652f9a0b0677337b9";
const CRV_FRAX_TOKEN_ADDRESS = "0xd632f22692fac7611d2aa1c0d552930d43caed3b";
const CRV_USDN_TOKEN_ADDRESS = "0x4f3e8f405cf5afc05d68142f3783bdfe13811522";
const CRV_UST_TOKEN_ADDRESS = "0x94e131324b6054c0d789b190b2dac504e4361b53";

const DUSD_METAPOOL_ADDRESS = "0x8038C01A0390a8c547446a0b2c18fc9aEFEcc10c";
const FRAX_METAPOOL_ADDRESS = "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B";
const USDN_METAPOOL_ADDRESS = "0x0f9cb53Ebe405d49A0bbdBD291A65Ff571bC83e1";
const UST_METAPOOL_ADDRESS = "0x890f4e345B1dAED0367A877a1612f86A1f86985f";

const YDUSD_TOKEN_ADDRESS = "0x30fcf7c6cdfc46ec237783d94fc78553e79d4e9c";
const YFRAX_TOKEN_ADDRESS = "0xb4ada607b9d6b2c9ee07a275e9616b84ac560139";
const YUSDN_TOKEN_ADDRESS = "0x3b96d491f067912d18563d56858ba7d6ec67a6fa";
const YUST_TOKEN_ADDRESS = "0x1c6a9783f812b3af3abbf7de64c3cd7cc7d1af44";

const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const CURVE_ADDRESS_PROVIDER_ADDRESS =
  "0x0000000022D53366457F9d5E68Ec105046FC4383";
const CURVE_FACTORY_METAPOOL_DEPOSIT_ZAP_ADDRESS =
  "0xA79828DF1850E8a3A3064576f380D90aECDD3359";

async function deployContracts(): Promise<Contracts> {
  //Deploy helper Faucet
  const Faucet = await ethers.getContractFactory("Faucet");
  const faucet = await (
    await Faucet.deploy(
      UNISWAP_ROUTER_ADDRESS,
      CURVE_ADDRESS_PROVIDER_ADDRESS,
      CURVE_FACTORY_METAPOOL_DEPOSIT_ZAP_ADDRESS
    )
  ).deployed();
  await network.provider.send("hardhat_setBalance", [
    faucet.address,
    "0x152d02c7e14af6800000", // 100k ETH
  ]);

  //Deploy Curve Token
  const threeCrv = (await ethers.getContractAt(
    "ERC20",
    THREE_CRV_TOKEN_ADDRESS
  )) as ERC20;

  const crvDUSD = (await ethers.getContractAt(
    "ERC20",
    CRV_DUSD_TOKEN_ADDRESS
  )) as ERC20;

  const crvFrax = (await ethers.getContractAt(
    "ERC20",
    CRV_FRAX_TOKEN_ADDRESS
  )) as ERC20;

  const Test = await ethers.getContractFactory("Test");
  const test = await (
    await Test.deploy(THREE_CRV_TOKEN_ADDRESS, DUSD_METAPOOL_ADDRESS)
  ).deployed();

  return {
    threeCrv,
    crvDUSD,
    crvFrax,
    faucet,
    test,
  };
}

describe("Test", function () {
  before(async function () {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.FORKING_RPC_URL,
            blockNumber: parseInt(process.env.FORKING_BLOCK_NUMBER),
          },
        },
      ],
    });
  });

  beforeEach(async function () {
    [owner, depositor, depositor1, depositor2, depositor3] =
      await ethers.getSigners();
    contracts = await deployContracts();
    await contracts.faucet.sendThreeCrv(1000, contracts.test.address);
    await contracts.test.addStructs([
      { amount: parseEther("1"), curveMetapool: DUSD_METAPOOL_ADDRESS },
      { amount: parseEther("1"), curveMetapool: FRAX_METAPOOL_ADDRESS },
    ]);
    await contracts.test.addStructs2([
      { amount: parseEther("1"), curveMetapool: DUSD_METAPOOL_ADDRESS },
      { amount: parseEther("1"), curveMetapool: FRAX_METAPOOL_ADDRESS },
    ]);
  });
  describe("test", function () {
    it("test", async function () {
      console.log(await contracts.test.curveMetapool());
      await contracts.test.sendToCurveAddress(parseEther("10"));
      await contracts.test.sendToCurveMetapool(parseEther("10"));
      await contracts.test.sendToCurveMultiple();
      await contracts.test.sendToCurveMultiple2();

      console.log(
        await (
          await contracts.crvDUSD.balanceOf(contracts.test.address)
        ).toString()
      );
      console.log(
        await (
          await contracts.crvFrax.balanceOf(contracts.test.address)
        ).toString()
      );
    });
  });
});
