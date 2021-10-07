async function main() {
  // We get the contract to deploy
  const [deployer] = await ethers.getSigners();
  console.log("Deployer", deployer.address);

  const BeneficiaryRegistry = await ethers.getContractFactory("BeneficiaryRegistry");
  const beneficiaryRegistry = await BeneficiaryRegistry.deploy();
  await beneficiaryRegistry.deployed();

  const GrantRegistry = await ethers.getContractFactory("GrantRegistry");
  const grantRegistry = await GrantRegistry.deploy(beneficiaryRegistry.address);
  await grantRegistry.deployed();

  console.log("BeneficiaryRegistry deployed to:", beneficiaryRegistry.address);
  console.log("GrantRegistry deployed to:", grantRegistry.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
``;
