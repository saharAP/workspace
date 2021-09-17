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
  IERC20 private threeCrv;
  IERC20[3] private stablecoins;

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

  event Echo(uint256 amount);

  /* ========== CONSTRUCTOR ========== */

  constructor(
    IHysiBatchInteraction hysiBatchInteraction_,
    Curve3Pool curve3Pool_,
    IERC20 threeCrv_,
    IERC20[3] memory stablecoins_
  ) {
    hysiBatchInteraction = hysiBatchInteraction_;
    curve3Pool = curve3Pool_;
    threeCrv = threeCrv_;
    stablecoins = stablecoins_;
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  function zapIntoQueue(uint256[3] memory amounts_, uint256 min_mint_amounts_)
    public
  {
    for (uint8 i; i < amounts_.length; i++) {
      if (amounts_[i] > 0) {
        stablecoins[i].safeTransferFrom(msg.sender, address(this), amounts_[0]);
        stablecoins[i].safeIncreaseAllowance(address(curve3Pool), amounts_[0]);
      }
    }
    uint256 threeCrvAmount = curve3Pool.add_liquidity(
      amounts_,
      min_mint_amounts_
    );
    threeCrv.safeIncreaseAllowance(
      address(hysiBatchInteraction),
      threeCrvAmount
    );
    hysiBatchInteraction.depositForMint(threeCrvAmount, msg.sender);
  }

  function zapOutOfQueue(
    bytes32 batchId_,
    uint256 amountToWithdraw_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) public {
    hysiBatchInteraction.withdrawFromBatch(
      batchId_,
      amountToWithdraw_,
      msg.sender
    );
    threeCrv.safeTransferFrom(msg.sender, address(this), amounts_[0]);
    curve3Pool.remove_liquidity_one_coin(
      amountToWithdraw_,
      stableCoinIndex_,
      min_amount_
    );
    uint256 stableBalance = stablecoins[stableCoinIndex_].balanceOf(
      address(this)
    );
    stablecoins[stableCoinIndex_].safeTransfer(stableBalance, msg.sender);
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
    //TODO check if batch will return threeCrv or hysi -> error if it returns hysi
    uint256 triCurveAmount = hysiBatchInteraction.claim(batchId_);
    curve3Pool.remove_liquidity_one_coin(
      triCurveAmount,
      stableCoinIndex_,
      min_amount_
    );
    uint256 stableBalance = stablecoins[stableCoinIndex_].balanceOf(
      address(this)
    );
    stablecoins[stableCoinIndex_].safeTransfer(stableBalance, msg.sender);
    emit ClaimedIntoStable(
      triCurveAmount,
      batchId_,
      stableCoinIndex_,
      msg.sender
    );
  }
}
