// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../interfaces/ITokenRoyaltiesUpgradeable.sol";

contract MNFT is ERC1155("") {
    uint256 public maxRoyalty = 1000;

    struct RoyaltyInfo {
        address recipient;
        uint24 amount;
    }

    mapping(uint256 => address) public creator;
    mapping(uint256 => RoyaltyInfo) public royalties;
    mapping(uint256 => string) private _tokenURIs;

    function mint(
        uint256 id_,
        uint256 amount_,
        uint256 royalty_
    ) external {
        creator[id_] = msg.sender;
        _setTokenRoyalty(id_, msg.sender, royalty_);

        _mint(msg.sender, id_, amount_, "");
    }

    function royaltyInfo(uint256 id, uint256 value)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        RoyaltyInfo memory royalties_ = royalties[id];
        receiver = royalties_.recipient;
        royaltyAmount = (value * royalties_.amount) / 100;
    }

    function _setTokenRoyalty(
        uint256 id,
        address recipient,
        uint256 value
    ) internal {
        require(value <= maxRoyalty, "Royalties Too high");

        royalties[id] = RoyaltyInfo(recipient, uint24(value));
    }
}
