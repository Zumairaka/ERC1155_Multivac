const { ethers, upgrades } = require('hardhat')

async function main() {
	const [deployer] = await ethers.getSigners()

	console.log(`Deploying MTVNFT with the account: ${deployer.address}`)

	console.log('Deploying MTVNFT...')

	const NFTMtv = await ethers.getContractFactory('NFTMtv')
	const NFTMTV = await upgrades.deployProxy(NFTMtv, {
		initializer: 'initialize',
	})
	await NFTMTV.deployed()
	console.log('NFTMtv deployed to:', NFTMTV.address)
}

main()
