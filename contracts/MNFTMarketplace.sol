// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

/// @title NFT market place built on Multivac blockchain network
/// @author Sumaira K A
/// @notice This is a smart contract for NFT market place
/// built on Multivac blockchain network. This is buit as part of MVP.
/// so the selling price is fixed and not available for auction.

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/ITokenRoyaltiesUpgradeable.sol";

// ERC1155HolderUpgradeable,
contract MNFTMarketplace is
    ERC1155HolderUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public tokenContract;
    uint256 private _depositFee; // deposit fee for listing the items
    uint256 private _serviceFee; // service fee that has to be sent to the marketplace owner at the time of a purchase
    uint256 private _totalDepositFee; // to keep track of deposit fees
    address[] private verifiedContracts;
    CountersUpgradeable.Counter private _itemIds;

    // creating a new role
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event MarketItemCreated(
        uint256 indexed itemId,
        uint256 indexed tokenId,
        address indexed nftContract,
        address seller,
        uint256 numberOfItemsAvailable,
        uint256 pricePerItem,
        uint256 depositFee,
        uint8 paymentOption
    );

    event MarketItemSold(
        uint256 indexed itemId,
        address indexed seller,
        address owner,
        uint256 numberOfItems,
        uint256 pricePerItem,
        address indexed creator,
        uint256 royalty,
        uint256 serviceFee,
        uint8 paymentOption
    );

    event MarketItemRemoved(
        uint256 indexed itemId,
        address indexed seller,
        uint256 numberOfItemsRemoved,
        uint256 numberOfItemsRemaining
    );

    event DepositFeeChanged(
        address indexed admin,
        uint256 oldFee,
        uint256 newFee
    );

    event ServiceFeeChanged(
        address indexed admin,
        uint256 oldFee,
        uint256 newFee
    );

    event WhitelistedNFTContracts(
        address indexed admin,
        address[] nftContracts
    );

    event DepositFeeTransferred(
        uint256 indexed itemId,
        address indexed account,
        uint256 amount
    );

    event ExcessDepositFeeTransferred(
        uint256 indexed itemId,
        address indexed account,
        uint256 amount
    );

    event TransferredRoyaltyToTheCreator(
        uint256 indexed itemId,
        address indexed account,
        uint256 amount
    );

    event TransferredPaymentToTheSeller(
        uint256 indexed itemId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event ServiceFeeClaimed(
        address indexed admin,
        address indexed account,
        uint256 amount,
        uint8 paymentOption
    );

    modifier isRealAddress(address account) {
        require(account != address(0), "Mvcmp: cannot be zero address");
        _;
    }

    struct MarketItem {
        address nftContract;
        address seller;
        uint256 tokenId;
        uint256 itemsAvailable;
        uint256 pricePerItem;
        uint256 itemsSold;
        uint256 depositFee;
        uint8 paymentOption;
    }

    mapping(uint256 => MarketItem) public marketItems;

    function initialize(address token) public isRealAddress(token) initializer {
        __ERC1155Holder_init();
        __ReentrancyGuard_init();
        __AccessControl_init();
        _setupRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        tokenContract = IERC20Upgradeable(token);
        _depositFee = 100 ether; // 100 MTV
        _serviceFee = 250; // 2.5% out of 100% (10000) and max fee is 10% (1000)
        _totalDepositFee = 0;
    }

    /**
     * @dev function for making the contract ERC1155 receiver
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlUpgradeable, ERC1155ReceiverUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev function for creating the market item for listing.
     * NFT contractAddress, tokenId, numberOfItems, price and
     * payment option are the parameters
     * @dev we need to check the following conditions
     * they should have sent the deposit fee
     * price of the item should be greater than 1 wei
     * the contract address should be verified based on our
     * platform criterias.
     * seller should have enough nft balance for listing
     * number of items should be greater than one
     * @dev payment option '0' stands for 'mvt' and '1' stands for 'token'(usdt)
     */
    function createMarketItem(
        uint256 _tokenId,
        address _nftContract,
        uint256 _numberOfItems,
        uint256 _pricePerItem,
        uint8 _paymentOption
    ) external payable nonReentrant isRealAddress(_msgSender()) {
        _itemIds.increment();
        uint256 _itemId = _itemIds.current();

        require(_numberOfItems > 0, "Mvcmp: zero number of items");

        require(msg.value >= _depositFee, "Mvcmp: deposit fee is less");
        require(
            IERC1155Upgradeable(_nftContract).balanceOf(
                _msgSender(),
                _tokenId
            ) >= _numberOfItems,
            "Mvcmp: not enough nft balance"
        );
        require(
            (_paymentOption == 0 || _paymentOption == 1),
            "Mvcmp: invalid payment option"
        );
        require(_pricePerItem > 0, "Mvcmp: price cannot be zero");
        require(
            _verifyContract(_nftContract) == true,
            "Mvcmp: contract not whitelisted"
        );

        // store the data to the market items
        marketItems[_itemId] = MarketItem(
            _nftContract,
            payable(_msgSender()),
            _tokenId,
            _numberOfItems,
            _pricePerItem,
            0,
            _depositFee,
            _paymentOption
        );

        // update the total deplosit fee
        _totalDepositFee += _depositFee;

        // emit the event for notifying the creation of item for selling
        emit MarketItemCreated(
            _itemId,
            _tokenId,
            _nftContract,
            _msgSender(),
            _numberOfItems,
            _pricePerItem,
            _depositFee,
            _paymentOption
        );

        // transfer the item to the market place address
        IERC1155Upgradeable(_nftContract).safeTransferFrom(
            _msgSender(),
            address(this),
            _tokenId,
            _numberOfItems,
            ""
        );

        // transfer back the excess listing price
        uint256 excessAmount_ = msg.value - _depositFee;
        if (excessAmount_ > 0) {
            emit ExcessDepositFeeTransferred(
                _itemId,
                _msgSender(),
                excessAmount_
            );

            (bool isSendToSeller, ) = payable(_msgSender()).call{
                value: excessAmount_
            }("");
            require(isSendToSeller, "Mvcmp: send to seller failed");
        }
    }

    /**
     * @dev function for buying the items
     * upon buying the items the creator would be getting the royalty
     * based on the percentage set by the creator the royalty will be deducted from
     * the price and transferred to the creator
     * @dev we should check the following criteria
     * if there is enough nfts to buy
     * if the buyer has enough balance for buying nft
     * @dev we need to find the royalty fee by calling an internal function
     * we will compute the service fee for the platform
     * both fees will be deducted from the seller's payment
     */
    function buyMarketItem(uint256 _itemId, uint256 _numberOfItems)
        external
        payable
        nonReentrant
        isRealAddress(_msgSender())
    {
        MarketItem storage marketItem = marketItems[_itemId];

        // check if enough nfts are available for buying
        require(
            _numberOfItems <= marketItem.itemsAvailable,
            "Mvcmp: not enough nfts to buy"
        );

        // check if buyer has enough balance for buying the item
        uint256 amount_ = marketItem.pricePerItem * _numberOfItems;

        if (marketItem.paymentOption == 0) {
            require(msg.value >= amount_, "Mvcmp: not enough mvt for buying");
        } else {
            require(
                tokenContract.balanceOf(_msgSender()) >= amount_,
                "Mvcmp:not enough usdt for buying"
            );
        }

        // compute the royalty for the creator
        address seller_ = marketItem.seller;
        (address creator_, uint256 royaltyAmount_) = _getRoyalty(
            marketItem.tokenId,
            amount_,
            marketItem.nftContract
        );

        // compute service charge for the platform
        uint256 serviceFee_ = _computeServiceFee(amount_);

        uint256 payment_ = amount_ - royaltyAmount_ - serviceFee_;

        // update the mapping of seller
        marketItem.itemsAvailable -= _numberOfItems;
        marketItem.itemsSold += _numberOfItems;

        // emit the even for notifying the sell of items and transfer of amounts
        emit MarketItemSold(
            _itemId,
            seller_,
            _msgSender(),
            _numberOfItems,
            marketItem.pricePerItem,
            creator_,
            royaltyAmount_,
            serviceFee_,
            marketItem.paymentOption
        );

        // transfer the payment and royalty
        emit TransferredPaymentToTheSeller(
            _itemId,
            _msgSender(),
            seller_,
            payment_
        );
        emit TransferredRoyaltyToTheCreator(_itemId, creator_, royaltyAmount_);
        if (marketItem.paymentOption == 0) {
            // transfer payment to the seller
            (bool isSendToSeller, ) = payable(seller_).call{value: payment_}(
                ""
            );
            require(isSendToSeller, "Mvcmp: send to seller failed");

            // trasnfer royalty to the creator
            if (creator_ != address(0) && royaltyAmount_ > 0) {
                (bool isSendToCreator, ) = payable(creator_).call{
                    value: royaltyAmount_
                }("");
                require(isSendToCreator, "Mvcmp: send to creator failed");
            }
        } else {
            // transfer payment to the seller
            tokenContract.safeTransferFrom(_msgSender(), seller_, payment_);

            // trasnfer royalty to the creator
            if (creator_ != address(0) && royaltyAmount_ > 0) {
                tokenContract.safeTransferFrom(
                    _msgSender(),
                    creator_,
                    royaltyAmount_
                );
            }

            // transfer service fee to the smart contract
            tokenContract.safeTransferFrom(
                _msgSender(),
                address(this),
                serviceFee_
            );
        }

        // if all sold then transfer the deposit fee back to the seller
        if (marketItem.itemsAvailable == 0) {
            emit DepositFeeTransferred(_itemId, seller_, marketItem.depositFee);
            _totalDepositFee -= marketItem.depositFee;

            (bool isSendToSeller, ) = payable(seller_).call{
                value: marketItem.depositFee
            }("");

            require(isSendToSeller, "Mvcmp: send to seller failed");
        }

        // transfer the nfts to the buyer
        IERC1155Upgradeable(marketItem.nftContract).safeTransferFrom(
            address(this),
            _msgSender(),
            marketItem.tokenId,
            _numberOfItems,
            ""
        );
    }

    /**
     * @dev function for removing the items from the sell order
     * if the request is for removing all the items then; it can be deleted from the listed nfts.
     * Also mapping is deleted for saving the space. Otherwise will update the remaining numbers.
     * we need to check certain conditions like if the request is from valid user
     * also not all the items are sold
     * @dev we shouyld check the following criterias
     * the request should be from the actual seller
     * the items cannot be removed if all the items are sold
     * if the requested amount is greater than availble
     * @dev if all the items are removed then trasnfer the deposit fee back
     */
    function removeMarketItems(uint256 _itemId, uint256 _amount)
        external
        nonReentrant
        isRealAddress(_msgSender())
    {
        MarketItem storage marketItem = marketItems[_itemId];
        address seller_ = marketItem.seller;

        require(seller_ == _msgSender(), "Mvcmp: unauthorized access");
        require(_amount > 0, "Mvcmp: requested zero items");

        uint256 amount_ = marketItem.itemsAvailable;

        require(amount_ > 0, "Mvcmp: cannot remove sold items");
        require(amount_ >= _amount, "Mvcmp:request amount unavailable");

        uint256 remaining = amount_ - _amount;

        // transfer the items back to the seller
        IERC1155Upgradeable(marketItem.nftContract).safeTransferFrom(
            address(this),
            seller_,
            marketItem.tokenId,
            _amount,
            ""
        );

        // delete the items from the storage if the request is to remove all the items
        // otherwise update the number of items and transfer the deposit back incase of
        // zero items available
        if (remaining == 0) {
            // trasnfer the deposit fee and delete the mapping
            uint256 value_ = marketItem.depositFee;
            _totalDepositFee -= value_;

            emit DepositFeeTransferred(_itemId, seller_, value_);
            delete marketItems[_itemId];

            (bool isSendToSeller, ) = payable(seller_).call{value: value_}("");
            require(isSendToSeller, "Mvcmp: send to seller failed");
        } else {
            // update the mapping
            marketItem.itemsAvailable = remaining;
        }

        emit MarketItemRemoved(_itemId, _msgSender(), _amount, remaining);
    }

    /**
     * @dev function for claiming the service fees
     * it is possible only by the owner
     * need to make sure enough service fee is available
     * apart from users deposit fee
     * based on the payment option service fee can be withdrawn
     */
    function withdrawServiceFees(
        address _account,
        uint256 _amount,
        uint8 _paymentOption
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        uint256 balance_;
        if (_paymentOption == 0) {
            balance_ = address(this).balance - _totalDepositFee;
        } else {
            balance_ = tokenContract.balanceOf(address(this));
        }

        require(balance_ >= _amount, "Mvcmp: insufficient service fee");

        // trasnfer the service to the specified account
        emit ServiceFeeClaimed(_msgSender(), _account, _amount, _paymentOption);
        if (_paymentOption == 0) {
            (bool isSendToAccount, ) = payable(_account).call{value: _amount}(
                ""
            );
            require(isSendToAccount, "Mvcmp: send service fee failed");
        } else {
            tokenContract.safeTransfer(_account, _amount);
        }
    }

    /**
     * @dev function for changing the deposit fee
     * possible only by the admin
     * @dev we should check if the new price is not more than 100% (10000)
     */
    function changeDepositFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        require(_depositFee != _newFee, "Mvcmp: same as current");

        uint256 oldFee_ = _depositFee;
        _depositFee = _newFee * 1 ether;
        emit DepositFeeChanged(_msgSender(), oldFee_, _depositFee);
    }

    /**
     * @dev function for changing the service fee
     * possible only by the admin
     * @dev we should check if the new price is not more than 100% (10000)
     */
    function changeServiceFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        require(_newFee <= 1000, "Mvcmp: price exceeds 10%");
        require(_serviceFee != _newFee, "Mvcmp: same as current");

        uint256 oldFee_ = _serviceFee;
        _serviceFee = _newFee;
        emit ServiceFeeChanged(_msgSender(), oldFee_, _serviceFee);
    }

    /**
     * @dev function for adding the nft contract addresses to the whitelisted array
     * possible only by the admin
     * @dev we need to check the following criterias
     * array size cannot be zero
     * address cannot be a zero address
     * if address already exist
     */
    function whitelistNFTContracts(address[] memory _nftContracts)
        external
        onlyRole(ADMIN_ROLE)
    {
        uint256 size = _nftContracts.length;
        require(size > 0, "Mvcmp: array size cannot be zero");
        for (uint256 i = 0; i < size; i++) {
            require(
                _nftContracts[i] != address(0),
                "Mvcmp: address cannot be zero"
            );
            require(
                _verifyContract(_nftContracts[i]) == false,
                "Mvcmp: address already exists"
            );
            verifiedContracts.push(_nftContracts[i]);
        }
        emit WhitelistedNFTContracts(_msgSender(), _nftContracts);
    }

    /**
     * @dev function for returning the whitelisted nft contract addresses array
     */
    function getWhitelistedContracts()
        external
        view
        returns (address[] memory)
    {
        return verifiedContracts;
    }

    /**
     * @dev function for returning the listing price
     */
    function getDepositFee() external view returns (uint256) {
        return _depositFee;
    }

    /**
     * @dev function for returning the listing price
     */
    function getServiceFee() external view returns (uint256) {
        return _serviceFee;
    }

    /**
     * @dev function for returning the current itemId
     */
    function getCurrentItemId() external view returns (uint256) {
        return _itemIds.current();
    }

    /**
     * @dev internal function for verifying the contract
     */
    function _verifyContract(address _nftContract)
        internal
        view
        returns (bool)
    {
        for (uint256 i = 0; i < verifiedContracts.length; i++) {
            if (_nftContract == verifiedContracts[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev internal function for computing the service fee
     */
    function _computeServiceFee(uint256 _amount)
        internal
        view
        returns (uint256)
    {
        return (_amount * _serviceFee) / 10000;
    }

    /**
     * @dev internal function for retrieving the royalty amount
     * if the nft contract is without royalty then it would return 0
     * otherwise it will fetch the royalty data from the nft contract
     */
    function _getRoyalty(
        uint256 _tokenId,
        uint256 _amount,
        address _nftContract
    ) internal view returns (address _creator, uint256 _royalty) {
        try
            ITokenRoyaltiesUpgradeable(_nftContract).royaltyInfo(
                _tokenId,
                _amount
            )
        returns (address creator, uint256 royalty) {
            return (creator, royalty);
        } catch {
            return (address(0), 0);
        }
    }
}
