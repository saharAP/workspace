# HYSI Batch Interaction

## Intro
The contract in question is ./contracts/HysiBatchInteraction.sol.

It inherits ./contracts/KeeperIncentives.sol which handles keeper permissions and their payouts. 

Additionally ./contracts/HysiBatchZapper.sol allows user to interact with stablecoins directly without needing to use 3CRV. Some of the functions in HysiBatchInteraction were build with this contract in mind. Therefore it needs to be audited aswell and be taken into consideration when looking at certain functions in the main contract.

In order to run tests copy .env.example into .env in the root folder.
In .env set FORKING_RPC_URL to your rpc-url (We used alchemy since we encountered some issues with Infura) and FORKING_BLOCK_NUMBER to 12780680. Afterwards run ```yarn``` in root to install all dependencies.

The tests are ./test/HysiBatchInteraction.test.ts and ./test/fork/BatchHysi.test.ts

Run the tests for the main contract with ```yarn hardhat test ./test/HysiBatchInteraction.test.ts``` and ```yarn hardhat test ./test/fork/HysiBatchInteraction.test.ts```

HysiBatchZapper can be tested with ```yarn hardhat test ./test/HysiBatchZapper.test.ts``` and ```yarn hardhat test ./test/fork/HysiBatchZapper.test.ts```

Run the KeeperIncentive test with ```yarn hardhat test ./test/HysiBatchInteraction.test.ts```.

## Business Logic
HysiBatchInteraction was created to allow users to pool ressources and save on gas when minting or redeeming HYSI directly with stablecoins.

HYSI (0x8d1621a27bb8c84e59ca339cf9b21e15b907e408) is a SetToken which tracks high yield stablecoins. In consists of an equal mix of 4 different yStablecoins. Those are currently yDUSD, yFRAX, yUSDN and yUST. In order to mint HYSI one has to deposit sufficient amounts of these 4 token.

In order to get HYSI one has to deposit stablecoins or 3CRV into 4 seperate curve metapools to receive their LP-token. These LP-token need to be deposited into their respective yearn vaults to get the yToken needed to mint HYSI. Last but not least we mint HYSI with these yToken.

When redeeming HYSI we do this whole process in reverse to get 3CRV at the end of the process.

We create batches for depositors to pool their funds and pay permissioned keeper to process these batches periodically in order to mint or redeem HYSI. After they have been processed depositors can redeem their shares to either claim HYSI from a mint-batch or 3CRV from a redeem-batch.

Currently users can deposit either 3CRV to mint HYSI or HYSI to redeem for 3CRV. Later we will deploy a second contract to zap with stablecoins into the tri-pool and deposit 3CRV. This is not part of this audit though.

The important functions of this contract are:
-  batchMint() to mint HYSI with a batch of 3CRV
-  batchRedeem() to redeem a batch of HYSI and receive 3CRV
-  withdrawFromBatch() to withdraw funds from a batch before it has been processed
-  moveUnclaimedDepositsIntoCurrentBatch() which takes the unclaimed funds in processed batches of a user and moves them into the current batch to reverse this process

### BatchMint()
A permissioned keeper mints HYSI with depositeed 3CRV. 

1. The keeper defines via an offchain oracle an acceptable lowest amount of HYSI which should be minted with the available funds. 
2. Since we might have some leftover yToken from previous batches we calculate their value in 3CRV and add it to the available 3CRV from this batch. 
3. We than calculate a how many 3CRV we need to deposit into each metapool. 
4. Deposit allocated 3CRV for LP-Token in curve metapools.
5. Deposit LP-Token into yearn vaults.
6. Calculate the highest possible amount of HYSI we can mint with the lowest common denominator of available yToken.
7. Check if this amount is acceptable or if the slippage is too high.
8. Mint HYSI and set the minted amount to be claimed.
9. Set the Batch to claimable, update the last mint timestamp and create a new mint batch.

### BatchRedeem()
A permissioned keeper redeems deposited HYSI for 3CRV. 

