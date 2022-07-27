/* eslint-disable prettier/prettier */

const chai = require('chai')
const { expect } = chai
const { ethers, upgrades } = require('hardhat')
const { solidity } = require('ethereum-waffle')
chai.use(solidity)

let MTVNFTContract, MTVNFT, MTVNFTContractV2, MTVNFTV2
let owner, addr1

const ids = [1, 2, 3, 4]
const amounts = [1, 5, 10, 1]
const royalties = [5, 2, 6, 5]
const URIs = [
	'https://arweave.net/eR4wgSnWusIG-xF2BZzsiOwVehQsvfCT8VAUC4NHQ5Y',
	'https://arweave.net/NOvV7akJDBFZogZOKxDMwIhOauiDNhVqnIfUqJmmPR8',
	'https://arweave.net/q6RS0m0cdoieJbbXI4H1A4yJcDeFi97YF3fHVhn-h9M',
	'https://arweave.net/NOvV7akJDBFZogZOKxDMwIhOauiDNhVqnIfUqJmmPR9',
]

describe('MTV NFT', function () {
	beforeEach(async function () {
		;[owner, addr1] = await ethers.getSigners()

		MTVNFT = await ethers.getContractFactory('NFTMtv')
		MTVNFTContract = await upgrades.deployProxy(MTVNFT, {
			initializer: 'initialize',
		})
		await MTVNFTContract.deployed()
	})

	describe('Minting Single NFT', function () {
		it('will check the NFT details', async function () {
			const mintPromise = await MTVNFTContract.connect(addr1).mint(
				amounts[0],
				royalties[0],
				URIs[0]
			)

			const royaltyInfo = await MTVNFTContract.royalties(ids[0])
			expect(
				await MTVNFTContract.balanceOf(addr1.address, ids[0])
			).to.be.equal(amounts[0])
			expect(await MTVNFTContract.uri(ids[0])).to.be.equal(URIs[0])
			expect(await MTVNFTContract.creator(ids[0])).to.be.equal(
				addr1.address
			)
			expect(royaltyInfo.recipient).to.be.equal(addr1.address)
			expect(royaltyInfo.amount).to.be.equal(royalties[0])

			expect(mintPromise)
				.to.emit(MTVNFTContract, 'Mint')
				.withArgs(
					addr1.address,
					ids[0],
					amounts[0],
					royalties[0],
					URIs[0]
				)
		})

		it('should fail if amount of token ', async function () {
			await expect(
				MTVNFTContract.connect(addr1).mint(0, royalties[0], URIs[0])
			).to.be.revertedWith('Amount should be positive')
		})

		it('should fail if URI is empty', async function () {
			await expect(
				MTVNFTContract.connect(addr1).mint(amounts[0], royalties[0], '')
			).to.be.revertedWith('tokenURI should be set')
		})

		it('should fail if royalty exceeds max royalty', async function () {
			const maxRoyalty = await MTVNFTContract.maxRoyalty()
			await expect(
				MTVNFTContract.connect(addr1).mint(
					amounts[0],
					ethers.BigNumber.from(maxRoyalty).add(1),
					URIs[0]
				)
			).to.be.revertedWith('Royalties Too high')
		})
	})

	describe('Minting Batch NFTs', function () {
		it('will check the NFT details', async function () {
			const mintPromise = await MTVNFTContract.connect(addr1).batchMint(
				amounts,
				royalties,
				URIs
			)
			for (let i = 0; i < ids.length; i++) {
				const royaltyInfo = await MTVNFTContract.royalties(ids[i])

				expect(
					await MTVNFTContract.balanceOf(addr1.address, ids[i])
				).to.be.equal(amounts[i])
				expect(await MTVNFTContract.uri(ids[i])).to.be.equal(URIs[i])
				expect(await MTVNFTContract.creator(ids[i])).to.be.equal(
					addr1.address
				)
				expect(royaltyInfo.recipient).to.be.equal(addr1.address)
				expect(royaltyInfo.amount).to.be.equal(royalties[i])

				expect(mintPromise)
					.to.emit(MTVNFTContract, 'Mint')
					.withArgs(
						addr1.address,
						ids[i],
						amounts[i],
						royalties[i],
						URIs[i]
					)
			}
		})

		it('should fail for any invalid array value', async function () {
			const dummyAmounts = [10, 0, 5, 10, 1]
			const dummyRoyalties = [5, 2, 10000, 6, 5]
			const dummyURIs = [
				'https://arweave.net/eR4wgSnWusIG-xF2BZzsiOwVehQsvfCT8VAUC4NHQ5Y',
				'https://arweave.net/NOvV7akJDBFZogZOKxDMwIhOauiDNhVqnIfUqJmmPR8',
				'https://arweave.net/q6RS0m0cdoieJbbXI4H1A4yJcDeFi97YF3fHVhn-h9M',
				'https://arweave.net/NOvV7akJDBFZogZOKxDMwIhOauiDNhVqnIfUqJmmPR9',
			]

			await expect(
				MTVNFTContract.connect(addr1).batchMint(
					dummyAmounts,
					dummyRoyalties,
					dummyURIs
				)
			).to.be.reverted
		})
	})

	describe('Royalties', function () {
		it('should pass on valid value', async function () {
			const oldValue = (await MTVNFTContract.maxRoyalty()).toString()
			const newValue = '100'

			const setRoyaltyPromise = await MTVNFTContract.connect(
				owner
			).setMaxRoyalty(newValue)

			expect((await MTVNFTContract.maxRoyalty()).toString()).to.be.equal(
				newValue
			)

			expect(setRoyaltyPromise)
				.to.emit(MTVNFTContract, 'RoyaltyChanged')
				.withArgs(oldValue, newValue)
		})

		it('should fail when a user tries to set maxRoyalty', async function () {
			const newValue = 3838

			await expect(
				MTVNFTContract.connect(addr1).setMaxRoyalty(newValue)
			).to.be.revertedWith('Ownable: caller is not the owner')
		})

		it('should fail on same value', async function () {
			const oldValue = (await MTVNFTContract.maxRoyalty()).toString()
			const newValue = oldValue

			await expect(
				MTVNFTContract.connect(owner).setMaxRoyalty(newValue)
			).to.be.revertedWith('Royalty is same as previous value')
		})

		it('should fail on invalid value', async function () {
			await expect(
				MTVNFTContract.connect(owner).setMaxRoyalty(10001)
			).to.be.revertedWith('Royalty exceeds 100%')
		})

		it('will fetch valid royalty value', async function () {
			await MTVNFTContract.connect(addr1).mint(
				amounts[0],
				royalties[0],
				URIs[0]
			)
			const royaltyInfo = await MTVNFTContract.royaltyInfo(ids[0], 10000)
			expect(royaltyInfo.receiver).to.be.equal(addr1.address)
			expect(royaltyInfo.royaltyAmount).to.be.equal(5)
		})
	})

	describe('Upgradeable', function () {
		it('will check the Upgradeable data storage', async function () {
			const mintPromise = await MTVNFTContract.connect(addr1).mint(
				amounts[0],
				royalties[0],
				URIs[0]
			)

			MTVNFTV2 = await ethers.getContractFactory('NFTMtvV2')
			MTVNFTContractV2 = await upgrades.upgradeProxy(
				MTVNFTContract.address,
				MTVNFTV2
			)

			const royaltyInfo = await MTVNFTContractV2.royalties(ids[0])
			expect(
				await MTVNFTContractV2.balanceOf(addr1.address, ids[0])
			).to.be.equal(amounts[0])
			expect(await MTVNFTContractV2.uri(ids[0])).to.be.equal(URIs[0])
			expect(await MTVNFTContractV2.creator(ids[0])).to.be.equal(
				addr1.address
			)
			expect(royaltyInfo.recipient).to.be.equal(addr1.address)
			expect(royaltyInfo.amount).to.be.equal(royalties[0])

			expect(mintPromise)
				.to.emit(MTVNFTContractV2, 'Mint')
				.withArgs(
					addr1.address,
					ids[0],
					amounts[0],
					royalties[0],
					URIs[0]
				)
		})

		it('will fail if msg.value less than 1 ether', async function () {
			MTVNFTV2 = await ethers.getContractFactory('NFTMtvV2')
			MTVNFTContractV2 = await upgrades.upgradeProxy(
				MTVNFTContract.address,
				MTVNFTV2
			)
			await expect(
				MTVNFTContractV2.connect(addr1).mint(
					amounts[0],
					royalties[0],
					URIs[0]
				)
			).to.be.revertedWith('Mint cost not reached')
		})

		it('will mint if msg.value is equal to 100 ether', async function () {
			MTVNFTV2 = await ethers.getContractFactory('NFTMtvV2')
			MTVNFTContractV2 = await upgrades.upgradeProxy(
				MTVNFTContract.address,
				MTVNFTV2
			)

			const mintPromise = await MTVNFTContractV2.connect(addr1).mint(
				amounts[0],
				royalties[0],
				URIs[0],
				{ value: ethers.utils.parseEther('100') }
			)

			const royaltyInfo = await MTVNFTContractV2.royalties(ids[0])
			expect(
				await MTVNFTContractV2.balanceOf(addr1.address, ids[0])
			).to.be.equal(amounts[0])
			expect(await MTVNFTContractV2.uri(ids[0])).to.be.equal(URIs[0])
			expect(await MTVNFTContractV2.creator(ids[0])).to.be.equal(
				addr1.address
			)
			expect(royaltyInfo.recipient).to.be.equal(addr1.address)
			expect(royaltyInfo.amount).to.be.equal(royalties[0])

			expect(mintPromise)
				.to.emit(MTVNFTContractV2, 'Mint')
				.withArgs(
					addr1.address,
					ids[0],
					amounts[0],
					royalties[0],
					URIs[0]
				)
		})
	})
})
