# HYSI Batch Interaction

## Intro
The contract in question is ./contracts/HysiBatchInteraction.sol

In order to run tests add FORKING_RPC_URL to the .env in root as well as set FORKING_BLOCK_NUMBER to 12780680.

The tests are ./test/HysiBatchInteraction.test.ts and ./test/fork/BatchHysi.test.ts

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
-  withdrawFromQueue() to withdraw funds from a batch before it has been processed
-  moveUnclaimedDepositsIntoCurrentBatch() which takes the unclaimed funds in processed batches of a user and moves them into the current batch to reverse this process

### BatchMint
A permissioned keeper mints HYSI with depositeed 3CRV. 

1. The keeper defines via an offchain oracle an acceptable lowest amount of HYSI which should be minted with the available funds. 
2. Since we might have some leftover yToken from previous batches we calculate their value in 3CRV and add it to the available 3CRV from this batch. 
3. We than calculate a how many 3CRV we need to deposit into each metapool. 
4. Deposit allocated 3CRV for LP-Token in curve metapools.
5. Deposit LP-Token into yearn vaults.
6. Calculate the lowest possible amount of HYSI we can mint with the available yToken.
7. Check if this amount is acceptable or if the slippage is too high.
8. Mint HYSI and set the minted amount to be claimed.
9. Set the Batch to claimable, update the last mint timestamp and create a new mint batch.

### BatchRedeem
A permissioned keeper redeems deposited HYSI for 3CRV. 

1. The keeper defines via an offchain oracle an acceptable lowest amount of 3CRV which should be received after redeeming with the available funds. 
2. Redeem HYSI for yToken.
3. Burn yToken for curve LP-Token.
4. Burn LP-Token to receive 3CRV.
5. Check if this 3CRV amount is acceptable or if the slippage is too high.
6. Set the Batch to claimable, update the last redeem timestamp and create a new redeem batch

### WithdrawFromQueue
A user withdraws their funds from a batch before it gets processed.

1. The user defines the batch they want to withdraw from and how many shares they want to withdraw.
2. Calculate and update the new share balance, supplied token and unclaimed shares.
3. Withdraw either 3CRV or HYSI depending on the batchType.

### MoveUnclaimedDepositsIntoCurrentBatch
A user has not yet claimed processed funds in older batches and wants to use them in a new batch without needing to manually claim all these funds.
(A user can either use 3CRV from previously redeemed HYSI to mint HYSI again or redeem previously minted HYSI for 3CRV)

1. The user defines from which type of batches the want to withdraw from, an array of batches and the amount of shares they want to withdraw.
2. Loop through each of the batches.
   1. Check if they have sufficient shares in the batch.
   2. Check if the batch is of the correct type.
   3. Check if the batch has been processed and is now claimable.
   4. Calculate how many token can be withdrawn
   5. Update claimableToken, unclaimedShares and shareBalance of the user
   6. Add the amount of token to the total amount of token that will be used
3. Deposit the total amounts of token into either a new mint or redeem batch.