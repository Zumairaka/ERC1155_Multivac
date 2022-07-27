const { ethers, upgrades } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log(
		`Deploying MNFT marketplace upgradeable contract with the account: ${deployer.address}`
	)

	// 0xfd36c336eb67a092dc80a063ff0644e13142d454 ia the contract
	// address for usdt in multivac network

	const MNFTMarketplace = await ethers.getContractFactory('MNFTMarketplace')
	const mnftMarketplace = await upgrades.deployProxy(
		MNFTMarketplace,
		['0xfd36c336eb67a092dc80a063ff0644e13142d454'],
		{ initializer: 'initialize' }
	)

	await mnftMarketplace.deployed()
	console.log(
		`MNFT marketplace upgradeable contract deployed to the address: ${mnftMarketplace.address}`
	)
}

main()
	.then(() => {
		process.exit(0)
	})
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
