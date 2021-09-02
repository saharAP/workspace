pragma solidity >=0.7.0 <0.8.0;

interface Curve3Pool {
  function add_liquidity(uint256[3] calldata amounts, uint256 min_mint_amounts)
    external;

  function remove_liquidity_one_coin(
    uint256 burn_amount,
    int128 i,
    uint256 min_amount
  ) external;
}