// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;

interface IHysiBatchInteraction {
  function depositForMint(uint256 amount_) external {}

  function claim(bytes32 batchId_) external returns (uint256);

  function withdrawFromBatch(bytes32 batchId_, uint256 amountToWithdraw_)
    external;
}
