import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { formatEther, parseEther } from "ethers/lib/utils";
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
  MockYearnV2Vault,
} from "../../typechain";

const provider = waffle.provider;

interface Contracts {
  threeCrv: ERC20;
  crvDUSD: ERC20;
  crvFRAX: ERC20;
  crvUSDN: ERC20;
  crvUST: ERC20;
  threePool: CurveMetapool;
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
  hysiBatchInteraction: HysiBatchInteraction;
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
const SET_TOKEN_ADDRESS = "0x8d1621a27bb8c84e59ca339cf9b21e15b907e408";

const THREE_CRV_TOKEN_ADDRESS = "0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490";

const THREEPOOL_ADDRESS = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
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

const componentMap = {
  [YDUSD_TOKEN_ADDRESS]: {
    name: "yDUSD",
    metaPool: undefined,
    yPool: undefined,
  },
  [YFRAX_TOKEN_ADDRESS]: {
    name: "yFRAX",
    metaPool: undefined,
    yPool: undefined,
  },
  [YUSDN_TOKEN_ADDRESS]: {
    name: "yUSDN",
    metaPool: undefined,
    yPool: undefined,
  },
  [YUST_TOKEN_ADDRESS]: {
    name: "yUST",
    metaPool: undefined,
    yPool: undefined,
  },
};

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

  const threePool = (await ethers.getContractAt(
    CurveMetapoolAbi,
    THREEPOOL_ADDRESS
  )) as CurveMetapool;

  //Deploy Curve Metapool
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

  //const calcWithdraw = {
  //  dusd: formatEther(
  //    await dusdMetapool.calc_withdraw_one_coin(parseEther("1"), 1)
  //  ),
  //  frax: formatEther(
  //    await fraxMetapool.calc_withdraw_one_coin(parseEther("1"), 1)
  //  ),
  //  usdn: formatEther(
  //    await usdnMetapool.calc_withdraw_one_coin(parseEther("1"), 1)
  //  ),
  //  ust: formatEther(
  //    await ustMetapool.calc_withdraw_one_coin(parseEther("1"), 1)
  //  ),
  //};

  //console.log({ calcWithdraw });

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

