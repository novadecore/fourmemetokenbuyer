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

const buyTokenAMAPAbi = [
  "function buyTokenAMAP(address token, uint256 funds, uint256 minAmount) payable"
];

const purchaseTokenAMAPAbi =[
  "function purchaseTokenAMAP(address token, uint256 funds, uint256 minAmount) payable"
];


const sellAbi = [
  "function sellToken(address token, uint256 amount)"
];

const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)"
];

const minimalErc20Abi = [
  "function decimals() view returns (uint8)"
];

export default function Page() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState([{ key: "", selected: true }]);
  const [status, setStatus] = useState("Ready");
  const [mode, setMode] = useState("buy");
  const [payToken, setPayToken] = useState("BNB"); // 新增币种选择

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

    if (!ethers.isAddress(tokenAddress)) {
      throw new Error("无效的 Token 地址");
    }

    if (amount.trim() === "" || isNaN(amount) || parseFloat(amount) <= 0) {
      throw new Error("请输入有效的购买数量");
    }
    
    setStatus("Processing...");

      //处理rpc通道
    try {
      const url = process.env.NEXT_PUBLIC_RPC_URL;
      if (!url) throw new Error("Missing RPC URL in .env.local");
      const provider = new ethers.JsonRpcProvider(url);
      const helperAddress = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034";
      const helper = new ethers.Contract(helperAddress, helperAbi, provider);

      //选择gas参数
      const gasOptions = {
        gasPrice: ethers.parseUnits("0.5", "gwei"),
        gasLimit: 300000,
      };

      //选择钱包，如果没有选择钱包则报错
      for (const wallet of wallets) {
        if (!wallet.selected || !wallet.key) continue;
        const signer = new ethers.Wallet(wallet.key, provider);

        //买
        if (mode === "buy") {
          let tokenManager;
          let valueToSend;
          let amountFunds;
          let tokenAmount;

          if (payToken === "BNB") {
            // 直接按BNB购买
            tokenAmount = ethers.parseUnits(amount, 18);
            const buffer = tokenAmount / 10n; // 10% 余量
            amountFunds = tokenAmount;
            valueToSend = tokenAmount + buffer;

            const info = await helper.getTokenInfo(tokenAddress);
            const version = Number(info.version);
            const tokenManager = info.tokenManager;

            const useAMAP = version === 2;

            //是v2版本的代币，使用buyAMAPAbi购买
            if (useAMAP) {
              const contract = new ethers.Contract(tokenManager, buyTokenAMAPAbi, signer);
              const tx = await contract.buyTokenAMAP(
                tokenAddress,
                amountFunds,
                1n,
                {
                  value: valueToSend,
                  ...gasOptions
                }
              );
              await tx.wait();
            //不是v2版本的代币，使用purchaseTokenAMAPAbi购买
            } else {
              const contract = new ethers.Contract(tokenManager, purchaseTokenAMAPAbi, signer);
              const tx = await contract.purchaseTokenAMAP(
                tokenAddress,
                amountFunds,
                1n,
                {
                  value: valueToSend,
                  ...gasOptions
                }
              );
              await tx.wait();
            }

          } else {
            // 使用目标币购买（非bnb）
            const tokenContract = new ethers.Contract(tokenAddress, minimalErc20Abi, provider);
            const decimals = await tokenContract.decimals();
            tokenAmount = ethers.parseUnits(amount, decimals);
            const tryResult = await helper.tryBuy(tokenAddress, tokenAmount, 0);
            if (tryResult.amountFunds === 0n && tryResult.amountMsgValue === 0n) {
              throw new Error("trybuy接口故障,无法预测该代币购买金额及数量");
            }
            tokenManager = tryResult.tokenManager;
            valueToSend = tryResult.amountMsgValue;
            amountFunds = tryResult.amountFunds;
            const buyContract = new ethers.Contract(tokenManager, buyAbi, signer);
            const tx = await buyContract.buyToken(
              tokenAddress,
              tokenAmount,
              amountFunds,
              { 
                value: valueToSend, 
                ...gasOptions
              }
            );
            await tx.wait();
          }
        } else {
          // 卖出
          const tokenAmount = ethers.parseUnits(amount, 18);
          const tryResult = await helper.trySell(tokenAddress, tokenAmount);
          const tokenManager = tryResult.tokenManager;

          const token = new ethers.Contract(tokenAddress, erc20Abi, signer);
          const approveTx = await token.approve(
            tokenManager, 
            tokenAmount, 
            {
            gasPrice: ethers.parseUnits("0.5", "gwei"),
            gasLimit: 60000,
            }
          );
          await approveTx.wait();

          const sellContract = new ethers.Contract(tokenManager, sellAbi, signer);
          const tx = await sellContract.sellToken(tokenAddress, tokenAmount, gasOptions);
          await tx.wait();
        }
      }

      setStatus("✅ Completed");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error: " + err.message);
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
            >购买</button>
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

            <div className={classes.amountWrapper}>
              <select
                className={classes.dropdown}
                value={payToken}
                onChange={(e) => setPayToken(e.target.value)}
              >
                <option value="BNB">BNB</option>
                <option value="Token">目标代币</option>
              </select>

              <input
                className={classes.input}
                placeholder={payToken === "BNB" ? "BNB 数量" : "Token 数量"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

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
