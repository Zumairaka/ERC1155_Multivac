// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./interfaces/ITokenRoyaltiesUpgradeable.sol";

contract NFTMtv is
    Initializable,
    ERC1155Upgradeable,
    OwnableUpgradeable,
    ITokenRoyaltiesUpgradeable
{

    uint256 public maxRoyalty;
    CountersUpgradeable.Counter private _tokenIds;

    event Mint(
        address indexed creator,
        uint256 indexed id,
        uint256 amount,
        uint256 royalty,
        string uri
    );
    event RoyaltyChanged(uint256 oldValue, uint256 newValue);

    struct RoyaltyInfo {
        address recipient;
        uint24 amount;
    }

    mapping(uint256 => address) public creator;
    mapping(uint256 => RoyaltyInfo) public royalties;
    mapping(uint256 => string) private _tokenURIs;

    function initialize() public initializer {
        __ERC1155_init("");
        __Ownable_init();

        // max royality 10 percent
        maxRoyalty = 1000;
    }

    function mint(
        uint256 amount_,
        uint256 royalty_,
        string memory tokenURI
    ) external {
        _tokenIds.increment();
        uint256 id_ = _tokenIds.current();
        _beforeTokenMint(id_, amount_, tokenURI);

        creator[id_] = msg.sender;

        _setURI(id_, tokenURI);

        _setTokenRoyalty(id_, msg.sender, royalty_);
        emit Mint(msg.sender, id_, amount_, royalty_, tokenURI);

        _mint(msg.sender, id_, amount_, "");
    }

    function batchMint(
        uint256[] memory amounts_,
        uint256[] memory royalties_,
        string[] memory tokenURIs
    ) external {
        uint256 size = tokenURIs.length;
        uint256[] memory ids_ = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            _tokenIds.increment();
            uint256 id = _tokenIds.current();
            ids_[i] = id;
            uint256 amount = amounts_[i];
            string memory tokenURI = tokenURIs[i];
            uint256 royalty = royalties_[i];

            _beforeTokenMint(id, amount, tokenURI);

            _setURI(id, tokenURI);
            creator[id] = msg.sender;
            _setTokenRoyalty(id, msg.sender, royalty);

            emit Mint(msg.sender, id, amount, royalty, tokenURI);
        }
        _mintBatch(msg.sender, ids_, amounts_, "");
    }

    function royaltyInfo(uint256 id, uint256 value)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        RoyaltyInfo memory royalties_ = royalties[id];
        receiver = royalties_.recipient;
        royaltyAmount = (value * royalties_.amount) / 10000;
    }

    function setMaxRoyalty(uint256 maxRoyalty_) external onlyOwner {
        require(maxRoyalty_ <= 10000, "Royalty exceeds 100%");
        require(maxRoyalty_ != maxRoyalty, "Royalty is same as previous value");

        emit RoyaltyChanged(maxRoyalty, maxRoyalty_);
        maxRoyalty = maxRoyalty_;
    }

    function uri(uint256 id)
        public
        view
        override(ERC1155Upgradeable)
        returns (string memory)
    {
        return _tokenURIs[id];
    }

    function _beforeTokenMint(
        uint256 id,
        uint256 amount,
        string memory _tokenURI
    ) internal view {
        require(creator[id] == address(0), "Token is already minted");
        require(amount != 0, "Amount should be positive");
        require(bytes(_tokenURI).length > 0, "tokenURI should be set");
    }

    function _setTokenRoyalty(
        uint256 id,
        address recipient,
        uint256 value
    ) internal {
        require(value <= maxRoyalty, "Royalties Too high");

        royalties[id] = RoyaltyInfo(recipient, uint24(value));
    }

    function _setURI(uint256 id, string memory _uri) internal {
        _tokenURIs[id] = _uri;
    }
}
