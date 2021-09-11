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
      batchType: batch.batchType,
      batchId: batch.batchId,
      claimable: batch.claimable,
      unclaimedShares: batch.unclaimedShares,
      suppliedTokenBalance: batch.suppliedTokenBalance,
      claimableTokenBalance: batch.claimableTokenBalance,
      suppliedTokenAddress: batch.suppliedTokenAddress,
      claimableTokenAddress: batch.claimableTokenAddress,
    };
  }
}

export default HysiBatchInteractionAdapter;
