"use client";

import { useState } from "react";
import { ethers } from "ethers";
import classes from "./page.module.css";

export default function Page() {
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState([{ key: "", selected: true }]);
  const [status, setStatus] = useState("Ready");
  const [mode, setMode] = useState("buy"); // "buy" or "sell"

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
      const buyAbi = [
        "function buyToken(address token, uint256 amount, uint256 maxFunds) payable",
      ];
      const sellAbi = ["function sellToken(address token, uint256 amount)"];

      for (const wallet of wallets) {
        if (!wallet.selected || !wallet.key) continue;

        const provider = new ethers.JsonRpcProvider(
          "https://bsc-dataseed.binance.org/"
        );
        const signer = new ethers.Wallet(wallet.key, provider);

        const abi = mode === "buy" ? buyAbi : sellAbi;
        const contract = new ethers.Contract(
          "0x5c952063c7fc8610FFDB798152D69F0B9550762b",
          abi,
          signer
        );

        if (mode === "buy") {
          const tokenAmount = ethers.parseUnits(amount, 18);
          const maxBNB = ethers.parseUnits("100", "ether");
          const tx = await contract.buyToken(
            tokenAddress,
            tokenAmount,
            maxBNB,
            {
              value: maxBNB,
            }
          );
          await tx.wait();
        } else {
          const tx = await contract.sellToken(
            tokenAddress,
            ethers.parseUnits(amount, 18)
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
