"use client";

import { useState } from "react";
import { ethers } from "ethers";
import classes from "./page.module.css";

const helperAbi = [
  "function tryBuy(address token, uint256 amount, uint256 funds) view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)",
  "function trySell(address token, uint256 amount) view returns (address tokenManager, address quote, uint256 funds, uint256 fee)",
  "function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)"
];

const buyAbi = [
  "function buyToken(address token, uint256 amount, uint256 maxFunds) payable"
];

const sellAbi = [
  "function sellToken(address token, uint256 amount)"
];

const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)"
];

export default function Page() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState([{ key: "", selected: true }]);
  const [status, setStatus] = useState("Ready");
  const [mode, setMode] = useState("buy");

  const handleWalletKeyChange = (index, value) => {
    const updated = [...wallets];
    updated[index].key = value;
    setWallets(updated);
  };

  const handleWalletToggle = (index) => {
    const updated = [...wallets];
    updated[index].selected = !updated[index].selected;
    setWallets(updated);
  };

  const addWallet = () => {
    setWallets([...wallets, { key: "", selected: true }]);
  };

  const execute = async () => {
    setStatus("Processing...");
    try {
      const url = process.env.NEXT_PUBLIC_RPC_URL;
      console.log("RPC URL from env:", process.env.NEXT_PUBLIC_RPC_URL);
      if (!url) {
        throw new Error("Missing RPC URL in .env.local");
      }

      const provider = new ethers.JsonRpcProvider(url);
      const helperAddress = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034";
      const helper = new ethers.Contract(helperAddress, helperAbi, provider);

      const tokenAmount = ethers.parseUnits(amount, 18);


      // 全局 gas 参数
      const gasOptions = {
        gasPrice: ethers.parseUnits("0.5", "gwei"),
        gasLimit: 300000,
      };

      for (const wallet of wallets) {
        if (!wallet.selected || !wallet.key) continue;

        const signer = new ethers.Wallet(wallet.key, provider);

        if (mode === "buy") {
          const tryResult = await helper.tryBuy(tokenAddress, tokenAmount, 0);
          console.log("tryBuy result:", tryResult);
          const info = await helper.getTokenInfo(tokenAddress);
          console.log("getTokenInfo =>", info);

          const tokenManager = tryResult.tokenManager;
          const amountMsgValue = tryResult.amountMsgValue;
          const amountFunds = tryResult.amountFunds;

          if (
            tryResult.amountFunds === 0n ||
            tryResult.amountMsgValue === 0n
          ) {
            throw new Error("无法买入该代币，可能无流动性或不是内盘交易支持的目标。");
          }

          const buyContract = new ethers.Contract(tokenManager, buyAbi, signer);
          const tx = await buyContract.buyToken(
            tokenAddress,
            tokenAmount,
            amountFunds,
            {
              value: amountMsgValue,
              ...gasOptions 
            }
          );
          await tx.wait();
        } else {
          const tryResult = await helper.trySell(tokenAddress, tokenAmount);
          const tokenManager = tryResult.tokenManager;

          // approve first
          const token = new ethers.Contract(tokenAddress, erc20Abi, signer);
          const approveTx = await token.approve(
            tokenManager, 
            tokenAmount, 
            {
              gasPrice: ethers.parseUnits("0.5", "gwei"),
              gasLimit: 60000
            }
          );
          await approveTx.wait();

          // then sell
          const sellContract = new ethers.Contract(tokenManager, sellAbi, signer);
          const tx = await sellContract.sellToken(
            tokenAddress, 
            tokenAmount, 
            gasOptions
          );
          await tx.wait();
        }
      }

      setStatus("Completed");
    } catch (err) {
      console.error(err);
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div className={classes.container}>
      <h2>🟡 Four.Meme 批量内盘买币工具</h2>

      <div className={classes.sectionWrapper}>
        <div className={classes.leftPanel}>
          <h4>1️⃣ 输入私钥并勾选：</h4>
          {wallets.map((wallet, i) => (
            <div key={i} className={classes.walletItem}>
              <label>
                <input
                  type="checkbox"
                  checked={wallet.selected}
                  onChange={() => handleWalletToggle(i)}
                />
              </label>
              <input
                className={classes.input}
                placeholder={`Private Key #${i + 1}`}
                value={wallet.key}
                onChange={(e) => handleWalletKeyChange(i, e.target.value)}
              />
            </div>
          ))}
          <button className={classes.button} onClick={addWallet}>➕ 添加钱包</button>
        </div>

        <div className={classes.rightPanel}>
          <div className={classes.tabHeader}>
            <button
              className={mode === "buy" ? classes.activeTab : classes.tab}
              onClick={() => setMode("buy")}
            >买入</button>
            <button
              className={mode === "sell" ? classes.activeTab : classes.tab}
              onClick={() => setMode("sell")}
            >卖出</button>
          </div>

          <div className={classes.tabContent}>
            <input
              className={classes.input}
              placeholder="Token Address"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
            />
            <input
              className={classes.input}
              placeholder="Token 数量"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button className={classes.button} onClick={execute}>
              🚀 执行{mode === "buy" ? "买入" : "卖出"}
            </button>
          </div>
        </div>
      </div>

      <p className={classes.status}>状态：{status}</p>
    </div>
  );
}
