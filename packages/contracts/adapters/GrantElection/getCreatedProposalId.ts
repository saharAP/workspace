import { ethers } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";

export const getCreatedProposalId = async (
  txnHash: string | undefined,
  provider: JsonRpcProvider
): Promise<number> => {
  if (!txnHash) {
    throw new Error("Invalid transaction hash");
  }
  const abi = [
    "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, address indexed beneficiary, bytes applicationCid)",
  ];
  const iface = new ethers.utils.Interface(abi);

  const topic = ethers.utils.id(
    "ProposalCreated(uint256,address,address,bytes)"
  );
  const logs = (
    await provider.getLogs({
      fromBlock: "latest",
      toBlock: "latest",
      topics: [topic],
    })
  ).filter((log) => log.transactionHash === txnHash);

  const parsed = iface.parseLog(logs[logs.length - 1]);
  return parsed.args[0].toNumber();
};
export default getCreatedProposalId;
