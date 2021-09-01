// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "./lib/Owned.sol";
import "./Interfaces/Integrations/YearnVault.sol";
import "./Interfaces/Integrations/BasicIssuanceModule.sol";
import "./Interfaces/Integrations/ISetToken.sol";
import "./Interfaces/Integrations/CurveContracts.sol";

/*
This Contract allows smaller depositors to mint and redeem HYSI without needing to through all the steps necessary on their own...
...which not only takes long but mainly costs enormous amounts of gas.
The HYSI is created from 4 different yToken which in turn need each a deposit of a crvLPToken.
This means 12 approvals and 9 deposits are necessary to mint one HYSI.
We Batch this process and allow users to pool their funds. Than we pay keeper to Mint or Redeem HYSI regularly.
*/
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
    BatchType batchType;
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
  event MovedUnclaimedDepositsIntoCurrentBatch(
    uint256 amount,
    BatchType batchType,
    address account
  );

  /* ========== CONSTRUCTOR ========== */

  constructor(
    IERC20 threeCrv_,
    ISetToken setToken_,
    BasicIssuanceModule basicIssuanceModule_,
    Underlying[] memory underlying_,
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

    _setUnderlyingToken(underlying_);

    batchCooldown = batchCooldown_;
    currentMintBatchId = _generateNextBatchId(bytes32("mint"));
    currentRedeemBatchId = _generateNextBatchId(bytes32("redeem"));
    _setRedeemBatchType();
    mintThreshold = mintThreshold_;
    redeemThreshold = redeemThreshold_;

    lastMintedAt = block.timestamp;
    lastRedeemedAt = block.timestamp;
  }

  /* ========== VIEWS ========== */

  /**
   * @notice Get ids for all batches that a user has interacted with
   * @param account The address for whom we want to retrieve batches
   */
  function getBatchesOfAccount(address account)
    external
    view
    returns (bytes32[] memory)
  {
    return batchesOfAccount[account];
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  /**
   * @notice Deposits funds in the current mint batch
   * @param  amount_ Amount of 3cr3CRV to use for minting
   */
  function depositForMint(uint256 amount_) external {
    require(threeCrv.balanceOf(msg.sender) > 0, "insufficent balance");
    threeCrv.transferFrom(msg.sender, address(this), amount_);
    _deposit(amount_, currentMintBatchId);
  }

  /**
   * @notice deposits funds in the current redeem batch
   * @param  amount_ amount of HYSI to be redeemed
   */
  function depositForRedeem(uint256 amount_) external {
    require(setToken.balanceOf(msg.sender) > 0, "insufficient balance");
    setToken.transferFrom(msg.sender, address(this), amount_);
    _deposit(amount_, currentRedeemBatchId);
  }

  /**
   * @notice Claims funds after the batch has been processed (get HYSI from a mint batch and 3CRV from a redeem batch)
   * @param batchId_ Id of batch to claim from
   * @param batchType_ Type of the batch (Mint, Redeem)
   */
  function claim(bytes32 batchId_, BatchType batchType_) external {
    Batch storage batch = batches[batchId_];
    require(batch.claimable, "not yet claimable");

    uint256 shares = batch.shareBalance[msg.sender];
    require(shares <= batch.unclaimedShares, "claiming too many shares");

    //Calculate how many token will be claimed
    uint256 claimedToken = batch.claimableToken.mul(shares).div(
      batch.unclaimedShares
    );

    //Subtract the claimed token from the batch
    batch.claimableToken = batch.claimableToken.sub(claimedToken);
    batch.unclaimedShares = batch.unclaimedShares.sub(shares);
    batch.shareBalance[msg.sender] = 0;

    //Transfer token
    if (batchType_ == BatchType.Mint) {
      setToken.safeIncreaseAllowance(address(this), claimedToken);
      setToken.safeTransferFrom(address(this), msg.sender, claimedToken);
    } else {
      threeCrv.safeIncreaseAllowance(address(this), claimedToken);
      threeCrv.safeTransferFrom(address(this), msg.sender, claimedToken);
    }

    emit Claimed(msg.sender, shares);
  }

  /**
   * @notice Moves unclaimed token (3crv or Hysi) from their respective Batches into a new redeemBatch / mintBatch without needing to claim them first
   * @param batchIds the ids of each batch where hysi should be moved from
   * @param shares how many shares should redeemed in each of the batches
   * @param batchType the batchType where funds should be taken from (Mint -> Take Hysi and redeem then, Redeem -> Take 3Crv and Mint HYSI)
   * @dev input arrays must not be longer than 20 elements to prevent gas-overflow
   * @dev the indices of batchIds must match the amountsInHysi to work properly (This will be done by the frontend)
   * @dev we check the requirements for each batch only with an if and skip it instead of using require...
   * @dev ...to not revert a whole transaction for one faulty input while still preserving security
   */
  function moveUnclaimedDepositsIntoCurrentBatch(
    bytes32[] calldata batchIds,
    uint256[] calldata shares,
    BatchType batchType
  ) external {
    require(batchIds.length == shares.length, "array lengths must match");
    //Protect from gas overflow (20 is chosen arbitrarily)
    //TODO find the highest length possible without causing gas-overflow
    require(batchIds.length <= 20, "submit less batches");

    uint256 totalAmount;

    for (uint256 i; i < batchIds.length; i++) {
      Batch storage batch = batches[batchIds[i]];

      //Check that the user has enough funds and that the batch was already minted
      //Only the current redeemBatch is claimable == false so this check allows us to not adjust batch.suppliedToken
      //Additionally it makes no sense to move funds from the current redeemBatch to the current redeemBatch
      require(shares[i] <= batch.shareBalance[msg.sender], "not enough shares");
      require(batch.batchType == batchType, "inccorect batchType");
      require(batch.claimable == true, "has not yet been processed");

      uint256 claimedToken = batch.claimableToken.mul(shares[i]).div(
        batch.unclaimedShares
      );
      batch.claimableToken = batch.claimableToken.sub(claimedToken);
      batch.unclaimedShares = batch.unclaimedShares.sub(shares[i]);
      batch.shareBalance[msg.sender] = batch.shareBalance[msg.sender].sub(
        shares[i]
      );

      totalAmount = totalAmount.add(claimedToken);
    }
    require(totalAmount > 0, "totalAmount must be larger 0");

    bytes32 currentBatchId;
    if (batchType == BatchType.Mint) {
      currentBatchId = currentRedeemBatchId;
    } else {
      currentBatchId = currentMintBatchId;
    }

    _deposit(totalAmount, currentBatchId);

    emit MovedUnclaimedDepositsIntoCurrentBatch(
      totalAmount,
      batchType,
      msg.sender
    );
  }

  /**
   * @notice Mint HYSI token with deposited 3CRV. This function goes through all the steps necessary to mint an optimal amount of HYSI
   * @dev This function deposits 3CRV in the underlying Metapool and deposits these LP token to get yToken which in turn are used to mint HYSI
   * @dev This process leaves some leftovers which are partially used in the next mint batches.
   * @dev In order to get 3CRV we can implement a zap to move stables into the curve tri-pool
   */
  function batchMint() external {
    Batch storage batch = batches[currentMintBatchId];

    //Check if there was enough time between the last batch minting and this attempt...
    //...or if enough 3CRV was deposited to make the minting worthwhile
    //This is to prevent excessive gas consumption and costs as we will pay keeper to call this function
    require(
      (block.timestamp.sub(lastMintedAt) >= batchCooldown) ||
        (batch.suppliedToken >= mintThreshold),
      "can not execute batch action yet"
    );

    //Check if the Batch got already processed -- should technically not be possible
    require(batch.claimable == false, "already minted");

    //Check if this contract has enough 3CRV -- should technically not be necessary
    require(
      threeCrv.balanceOf(address(this)) >= batch.suppliedToken,
      "insufficient balance"
    );

    //Get the quantity of yToken for one HYSI
    (
      address[] memory tokenAddresses,
      uint256[] memory quantities
    ) = setBasicIssuanceModule.getRequiredComponentUnitsForIssue(
        setToken,
        1e18
      );

    //Total value of leftover yToken in 3CRV
    uint256 totalLeftoverIn3Crv;

    //Individual yToken leftovers valued in 3CRV
    uint256[] memory leftoversIn3Crv = new uint256[](quantities.length);

    for (uint256 i; i < underlying.length; i++) {
      //Check how many crvLPToken are needed to mint one yToken
      uint256 yTokenInCrvToken = underlying[i].yToken.pricePerShare();

      //Check how many 3CRV are needed to mint one crvLPToken
      uint256 crvTokenIn3Crv = underlying[i]
        .curveMetaPool
        .calc_withdraw_one_coin(1e18, 1);

      //Calculate how many 3CRV are needed to mint one yToken
      uint256 yTokenIn3Crv = yTokenInCrvToken.mul(crvTokenIn3Crv).div(1e18);

      //Calculate how much the yToken leftover are worth in 3CRV
      uint256 leftoverIn3Crv = underlying[i]
        .yToken
        .balanceOf(address(this))
        .mul(yTokenIn3Crv)
        .div(1e18);

      //Add the leftover value to the array of leftovers for later use
      leftoversIn3Crv[i] = leftoverIn3Crv;

      //Add the leftover value to the total leftover value
      totalLeftoverIn3Crv = totalLeftoverIn3Crv.add(leftoverIn3Crv);
    }

    //Calculate the total value of supplied token + leftovers in 3CRV
    uint256 suppliedTokenPlusLeftovers = batch.suppliedToken.add(
      totalLeftoverIn3Crv
    );

    for (uint256 i; i < underlying.length; i++) {
      //Calculate the pool allocation by dividing the suppliedToken by 4 and take leftovers into account
      uint256 poolAllocation = suppliedTokenPlusLeftovers.div(4).sub(
        leftoversIn3Crv[i]
      );

      //Pool 3CRV to get crvLPToken
      _sendToCurve(poolAllocation, underlying[i].curveMetaPool);

      //Deposit crvLPToken to get yToken
      _sendToYearn(
        underlying[i].crvToken.balanceOf(address(this)),
        underlying[i].crvToken,
        underlying[i].yToken
      );

      //Approve yToken for minting
      underlying[i].yToken.safeIncreaseAllowance(
        address(setBasicIssuanceModule),
        underlying[i].yToken.balanceOf(address(this))
      );
    }

    //Get the minimum amount of hysi that we can mint with our balances of yToken
    uint256 hysiAmount = underlying[0]
      .yToken
      .balanceOf(address(this))
      .mul(1e18)
      .div(quantities[0]);

    for (uint256 i = 1; i < underlying.length; i++) {
      hysiAmount = Math.min(
        hysiAmount,
        underlying[i].yToken.balanceOf(address(this)).mul(1e18).div(
          quantities[i]
        )
      );
    }

    //Check our balance of HYSI since we could have some still around from previous batches
    uint256 oldBalance = setToken.balanceOf(address(this));

    //Mint HYSI
    setBasicIssuanceModule.issue(setToken, hysiAmount, address(this));

    //Save the minted amount HYSI as claimable token for the batch
    batch.claimableToken = setToken.balanceOf(address(this)).sub(oldBalance);

    //Set suppliedToken to 0 so users cant withdraw any 3CRV
    batch.suppliedToken = 0;

    //Set claimable to true so users can claim their HYSI
    batch.claimable = true;

    //Update lastMintedAt for cooldown calculations
    lastMintedAt = block.timestamp;

    //Create the next mint batch id
    currentMintBatchId = _generateNextBatchId(currentMintBatchId);

    //Set the batchType of the next Batch
    Batch storage nextBatch = batches[currentMintBatchId];
    nextBatch.batchType = BatchType.Mint;

    //Should we display with how much money Hysi got minted or how many hysi got minted?
    //First is definitely easier to test but whats more valuable?
    emit BatchMinted(hysiAmount);
  }

  /**
   * @notice Redeems HYSI for 3CRV. This function goes through all the steps necessary to get 3CRV
   * @dev This function reedeems HYSI for the underlying yToken and deposits these yToken in curve Metapools for 3CRV
   * @dev In order to get stablecoins from 3CRV we can use a zap to redeem 3CRV for stables in the curve tri-pool
   */
  function batchRedeem() external {
    Batch storage batch = batches[currentRedeemBatchId];

    //Check if there was enough time between the last batch minting and this attempt...
    //...or if enough HYSI was deposited to make the minting worthwhile
    //This is to prevent excessive gas consumption and costs as we will pay keeper to call this function
    require(
      (block.timestamp.sub(lastMintedAt) >= batchCooldown) ||
        (batch.suppliedToken >= redeemThreshold),
      "can not execute batch action yet"
    );
    //Check if the Batch got already processed -- should technically not be possible
    require(batch.claimable == false, "already minted");

    //Check if this contract has enough HYSI -- should technically not be necessary
    require(
      setToken.balanceOf(address(this)) >= batch.suppliedToken,
      "insufficient balance"
    );

    //Allow setBasicIssuanceModule to use HYSI
    setToken.safeIncreaseAllowance(
      address(setBasicIssuanceModule),
      batch.suppliedToken
    );

    //Redeem HYSI for yToken
    setBasicIssuanceModule.redeem(setToken, batch.suppliedToken, address(this));

    //Check our balance of 3CRV since we could have some still around from previous batches
    uint256 oldBalance = threeCrv.balanceOf(address(this));

    for (uint256 i; i < underlying.length; i++) {
      //Deposit yToken to receive crvLPToken
      _withdrawFromYearn(
        underlying[i].yToken.balanceOf(address(this)),
        underlying[i].yToken
      );

      //Deposit crvLPToken to receive 3CRV
      _withdrawFromCurve(
        underlying[i].crvToken.balanceOf(address(this)),
        underlying[i].crvToken,
        underlying[i].curveMetaPool
      );
    }

    emit BatchRedeemed(batch.suppliedToken);

    //Save the redeemed amount of 3CRV as claimable token for the batch
    batch.claimableToken = threeCrv.balanceOf(address(this)).sub(oldBalance);

    //Set suppliedToken to 0 so users cant withdraw any HYSI
    batch.suppliedToken = 0;

    //Set claimable to true so users can claim their HYSI
    batch.claimable = true;

    //Update lastRedeemedAt for cooldown calculations
    lastRedeemedAt = block.timestamp;

    //Create the next redeem batch id
    currentRedeemBatchId = _generateNextBatchId(currentRedeemBatchId);

    //Set the batchType of the next Batch
    Batch storage nextBatch = batches[currentRedeemBatchId];
    nextBatch.batchType = BatchType.Redeem;
  }

  /* ========== RESTRICTED FUNCTIONS ========== */

  /**
   * @notice Deposit either HYSI or 3CRV in their respective batches
   * @param amount_ The amount of 3CRV or HYSI a user is depositing
   * @param currentBatchId The current reedem or mint batch id to place the funds in the next batch to be processed
   * @dev This function will be called by depositForMint or depositForRedeem and simply reduces code duplication
   */
  function _deposit(uint256 amount_, bytes32 currentBatchId) internal {
    Batch storage batch = batches[currentBatchId];

    //Add the new funds to the batch
    batch.suppliedToken = batch.suppliedToken.add(amount_);
    batch.unclaimedShares = batch.unclaimedShares.add(amount_);
    batch.shareBalance[msg.sender] = batch.shareBalance[msg.sender].add(
      amount_
    );

    //Save the batchId for the user so they can be retrieved to claim the batch
    batchesOfAccount[msg.sender].push(currentBatchId);

    emit Deposit(msg.sender, amount_);
  }

  /**
   * @notice Deposit 3CRV in a curve metapool for its LP-Token
   * @param amount_ The amount of 3CRV that gets deposited
   * @param curveMetapool_ The metapool where we want to provide liquidity
   */
  function _sendToCurve(uint256 amount_, CurveMetapool curveMetapool_)
    internal
    returns (uint256)
  {
    threeCrv.safeIncreaseAllowance(address(curveMetapool_), amount_);

    //Takes 3CRV and sends lpToken to this contract
    //Metapools take an array of amounts with the exoctic stablecoin at the first spot and 3CRV at the second.
    //The second variable determines the min amount of LP-Token we want to receive (slippage control)
    //TODO Calculate an acceptable value for slippage
    curveMetapool_.add_liquidity([0, amount_], 0);
  }

  /**
   * @notice Withdraws 3CRV for deposited crvLPToken
   * @param amount_ The amount of crvLPToken that get deposited
   * @param lpToken_ Which crvLPToken we deposit
   * @param curveMetapool_ The metapool where we want to provide liquidity
   */
  function _withdrawFromCurve(
    uint256 amount_,
    IERC20 lpToken_,
    CurveMetapool curveMetapool_
  ) internal returns (uint256) {
    lpToken_.safeIncreaseAllowance(address(curveMetapool_), amount_);

    //Takes lp Token and sends 3CRV to this contract
    //The second variable is the index for the token we want to receive (0 = exotic stablecoin, 1 = 3CRV)
    //The third variable determines min amount of token we want to receive (slippage control)
    //TODO Calculate an acceptable value for slippage
    curveMetapool_.remove_liquidity_one_coin(amount_, 1, 0);
  }

  /**
   * @notice Deposits crvLPToken for yToken
   * @param amount_ The amount of crvLPToken that get deposited
   * @param crvLPToken_ The crvLPToken which we deposit
   * @param yearnVault_ The yearn Vault in which we deposit
   */
  function _sendToYearn(
    uint256 amount_,
    IERC20 crvLPToken_,
    YearnVault yearnVault_
  ) internal {
    crvLPToken_.safeIncreaseAllowance(address(yearnVault_), amount_);

    //Mints yToken and sends them to msg.sender (this contract)
    yearnVault_.deposit(amount_);
  }

  /**
   * @notice Withdraw crvLPToken from yearn
   * @param amount_ The amount of crvLPToken which we deposit
   * @param yearnVault_ The yearn Vault in which we deposit
   */
  function _withdrawFromYearn(uint256 amount_, YearnVault yearnVault_)
    internal
  {
    yearnVault_.safeIncreaseAllowance(address(yearnVault_), amount_);

    //Takes yToken and sends crvLPToken to this contract
    yearnVault_.withdraw(amount_);
  }

  /**
   * @notice Generates the next batch id for new deposits
   * @param currentBatchId_ takes the current mint or redeem batch id
   */
  function _generateNextBatchId(bytes32 currentBatchId_)
    internal
    returns (bytes32)
  {
    return keccak256(abi.encodePacked(block.timestamp, currentBatchId_));
  }

  function _setRedeemBatchType() internal {
    Batch storage batch = batches[currentRedeemBatchId];
    batch.batchType = BatchType.Redeem;
  }

  /* ========== SETTER ========== */

  /**
   * @notice This function allows the owner to change the composition of underlying token of the HYSI
   * @param underlying_ An array structs describing underlying yToken, crvToken and curve metapool
   */
  function setUnderylingToken(Underlying[] calldata underlying_)
    public
    onlyOwner
  {
    _setUnderlyingToken(underlying_);
  }

  /**
    @notice This function defines which underlying token and pools are needed to mint a hysi token
    @param underlying_ An array structs describing underlying yToken, crvToken and curve metapool
    @dev !!! Its absolutely necessary that the order of underylingToken matches the order of getRequireedComponentUnitsforIssue
    @dev since our calculations for minting just iterate through the index and match it with the quantities given by Set
    @dev we must make sure to align them correctly by index, otherwise our whole calculation breaks down
  */
  function _setUnderlyingToken(Underlying[] memory underlying_) internal {
    for (uint256 i; i < underlying_.length; i++) {
      underlying.push(underlying_[i]);
    }
  }

  /**
   * @notice Changes the current batch cooldown
   * @param cooldown_ Cooldown in seconds
   * @dev The cooldown is the same for redeem and mint batches
   */
  function setBatchCooldown(uint256 cooldown_) external onlyOwner {
    batchCooldown = cooldown_;
  }

  /**
   * @notice Changes the Threshold of 3CRV which need to be deposited to be able to mint immediately
   * @param threshold_ Amount of 3CRV necessary to mint immediately
   */
  function setMintThreshold(uint256 threshold_) external onlyOwner {
    mintThreshold = threshold_;
  }

  /**
   * @notice Changes the Threshold of HYSI which need to be deposited to be able to redeem immediately
   * @param threshold_ Amount of HYSI necessary to mint immediately
   */
  function setRedeemThreshold(uint256 threshold_) external onlyOwner {
    redeemThreshold = threshold_;
  }

  /* ========== MODIFIER ========== */
}
