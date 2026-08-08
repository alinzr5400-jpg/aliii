import { TonConnectButton, useTonWallet } from "@tonconnect/ui-react";
import { useEffect, useState } from "react";

const API = "https://alamdar-backend1.onrender.com";

function App() {
  const wallet = useTonWallet();
  const [sale, setSale] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/sale`)
      .then((res) => res.json())
      .then((data) => setSale(data))
      .catch((err) => console.log(err));
  }, []);

  return (
    <div
      style={{
        padding: 30,
        color: "white",
        background: "#111",
        minHeight: "100vh",
      }}
    >
      <h1>ALAMDAR NFT</h1>

      <TonConnectButton />

      <br />
      <br />

      <h2>Sale Info</h2>

      {sale ? (
        <pre>
          {JSON.stringify(sale, null, 2)}
        </pre>
      ) : (
        "Loading backend..."
      )}

      <h2>Wallet</h2>

      <pre>
        {wallet
          ? JSON.stringify(wallet.account, null, 2)
          : "Wallet not connected"}
      </pre>
    </div>
  );
}

export default App;