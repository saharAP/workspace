// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Defended.sol";
import "./Interfaces/Integrations/YearnVault.sol";
import "./Interfaces/Integrations/CurveContracts.sol";
import "./ITest.sol";

contract Test2 is Ownable, ReentrancyGuard, Pausable, Defended {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  CurveMetapool public curveMetapool;
  IERC20 public threeCrv;
  ITest public test;

  constructor(
    CurveMetapool curveMetapool_,
    IERC20 threeCrv_,
    ITest test_
  ) {
    curveMetapool = curveMetapool_;
    threeCrv = threeCrv_;
    test = test_;
  }

  function tester() external view returns (uint256) {
    return test.testNumber();
  }

  function totalSupply() external view returns (uint256) {
    return threeCrv.totalSupply();
  }

  function take3Crv(uint256 amount) external {
    threeCrv.safeTransferFrom(msg.sender, address(this), amount);
  }

  function sendToCurve(uint256 amount) external {
    threeCrv.transferFrom(msg.sender, address(this), amount);
    _sendToCurve(amount);
  }

  function _sendToCurve(uint256 amount) internal returns (uint256) {
    threeCrv.approve(address(curveMetapool), amount);
    uint256[2] memory curveDepositAmounts = [
      uint256(0), // USDX
      amount // 3Crv
    ];
    return curveMetapool.add_liquidity(curveDepositAmounts, uint256(0));
  }
}
