// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

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

contract Test is Ownable, ReentrancyGuard, Pausable, Defended {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  struct TestStruct {
    uint256 amount;
    address curveMetapool;
  }

  struct TestStruct2 {
    uint256 amount;
    CurveMetapool curveMetapool;
  }

  // CurveAddressProvider public curveAddressProvider;
  // CurveRegistry public curveRegistry;
  IERC20 public threeCrv;
  TestStruct[] public structs;
  TestStruct2[] public structs2;
  address public curveMetapoolAddress;
  CurveMetapool public curveMetapool;

  constructor(IERC20 threeCrv_, address curveMetapool_) {
    // curveAddressProvider = CurveAddressProvider(curveAddressProvider_);
    // curveRegistry = CurveRegistry(curveAddressProvider.get_registry());
    // curveMetapool = CurveMetapool(
    //   curveRegistry.get_pool_from_lp_token(address(crvLPToken_))
    // );
    curveMetapoolAddress = curveMetapool_;
    curveMetapool = CurveMetapool(curveMetapool_);
    threeCrv = threeCrv_;
  }

  function receive() external payable {}

  function addStructs(TestStruct[] calldata structs_) external {
    for (uint256 i; i < structs_.length; i++) {
      structs.push(structs_[i]);
    }
  }

  function addStructs2(TestStruct2[] calldata structs_) external {
    for (uint256 i; i < structs_.length; i++) {
      structs2.push(structs_[i]);
    }
  }

  function sendToCurveAddress(uint256 amount) external {
    threeCrv.approve(curveMetapoolAddress, amount);
    CurveMetapool(curveMetapoolAddress).add_liquidity([0, amount], 0);
  }

  function sendToCurveMetapool(uint256 amount) external {
    threeCrv.approve(address(curveMetapool), amount);
    curveMetapool.add_liquidity([0, amount], 0);
  }

  function sendToCurveMultiple() external {
    for (uint256 i; i < structs.length; i++) {
      _sendToCurve(structs[i].amount, structs[i].curveMetapool);
    }
  }

  function _sendToCurve(uint256 amount, address curveMetapool) internal {
    threeCrv.approve(curveMetapool, amount);
    CurveMetapool(curveMetapool).add_liquidity([0, amount], 0);
  }

  function sendToCurveMultiple2() external {
    for (uint256 i; i < structs2.length; i++) {
      _sendToCurve2(structs2[i].amount, structs2[i].curveMetapool);
    }
  }

  function _sendToCurve2(uint256 amount, CurveMetapool curveMetapool) internal {
    threeCrv.approve(address(curveMetapool), amount);
    curveMetapool.add_liquidity([0, amount], 0);
  }
}
