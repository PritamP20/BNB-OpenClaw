const { keccak256, toHex } = require('viem');

const sig = "NormalTokenDeployed(address,address,string,string,uint256,uint256)";
console.log(`Signature: ${sig}`);
console.log(`Hash: ${keccak256(Buffer.from(sig))}`);

const sig2 = "NormalTokenDeployed(address,address,string,string,uint256,uint256)";
// Wait, I already did that.
