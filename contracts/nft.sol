// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "evm-gateway-contract/contracts/ICrossTalkApplication.sol";
import "evm-gateway-contract/contracts/Utils.sol";
import "@routerprotocol/router-crosstalk-utils/contracts/CrossTalkUtils.sol";

contract NFT is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ICrossTalkApplication
{
    event SendNFTCrossChain(
        address from,
        address to,
        string dstId,
        uint256 tokenId
    );

    event NFTReceivedFromChain(
        address from,
        address to,
        string _srcChainId,
        uint256 tokenId
    );

    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    address public gatewayContract;
    uint64 public destGasLimit;
    mapping(uint64 => mapping(string => bytes)) public ourContractOnChains;

    function initialize(
        address payable gatewayAddress,
        uint64 _destGasLimit
    ) public initializer {
        gatewayContract = gatewayAddress;
        destGasLimit = _destGasLimit;

        __ERC721_init("NFT", "SNFT");
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _safeMint(address to, string memory uri) internal {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function safeMint(address to, string memory uri) public payable {
        require(msg.value >= 1 wei, "1 wei required to mint");

        _safeMint(to, uri);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    // The following functions are overrides required by Solidity.

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function setContractOnChain(
        uint64 chainType,
        string memory chainId,
        address contractAddress
    ) external onlyOwner {
        ourContractOnChains[chainType][chainId] = toBytes(contractAddress);
    }

    function transferNFTCrossChain(
        uint64 _dstChainType,
        string memory _dstChainId, // it can be uint, why it is string?
        uint64 expiryDurationInSeconds,
        uint64 destGasPrice,
        address to,
        uint256 tokenId
    ) public payable {
        require(
            address(this).balance > 0,
            "the balance of this contract is 0. pls send gas for message fees"
        );

        bytes memory payload = abi.encode(
            tokenId,
            tokenURI(tokenId),
            to,
            msg.sender
        );

        uint64 expiryTimestamp = uint64(block.timestamp) +
            expiryDurationInSeconds;
        Utils.DestinationChainParams memory destChainParams = Utils
            .DestinationChainParams(
                destGasLimit,
                destGasPrice,
                _dstChainType,
                _dstChainId
            );

        // burn the nft on src chain
        _burn(tokenId);
        CrossTalkUtils.singleRequestWithoutAcknowledgement(
            gatewayContract,
            expiryTimestamp,
            destChainParams,
            ourContractOnChains[_dstChainType][_dstChainId], // destination contract address
            payload
        );

        emit SendNFTCrossChain(msg.sender, to, _dstChainId, tokenId);
    }

    // mint nft to receipent user
    function handleRequestFromSource(
        bytes memory srcContractAddress,
        bytes memory payload,
        string memory srcChainId,
        uint64 srcChainType
    ) external returns (bytes memory) {
        require(msg.sender == gatewayContract);
        require(
            keccak256(srcContractAddress) ==
                keccak256(ourContractOnChains[srcChainType][srcChainId])
        );
        (
            uint256 tokenId,
            string memory tokenUri,
            address to,
            address from
        ) = abi.decode(payload, (uint256, string, address, address));

        _safeMint(to, tokenUri);
        emit NFTReceivedFromChain(from, to, srcChainId, tokenId);
        return abi.encode(srcChainId, srcChainType);
    }

    function toBytes(address a) public pure returns (bytes memory b) {
        assembly {
            let m := mload(0x40)
            a := and(a, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            mstore(
                add(m, 20),
                xor(0x140000000000000000000000000000000000000000, a)
            )
            mstore(0x40, add(m, 52))
            b := m
        }
    }

    // without any ack
    function handleCrossTalkAck(
        uint64, // eventIdentifier
        bool[] memory, // execFlags
        bytes[] memory // execData
    ) external {}

    receive() external payable {}
}
