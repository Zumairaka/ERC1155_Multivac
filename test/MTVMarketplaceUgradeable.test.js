const { expect } = require('chai')
const { ethers, upgrades } = require('hardhat')

let admin,
	add1,
	MNFTMarketplace,
	mnftMarketplace,
	MNFTMarketplaceV2,
	mnftMarketplaceV2,
	MNFT,
	mnft1

describe('MultivacNFT marketplace upgradeable contract', () => {
	// usdt ropsten address
	const usdt = ethers.utils.getAddress(
		'0x6ee856ae55b6e1a249f04cd3b947141bc146273c'
	)

	beforeEach(async () => {
		;[admin, add1] = await ethers.getSigners()

		MNFT = await ethers.getContractFactory('NFTMtv')
		mnft1 = await upgrades.deployProxy(MNFT, {
			initializer: 'initialize',
		})
		MNFTMarketplace = await ethers.getContractFactory('MNFTMarketplace')
		mnftMarketplace = await upgrades.deployProxy(MNFTMarketplace, [usdt], {
			initializer: 'initialize',
		})
		await mnftMarketplace.deployed()

		// whitelist some contracts
		await mnftMarketplace
			.connect(admin)
			.whitelistNFTContracts([mnft1.address])
	})

	describe('MNFTMarketplace Upgradable', () => {
		it('will verify the previous data after upgrading', async () => {
			await mnft1.connect(add1).mint('10', '500', 'ipfs://')
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(
					1,
					mnft1.address,
					10,
					ethers.utils.parseEther('1'),
					0,
					{
						value: ethers.utils.parseEther('100.0'),
					}
				)
			const itemDataV1 = await mnftMarketplace.marketItems(1)

			MNFTMarketplaceV2 = await ethers.getContractFactory(
				'MNFTMarketplaceV2'
			)
			mnftMarketplaceV2 = await upgrades.upgradeProxy(
				mnftMarketplace.address,
				MNFTMarketplaceV2
			)
			const itemDataV2 = await mnftMarketplaceV2.marketItems(1)

			expect(itemDataV1).to.be.deep.equal(itemDataV2)
		})
	})
})
