// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./lib/Owned.sol";
import "./Interfaces/Integrations/YearnVault.sol";
import "./Interfaces/Integrations/CurveContracts.sol";
import "./Interfaces/Integrations/BasicIssuanceModule.sol";
import "./Interfaces/Integrations/ISetToken.sol";

contract BatchSetInteraction is Owned {
  using SafeMath for uint256;
  using SafeERC20 for ThreeCrv;
  using SafeERC20 for CrvLPToken;
  using SafeERC20 for YearnVault;
  using SafeERC20 for ISetToken;
  using SafeERC20 for IERC20;

  enum BatchType {
    Mint,
    Redeem
  }

  struct UnderlyingToken {
    IERC20 crvToken;
    uint256 allocation;
    YearnVault yToken;
    CurveMetapool curveMetaPool;
  }

  struct Batch {
    uint256 unclaimedShares;
    uint256 suppliedToken;
    uint256 claimableToken;
    mapping(address => uint256) shareBalance;
    bool claimable;
  }

  /* ========== STATE VARIABLES ========== */

  ThreeCrv public threeCrv;
  BasicIssuanceModule public setBasicIssuanceModule;
  ISetToken public setToken;
  UnderlyingToken[] public underlyingToken;

  mapping(address => bytes32[]) public batchesOfAccount;
  mapping(bytes32 => Batch) public batches;

  uint256 public lastMintedAt;
  uint256 public lastRedeemedAt;
  bytes32 public currentMintBatchId;
  bytes32 public currentRedeemBatchId;
  uint256 public batchCooldown;
  uint256 public mintThreshold;
  uint256 public redeemThreshold;

  /* ========== EVENTS ========== */

  event Deposit(address indexed from, uint256 deposit);
  event Withdrawal(address indexed to, uint256 amount);
  event BatchMinted(uint256 amount);
  event BatchRedeemed(uint256 amount);
  event Claimed(address account, uint256 amount);
  event TokenSetAdded(ISetToken setToken);

  /* ========== CONSTRUCTOR ========== */

  constructor(
    ThreeCrv threeCrv_,
    ISetToken setToken_,
    BasicIssuanceModule basicIssuanceModule_,
    uint256 batchCooldown_,
    uint256 mintThreshold_,
    uint256 redeemThreshold_
  ) Owned(msg.sender) {
    require(address(threeCrv_) != address(0));
    require(address(setToken_) != address(0));
    require(address(basicIssuanceModule_) != address(0));
    threeCrv = threeCrv_;
    setToken = setToken_;
    setBasicIssuanceModule = basicIssuanceModule_;
    batchCooldown = batchCooldown_;
    currentMintBatchId = _generateNextBatchId(bytes32(0));
    currentRedeemBatchId = _generateNextBatchId(bytes32(0));
    mintThreshold = mintThreshold_;
    redeemThreshold = redeemThreshold_;
    lastMintedAt = block.timestamp;
    lastRedeemedAt = block.timestamp;
  }

  /* ========== VIEWS ========== */

  /* ========== MUTATIVE FUNCTIONS ========== */

  /**
   * @notice deposits funds for batch set minting
   * @param  amount_ amount of 3crv to use for minting
   */
  function depositForMint(uint256 amount_) external {
    require(threeCrv.balanceOf(msg.sender) > 0, "insufficent balance");
    threeCrv.transferFrom(msg.sender, address(this), amount_);
    _deposit(amount_, currentMintBatchId);
  }

  /**
   * @notice deposits funds for batch reedeming of a set
   * @param  amount_ amount of setToken to be redeemed
   */
  function depositForRedeem(uint256 amount_) external {
    require(setToken.balanceOf(msg.sender) > 0, "insufficient balance");
    setToken.transferFrom(msg.sender, address(this), amount_);
    _deposit(amount_, currentRedeemBatchId);
  }

  /**
   * @notice claims funds from batch
   * @param  batchId_ id of batch to claim from
   */
  function claim(bytes32 batchId_, BatchType batchType_) external {
    Batch storage batch = batches[batchId_];
    require(batch.claimable, "not yet claimable");
    uint256 shares = batch.shareBalance[msg.sender];
    require(shares <= batch.unclaimedShares, "claiming too many shares");

    uint256 claimedToken = batch.claimableToken.mul(shares).div(
      batch.unclaimedShares
    );
    batch.claimableToken = batch.claimableToken.sub(claimedToken);
    batch.unclaimedShares = batch.unclaimedShares.sub(shares);
    batch.shareBalance[msg.sender] = 0;

    if (batchType_ == BatchType.Mint) {
      setToken.safeIncreaseAllowance(address(this), claimedToken);
      setToken.safeTransferFrom(address(this), msg.sender, claimedToken);
    } else {
      threeCrv.safeIncreaseAllowance(address(this), claimedToken);
      threeCrv.safeTransferFrom(address(this), msg.sender, claimedToken);
    }

    emit Claimed(msg.sender, shares);
  }

  function batchMint(uint256 amount_) external {
    Batch storage batch = batches[currentMintBatchId];
    require(
      (block.timestamp.sub(lastMintedAt) >= batchCooldown) ||
        (batch.suppliedToken >= mintThreshold),
      "can not execute batch action yet"
    );
    require(batch.claimable == false, "already minted");
    require(
      threeCrv.balanceOf(address(this)) >= batch.suppliedToken,
      "insufficient balance"
    );

    for (uint256 i; i < underlyingToken.length; i++) {
      uint256 allocation = batch
      .suppliedToken
      .mul(underlyingToken[i].allocation)
      .div(100e18);
      uint256 crvLPTokenAmount = _sendToCurve(
        allocation,
        underlyingToken[i].curveMetaPool
      );
      _sendToYearn(
        underlyingToken[i].crvToken.balanceOf(address(this)),
        underlyingToken[i].crvToken,
        underlyingToken[i].yToken
      );
      underlyingToken[i].yToken.safeIncreaseAllowance(
        address(setBasicIssuanceModule),
        underlyingToken[i].yToken.balanceOf(address(this))
      );
    }
    uint256 oldBalance = setToken.balanceOf(address(this));
    setBasicIssuanceModule.issue(setToken, amount_, address(this));
    batch.claimableToken = setToken.balanceOf(address(this)).sub(oldBalance);
    batch.suppliedToken = 0;
    batch.claimable = true;

    lastMintedAt = block.timestamp;
    currentMintBatchId = _generateNextBatchId(currentMintBatchId);

    emit BatchMinted(amount_);
  }

  function batchRedeem() external {
    Batch storage batch = batches[currentRedeemBatchId];
    require(
      (block.timestamp.sub(lastMintedAt) >= batchCooldown) ||
        (batch.suppliedToken >= redeemThreshold),
      "can not execute batch action yet"
    );
    require(batch.claimable == false, "already minted");
    require(
      setToken.balanceOf(address(this)) >= batch.suppliedToken,
      "insufficient balance"
    );

    setToken.safeIncreaseAllowance(
      address(setBasicIssuanceModule),
      batch.suppliedToken
    );

    setBasicIssuanceModule.redeem(setToken, batch.suppliedToken, address(this));

    uint256 oldBalance = threeCrv.balanceOf(address(this));
    for (uint256 i; i < underlyingToken.length; i++) {
      _withdrawFromYearn(
        underlyingToken[i].yToken.balanceOf(address(this)),
        underlyingToken[i].yToken
      );
      _withdrawFromCurve(
        underlyingToken[i].crvToken.balanceOf(address(this)),
        underlyingToken[i].crvToken,
        underlyingToken[i].curveMetaPool
      );
    }

    emit BatchRedeemed(batch.suppliedToken);

    batch.claimableToken = threeCrv.balanceOf(address(this)).sub(oldBalance);
    batch.suppliedToken = 0;
    batch.claimable = true;

    lastRedeemedAt = block.timestamp;
    currentRedeemBatchId = _generateNextBatchId(currentRedeemBatchId);
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  function _deposit(uint256 amount_, bytes32 currentBatchId) internal {
    Batch storage batch = batches[currentBatchId];
    batch.suppliedToken = batch.suppliedToken.add(amount_);
    batch.unclaimedShares = batch.unclaimedShares.add(amount_);
    batch.shareBalance[msg.sender] = batch.shareBalance[msg.sender].add(
      amount_
    );
    batchesOfAccount[msg.sender].push(currentBatchId);
    emit Deposit(msg.sender, amount_);
  }

  function _claim(
    uint256 shares_,
    uint256 unclaimedShares_,
    uint256 batchBalance_,
    IERC20 token_
  ) internal returns (uint256) {
    uint256 claimableToken = batchBalance_.mul(shares_).div(unclaimedShares_);
    token_.safeIncreaseAllowance(address(this), claimableToken);
    token_.safeTransferFrom(address(this), msg.sender, claimableToken);
    return claimableToken;
  }

  function _sendToCurve(uint256 amount_, CurveMetapool curveMetapool_)
    internal
    returns (uint256)
  {
    threeCrv.safeIncreaseAllowance(address(curveMetapool_), amount_);
    uint256[2] memory curveDepositAmounts = [
      0, // USDX
      amount_ // 3Crv
    ];
    return curveMetapool_.add_liquidity(curveDepositAmounts, 0);
  }

  function _withdrawFromCurve(
    uint256 amount_,
    IERC20 lpToken_,
    CurveMetapool curveMetapool_
  ) internal returns (uint256) {
    lpToken_.safeIncreaseAllowance(address(curveMetapool_), amount_);
    return curveMetapool_.remove_liquidity_one_coin(amount_, 1, 0);
  }

  function _sendToYearn(
    uint256 amount_,
    IERC20 yToken_,
    YearnVault yearnVault_
  ) internal {
    yToken_.safeIncreaseAllowance(address(yearnVault_), amount_);
    yearnVault_.deposit(amount_);
  }

  function _withdrawFromYearn(uint256 amount_, YearnVault yearnVault_)
    internal
  {
    yearnVault_.safeIncreaseAllowance(address(yearnVault_), amount_);
    yearnVault_.withdraw(amount_);
  }

  function _generateNextBatchId(bytes32 currentBatchId_)
    internal
    returns (bytes32)
  {
    return keccak256(abi.encodePacked(block.timestamp, currentBatchId_));
  }

  /* ========== SETTER ========== */

  function setUnderylingToken(UnderlyingToken[] calldata underlyingToken_)
    external
    onlyOwner
  {
    for (uint256 i; i < underlyingToken_.length; i++) {
      underlyingToken.push(underlyingToken_[i]);
    }
  }

  function setBatchCooldown(uint256 cooldown_) external onlyOwner {
    batchCooldown = cooldown_;
  }

  function setMintThreshold(uint256 threshold_) external onlyOwner {
    mintThreshold = threshold_;
  }

  function setRedeemThreshold(uint256 threshold_) external onlyOwner {
    redeemThreshold = threshold_;
  }

  /* ========== MODIFIER ========== */
}
