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

  event ZappedIntoQueue(uint256 threeCurveAmount, address account);
  event ZappedOutOfQueue(
    bytes32 batchId,
    uint8 stableCoinIndex,
    uint256 threeCurveAmount,
    uint256 stableCoinAmount,
    address account
  );
  event ClaimedIntoStable(
    bytes32 batchId,
    uint8 stableCoinIndex,
    uint256 threeCurveAmount,
    uint256 stableCoinAmount,
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
    external
  {
    for (uint8 i; i < amounts_.length; i++) {
      if (amounts_[i] > 0) {
        stablecoins[i].safeTransferFrom(msg.sender, address(this), amounts_[0]);
        stablecoins[i].safeIncreaseAllowance(address(curve3Pool), amounts_[0]);
      }
    }
    curve3Pool.add_liquidity(amounts_, min_mint_amounts_);
    uint256 threeCrvAmount = threeCrv.balanceOf(address(this));
    threeCrv.safeIncreaseAllowance(
      address(hysiBatchInteraction),
      threeCrvAmount
    );
    hysiBatchInteraction.depositForMint(threeCrvAmount, msg.sender);
    emit ZappedIntoQueue(threeCrvAmount, msg.sender);
  }

  function zapOutOfQueue(
    bytes32 batchId_,
    uint256 amountToWithdraw_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) external {
    hysiBatchInteraction.withdrawFromBatch(
      batchId_,
      amountToWithdraw_,
      msg.sender
    );
    uint256 stableBalance = _swapAndTransfer3Crv(
      amountToWithdraw_,
      stableCoinIndex_,
      min_amount_
    );

    emit ZappedOutOfQueue(
      batchId_,
      stableCoinIndex_,
      amountToWithdraw_,
      stableBalance,
      msg.sender
    );
  }

  function claimAndSwapToStable(
    bytes32 batchId_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) external {
    uint256 threeCurveAmount = hysiBatchInteraction.claim(batchId_, msg.sender);
    uint256 stableBalance = _swapAndTransfer3Crv(
      threeCurveAmount,
      stableCoinIndex_,
      min_amount_
    );

    emit ClaimedIntoStable(
      batchId_,
      stableCoinIndex_,
      threeCurveAmount,
      stableBalance,
      msg.sender
    );
  }

  function _swapAndTransfer3Crv(
    uint256 threeCurveAmount_,
    uint8 stableCoinIndex_,
    uint256 min_amount_
  ) internal returns (uint256) {
    threeCrv.safeIncreaseAllowance(address(curve3Pool), threeCurveAmount_);
    curve3Pool.remove_liquidity_one_coin(
      threeCurveAmount_,
      stableCoinIndex_,
      min_amount_
    );
    uint256 stableBalance = stablecoins[stableCoinIndex_].balanceOf(
      address(this)
    );
    stablecoins[stableCoinIndex_].safeTransfer(msg.sender, stableBalance);
    return stableBalance;
  }
}