  componentMap[YDUSD_TOKEN_ADDRESS].metaPool = dusdMetapool;
  componentMap[YDUSD_TOKEN_ADDRESS].yPool = yDUSD;
  componentMap[YFRAX_TOKEN_ADDRESS].metaPool = fraxMetapool;
  componentMap[YFRAX_TOKEN_ADDRESS].yPool = yFRAX;
  componentMap[YUSDN_TOKEN_ADDRESS].metaPool = usdnMetapool;
  componentMap[YUSDN_TOKEN_ADDRESS].yPool = yUSDN;
  componentMap[YUST_TOKEN_ADDRESS].metaPool = ustMetapool;
  componentMap[YUST_TOKEN_ADDRESS].yPool = yUST;

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
    "HysiBatchInteraction"
  );
  const hysiBatchInteraction = await (
    await HysiBatchInteraction.deploy(
      THREE_CRV_TOKEN_ADDRESS,
      HYSI_TOKEN_ADDRESS,
      SET_BASIC_ISSUANCE_MODULE_ADDRESS,
      [
        YDUSD_TOKEN_ADDRESS,
        YFRAX_TOKEN_ADDRESS,
        YUSDN_TOKEN_ADDRESS,
        YUST_TOKEN_ADDRESS,
      ],
      [
        {
          curveMetaPool: DUSD_METAPOOL_ADDRESS,
          crvLPToken: CRV_DUSD_TOKEN_ADDRESS,
        },
        {
          curveMetaPool: FRAX_METAPOOL_ADDRESS,
          crvLPToken: CRV_FRAX_TOKEN_ADDRESS,
        },
        {
          curveMetaPool: USDN_METAPOOL_ADDRESS,
          crvLPToken: CRV_USDN_TOKEN_ADDRESS,
        },
        {
          curveMetaPool: UST_METAPOOL_ADDRESS,
          crvLPToken: CRV_UST_TOKEN_ADDRESS,
        },
      ],
      2500,
      parseEther("200"),
      parseEther("1")
    )
  ).deployed();

  return {
    threeCrv,
    crvDUSD,
    crvFRAX,
    crvUSDN,
    crvUST,
    threePool,
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
const getMinAmountOfHYSIToMint = async (): Promise<BigNumber> => {
  const batchId = await contracts.hysiBatchInteraction.currentMintBatchId();
  // get expected units of HYSI given 3crv amount:
  const threeCrvInBatch = (
    await contracts.hysiBatchInteraction.batches(batchId)
  ).suppliedToken;
  const valueOf3CrvInBatch = threeCrvInBatch.mul(
    await contracts.threePool.get_virtual_price()
  );
  const components = await contracts.basicIssuanceModule.getRequiredComponentUnitsForIssue(
    SET_TOKEN_ADDRESS,
    parseEther("1")
  );
  const componentAddresses = components[0];
  const componentAmounts = components[1];

  const componentVirtualPrices = await Promise.all(
    componentAddresses.map(async (component) => {
      const metapool = componentMap[component.toLowerCase()]
        .metaPool as CurveMetapool;
      const yPool = componentMap[component.toLowerCase()]
        .yPool as MockYearnV2Vault;
      const yPoolPricePerShare = await yPool.pricePerShare();
      const metapoolPrice = await metapool.get_virtual_price();
      return yPoolPricePerShare.mul(metapoolPrice).div(parseEther("1"));
    })
  );

  const componentValuesInUSD = componentVirtualPrices.reduce(
    (sum, componentPrice, i) => {
      return sum.add(componentPrice.mul(componentAmounts[i]));
    },
    parseEther("0")
  );

  const HYSI_toMint = valueOf3CrvInBatch
    .mul(parseEther("1"))
    .div(componentValuesInUSD);

  const minAmountToMint = HYSI_toMint.mul(parseEther(".995")).div(
    parseEther("1")
  );
  return minAmountToMint;
};

const getMinAmountOf3CrvToReceive = async (
  slippage: number = 0.005
): Promise<BigNumber> => {
  const batchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();

  // get expected units of HYSI given 3crv amount:
  const HYSIInBatch = (await contracts.hysiBatchInteraction.batches(batchId))
    .suppliedToken;

  const components = await contracts.basicIssuanceModule.getRequiredComponentUnitsForIssue(
    SET_TOKEN_ADDRESS,
    HYSIInBatch
  );
  const componentAddresses = components[0];
  const componentAmounts = components[1];

  const componentVirtualPrices = await Promise.all(
    componentAddresses.map(async (component) => {
      const metapool = componentMap[component.toLowerCase()]
        .metaPool as CurveMetapool;
      const yPool = componentMap[component.toLowerCase()]
        .yPool as MockYearnV2Vault;
      const yPoolPricePerShare = await yPool.pricePerShare();
      const metapoolPrice = await metapool.get_virtual_price();
      return yPoolPricePerShare.mul(metapoolPrice).div(parseEther("1"));
    })
  );

  const componentValuesInUSD = componentVirtualPrices.reduce(
    (sum, componentPrice, i) => {
      return sum.add(
        componentPrice.mul(componentAmounts[i]).div(parseEther("1"))
      );
    },
    parseEther("0")
  );

  // 50 bps slippage tolerance
  const slippageTolerance = 1 - Number(slippage);
  const minAmountToReceive = componentValuesInUSD
    .mul(parseEther(slippageTolerance.toString()))
    .div(parseEther("1"));

  console.log({
    componentValuesInUSD: formatEther(componentValuesInUSD),
    minAmountToReceive: formatEther(minAmountToReceive),
  });
  return minAmountToReceive;
};

async function depositForHysiMint(
  account: SignerWithAddress,
  threeCrvAmount: BigNumber
): Promise<void> {
  await contracts.threeCrv
    .connect(account)
    .approve(contracts.hysiBatchInteraction.address, threeCrvAmount);
  await contracts.hysiBatchInteraction
    .connect(account)
    .depositForMint(threeCrvAmount);
}

async function distributeHysiToken(): Promise<void> {
  await depositForHysiMint(depositor, parseEther("100"));
  await depositForHysiMint(depositor1, parseEther("100"));
  await depositForHysiMint(depositor2, parseEther("100"));
  await depositForHysiMint(depositor3, parseEther("100"));

  await provider.send("evm_increaseTime", [1800]);
  await provider.send("evm_mine", []);

  await contracts.hysiBatchInteraction.connect(owner).batchMint(0);
  const depositId = await contracts.hysiBatchInteraction.batchesOfAccount(
    depositor.address,
    0
  );
  await contracts.hysiBatchInteraction.connect(depositor).claim(depositId);
  await contracts.hysiBatchInteraction.connect(depositor1).claim(depositId);
  await contracts.hysiBatchInteraction.connect(depositor2).claim(depositId);
  await contracts.hysiBatchInteraction.connect(depositor3).claim(depositId);

  hysiBalance = await contracts.hysi.balanceOf(depositor.address);

  await contracts.hysi
    .connect(depositor)
    .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
  await contracts.hysi
    .connect(depositor1)
    .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
  await contracts.hysi
    .connect(depositor2)
    .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
  await contracts.hysi
    .connect(depositor3)
    .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
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
    [
      owner,
      depositor,
      depositor1,
      depositor2,
      depositor3,
    ] = await ethers.getSigners();
    contracts = await deployContracts();
    [depositor, depositor1, depositor2, depositor3].forEach(async (account) => {
      await contracts.faucet.sendThreeCrv(10000, account.address);
    });
  });
  describe("mint", function () {
    context("depositing", function () {
      it("deposits 3crv in the current mintBatch", async function () {
        await contracts.threeCrv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        expect(
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("10"))
        )
          .to.emit(contracts.hysiBatchInteraction, "Deposit")
          .withArgs(depositor.address, parseEther("10"));
        expect(
          await contracts.threeCrv.balanceOf(
            contracts.hysiBatchInteraction.address
          )
        ).to.equal(parseEther("10"));
        const currentMintBatchId = await contracts.hysiBatchInteraction.currentMintBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentMintBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("10"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("10"));
      });
      it("adds the mintBatch to the users batches", async function () {
        await contracts.threeCrv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("100"));

        const currentMintBatchId = await contracts.hysiBatchInteraction.currentMintBatchId();
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            0
          )
        ).to.equal(currentMintBatchId);
      });
      it("allows multiple deposits", async function () {
        await contracts.threeCrv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("100"));
        await contracts.threeCrv
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForMint(parseEther("100"));
        await contracts.threeCrv
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("50"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("50"));
        const currentMintBatchId = await contracts.hysiBatchInteraction.currentMintBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentMintBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(parseEther("300"));
        expect(currentBatch.unclaimedShares).to.equal(parseEther("300"));
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
        await contracts.threeCrv
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
          await contracts.hysiBatchInteraction.batchMint();
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
          const balance = await contracts.threeCrv.balanceOf(depositor.address);
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Mint, parseEther("100"))
          )
            .to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue")
            .withArgs(batchId, parseEther("100"), depositor.address);
          expect(
            await contracts.threeCrv.balanceOf(depositor.address)
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
          await contracts.hysiBatchInteraction.batchMint();
          expect(
            (await contracts.hysiBatchInteraction.batches(batchId))
              .claimableToken
          ).to.equal(parseEther("0.203265918367346937"));
        });
      });
    });
    context("batch minting", function () {
      context("reverts", function () {
        it("reverts when minting too early", async function () {
          await contracts.threeCrv
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("100"));
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchMint(0)
          ).to.be.revertedWith("can not execute batch action yet");
        });
      });
      context("success", function () {
        it("batch mints", async function () {
          this.timeout(45000);
          const batchId = await contracts.hysiBatchInteraction.currentMintBatchId();

          await contracts.threeCrv
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("100"));
          await provider.send("evm_increaseTime", [2500]);
          await provider.send("evm_mine", []);

          const minAmount = await getMinAmountOfHYSIToMint();

          const result = await contracts.hysiBatchInteraction
            .connect(depositor)
            .batchMint(minAmount);
          const tx = await result.wait(1);
          //console.log({
          //  gasUsed: formatEther(
          //    tx.cumulativeGasUsed.mul(parseUnits("50", "gwei"))
          //  ),
          //});
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchMinted")
            .withArgs(
              batchId,
              parseEther("100"),
              parseEther("0.406935062490403271")
            );
          expect(
            await contracts.hysi.balanceOf(
              contracts.hysiBatchInteraction.address
            )
          ).to.equal(parseEther("0.406935062490403271"));
        });
        it("mints early when mintThreshold is met", async function () {
          this.timeout(45000);
          await contracts.threeCrv
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("100"));
          await contracts.threeCrv
            .connect(depositor1)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor1)
            .depositForMint(parseEther("100"));
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchMint(0)
          ).to.emit(contracts.hysiBatchInteraction, "BatchMinted");
        });
        it("advances to the next batch", async function () {
          await contracts.threeCrv
            .connect(depositor)
            .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForMint(parseEther("100"));
          await provider.send("evm_increaseTime", [2500]);

          const previousMintBatchId = await contracts.hysiBatchInteraction.currentMintBatchId();
          await contracts.hysiBatchInteraction.batchMint(0);

          const previousBatch = await contracts.hysiBatchInteraction.batches(
            previousMintBatchId
          );
          expect(previousBatch.claimable).to.equal(true);

          const currentMintBatchId = await contracts.hysiBatchInteraction.currentMintBatchId();
          expect(currentMintBatchId).to.not.equal(previousMintBatchId);
        });
      });
    });
    context("claim batch", function () {
      beforeEach(async function () {
        await contracts.threeCrv
          .connect(depositor)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForMint(parseEther("100"));
        await contracts.threeCrv
          .connect(depositor1)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForMint(parseEther("100"));
        await contracts.threeCrv
          .connect(depositor2)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForMint(parseEther("100"));
        await contracts.threeCrv
          .connect(depositor3)
          .approve(contracts.hysiBatchInteraction.address, parseEther("100"));
        await contracts.hysiBatchInteraction
          .connect(depositor3)
          .depositForMint(parseEther("100"));
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
        await provider.send("evm_increaseTime", [2500]);

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
            parseEther("100"),
            parseEther("0.406935072800108017") // ~ 101.7 USD
          );
        expect(await contracts.hysi.balanceOf(depositor.address)).to.equal(
          parseEther("0.406935072800108017")
        );
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(parseEther("300"));
        expect(batch.claimableToken).to.equal(
          parseEther("1.220805218400324053")
        );
      });
    });
  });
  describe("redeem", function () {
    beforeEach(async function () {
      await distributeHysiToken();
    });
    context("depositing", function () {
      it("deposits setToken in the current redeemBatch", async function () {
        const result = await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);
        expect(result)
          .to.emit(contracts.hysiBatchInteraction, "Deposit")
          .withArgs(depositor.address, hysiBalance);
        expect(
          await contracts.hysi.balanceOf(contracts.hysiBatchInteraction.address)
        ).to.equal(hysiBalance);
        const currentRedeemBatchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentRedeemBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(hysiBalance);
        expect(currentBatch.unclaimedShares).to.equal(hysiBalance);
      });
      it("adds the redeemBatch to the users batches", async function () {
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);

        const currentRedeemBatchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            1
          )
        ).to.equal(currentRedeemBatchId);
      });
      it("allows multiple deposits", async function () {
        this.timeout(25000);
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);
        await contracts.hysiBatchInteraction
          .connect(depositor1)
          .depositForRedeem(hysiBalance);
        await contracts.hysiBatchInteraction
          .connect(depositor2)
          .depositForRedeem(hysiBalance.div(2));
        await contracts.hysiBatchInteraction
          .connect(depositor3)
          .depositForRedeem(hysiBalance.div(2));
        const currentRedeemBatchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
        const currentBatch = await contracts.hysiBatchInteraction.batches(
          currentRedeemBatchId
        );
        expect(currentBatch.suppliedToken).to.equal(
          hysiBalance.mul(2).add(hysiBalance.div(2).mul(2)) // deposited 300 hysi
        );
        expect(currentBatch.unclaimedShares).to.equal(
          hysiBalance.mul(2).add(hysiBalance.div(2).mul(2))
        );
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            1
          )
        ).to.equal(currentRedeemBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor1.address,
            1
          )
        ).to.equal(currentRedeemBatchId);
        expect(
          await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor2.address,
            1
          )
        ).to.equal(currentRedeemBatchId);
      });
    });
    context("withdraw from queue", function () {
      beforeEach(async function () {
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);
      });
      context("revert", function () {
        it("reverts when the batch was already redeemed", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            1
          );
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchRedeem();
          await expect(
            contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, hysiBalance)
          ).to.be.revertedWith("already processed");
        });
      });
      context("sucess", function () {
        it("withdraws the deposit", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            1
          );
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, hysiBalance)
          )
            .to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue")
            .withArgs(batchId, hysiBalance, depositor.address);
          expect(await contracts.hysi.balanceOf(depositor.address)).to.equal(
            hysiBalance
          );
        });
        it("withdraws part of the deposit and continues to redeem the rest", async function () {
          const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
            depositor.address,
            1
          );
          expect(
            await contracts.hysiBatchInteraction
              .connect(depositor)
              .withdrawFromQueue(batchId, BatchType.Redeem, hysiBalance.div(2))
          ).to.emit(contracts.hysiBatchInteraction, "WithdrawnFromQueue");
          await provider.send("evm_increaseTime", [1800]);
          await provider.send("evm_mine", []);
          await contracts.hysiBatchInteraction.batchRedeem();
          expect(
            (await contracts.hysiBatchInteraction.batches(batchId))
              .claimableToken
          ).to.equal(parseEther("100.041281290634714725"));
        });
      });
    });

    context("batch redeeming", function () {
      context("reverts", function () {
        it("reverts when redeeming too early", async function () {
          this.timeout(25000);

          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(hysiBalance);

          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchRedeem(0)
          ).to.be.revertedWith("can not execute batch action yet");
        });
        it("reverts when amount of 3crv to receive is less than slippage tolerance", async function () {
          this.timeout(25000);

          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(hysiBalance);

          await provider.send("evm_increaseTime", [2500]);
          await provider.send("evm_mine", []);
          const minAmount = await getMinAmountOf3CrvToReceive(0.0001);
          await expect(
            contracts.hysiBatchInteraction.connect(owner).batchRedeem(minAmount)
          ).to.be.revertedWith("slippage too high");
        });
      });
      context("success", function () {
        it("batch redeems", async function () {
          const batchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(hysiBalance);
          await provider.send("evm_increaseTime", [2500]);
          await provider.send("evm_mine", []);

          // todo: why is slippage so high for this redemption ?
          const min3Crv = await getMinAmountOf3CrvToReceive(0.016);
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchRedeem(min3Crv);
          expect(result)
            .to.emit(contracts.hysiBatchInteraction, "BatchRedeemed")
            .withArgs(
              batchId,
              hysiBalance,
              parseEther("100.118378605853378433")
            );
          expect(
            await contracts.threeCrv.balanceOf(
              contracts.hysiBatchInteraction.address
            )
          ).to.equal(parseEther("100.118378605853378433"));
        });

        it("mints early when redeemThreshold is met", async function () {
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(hysiBalance);
          await contracts.hysiBatchInteraction
            .connect(depositor1)
            .depositForRedeem(hysiBalance);
          await contracts.hysiBatchInteraction
            .connect(depositor2)
            .depositForRedeem(hysiBalance);
          const result = await contracts.hysiBatchInteraction
            .connect(owner)
            .batchRedeem(0);
          expect(result).to.emit(
            contracts.hysiBatchInteraction,
            "BatchRedeemed"
          );
        });
        it("advances to the next batch", async function () {
          await contracts.hysiBatchInteraction
            .connect(depositor)
            .depositForRedeem(hysiBalance);
          await provider.send("evm_increaseTime", [2500]);
          await provider.send("evm_mine", []);
          const previousRedeemBatchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
          await contracts.hysiBatchInteraction.batchRedeem(0);

          const previousBatch = await contracts.hysiBatchInteraction.batches(
            previousRedeemBatchId
          );
          expect(previousBatch.claimable).to.equal(true);

          const currentRedeemBatchId = await contracts.hysiBatchInteraction.currentRedeemBatchId();
          expect(currentRedeemBatchId).to.not.equal(previousRedeemBatchId);
        });
      });
    });
    context("claim batch", function () {
      it("reverts when batch is not yet claimable", async function () {
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          1
        );
        await expect(
          contracts.hysiBatchInteraction.claim(batchId)
        ).to.be.revertedWith("not yet claimable");
      });
      it("claim batch successfully", async function () {
        await contracts.hysiBatchInteraction
          .connect(depositor)
          .depositForRedeem(hysiBalance);
        await provider.send("evm_increaseTime", [2500]);
        await provider.send("evm_mine", []);
        await contracts.hysiBatchInteraction.connect(owner).batchRedeem(0);
        const batchId = await contracts.hysiBatchInteraction.batchesOfAccount(
          depositor.address,
          1
        );
        expect(
          await contracts.hysiBatchInteraction.connect(depositor).claim(batchId)
        )
          .to.emit(contracts.hysiBatchInteraction, "Claimed")
          .withArgs(
            depositor.address,
            BatchType.Redeem,
            hysiBalance,
            parseEther("100.118372326437056824")
          );
        expect(await contracts.threeCrv.balanceOf(depositor.address)).to.equal(
          parseEther("17857389.010246373493870362")
        );
        const batch = await contracts.hysiBatchInteraction.batches(batchId);
        expect(batch.unclaimedShares).to.equal(0);
      });
    });
  });
});
