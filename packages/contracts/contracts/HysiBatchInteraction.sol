// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Owned.sol";
import "./Interfaces/Integrations/YearnVault.sol";
import "./Interfaces/Integrations/BasicIssuanceModule.sol";
import "./Interfaces/Integrations/ISetToken.sol";
import "./Interfaces/Integrations/CurveContracts.sol";

contract HysiBatchInteraction is Owned {
  using SafeMath for uint256;
  using SafeERC20 for YearnVault;
  using SafeERC20 for ISetToken;
  using SafeERC20 for IERC20;

  enum BatchType {
    Mint,
    Redeem
  }

  struct Underlying {
    IERC20 crvToken;
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

  IERC20 public threeCrv;
  BasicIssuanceModule public setBasicIssuanceModule;
  ISetToken public setToken;
  Underlying[] public underlying;

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
    IERC20 threeCrv_,
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

  function getQuantities() public view returns (uint256[] memory) {
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );
    return quantities;
  }

  function getYPrices() public view returns (uint256[] memory) {
    uint256[] memory yPrices = new uint256[](underlying.length);
    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      yPrices[i] = underlying[i].yToken.pricePerShare();
    }
    return yPrices;
  }

  function getCRVPrices() public view returns (uint256[] memory) {
    uint256[] memory crvPrices = new uint256[](underlying.length);
    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      crvPrices[i] = underlying[i].curveMetaPool.calc_withdraw_one_coin(
        1e18,
        1
      );
    }
    return crvPrices;
  }

  function getYInCRV() public view returns (uint256[] memory) {
    uint256[] memory yInCRV = new uint256[](underlying.length);
    //Check how many crvToken are needed to mint one yToken
    for (uint256 i; i < underlying.length; i++) {
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      yInCRV[i] = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);
    }
    return yInCRV;
  }

  function getQuantitiesIn3Crv() public view returns (uint256[] memory) {
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Amount of 3crv needed to mint the necessary quantity of yToken for hysi
    uint256[] memory quantitiesIn3Crv = new uint256[](quantities.length);

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calc how many 3crv are needed to mint the quantity in yToken
      uint256 quantityIn3Crv = yTokenIn3Crv.mul(quantities[i]).div(1e18);

      //Save allocation in 3crv for later
      quantitiesIn3Crv[i] = quantityIn3Crv;
    }
    return quantitiesIn3Crv;
  }

  function getHysiIn3Crv() public view returns (uint256) {
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Amount of 3crv needed to mint 1 hysi
    uint256 hysiIn3Crv;

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calc how many 3crv are needed to mint the quantity in yToken
      uint256 quantityIn3Crv = yTokenIn3Crv.mul(quantities[i]).div(1e18);

      //Calc total price of 1 HYSI in 3crv
      hysiIn3Crv = hysiIn3Crv.add(quantityIn3Crv);
    }

    //Calc max amount of Hysi mintable
    return hysiIn3Crv;
  }

  function getExpectedHysi(uint256 threeCrvAmount_)
    public
    view
    returns (uint256)
  {
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Amount of 3crv needed to mint 1 hysi
    uint256 hysiIn3Crv;

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calc how many 3crv are needed to mint the quantity in yToken
      uint256 quantityIn3Crv = yTokenIn3Crv.mul(quantities[i]).div(1e18);

      //Calc total price of 1 HYSI in 3crv
      hysiIn3Crv = hysiIn3Crv.add(quantityIn3Crv);
    }

    //Calc max amount of Hysi mintable
    return threeCrvAmount_.div(hysiIn3Crv.div(1e18));
  }

  function getPoolAllocations()
    public
    view
    returns (uint256[] memory, address[] memory)
  {
    Batch storage batch = batches[currentMintBatchId];

    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Amount of 3crv needed to mint 1 hysi
    uint256 hysiIn3Crv;

    uint256[] memory quantitiesIn3Crv = new uint256[](quantities.length);

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calc how many 3crv are needed to mint the quantity in yToken
      uint256 quantityIn3Crv = yTokenIn3Crv.mul(quantities[i]).div(1e18);

      //Calc total price of 1 HYSI in 3crv
      hysiIn3Crv = hysiIn3Crv.add(quantityIn3Crv);
      quantitiesIn3Crv[i] = quantityIn3Crv;
    }

    //Calc max amount of Hysi mintable
    uint256 hysiAmount = batch.suppliedToken.div(hysiIn3Crv.div(1e18));
    uint256[] memory returnValues = new uint256[](quantities.length);
    address[] memory metapools = new address[](quantities.length);
    for (uint256 i; i < underlying.length; i++) {
      returnValues[i] = quantitiesIn3Crv[i].mul(hysiAmount).div(1e18);
      metapools[i] = address(underlying[i].curveMetaPool);
    }
    return (returnValues, metapools);
  }

  function sendToCurve(uint256[] calldata amounts) external {
    for (uint256 i; i < underlying.length; i++) {
      _sendToCurve(amounts[i], underlying[i].curveMetaPool);
    }
  }

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

  function batchMint() external {
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
    //!!! its absolutely necessary that the order of underylingToken matches the order of getRequireedComponentUnitsforIssue
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Amount of 3crv needed to mint 1 hysi
    uint256 hysiIn3Crv;

    //Amount of 3crv needed to mint the necessary quantity of yToken for hysi
    uint256[] memory quantitiesIn3Crv = new uint256[](quantities.length);

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3crv are needed to mint one crvToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calc how many 3crv are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calc how many 3crv are needed to mint the quantity in yToken
      uint256 quantityIn3Crv = yTokenIn3Crv.mul(quantities[i]).div(1e18);

      //Calc total price of 1 HYSI in 3crv
      hysiIn3Crv = hysiIn3Crv.add(quantityIn3Crv);

      //Save allocation in 3crv for later
      quantitiesIn3Crv[i] = quantityIn3Crv;
    }

    //Calc max amount of Hysi mintable
    uint256 hysiAmount = batch.suppliedToken.div(hysiIn3Crv.div(1e18));

    for (uint256 i; i < underlying.length; i++) {
      uint256 poolAllocation = quantitiesIn3Crv[i].mul(hysiAmount).div(1e18);
      _sendToCurve(poolAllocation, underlying[i].curveMetaPool);
      // _sendToYearn(
      //   underlying[i].crvToken.balanceOf(address(this)),
      //   underlying[i].crvToken,
      //   underlying[i].yToken
      // );
      // underlying[i].yToken.safeIncreaseAllowance(
      //   address(setBasicIssuanceModule),
      //   underlying[i].yToken.balanceOf(address(this))
      // );
    }
    // uint256 oldBalance = setToken.balanceOf(address(this));
    // setBasicIssuanceModule.issue(setToken, hysiAmount, address(this));
    // batch.claimableToken = setToken.balanceOf(address(this)).sub(oldBalance);
    // batch.suppliedToken = 0;
    // batch.claimable = true;

    // lastMintedAt = block.timestamp;
    // currentMintBatchId = _generateNextBatchId(currentMintBatchId);

    emit BatchMinted(hysiAmount);
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
    for (uint256 i; i < underlying.length; i++) {
      _withdrawFromYearn(
        underlying[i].yToken.balanceOf(address(this)),
        underlying[i].yToken
      );
      _withdrawFromCurve(
        underlying[i].crvToken.balanceOf(address(this)),
        underlying[i].crvToken,
        underlying[i].curveMetaPool
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

  function _sendToCurve(uint256 amount_, CurveMetapool curveMetapool_)
    internal
    returns (uint256)
  {
    threeCrv.safeIncreaseAllowance(address(curveMetapool_), amount_);
    curveMetapool_.add_liquidity([0, amount_], 0);
  }

  function _withdrawFromCurve(
    uint256 amount_,
    IERC20 lpToken_,
    CurveMetapool curveMetapool_
  ) internal returns (uint256) {
    lpToken_.safeIncreaseAllowance(address(curveMetapool_), amount_);
    curveMetapool_.remove_liquidity_one_coin(amount_, 1, 0);
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

  /**
    @notice This function defines which underyling token and pools are needed to mint a hysi token
    @param underlying_ An array structs describing underlying yToken, crvToken and curve metapool
    @dev !!! Its absolutely necessary that the order of underylingToken matches the order of getRequireedComponentUnitsforIssue
    @dev since our calculations for minting just iterate through the index and match it with the quantities given by Set
    @dev we must make sure to align them correctly by index, otherwise our whole calculation breaks down
  */
  function setUnderylingToken(Underlying[] calldata underlying_)
    external
    onlyOwner
  {
    for (uint256 i; i < underlying_.length; i++) {
      underlying.push(underlying_[i]);
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
