// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./Interfaces/IHysiBatchInteraction.sol";
import "./Interfaces/Integrations/Curve3Pool.sol";

contract A {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public x;

  /* ========== CONSTRUCTOR ========== */

  constructor() {}

  /* ========== MUTATIVE FUNCTIONS ========== */

  function incrementX() external {
    x = x++;
  }
}

contract B {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public x;

  /* ========== CONSTRUCTOR ========== */

  constructor() {}

  /* ========== MUTATIVE FUNCTIONS ========== */

  function delegateIncrementX(address _contract) external {
    (bool success, bytes memory result) = _contract.delegatecall(
      abi.encodeWithSignature("incrementX()")
    );
    require(success, "no success");
  }
}

contract C {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  bytes32 public test;
  uint256 public y;

  /* ========== CONSTRUCTOR ========== */

  constructor() {}

  /* ========== MUTATIVE FUNCTIONS ========== */
  function delegateIncrementX(address _contract) external {
    (bool success, bytes memory result) = _contract.delegatecall(
      abi.encodeWithSignature("incrementX()")
    );
    require(success, "no success");
  }
}
