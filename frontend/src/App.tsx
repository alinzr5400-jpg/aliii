import { TonConnectButton, useTonWallet } from "@tonconnect/ui-react";

function App() {
  const wallet = useTonWallet();

  return (
    <div
      style={{
        padding: 30,
        color: "white",
        background: "#111",
        minHeight: "100vh",
      }}
    >
      <h1>ALAMDAR</h1>

      <TonConnectButton />

      <br />
      <br />

      <pre>
        {wallet
          ? JSON.stringify(wallet.account, null, 2)
          : "Wallet not connected"}
      </pre>
    </div>
  );
}

export default App;