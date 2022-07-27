// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITokenRoyaltiesUpgradeable {
    function royaltyInfo(uint256 id, uint256 value)
        external
        view
        returns (address receiver, uint256 royaltyAmount);
}
