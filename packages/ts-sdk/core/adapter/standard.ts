import {
    Wallet,
    WalletAccount,
} from '@wallet-standard/base';
import {
    StandardConnectFeature,
    StandardDisconnectFeature,
    StandardEventsFeature,
} from '@wallet-standard/features';
import {
    SolanaSignMessageFeature,
    SolanaSignTransactionFeature,
    SolanaSignAndSendTransactionFeature,
} from '@solana/wallet-standard-features';
import {
    registerWallet,
} from '@wallet-standard/wallet';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { LazorkitWalletAdapter, LazorkitWalletName, DEFAULT_CONFIG } from './adapter';

export function registerLazorkitWallet(config?: Partial<typeof DEFAULT_CONFIG>) {
    registerWallet(new LazorkitWalletStandard(config));
}

class LazorkitWalletStandard implements Wallet {
    readonly version = '1.0.0';
    readonly name = LazorkitWalletName;
    readonly icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI2NCIgZmlsbD0iIzAwMDAwMCIvPjwvc3ZnPg==';

    private _adapter: LazorkitWalletAdapter;
    private _account: WalletAccount | null = null;
    private _listeners: Record<string, Function[]> = {};

    constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
        this._adapter = new LazorkitWalletAdapter(config);
        this._adapter.on('connect', (publicKey: PublicKey) => {
            this._account = {
                address: publicKey.toBase58(),
                publicKey: publicKey.toBytes(),
                chains: ['solana:mainnet', 'solana:devnet', 'solana:testnet'],
                features: [
                    'solana:signAndSendTransaction',
                    'solana:signTransaction',
                    'solana:signMessage',
                ],
            };
            this._emit('change', { accounts: [this._account] });
        });
        this._adapter.on('disconnect', () => {
            this._account = null;
            this._emit('change', { accounts: [] });
        });
    }

    get accounts() {
        return this._account ? [this._account] : [];
    }

    get chains() {
        return ['solana:mainnet', 'solana:devnet', 'solana:testnet'] as const;
    }

    get features(): StandardConnectFeature &
        StandardDisconnectFeature &
        StandardEventsFeature &
        SolanaSignAndSendTransactionFeature &
        SolanaSignTransactionFeature &
        SolanaSignMessageFeature {
        return {
            'standard:connect': {
                version: '1.0.0',
                connect: async () => {
                    await this._adapter.connect();
                    return { accounts: this.accounts };
                },
            },
            'standard:disconnect': {
                version: '1.0.0',
                disconnect: async () => {
                    await this._adapter.disconnect();
                },
            },
            'standard:events': {
                version: '1.0.0',
                on: (event: any, listener: any) => {
                    this._listeners[event] = this._listeners[event] || [];
                    this._listeners[event].push(listener);
                    return () => {
                        this._listeners[event] = this._listeners[event]?.filter((l: any) => l !== listener) || [];
                    };
                },
            },
            'solana:signAndSendTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signAndSendTransaction: async (...inputs: any[]) => {
                    const results = [];
                    for (const input of inputs) {
                        const tx = VersionedTransaction.deserialize(input.transaction);
                        const signature = await this._adapter.sendTransaction(tx);
                        results.push({ signature: bs58.decode(signature) });
                    }
                    return results as any;
                },
            },
            'solana:signTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signTransaction: async (..._inputs: any[]) => {
                    // Not supported
                    throw new Error('signTransaction not supported');
                },
            },
            'solana:signMessage': {
                version: '1.0.0',
                signMessage: async (...inputs: any[]) => {
                    const results = [];
                    for (const input of inputs) {
                        const signature = await this._adapter.signMessage(input.message);
                        results.push({
                            message: input.message,
                            signature,
                            signedMessage: input.message,
                        });
                    }
                    return results as any;
                },
            },
        };
    }

    private _emit(event: string, ...args: any[]) {
        // @ts-ignore
        this._listeners[event]?.forEach((l: any) => l(...args));
    }
}
