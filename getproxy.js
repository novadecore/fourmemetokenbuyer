import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const proxy = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034";
const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function main() {
  const data = await provider.send("eth_getStorageAt", [proxy, slot, "latest"]);
  const impl = ethers.getAddress("0x" + data.slice(-40));
  console.log("Implementation (Logic) address:", impl);
}

main();
