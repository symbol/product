// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {Script, console} from "forge-std/Script.sol";
import {FiatTokenV2_2 as WrappedToken} from "stablecoin-evm/contracts/v2/FiatTokenV2_2.sol";

// initialize a wrapped token with environment values
// sender: owner
contract InitializeScript is Script {
	WrappedToken public token;

	function setUp() public
	{}

	function run() public {
		string memory nativeToken = vm.envString("NATIVE_TOKEN");
		string memory tokenName = string(abi.encodePacked("wrapped", nativeToken));
		string memory tokenSymbol = string(abi.encodePacked("w", nativeToken));
		string memory tokenCurrency = nativeToken;
		uint8 tokenDecimals = 6;

		console.log("    token name: ", tokenName);
		console.log("  token symbol: ", tokenSymbol);
		console.log("token currency: ", tokenCurrency);
		console.log("token decimals: ", uint256(tokenDecimals));

		address proxyAddress = vm.envAddress("PROXY_ADDRESS");
		address masterMinter = vm.envAddress("MASTER_MINTER_ADDRESS");
		address pauser = vm.envAddress("PAUSER_ADDRESS");
		address blacklister = vm.envAddress("BLACKLISTER_ADDRESS");
		address owner = vm.envAddress("OWNER_ADDRESS");

		vm.startBroadcast();

		token = WrappedToken(vm.envAddress("PROXY_ADDRESS"));
		token.initialize(tokenName, tokenSymbol, tokenCurrency, tokenDecimals, masterMinter, pauser, blacklister, owner);

		vm.stopBroadcast();
	}
}
