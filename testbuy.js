import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ethers } from "ethers"

export default function BulkTokenBuyer() {
  const [tokenAddress, setTokenAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [wallets, setWallets] = useState([""])
  const [status, setStatus] = useState("Ready")

  const handleWalletChange = (index, value) => {
    const updated = [...wallets]
    updated[index] = value
    setWallets(updated)
  }

  const addWallet = () => {
    setWallets([...wallets, ""])
  }

  const buyToken = async () => {
    setStatus("Processing...")
    try {
      const abi = [
        "function buyToken(address token, uint256 amount, uint256 maxFunds) payable"
      ]
      for (const privateKey of wallets) {
        if (!privateKey) continue
        const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/")
        const signer = new ethers.Wallet(privateKey, provider)
        const contract = new ethers.Contract("0x5c952063c7fc8610FFDB798152D69F0B9550762b", abi, signer)
        const tx = await contract.buyToken(tokenAddress, ethers.parseUnits(amount, 18), ethers.parseUnits("0.1", "ether"), {
          value: ethers.parseUnits("0.1", "ether")
        })
        await tx.wait()
      }
      setStatus("Completed")
    } catch (err) {
      console.error(err)
      setStatus("Error: " + err.message)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Bulk Token Buyer (Four.meme)</h1>
      <Card>
        <CardContent className="space-y-2 p-4">
          <Input placeholder="Token Address" value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} />
          <Input placeholder="Token Amount" value={amount} onChange={e => setAmount(e.target.value)} />
          {wallets.map((w, i) => (
            <Input key={i} placeholder={`Private Key #${i + 1}`} value={w} onChange={e => handleWalletChange(i, e.target.value)} />
          ))}
          <Button onClick={addWallet}>Add Wallet</Button>
          <Button onClick={buyToken}>Buy Token</Button>
          <div>Status: {status}</div>
        </CardContent>
      </Card>
    </div>
  )
}