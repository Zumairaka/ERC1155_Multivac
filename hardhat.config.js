require('dotenv').config()

require('@nomiclabs/hardhat-etherscan')
require('@nomiclabs/hardhat-waffle')
require('hardhat-gas-reporter')
require('@openzeppelin/hardhat-upgrades')
require('solidity-coverage')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
	const accounts = await hre.ethers.getSigners()

	for (const account of accounts) {
		console.log(account.address)
	}
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
	solidity: {
		compilers: [
			{
				version: '0.4.17',
			},
			{
				version: '0.8.4',
			},
		],
	},
	networks: {
		rinkeby: {
			url: `https://rinkeby.infura.io/v3/${process.env.PROJECT_ID}`,
			accounts:
				process.env.PRIVATE_KEY !== undefined
					? [process.env.KEY_ONE]
					: [],
		},
		multivacMainnet: {
			url: 'https://rpc.mtv.ac',
			chainId: 62621,
			accounts: [`0x${process.env.PRIVATE_KEY}`],
		},
		bscTestnet: {
			url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
			chainId: 97,
			accounts: [`0x${process.env.PRIVATE_KEY}`],
		},
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY,
	},
	settings: {
		optimizer: {
			enabled: true,
			runs: 200,
		},
	},
}
