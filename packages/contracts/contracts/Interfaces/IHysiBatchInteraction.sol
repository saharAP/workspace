// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;

interface IHysiBatchInteraction {
  function depositForMint(uint256 amount_, address account_) external;

  function claim(bytes32 batchId_, address account_) external returns (uint256);

  function withdrawFromBatch(
    bytes32 batchId_,
    uint256 amountToWithdraw_,
    address account_
  ) external;
}
