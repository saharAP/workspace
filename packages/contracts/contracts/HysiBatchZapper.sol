// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./Interfaces/IHysiBatchInteraction.sol";
import "./Interfaces/Integrations/Curve3Pool.sol";

contract HysiBatchZapper {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  /* ========== STATE VARIABLES ========== */

  IHysiBatchInteraction private hysiBatchInteraction;
  Curve3Pool private curve3Pool;

  /* ========== EVENTS ========== */

  event ZappedIntoQueue(uint256 triCurveAmount, address account);
  event ZappedOutOfQueue(
    uint256 triCurveAmount,
    bytes32 batchId,
    uint8 stableCoinIndex,
    address account
  );
  event ClaimedIntoStable(
    uint256 triCurveAmount,
    bytes32 batchId,
    uint8 stableCoinIndex,
    address account
  );

  /* ========== CONSTRUCTOR ========== */

  constructor(
    IHysiBatchInteraction hysiBatchInteraction_,
    Curve3Pool curve3Pool_
  ) {
    hysiBatchInteraction = hysiBatchInteraction_;
    curve3Pool = curve3Pool_;
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  function zapIntoQueue(uint256[3] calldata amount_, uint256 min_mint_amounts_)
    public
  {
    uint256 triCurveAmount = curve3Pool.add_liquidity(
      amount_,
      min_mint_amounts_
    );
    hysiBatchInteraction.depositForMint(triCurveAmount);
    emit ZappedIntoQueue(triCurveAmount, msg.sender);
  }

  function zapOutOfQueue(
    bytes32 batchId_,
    uint256 amountToWithdraw_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) public {
    hysiBatchInteraction.withdrawFromBatch(batchId_, amountToWithdraw_);
    Curve3Pool.remove_liquidity_one_coin(
      amountToWithdraw_,
      stableCoinIndex_,
      min_amount_
    );
    emit ZappedOutOfQueue(
      amountToWithdraw_,
      batchId_,
      stableCoinIndex_,
      msg.sender
    );
  }

  function claimAndSwapToStable(
    bytes32 batchId_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) public {
    uint256 triCurveAmount = hysiBatchInteraction.claim(batchId_);
    Curve3Pool.remove_liquidity_one_coin(
      triCurveAmount,
      stableCoinIndex_,
      min_amount_
    );
    emit ClaimedIntoStable(
      triCurveAmount,
      batchId_,
      stableCoinIndex_,
      msg.sender
    );
  }
}
