pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./CurveAddressProvider.sol";
import "./CurveRegistry.sol";
import "./CurveMetapool.sol";

interface ThreeCrv is IERC20 {}
interface CrvLPToken is IERC20 {}