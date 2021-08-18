// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./MockERC20.sol";

contract MockYearnV1Vault is MockERC20 {
  using SafeMath for uint256;
  using SafeERC20 for MockERC20;

  MockERC20 public token;

  constructor(address token_) MockERC20("Mock crvUSDX yVault", "yvUSDX", 18) {
    token = MockERC20(token_);
  }

  function balance() public view returns (uint256) {
    return token.balanceOf(address(this));
  }

  function pricePerShare() public view returns (uint256) {
    if (totalSupply() == 0) {
      return 1e18;
    }
    return balance().mul(1e18).div(totalSupply());
  }

  function deposit(uint256 _amount) public {
    uint256 _pool = balance();
    uint256 _before = token.balanceOf(address(this));
    token.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 _after = token.balanceOf(address(this));
    _amount = _after.sub(_before); // Additional check for deflationary tokens
    uint256 shares = 0;
    if (totalSupply() == 0) {
      shares = _amount;
    } else {
      shares = (_amount.mul(totalSupply())).div(_pool);
    }
    _mint(msg.sender, shares);
  }

  function withdraw(uint256 _shares) public {
    uint256 r = (balance().mul(_shares)).div(totalSupply());
    _burn(msg.sender, _shares);
    token.safeTransfer(msg.sender, r);
  }

  // Test helpers

  function setPricePerFullShare(uint256 pricePerFullShare) external {
    token.burn(address(this), token.balanceOf(address(this)));
    uint256 balance = pricePerFullShare.mul(totalSupply()).div(1e18);
    token.mint(address(this), balance);
  }
}
