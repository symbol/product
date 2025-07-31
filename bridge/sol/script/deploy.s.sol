// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {Script, console} from "forge-std/Script.sol";
import {FiatTokenV2_2 as WrappedToken} from "stablecoin-evm/contracts/v2/FiatTokenV2_2.sol";
import {FiatTokenProxy as WrappedTokenProxy} from "stablecoin-evm/contracts/v1/FiatTokenProxy.sol";

// deploys (an uninitialized) wrapped token contract and proxy contract
// sender: deployer/admin
contract DeployScript is Script {
	WrappedTokenProxy public proxy;
	WrappedToken public token;

	function setUp() public
	{}

	function run() public {
		vm.startBroadcast();

		token = new WrappedToken();
		proxy = new WrappedTokenProxy(address(token));

		vm.stopBroadcast();

		console.log("wrapped token deployed at: ", address(token));
		console.log("        proxy deployed at: ", address(proxy));
	}
}
