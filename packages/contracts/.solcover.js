module.exports = {
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
  skipFiles: [
    "pool/AffiliateToken.sol",
    "test_helpers/Faucet.sol",
    "mocks/",
    "lib/",
    "interfaces/",
    "UniswapV2Router02.sol",
    "RandomNumberConsumer.sol",
  ],
};
