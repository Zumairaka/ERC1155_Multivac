const { expect } = require('chai')
const { BigNumber } = require('ethers')
const { ethers, upgrades, waffle } = require('hardhat')
const provider = waffle.provider

describe('MultivacNFT marketplace upgradeable contract', () => {
	let admin,
		add1,
		add2,
		add3,
		MNFTMarketplace,
		mnftMarketplace,
		MNFT,
		mnft1,
		mnft2,
		mnft3,
		mnft4,
		MNFTnormal,
		mnftNormal,
		USDT,
		usdt
	// usdt ropsten address
	// const usdt = ethers.utils.getAddress(
	// 	'0x6ee856ae55b6e1a249f04cd3b947141bc146273c'
	// )
	ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

	// convert to ether
	function getValue(amount) {
		let _amount = BigNumber.from(amount).mul(
			BigNumber.from(10).pow(BigNumber.from(18))
		)
		return _amount
	}

	// compute service fee
	function getServiceFee(amount) {
		let _fee = BigNumber.from(amount)
			.mul(BigNumber.from(25))
			.div(BigNumber.from(1000))
		return _fee
	}

	// compute royalty (default kept it as 10%)
	function getRoyalty(amount) {
		let _fee = BigNumber.from(amount)
			.mul(BigNumber.from(10))
			.div(BigNumber.from(100))
		return _fee
	}

	beforeEach(async () => {
		;[admin, add1, add2, add3, _] = await ethers.getSigners()

		MNFT = await ethers.getContractFactory('MNFT')
		mnft1 = await MNFT.deploy()
		mnft2 = await MNFT.deploy()
		mnft3 = await MNFT.deploy()
		mnft4 = await MNFT.deploy()

		MNFTnormal = await ethers.getContractFactory('MNFTnormal')
		mnftNormal = await MNFTnormal.deploy()

		USDT = await ethers.getContractFactory('USDT')
		usdt = await USDT.deploy()
		await usdt.TetherToken(10000000000, 'USDT token', 'USDT', 6)

		MNFTMarketplace = await ethers.getContractFactory('MNFTMarketplace')
		mnftMarketplace = await upgrades.deployProxy(
			MNFTMarketplace,
			[usdt.address],
			{
				initializer: 'initialize',
			}
		)
		await mnftMarketplace.deployed()

		adminRole = ethers.utils.id('ADMIN_ROLE')

		nftContracts = [
			mnft1.address,
			mnft2.address,
			mnft3.address,
			mnftNormal.address,
		]

		// whitelist some contracts
		await mnftMarketplace.connect(admin).whitelistNFTContracts(nftContracts)

		// mint some nfts to add1
		await mnft1.connect(add1).mint(1, 10, 10)
		await mnftNormal.connect(add2).mint(1, 10)
	})

	describe('Initialize', () => {
		it('Should revert if initializer is called twice', async () => {
			await expect(
				mnftMarketplace.initialize(usdt.address)
			).to.be.revertedWith(
				'Initializable: contract is already initialized'
			)
		})
	})

	describe('Creating Market Item', () => {
		it('Should revert if number of items are zero', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft1.address, 0, price, 0, {
						value: ethers.utils.parseEther('100'),
					})
			).to.be.revertedWith('Mvcmp: zero number of items')
		})

		it('Should revert if the deposit fee is less than 100mtv', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft1.address, 10, price, 0, {
						value: ethers.utils.parseEther('1'),
					})
			).to.be.revertedWith('Mvcmp: deposit fee is less')
		})

		it('Should revert if not enough nft balance with the seller', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft1.address, 11, price, 0, {
						value: ethers.utils.parseEther('100'),
					})
			).to.be.revertedWith('Mvcmp: not enough nft balance')
		})

		it('Should revert if provided invalid payment option', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft1.address, 10, price, 2, {
						value: ethers.utils.parseEther('100'),
					})
			).to.be.revertedWith('Mvcmp: invalid payment option')
		})

		it('Should revert if the price is not atleast one wei', async () => {
			let price = getValue(0)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft1.address, 10, price, 0, {
						value: ethers.utils.parseEther('100'),
					})
			).to.be.revertedWith('Mvcmp: price cannot be zero')
		})

		it('Should revert if the contract address is not in whitelist', async () => {
			let price = getValue(1)
			// mint some nfts from mnft4 (the one is not in whitelist)
			await mnft4.connect(add1).mint(1, 10, 10)
			await mnft4
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await expect(
				mnftMarketplace
					.connect(add1)
					.createMarketItem(1, mnft4.address, 10, price, 0, {
						value: ethers.utils.parseEther('100'),
					})
			).to.be.revertedWith('Mvcmp: contract not whitelisted')
		})

		it('Should create the market item and transfer the nft to the contract successfully', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			let itemId = await mnftMarketplace.getCurrentItemId()

			let tokenId = (await mnftMarketplace.marketItems(itemId)).tokenId
			let nftContract = (await mnftMarketplace.marketItems(itemId))
				.nftContract
			let seller = (await mnftMarketplace.marketItems(itemId)).seller
			let numberOfItems = (await mnftMarketplace.marketItems(itemId))
				.itemsAvailable
			let priceSC = (await mnftMarketplace.marketItems(itemId))
				.pricePerItem
			let paymentOption = (await mnftMarketplace.marketItems(itemId))
				.paymentOption
			let numberSold = (await mnftMarketplace.marketItems(itemId))
				.itemsSold
			let depositFee = (await mnftMarketplace.marketItems(itemId))
				.depositFee

			// check the mapping data
			expect(tokenId).to.equal(1)
			expect(nftContract).to.equal(mnft1.address)
			expect(seller).to.equal(add1.address)
			expect(numberOfItems).to.equal(10)
			expect(priceSC).to.equal(price)
			expect(paymentOption).to.equal(0)
			expect(depositFee).to.equal(deposit)
			expect(numberSold).to.equal(0)

			// check the balance of marketplace for listing price and nfts
			let depositBalance = await provider.getBalance(
				mnftMarketplace.address
			)
			let nftBalance = await mnft1.balanceOf(mnftMarketplace.address, 1)
			let nftBalanceSeller = await mnft1.balanceOf(add1.address, 1)

			expect(depositBalance).to.equal(deposit)
			expect(nftBalance).to.equal(10)
			expect(nftBalanceSeller).to.equal(0)
		})

		it('Should transfer the excess deposit fee back to the seller', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// check the balance before creating market item
			let balanceBefore = await provider.getBalance(add1.address)

			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('150'),
				})

			// check the balance after creating market item
			let balanceAfter = await provider.getBalance(add1.address)

			let gascost = BigNumber.from(balanceBefore).sub(
				BigNumber.from(balanceAfter).add(BigNumber.from(deposit))
			)

			// difference between before and after balance should be
			// only the deposit fee apart from gas fee should not be 150mtv
			// 50 got refunded
			let difference = BigNumber.from(balanceBefore)
				.sub(BigNumber.from(balanceAfter))
				.sub(BigNumber.from(gascost))

			expect(difference).to.equal(deposit)
		})
	})

	describe('Buying Market Item', () => {
		it('Should revert if not enough items to buy', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 5, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// buying items
			await expect(
				mnftMarketplace.connect(add2).buyMarketItem(1, 10, {
					value: ethers.utils.parseEther('10.0'),
				})
			).to.be.revertedWith('Mvcmp: not enough nfts to buy')
		})

		it('Should revert if not enough mvts sent as payment', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 5, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// buying items
			await expect(
				mnftMarketplace.connect(add2).buyMarketItem(1, 5, {
					value: ethers.utils.parseEther('4.0'),
				})
			).to.be.revertedWith('Mvcmp: not enough mvt for buying')
		})

		it('Should revert if not enough usdt is there with the buyer', async () => {
			// transfer some usdt to the add2
			await usdt.connect(admin).transfer(add2.address, 9)
			await usdt.connect(add2).approve(mnftMarketplace.address, 9)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, 1, 1, {
					value: ethers.utils.parseEther('100'),
				})

			// buying items
			await expect(
				mnftMarketplace.connect(add2).buyMarketItem(1, 10)
			).to.be.revertedWith('Mvcmp:not enough usdt for buying')
		})

		it('Should process the buying using mvt and trasnfer the payments successfully', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			let balanceOfCreator = await provider.getBalance(add1.address)

			// buying items
			await mnftMarketplace.connect(add2).buyMarketItem(1, 9, {
				value: ethers.utils.parseEther('9'),
			})

			let afterCreatorBalance = await provider.getBalance(add1.address)

			// calculate the royalty and check if it is sent to the creator
			let payment = getValue(9)

			// since both the creator and seller same payment is 10 minus service fee
			// find the service fee
			let serviceFee = getServiceFee(payment)
			balanceOfCreatorAfter = BigNumber.from(balanceOfCreator).add(
				BigNumber.from(payment).sub(BigNumber.from(serviceFee))
			)
			expect(afterCreatorBalance).to.equal(balanceOfCreatorAfter)

			// transfer of nft to the buyer
			let buyerNFTBalance = await mnft1.balanceOf(add2.address, 1)
			expect(buyerNFTBalance).to.equal(9)

			// seller nft balance should be zero
			let sellerNFTBalance = await mnft1.balanceOf(add1.address, 1)
			expect(sellerNFTBalance).to.equal(0)

			// marketplace nft balance should be one
			let marketNFTBalance = await mnft1.balanceOf(
				mnftMarketplace.address,
				1
			)
			expect(marketNFTBalance).to.equal(1)

			// platform should receive the service fee
			let platformBalance = BigNumber.from(deposit).add(
				BigNumber.from(serviceFee)
			)
			let platformBalanceSC = await provider.getBalance(
				mnftMarketplace.address
			)
			expect(platformBalance).to.equal(platformBalanceSC)

			// check the mapping values
			let tokenId = (await mnftMarketplace.marketItems(1)).tokenId
			let nftContract = (await mnftMarketplace.marketItems(1)).nftContract
			let seller = (await mnftMarketplace.marketItems(1)).seller
			let itemsAvailable = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let priceSC = (await mnftMarketplace.marketItems(1)).pricePerItem
			let paymentOption = (await mnftMarketplace.marketItems(1))
				.paymentOption
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold
			let depositFee = (await mnftMarketplace.marketItems(1)).depositFee

			expect(tokenId).to.equal(1)
			expect(nftContract).to.equal(mnft1.address)
			expect(seller).to.equal(add1.address)
			expect(itemsAvailable).to.equal(1)
			expect(priceSC).to.equal(price)
			expect(paymentOption).to.equal(0)
			expect(numberSold).to.equal(9)
			expect(depositFee).to.equal(deposit)
		})

		it('Should trasnfer the deposit fee once all sold back to the seller and royalty to different creator', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// add3 will buy this
			await mnftMarketplace.connect(add3).buyMarketItem(1, 10, {
				value: ethers.utils.parseEther('10'),
			})

			// add3 will relist/re create the market item
			await mnft1
				.connect(add3)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add3)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			let itemId = await mnftMarketplace.getCurrentItemId()

			// balance of creator add1
			let balanceOfCreator = await provider.getBalance(add1.address)

			// balance of seller before
			let balanceOfSeller = await provider.getBalance(add3.address)

			// buying items
			await mnftMarketplace.connect(add2).buyMarketItem(itemId, 10, {
				value: ethers.utils.parseEther('10'),
			})

			// calculate the royalty and check if it is sent to the creator
			let payment = getValue(10)
			let royalty = getRoyalty(payment)

			// find the service fee
			let serviceFee = getServiceFee(payment)

			// all sold seller should get the payment plus deposit minus royalty and service fee
			let balanceOfSellerAfter = BigNumber.from(balanceOfSeller)
				.add(BigNumber.from(payment))
				.sub(BigNumber.from(royalty))
				.sub(BigNumber.from(serviceFee))
				.add(BigNumber.from(deposit))

			let balanceOfSellerSc = await provider.getBalance(add3.address)
			expect(balanceOfSellerAfter).to.equal(balanceOfSellerSc)

			// creator should receive the royalty
			let balanceOfCreatorAfter = BigNumber.from(balanceOfCreator).add(
				BigNumber.from(royalty)
			)
			let balanceOfCreatorSc = await provider.getBalance(add1.address)
			expect(balanceOfCreatorAfter).to.equal(balanceOfCreatorSc)

			// platform should receive the service fee (2 purchase has been done so 2 times 2.5%)
			let platformBalanceSC = await provider.getBalance(
				mnftMarketplace.address
			)
			let platformBalance = BigNumber.from(serviceFee).mul(
				BigNumber.from(2)
			)
			expect(platformBalanceSC).to.equal(platformBalance)

			// check the mapping values
			let tokenId = (await mnftMarketplace.marketItems(2)).tokenId
			let nftContract = (await mnftMarketplace.marketItems(2)).nftContract
			let seller = (await mnftMarketplace.marketItems(2)).seller
			let itemsAvailable = (await mnftMarketplace.marketItems(2))
				.itemsAvailable
			let priceSC = (await mnftMarketplace.marketItems(2)).pricePerItem
			let paymentOption = (await mnftMarketplace.marketItems(2))
				.paymentOption
			let numberSold = (await mnftMarketplace.marketItems(2)).itemsSold
			let depositFee = (await mnftMarketplace.marketItems(2)).depositFee

			expect(tokenId).to.equal(1)
			expect(nftContract).to.equal(mnft1.address)
			expect(seller).to.equal(add3.address)
			expect(itemsAvailable).to.equal(0)
			expect(priceSC).to.equal(price)
			expect(paymentOption).to.equal(0)
			expect(numberSold).to.equal(10)
			expect(depositFee).to.equal(deposit)
		})

		it('Should create the market item and sell the item even if royalty is not there', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnftNormal
				.connect(add2)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market item
			await mnftMarketplace
				.connect(add2)
				.createMarketItem(1, mnftNormal.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			let balanceOfSeller = await provider.getBalance(add2.address)

			// sell it to someone else
			await mnftMarketplace.connect(add1).buyMarketItem(1, 9, {
				value: ethers.utils.parseEther('9.0'),
			})

			// since this contract does not support royalty no royalty is deducted
			let afterSellerBalance = await provider.getBalance(add2.address)

			// since there is no creator and royalty, seller will get the payment minus service fee
			// find the service fee
			let payment = getValue(9)
			let serviceFee = getServiceFee(payment)
			balanceOfSellerAfter = BigNumber.from(balanceOfSeller).add(
				BigNumber.from(payment).sub(BigNumber.from(serviceFee))
			)
			expect(afterSellerBalance).to.equal(balanceOfSellerAfter)

			// transfer of nft to the buyer
			let buyerNFTBalance = await mnftNormal.balanceOf(add1.address, 1)
			expect(buyerNFTBalance).to.equal(9)

			// seller nft balance should be one
			let sellerNFTBalance = await mnft1.balanceOf(add2.address, 1)
			expect(sellerNFTBalance).to.equal(0)

			// platform should receive the service fee
			let platformBalance = BigNumber.from(deposit).add(
				BigNumber.from(serviceFee)
			)
			let platformBalanceSC = await provider.getBalance(
				mnftMarketplace.address
			)
			expect(platformBalance).to.equal(platformBalanceSC)

			// check the mapping values
			let tokenId = (await mnftMarketplace.marketItems(1)).tokenId
			let nftContract = (await mnftMarketplace.marketItems(1)).nftContract
			let seller = (await mnftMarketplace.marketItems(1)).seller
			let itemsAvailable = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let priceSC = (await mnftMarketplace.marketItems(1)).pricePerItem
			let paymentOption = (await mnftMarketplace.marketItems(1))
				.paymentOption
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold
			let depositFee = (await mnftMarketplace.marketItems(1)).depositFee

			expect(tokenId).to.equal(1)
			expect(nftContract).to.equal(mnftNormal.address)
			expect(seller).to.equal(add2.address)
			expect(itemsAvailable).to.equal(1)
			expect(priceSC).to.equal(price)
			expect(paymentOption).to.equal(0)
			expect(numberSold).to.equal(9)
			expect(depositFee).to.equal(deposit)
		})

		it('Should process the buying using usdt and trasnfer the payments successfully', async () => {
			let deposit = getValue(100)

			// transfer some usdt to the add2
			await usdt.connect(admin).transfer(add2.address, 1000)
			await usdt.connect(add2).approve(mnftMarketplace.address, 1000)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, 100, 1, {
					value: ethers.utils.parseEther('100'),
				})

			// balance of creator/seller same here
			let balanceOfCreator = await usdt.balanceOf(add1.address)

			// buying items
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10)

			let afterCreatorBalance = await usdt.balanceOf(add1.address)

			// calculate the royalty and check if it is sent to the creator
			let payment = 1000

			// since both the creator and seller same payment is 1000 minus service fee
			// find the service fee
			let serviceFee = getServiceFee(payment)
			balanceOfCreatorAfter = BigNumber.from(balanceOfCreator).add(
				BigNumber.from(payment).sub(BigNumber.from(serviceFee))
			)
			expect(afterCreatorBalance).to.equal(balanceOfCreatorAfter)

			// platform should receive the service fee
			let platformBalance = await usdt.balanceOf(mnftMarketplace.address)
			expect(platformBalance).to.equal(serviceFee)

			// check the mapping values
			let tokenId = (await mnftMarketplace.marketItems(1)).tokenId
			let nftContract = (await mnftMarketplace.marketItems(1)).nftContract
			let seller = (await mnftMarketplace.marketItems(1)).seller
			let itemsAvailable = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let priceSC = (await mnftMarketplace.marketItems(1)).pricePerItem
			let paymentOption = (await mnftMarketplace.marketItems(1))
				.paymentOption
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold
			let depositFee = (await mnftMarketplace.marketItems(1)).depositFee

			expect(tokenId).to.equal(1)
			expect(nftContract).to.equal(mnft1.address)
			expect(seller).to.equal(add1.address)
			expect(itemsAvailable).to.equal(0)
			expect(priceSC).to.equal(100)
			expect(paymentOption).to.equal(1)
			expect(numberSold).to.equal(10)
			expect(depositFee).to.equal(deposit)
		})
	})

	describe('Remove Market Item', () => {
		it('Should revert if the request is not from actual seller', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// cancel some items
			await expect(
				mnftMarketplace.connect(add2).removeMarketItems(1, 5)
			).to.be.revertedWith('Mvcmp: unauthorized access')
		})

		it('Should revert if the requested is zero items', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// cancel some items
			await expect(
				mnftMarketplace.connect(add1).removeMarketItems(1, 0)
			).to.be.revertedWith('Mvcmp: requested zero items')
		})

		it('Should revert if the request is on sold items', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10, {
				value: ethers.utils.parseEther('10.0'),
			})

			// cancel some items
			await expect(
				mnftMarketplace.connect(add1).removeMarketItems(1, 5)
			).to.be.revertedWith('Mvcmp: cannot remove sold items')
		})

		it('Should revert if the requested amount is more than available', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 5, {
				value: ethers.utils.parseEther('5.0'),
			})

			// cancel some items
			await expect(
				mnftMarketplace.connect(add1).removeMarketItems(1, 6)
			).to.be.revertedWith('Mvcmp:request amount unavailable')
		})

		it('Should remove the items, transfer nfts and update the details successfully', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			let sellerNFTBalance = await mnft1.balanceOf(add1.address, 1)
			expect(sellerNFTBalance).to.equal(0)

			// cancel some items
			await mnftMarketplace.connect(add1).removeMarketItems(1, 3)

			// check the balance after cancelling 3 items
			let afterSellerNFTBalance = await mnft1.balanceOf(add1.address, 1)
			expect(afterSellerNFTBalance).to.equal(3)

			// check the mappings after cancelling 3 items
			let numberOfItems = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold

			expect(numberOfItems).to.equal(7)
			expect(numberSold).to.equal(0)
		})

		it('Should remove the items, transfer nfts and update the details successfully even after selling some items', async () => {
			let price = getValue(1)
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 5, {
				value: ethers.utils.parseEther('5.0'),
			})

			let sellerNFTBalance = await mnft1.balanceOf(add1.address, 1)
			expect(sellerNFTBalance).to.equal(0)

			// cancel some items
			await mnftMarketplace.connect(add1).removeMarketItems(1, 3)

			// check the balance after cancelling 3 items
			let afterSellerNFTBalance = await mnft1.balanceOf(add1.address, 1)
			expect(afterSellerNFTBalance).to.equal(3)

			// check the mappings after cancelling 3 items
			let numberOfItems = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold

			expect(numberOfItems).to.equal(2)
			expect(numberSold).to.equal(5)
		})

		it('Should remove the items and transfer the deposit if removed completely', async () => {
			let price = getValue(1)
			let deposit = getValue(100)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, price, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// balance after buy
			let balanceAfterBuy = await provider.getBalance(add1.address)

			// cancel some items
			await mnftMarketplace.connect(add1).removeMarketItems(1, 10)
			let balanceAfterRemove = await provider.getBalance(add1.address)

			// check the balance after cancelling all items
			// let balanceAfter = await provider.getBalance(add1.address)
			let gascost = BigNumber.from(balanceAfterRemove).sub(
				BigNumber.from(balanceAfterBuy)
			)

			let balanceExpected = BigNumber.from(balanceAfterBuy).add(
				BigNumber.from(gascost)
			)
			expect(balanceAfterRemove).to.equal(balanceExpected)

			// check the mappings after cancelling all items
			let numberOfItems = (await mnftMarketplace.marketItems(1))
				.itemsAvailable
			let numberSold = (await mnftMarketplace.marketItems(1)).itemsSold

			expect(numberOfItems).to.equal(0)
			expect(numberSold).to.equal(0)
		})
	})

	describe('Withdraw Service Fees', () => {
		it('Should revert if the caller is not an Admin', async () => {
			let amount = getValue(1)
			let payment = getValue(10)
			// create some market items for sending service fees
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, amount, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10, {
				value: ethers.utils.parseEther('10.0'),
			})

			let serviceFee = getServiceFee(payment)

			await expect(
				mnftMarketplace
					.connect(add1)
					.withdrawServiceFees(add1.address, serviceFee, 0)
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${adminRole}`
			)
		})

		it('Should revert if more fee in mvt is asked than balance', async () => {
			let amount = getValue(1)
			let payment = getValue(10)
			// create some market items for sending service fees
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, amount, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10, {
				value: ethers.utils.parseEther('10.0'),
			})

			await expect(
				mnftMarketplace
					.connect(admin)
					.withdrawServiceFees(add1.address, payment, 0)
			).to.be.revertedWith('Mvcmp: insufficient service fee')
		})

		it('Should revert if more fee in usdt is asked than balance', async () => {
			// transfer some usdt to the add2
			await usdt.connect(admin).transfer(add2.address, 1000)
			await usdt.connect(add2).approve(mnftMarketplace.address, 1000)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, 100, 1, {
					value: ethers.utils.parseEther('100'),
				})

			// buying items
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10)

			await expect(
				mnftMarketplace
					.connect(admin)
					.withdrawServiceFees(add1.address, 1000, 0)
			).to.be.revertedWith('Mvcmp: insufficient service fee')
		})

		it('Should transfer the service fee in mvt properly to the account specified', async () => {
			let amount1 = getValue(1)
			let amount2 = getValue(10)

			// create some market items for sending lsiting prices
			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items for add1
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, amount1, 0, {
					value: ethers.utils.parseEther('100'),
				})

			// selling some items to addr2
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10, {
				value: ethers.utils.parseEther('10.0'),
			})

			let serviceFee = getServiceFee(amount2)

			let balanceBefore = await provider.getBalance(add3.address)

			await mnftMarketplace
				.connect(admin)
				.withdrawServiceFees(add3.address, serviceFee, 0)

			let balanceAfter = await provider.getBalance(add3.address)
			let balanceContract = await provider.getBalance(
				mnftMarketplace.address
			)
			let expected = BigNumber.from(balanceBefore).add(
				BigNumber.from(serviceFee)
			)

			expect(balanceAfter).to.equal(expected)
			expect(balanceContract).to.equal(0)
		})

		it('Should transfer the service fee in usdt properly to the account specified', async () => {
			// transfer some usdt to the add2
			await usdt.connect(admin).transfer(add2.address, 1000)
			await usdt.connect(add2).approve(mnftMarketplace.address, 1000)

			await mnft1
				.connect(add1)
				.setApprovalForAll(mnftMarketplace.address, true)

			// create market items
			await mnftMarketplace
				.connect(add1)
				.createMarketItem(1, mnft1.address, 10, 100, 1, {
					value: ethers.utils.parseEther('100'),
				})

			// buying items
			await mnftMarketplace.connect(add2).buyMarketItem(1, 10)

			let serviceFee = getServiceFee(1000)

			let balanceBefore = await usdt.balanceOf(add3.address)

			await mnftMarketplace
				.connect(admin)
				.withdrawServiceFees(add3.address, serviceFee, 1)

			let balanceAfter = await usdt.balanceOf(add3.address)
			let balanceContract = await usdt.balanceOf(
				mnftMarketplace.address
			)
			let expected = BigNumber.from(balanceBefore).add(
				BigNumber.from(serviceFee)
			)

			expect(balanceAfter).to.equal(expected)
			expect(balanceContract).to.equal(0)
		})
	})

	describe('Change Deposit Fee', () => {
		it('Should revert if the caller is not an Admin', async () => {
			await expect(
				mnftMarketplace.connect(add1).changeDepositFee(200)
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${adminRole}`
			)
		})

		it('Should revert if the new value is same as current', async () => {
			let DF1 = getValue(100)

			await expect(
				mnftMarketplace.connect(admin).changeDepositFee(DF1)
			).to.be.revertedWith('Mvcmp: same as current')
		})

		it('Should change the deposit fee properly by an Admin', async () => {
			let DF1 = getValue(100)
			let DF2 = getValue(200)

			// previous deposit fee
			expect(await mnftMarketplace.getDepositFee()).to.equal(DF1)

			// change deposit fee
			await mnftMarketplace.connect(admin).changeDepositFee(200)

			expect(await mnftMarketplace.getDepositFee()).to.equal(DF2)
		})
	})

	describe('Change Service Fee', () => {
		it('Should revert if the caller is not an Admin', async () => {
			await expect(
				mnftMarketplace.connect(add1).changeServiceFee(300)
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${adminRole}`
			)
		})

		it('Should revert if the new value is more than 10%', async () => {
			await expect(
				mnftMarketplace.connect(admin).changeServiceFee(3000)
			).to.be.revertedWith('Mvcmp: price exceeds 10%')
		})

		it('Should revert if the new value is same as current', async () => {
			await expect(
				mnftMarketplace.connect(admin).changeServiceFee(250)
			).to.be.revertedWith('Mvcmp: same as current')
		})

		it('Should change the service fee properly by an Admin', async () => {
			// previous service fee
			expect(await mnftMarketplace.getServiceFee()).to.equal(250)

			// change deposit fee
			await mnftMarketplace.connect(admin).changeServiceFee(300)

			expect(await mnftMarketplace.getServiceFee()).to.equal(300)
		})
	})

	describe('White Listing NFT Contracts', () => {
		it('Should revert if the caller is not an Admin', async () => {
			await expect(
				mnftMarketplace
					.connect(add1)
					.whitelistNFTContracts([mnft4.address])
			).to.be.revertedWith(
				`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role ${adminRole}`
			)
		})

		it('Should revert if the array size is zero', async () => {
			await expect(
				mnftMarketplace.connect(admin).whitelistNFTContracts([])
			).to.be.revertedWith('Mvcmp: array size cannot be zero')
		})

		it('Should revert if the address is zero', async () => {
			await expect(
				mnftMarketplace
					.connect(admin)
					.whitelistNFTContracts([ZERO_ADDRESS])
			).to.be.revertedWith('Mvcmp: address cannot be zero')
		})

		it('Should revert if the address is already in the list', async () => {
			await expect(
				mnftMarketplace
					.connect(admin)
					.whitelistNFTContracts([mnft2.address])
			).to.be.revertedWith('Mvcmp: address already exists')
		})

		it('Should add the new address to the whitelisted contracts list', async () => {
			// previous contracts list
			let contractsBefore =
				await mnftMarketplace.getWhitelistedContracts()
			expect(contractsBefore).to.deep.equal(nftContracts)

			// whitelist new
			await mnftMarketplace
				.connect(admin)
				.whitelistNFTContracts([mnft4.address])
			nftContractsNew = [
				mnft1.address,
				mnft2.address,
				mnft3.address,
				mnftNormal.address,
				mnft4.address,
			]

			// new contracts list
			let contractsAfter = await mnftMarketplace.getWhitelistedContracts()
			expect(contractsAfter).to.deep.equal(nftContractsNew)
		})
	})
})
