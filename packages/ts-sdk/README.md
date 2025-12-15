# LazorKit React SDK

LazorKit is the standard for WebAuthn smart wallets on Solana.

## Why LazorKit?
- **Better UX**: Passkey authentication replaces seed phrases
- **Gasless**: Built-in paymaster integration
- **Auto-Reconnect**: Seamless session persistence
- **Secure**: Smart wallet architecture

## Installation

```bash
npm install @lazorkit/wallet @coral-xyz/anchor @solana/web3.js
```

## Usage

```tsx
import { LazorkitProvider, useWallet } from '@lazorkit/wallet';
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

// 1. Wrap App with Provider
export const App = () => (
  <LazorkitProvider
    rpcUrl={process.env.LAZORKIT_RPC_URL}
    portalUrl={process.env.LAZORKIT_PORTAL_URL}
    paymasterConfig={{ paymasterUrl: process.env.LAZORKIT_PAYMASTER_URL }}
  >
    <WalletContent />
  </LazorkitProvider>
);

// 2. Use Hook
function WalletContent() {
  const { connect, signAndSendTransaction, isConnected } = useWallet();

  const handleTx = async () => {
    // Connect (Auto-reconnects)
    if (!isConnected) await connect();

    // Sign and Send
    const sig = await signAndSendTransaction({
      instructions: [
        SystemProgram.transfer({
          fromPubkey: smartWalletPubkey,
          toPubkey: new PublicKey('RECIPIENT'),
          lamports: LAMPORTS_PER_SOL * 0.1
        })
      ],
      transactionOptions: { feeToken: 'USDC' }
    });
    
    console.log("Tx:", sig);
  };

  return <button onClick={handleTx}>Execute Transaction</button>;
}
```

## API Reference

### `useWallet()`

#### `connect()`

Connects to the wallet. Auto-reconnects if session exists.

**Returns**
`Promise<WalletAccount>`

#### `disconnect()`

Disconnects the wallet.

**Returns** 
`Promise<void>`

#### `signMessage(message)`

Signs a message string key.

**Parameters**

| Param | Type | Description |
|---|---|---|
| `message` | `string` | Message content |

**Returns**
`Promise<{ signature: string, signedPayload: string }>`

#### `signAndSendTransaction(payload)`

Signs and sends transaction via Paymaster.

**Parameters**

| Param | Type | Description |
|---|---|---|
| `payload.instructions` | `TransactionInstruction[]` | Instructions |
| `payload.transactionOptions` | `object` | Optional config |
| `...addressLookupTableAccounts` | `AddressLookupTableAccount[]` | Address Lookup Tables |
| `...feeToken` | `string` | Fee token mint |
| `...computeUnitLimit` | `number` | Compute unit limit |

**Returns**
`Promise<string>` - Transaction signature.
