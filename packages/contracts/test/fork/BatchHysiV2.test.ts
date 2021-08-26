import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, waffle } from "hardhat";
import { HysiBatchInteractionV2 } from "packages/contracts/typechain/HysiBatchInteractionV2";
import CurveMetapoolAbi from "../../lib/Curve/CurveMetapoolAbi.json";
import BasicIssuanceModuleAbi from "../../lib/SetToken/vendor/set-protocol/artifacts/BasicIssuanceModule.json";
import SetTokenAbi from "../../lib/SetToken/vendor/set-protocol/artifacts/SetToken.json";
import { BasicIssuanceModule } from "../../lib/SetToken/vendor/set-protocol/types/BasicIssuanceModule";
import { SetToken } from "../../lib/SetToken/vendor/set-protocol/types/SetToken";
import {
  CurveMetapool,
  ERC20,
  Faucet,
  MockYearnV2Vault,
} from "../../typechain";

const provider = waffle.provider;

interface Contracts {
  threeCrv: ERC20;
  crvDUSD: ERC20;
  crvFRAX: ERC20;
  crvUSDN: ERC20;
  crvUST: ERC20;
  triPool: CurveMetapool;
  dusdMetapool: CurveMetapool;
  fraxMetapool: CurveMetapool;
  usdnMetapool: CurveMetapool;
  ustMetapool: CurveMetapool;
  yDUSD: MockYearnV2Vault;
  yFRAX: MockYearnV2Vault;
  yUSDN: MockYearnV2Vault;
  yUST: MockYearnV2Vault;
  hysi: SetToken;
  basicIssuanceModule: BasicIssuanceModule;
  hysiBatchInteraction: HysiBatchInteractionV2;
  faucet: Faucet;
}

enum BatchType {
  Mint,
  Redeem,
}

let hysiBalance: BigNumber;
let owner: SignerWithAddress,
  depositor: SignerWithAddress,
  depositor1: SignerWithAddress,
  depositor2: SignerWithAddress,
  depositor3: SignerWithAddress;
let contracts: Contracts;

const HYSI_TOKEN_ADDRESS = "0x8d1621a27bb8c84e59ca339cf9b21e15b907e408";

const SET_BASIC_ISSUANCE_MODULE_ADDRESS =
  "0xd8EF3cACe8b4907117a45B0b125c68560532F94D";

const THREE_CRV_TOKEN_ADDRESS = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";
const TRI_POOL_ADDRESS = "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7";

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