1. The keeper defines via an offchain oracle an acceptable lowest amount of 3CRV which should be received after redeeming with the available funds. 
2. Redeem HYSI for yToken.
3. Burn yToken for curve LP-Token.
4. Burn LP-Token to receive 3CRV.
5. Check if this 3CRV amount is acceptable or if the slippage is too high.
6. Set the Batch to claimable, update the last redeem timestamp and create a new redeem batch

### WithdrawFromBatch()
A user withdraws their funds from a batch before it gets processed.

1. The user defines the batch they want to withdraw from and how many shares they want to withdraw.
2. Calculate and update the new share balance, supplied token and unclaimed shares.
3. Withdraw either 3CRV or HYSI depending on the batchType.

### MoveUnclaimedDepositsIntoCurrentBatch()
It is possible that a user has minted HYSI in the past and not claimed it yet. In the scenario that they want to redeem this HYSI again we allow them to do so without needing to claim it first (and pay additional gas). This function moves unclaimed HYSI or 3CRV and moves into the current mint/redeem batch.

1. The user defines from which type of batches the want to withdraw from, an array of batches and the amount of shares they want to withdraw.
2. Loop through each of the batches.
   1. Check if they have sufficient shares in the batch.
   2. Check if the batch is of the correct type.
   3. Check if the batch has been processed and is now claimable.
   4. Calculate how many token can be withdrawn
   5. Update claimableToken, unclaimedShares and shareBalance of the user
   6. Add the amount of token to the total amount of token that will be used
3. Deposit the total amounts of token into either a new mint or redeem batch.


### KeeperIncentive
The inherited contract KeeperIncentive is taking care of permissions for keeper and paying incentives to keeper when they call BatchMint or BatchRedeem. It does not add any core business logic to the main contract. 

If BatchMint or BatchRedeem get called by someone other than the keeper it reverts the function call. 

When the keeperIncentive is enabled and the contract has a sufficient POP balance it will pay the keeper for calling the batchMint or BatchRedeem function. If this is not the case the function will still be executed but no rewards will be payed.


## HysiBatchZapper
The HysiBatchInteraction contract only works with 3CRV. But since most user will only have stablecoins and will also probably only want stablescoins the HysiBatchZapper allows to deposit or receive stablecoins directly and takes care of swapping it into 3CRV.

In order to faciliate the deposit and withdrawl for other accounts all relevant functions for the Zapper have an address parameter to define for whom zapper deposits/withdraws/claims.

If this address is not the same as msg.sender HysiBatchInteraction checks if zapper calls the function, otherwise it reverts.
Therefore only zapper can deposit,withdraw or claim for other accounts. The address of zapper can only be set once by the owner (after deployment) but cant be changed afterwards. This allows user to verify the zapper contract themselves.

HysiBatchZapper has three functions which interact with HysiBatchInteraction.
These are:

### zapIntoBatch()
A user might have a combination of DAI, USDC and USDT but no 3CRV to deposit into the next mint batch for HYSI.
Using ZapIntoBatch they can provide their stablecoins for 3CRV and deposit these for minting in one transaction.

1. The user defines which amounts of stablecoins they want to use and which slippage for 3CRV is acceptable.
2. HysiBatchZapper transfers the stables and approves the curve three-pool to use them
3. They get deposited for 3CRV with the user defined slippage.
4. All received 3CRV get deposited for the user in the mintBatch.

### zapOutOfBatch()
ZapOutOfBatch allows to withdraw 3CRV from a batch (before it gets used for minting), swap them for a stablecoin and send these to the user.

1. The user defines from which batch they want to withdraw from how many 3CRV they want to withdraw, which stablecoin they want to receive and slippage for curve.
2. HysiBatchZapper withdraws 3CRV from the batch.
3. They get burned in the curve three-pool for the defined stablecoin with the user defined slippage.
4. All received stablecoins are send to the user.

### claimAndSwapToStable()
This function allows a user to claim their 3CRV from a redeemed batch and swap them into a stablecoin of their choice.

1. The user defines which batch they want to claim, which stablecoin they want to receive and slippage for curve.
2. HysiBatchZapper claims 3CRV from the batch.
3. They get burned in the curve three-pool for the defined stablecoin with the user defined slippage.
4. All received stablecoins are send to the user.