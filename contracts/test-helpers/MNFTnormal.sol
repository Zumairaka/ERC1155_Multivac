// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MNFTnormal is ERC1155("") {
    function mint(uint256 id_, uint256 amount_) external {
        _mint(msg.sender, id_, amount_, "");
    }
}