const underlying = [
  {
    crvToken: CRV_DUSD_TOKEN_ADDRESS,
    yToken: YDUSD_TOKEN_ADDRESS,
    curveMetaPool: DUSD_METAPOOL_ADDRESS,
  },
  {
    crvToken: CRV_FRAX_TOKEN_ADDRESS,
    yToken: YFRAX_TOKEN_ADDRESS,
    curveMetaPool: FRAX_METAPOOL_ADDRESS,
  },
  {
    crvToken: CRV_USDN_TOKEN_ADDRESS,
    yToken: YUSDN_TOKEN_ADDRESS,
    curveMetaPool: USDN_METAPOOL_ADDRESS,
  },
  {
    crvToken: CRV_UST_TOKEN_ADDRESS,
    yToken: YUST_TOKEN_ADDRESS,
    curveMetaPool: UST_METAPOOL_ADDRESS,
  },
];

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
    "0x52b7d2dcc80cd2e4000000", // 100 million ETH
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

  const crvFRAX = (await ethers.getContractAt(
    "ERC20",
    CRV_FRAX_TOKEN_ADDRESS
  )) as ERC20;

  const crvUSDN = (await ethers.getContractAt(
    "ERC20",
    CRV_USDN_TOKEN_ADDRESS
  )) as ERC20;

  const crvUST = (await ethers.getContractAt(
    "ERC20",
    CRV_UST_TOKEN_ADDRESS
  )) as ERC20;

  //Deploy Curve Metapool
  const triPool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    TRI_POOL_ADDRESS
  )) as CurveMetapool;

  const dusdMetapool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    DUSD_METAPOOL_ADDRESS
  )) as CurveMetapool;

  const fraxMetapool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    FRAX_METAPOOL_ADDRESS
  )) as CurveMetapool;

  const usdnMetapool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    USDN_METAPOOL_ADDRESS
  )) as CurveMetapool;

  const ustMetapool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    UST_METAPOOL_ADDRESS
  )) as CurveMetapool;

  //Deploy Yearn Vaults
  const yDUSD = (await ethers.getContractAt(
    "MockYearnV2Vault",
    YDUSD_TOKEN_ADDRESS
  )) as MockYearnV2Vault;

  const yFRAX = (await ethers.getContractAt(
    "MockYearnV2Vault",
    YFRAX_TOKEN_ADDRESS
  )) as MockYearnV2Vault;

  const yUSDN = (await ethers.getContractAt(
    "MockYearnV2Vault",
    YUSDN_TOKEN_ADDRESS
  )) as MockYearnV2Vault;

  const yUST = (await ethers.getContractAt(
    "MockYearnV2Vault",
    YUST_TOKEN_ADDRESS
  )) as MockYearnV2Vault;

  //Deploy Set Procotol
  const hysi = (await ethers.getContractAt(
    SetTokenAbi.abi,
    HYSI_TOKEN_ADDRESS
  )) as SetToken;

  const basicIssuanceModule = (await ethers.getContractAt(
    BasicIssuanceModuleAbi.abi,
    SET_BASIC_ISSUANCE_MODULE_ADDRESS
  )) as BasicIssuanceModule;

  //Deploy HysiBatchInteraction
  const HysiBatchInteraction = await ethers.getContractFactory(
    "HysiBatchInteractionV2"
  );
  const hysiBatchInteraction = await (
    await HysiBatchInteraction.deploy(
      THREE_CRV_TOKEN_ADDRESS,
      TRI_POOL_ADDRESS,
      HYSI_TOKEN_ADDRESS,
      SET_BASIC_ISSUANCE_MODULE_ADDRESS,
      1500,
      parseEther("200"),
      parseEther("1")
    )
  ).deployed();

  await hysiBatchInteraction.connect(owner).setUnderylingToken(underlying);

  return {
    threeCrv,
    crvDUSD,
    crvFRAX,
    crvUSDN,
    crvUST,
    triPool,
    dusdMetapool,
    fraxMetapool,
    usdnMetapool,
    ustMetapool,
    yDUSD,
    yFRAX,
    yUSDN,
    yUST,
    hysi,
    basicIssuanceModule,
    hysiBatchInteraction,
    faucet,
  };
}

