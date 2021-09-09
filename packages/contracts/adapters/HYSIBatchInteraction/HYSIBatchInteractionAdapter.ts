import { BigNumber } from "@ethersproject/bignumber";
import { HysiBatchInteraction } from "../../typechain/HysiBatchInteraction";
export enum BatchType {
  Mint,
  Redeem,
}

export interface Batch {
  batchType: BatchType;
  batchId: string;
  claimable: boolean;
  unclaimedShares: BigNumber;
  suppliedTokenBalance: BigNumber;
  claimableTokenBalance: BigNumber;
  suppliedTokenAddress: string;
  claimableTokenAddress: string;
}

export class HysiBatchInteractionAdapter {
  constructor(private contract: HysiBatchInteraction) {}
  async getBatch(batchId: string): Promise<Batch> {
    const batch = await this.contract.batches(batchId);
    return {
      batchType: batch[0],
      batchId: batch[1],
      claimable: batch[2],
      unclaimedShares: batch[3],
      suppliedTokenBalance: batch[4],
      claimableTokenBalance: batch[5],
      suppliedTokenAddress: batch[6],
      claimableTokenAddress: batch[7],
    };
  }
}

export default HysiBatchInteractionAdapter;
