// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {Script, console} from "forge-std/Script.sol";
import {FiatTokenV2_2 as WrappedToken} from "stablecoin-evm/contracts/v2/FiatTokenV2_2.sol";

// delegates minting to a minter
// sender: master-minter
contract MintScript is Script {
	WrappedToken public token;

	function setUp() public
	{}

	function run() public {
		vm.startBroadcast();

		token = WrappedToken(vm.envAddress("PROXY_ADDRESS"));
		token.configureMinter(vm.envAddress("MINTER_ADDRESS"), 100000 * 1000000);

		vm.stopBroadcast();
	}
}