describe("HysiBatchInteraction Network Test", function () {
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
    console.log(
      await (await provider.getBalance(contracts.faucet.address)).toString()
    );
    await contracts.faucet.sendThreeCrv(10000000, depositor.address);
    console.log(
      await (await provider.getBalance(contracts.faucet.address)).toString()
    );
  });
  context("calculations", function () {
    it.skip("tests", async function () {
      const reqComponents =
        await contracts.basicIssuanceModule.getRequiredComponentUnitsForIssue(
          contracts.hysi.address,
          1
        );
      const quantities = reqComponents[1];

      const threeCrvVirtualPrice = await contracts.triPool.get_virtual_price();

      const crvTokenAmountForYTokenDUSD = await contracts.yDUSD.pricePerShare();
      const threeCrvAmountForCrvTokenDUSD =
        await contracts.hysiBatchInteraction.get3crvForMetapool(0);
      const yDUSDIn3Crv = crvTokenAmountForYTokenDUSD
        .mul(threeCrvAmountForCrvTokenDUSD)
        .div(parseEther("1"));
      const yDUSDPrice = yDUSDIn3Crv
        .mul(threeCrvVirtualPrice)
        .div(parseEther("1"));

      const crvTokenAmountForYTokenFRAX = await contracts.yFRAX.pricePerShare();
      const threeCrvAmountForCrvTokenFRAX =
        await contracts.hysiBatchInteraction.get3crvForMetapool(1);
      const yFRAXIn3Crv = crvTokenAmountForYTokenFRAX
        .mul(threeCrvAmountForCrvTokenFRAX)
        .div(parseEther("1"));
      const yFRAXPrice = yFRAXIn3Crv
        .mul(threeCrvVirtualPrice)
        .div(parseEther("1"));

      const crvTokenAmountForYTokenUSDN = await contracts.yUSDN.pricePerShare();
      const threeCrvAmountForCrvTokenUSDN =
        await contracts.hysiBatchInteraction.get3crvForMetapool(2);
      const yUSDNIn3Crv = crvTokenAmountForYTokenUSDN
        .mul(threeCrvAmountForCrvTokenUSDN)
        .div(parseEther("1"));
      const yUSDNPrice = yUSDNIn3Crv
        .mul(threeCrvVirtualPrice)
        .div(parseEther("1"));

      const crvTokenAmountForYTokenUST = await contracts.yUST.pricePerShare();
      const threeCrvAmountForCrvTokenUST =
        await contracts.hysiBatchInteraction.get3crvForMetapool(3);
      const yUSTIn3Crv = crvTokenAmountForYTokenUST
        .mul(threeCrvAmountForCrvTokenUST)
        .div(parseEther("1"));
      const yUSTPrice = yUSTIn3Crv
        .mul(threeCrvVirtualPrice)
        .div(parseEther("1"));

      const hysiPrice = yDUSDPrice
        .mul(quantities[0])
        .add(yFRAXPrice.mul(quantities[1]))
        .add(yUSDNPrice.mul(quantities[2]))
        .add(yUSTPrice.mul(quantities[3]));
      console.log(hysiPrice.toString());
    });
    it("mints", async function () {
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId1 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        0
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 1");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId1)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId2 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        1
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 2");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId2)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId3 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        2
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 3");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId3)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId4 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        3
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 4");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId4)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId5 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        4
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 5");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId5)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId6 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        5
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 6");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId6)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId7 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        6
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 7");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId7)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId8 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        7
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMint();
      console.log("run 8");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId8)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
    });
    it("mints even", async function () {
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId1 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        0
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 1");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId1)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId2 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        1
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 2");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId2)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId3 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        2
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 3");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId3)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId4 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        3
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 4");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId4)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId5 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        4
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 5");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId5)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId6 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        5
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 6");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId6)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId7 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        6
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 7");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId7)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId8 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        7
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintEven();
      console.log("run 8");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId8)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
    });
    it("tests calculations for mintV2", async function () {
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId1 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        0
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      const results =
        await contracts.hysiBatchInteraction.getV2InitalCalculationResults();
    });
    it("mints v2", async function () {
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId1 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        0
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 1");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId1)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId2 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        1
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 2");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId2)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId3 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        2
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 3");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId3)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId4 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        3
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 4");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId4)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId5 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        4
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 5");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId5)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId6 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        5
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 6");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId6)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId7 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        6
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 7");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId7)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
      await provider.send("evm_increaseTime", [1500]);
      await provider.send("evm_mine", []);
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("1000000"));
      const batchId8 = await contracts.hysiBatchInteraction.batchesOfAccount(
        depositor.address,
        7
      );
      await provider.send("evm_increaseTime", [1800]);
      await provider.send("evm_mine", []);
      await contracts.hysiBatchInteraction.connect(depositor).batchMintV2();
      console.log("run 8");
      console.log(
        (
          await contracts.hysiBatchInteraction.batches(batchId8)
        ).claimableToken.toString()
      );
      console.log(
        "yDUSD leftover",
        await (
          await contracts.yDUSD.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yFRAX leftover",
        await (
          await contracts.yFRAX.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUSDN leftover",
        await (
          await contracts.yUSDN.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "yUST leftover",
        await (
          await contracts.yUST.balanceOf(contracts.hysiBatchInteraction.address)
        )
          .div(parseEther("1"))
          .toString()
      );
      console.log(
        "3crv leftover",
        await (
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).toString()
      );
    });
    it.skip("keeper mint", async function () {
      await contracts.threeCrv
        .connect(depositor)
        .approve(contracts.hysiBatchInteraction.address, parseEther("1000000"));
      await contracts.hysiBatchInteraction
        .connect(depositor)
        .depositForMint(parseEther("250"));

      const batchId = await contracts.hysiBatchInteraction.currentMintBatchId();

      const mintBatch = await contracts.hysiBatchInteraction.batches(batchId);

      const reqComponents =
        await contracts.basicIssuanceModule.getRequiredComponentUnitsForIssue(
          contracts.hysi.address,
          1
        );
      const quantities = reqComponents[1];

      const crvTokenAmountForYTokenDUSD = await contracts.yDUSD.pricePerShare();
      const threeCrvAmountForCrvTokenDUSD =
        await contracts.hysiBatchInteraction.get3crvForMetapool(0);
      const yDUSDIn3Crv = crvTokenAmountForYTokenDUSD
        .mul(threeCrvAmountForCrvTokenDUSD)
        .div(parseEther("1"));
      const yDUSDQuantityIn3Crv = yDUSDIn3Crv.mul(quantities[0]);

      const crvTokenAmountForYTokenFRAX = await contracts.yFRAX.pricePerShare();
      const threeCrvAmountForCrvTokenFRAX =
        await contracts.hysiBatchInteraction.get3crvForMetapool(1);
      const yFRAXIn3Crv = crvTokenAmountForYTokenFRAX
        .mul(threeCrvAmountForCrvTokenFRAX)
        .div(parseEther("1"));
      const yFRAXQuantityIn3Crv = yFRAXIn3Crv.mul(quantities[1]);

      const crvTokenAmountForYTokenUSDN = await contracts.yUSDN.pricePerShare();
      const threeCrvAmountForCrvTokenUSDN =
        await contracts.hysiBatchInteraction.get3crvForMetapool(2);
      const yUSDNIn3Crv = crvTokenAmountForYTokenUSDN
        .mul(threeCrvAmountForCrvTokenUSDN)
        .div(parseEther("1"));
      const yUSDNQuantityIn3Crv = yUSDNIn3Crv.mul(quantities[2]);

      const crvTokenAmountForYTokenUST = await contracts.yUST.pricePerShare();
      const threeCrvAmountForCrvTokenUST =
        await contracts.hysiBatchInteraction.get3crvForMetapool(3);
      const yUSTIn3Crv = crvTokenAmountForYTokenUST
        .mul(threeCrvAmountForCrvTokenUST)
        .div(parseEther("1"));
      const yUSTQuantityIn3Crv = yUSTIn3Crv.mul(quantities[3]);

      const hysiPriceIn3Crv = yDUSDQuantityIn3Crv
        .add(yFRAXQuantityIn3Crv)
        .add(yUSDNQuantityIn3Crv)
        .add(yUSTQuantityIn3Crv);
      console.log("supplied Token", mintBatch.suppliedToken.toString());
      console.log("hysiPriceIn3crv", hysiPriceIn3Crv.toString());
      const hysiAmount = mintBatch.suppliedToken
        .mul(parseEther("1"))
        .div(hysiPriceIn3Crv);
      console.log("hysiAmount", hysiAmount.toString());
      const yDUSDAllocation = yDUSDQuantityIn3Crv
        .mul(hysiAmount)
        .div(parseEther("1"));
      const yFRAXAllocation = yFRAXQuantityIn3Crv
        .mul(hysiAmount)
        .div(parseEther("1"));
      const yUSDNAllocation = yUSDNQuantityIn3Crv
        .mul(hysiAmount)
        .div(parseEther("1"));
      const yUSTAllocation = yUSTQuantityIn3Crv
        .mul(hysiAmount)
        .div(parseEther("1"));
      const controlSum = yDUSDAllocation
        .add(yFRAXAllocation)
        .add(yUSDNAllocation)
        .add(yUSTAllocation);
      console.log("DUSD allocation", yDUSDAllocation.toString());
      console.log("FRAX allocation", yFRAXAllocation.toString());
      console.log("USDN allocation", yUSDNAllocation.toString());
      console.log("UST allocation", yUSTAllocation.toString());

      console.log("control", controlSum.toString());

      const hysiValues = await contracts.hysiBatchInteraction.getHysi();
      console.log("view hysiAmount", hysiValues[0].toString());
      hysiValues[1].forEach((e) => console.log(e.toString()));
      console.log(
        "view control",
        hysiValues[1][0]
          .add(hysiValues[1][1])
          .add(hysiValues[1][2])
          .add(hysiValues[1][3])
          .toString()
      );

      // await provider.send("evm_increaseTime", [1800]);
      // await provider.send("evm_mine", []);
      // await await contracts.hysiBatchInteraction
      //   .connect(depositor)
      //   .batchMintKeeper();
    });
  });
});
