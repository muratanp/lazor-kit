import {
    BaseWalletAdapter,
    WalletName,
    WalletReadyState,
    WalletDisconnectedError,
    WalletSignTransactionError,
    WalletWindowClosedError,
    SendTransactionOptions,
} from '@solana/wallet-adapter-base';
import {
    PublicKey,
    Transaction,
    VersionedTransaction,
    Connection,
    TransactionInstruction,
    TransactionSignature,
    // MessageAddressTableLookup,
} from '@solana/web3.js';

import { DialogManager, DialogResult, SignResult } from '../portal';
import { StorageManager, WalletInfo } from '../storage';
import { KoraClient } from '@solana/kora';
import {
    LazorkitClient,
    asCredentialHash,
    asPasskeyPublicKey,
    SmartWalletAction,
    getBlockchainTimestamp,
    CredentialHash
} from '../contract';
import { getCredentialHash, getPasskeyPublicKey } from '../wallet/utils';
import * as anchor from '@coral-xyz/anchor';
import { Buffer } from 'buffer';


// ============================================================================
// Constants & Config
// ============================================================================

export const LazorkitWalletName = 'Lazorkit Wallet' as WalletName<'Lazorkit Wallet'>;

export const DEFAULT_CONFIG = {
    rpcUrl: 'https://api.devnet.solana.com',
    portalUrl: 'https://portal.lazorkit.com',
    paymasterConfig: {
        paymasterUrl: 'https://kora.devnet.lazorkit.com',
        apiKey: ''
    },
};

export interface LazorkitSendTransactionOptions extends SendTransactionOptions {
    extraInstructions?: TransactionInstruction[];
}

// ============================================================================
// Adapter Implementation
// ============================================================================

export class LazorkitWalletAdapter extends BaseWalletAdapter {
    name: WalletName<'Lazorkit Wallet'> = LazorkitWalletName;
    url = 'https://lazorkit.com';
    icon = 'data:image/jpeg;base64,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'
    supportedTransactionVersions: ReadonlySet<any> = new Set(['legacy', 0]);

    private _publicKey: PublicKey | null = null;
    private _readyState: WalletReadyState =
        typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.Installed;
    private _connecting: boolean = false;
    private _wallet: WalletInfo | null = null;
    private _config = DEFAULT_CONFIG;

    constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
        super();
        if (config) {
            this._config = { ...this._config, ...config };
        }
    }

    get publicKey(): PublicKey | null {
        return this._publicKey;
    }

    get connecting(): boolean {
        return this._connecting;
    }

    get readyState(): WalletReadyState {
        return this._readyState;
    }

    async connect(): Promise<void> {
        try {
            if (this.connected || this.connecting) return;
            if (this._readyState !== WalletReadyState.Installed) throw new WalletWindowClosedError();

            this._connecting = true;
            this.emit('readyStateChange', this._readyState);

            // Check storage first
            const existingWallet = await StorageManager.getWallet();
            if (existingWallet) {
                this._updateWalletState(existingWallet);
                return;
            }

            // Initialize dialog manager
            const dialogManager = this._createDialogManager();

            try {
                const dialogResult: DialogResult = await dialogManager.openConnect();
                const walletInfo = await this._ensureWalletOnChain(dialogResult);

                await StorageManager.saveWallet(walletInfo);
                this._updateWalletState(walletInfo);

            } finally {
                dialogManager.destroy();
            }

        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    private _updateWalletState(wallet: WalletInfo) {
        this._wallet = wallet;
        this._publicKey = new PublicKey(wallet.smartWallet);
        this.emit('connect', this._publicKey);
    }

    private _createDialogManager(): DialogManager {
        return new DialogManager({
            portalUrl: this._config.portalUrl,
            rpcUrl: this._config.rpcUrl,
            paymasterUrl: this._config.paymasterConfig.paymasterUrl,
        });
    }

    private async _ensureWalletOnChain(dialogResult: DialogResult): Promise<WalletInfo> {
        const connection = new Connection(this._config.rpcUrl);
        const paymaster = new KoraClient({
            rpcUrl: this._config.paymasterConfig.paymasterUrl,
            apiKey: this._config.paymasterConfig.apiKey,
        });
        const smartWallet = new LazorkitClient(connection);

        const credentialHash = asCredentialHash(getCredentialHash(dialogResult.credentialId));
        const smartWalletData = await smartWallet.getSmartWalletByCredentialHash(credentialHash);

        let smartWalletAddress: string;
        let passkeyPubkey: string;

        if (!dialogResult.publicKey && smartWalletData) {
            passkeyPubkey = Buffer.from(smartWalletData.passkeyPubkey).toString('base64');
            localStorage.setItem('PUBLIC_KEY', passkeyPubkey);
        } else {
            passkeyPubkey = dialogResult.publicKey;
        }

        if (smartWalletData) {
            smartWalletAddress = smartWalletData.smartWallet.toBase58();
        } else {
            const feePayer = await paymaster.getPayerSigner();
            const initSmartWalletTxn = await smartWallet.createSmartWalletTxn({
                passkeyPublicKey: asPasskeyPublicKey(getPasskeyPublicKey(dialogResult.publicKey)),
                payer: new anchor.web3.PublicKey(feePayer.signer_address),
                credentialIdBase64: dialogResult.credentialId,
            });

            await paymaster.signAndSendTransaction({
                transaction: Buffer.from(initSmartWalletTxn.transaction.serialize({ requireAllSignatures: false })).toString('base64'),
                signer_key: feePayer.signer_address,
            });
            smartWalletAddress = initSmartWalletTxn.smartWallet.toBase58();
        }

        return {
            credentialId: dialogResult.credentialId,
            passkeyPubkey: getPasskeyPublicKey(passkeyPubkey),
            expo: 'web',
            platform: navigator.platform,
            smartWallet: smartWalletAddress,
            walletDevice: '',
        };
    }

    async disconnect(): Promise<void> {
        await StorageManager.clearWallet();
        this._wallet = null;
        this._publicKey = null;
        this.emit('disconnect');
    }

    async sendTransaction(
        transaction: Transaction | VersionedTransaction,
    ): Promise<TransactionSignature> {
        try {
            if (!this._wallet || !this._publicKey) throw new WalletDisconnectedError();

            const instructions = this._prepareInstructions(transaction);
            if (instructions.length === 0) throw new WalletSignTransactionError('No instructions to sign');

            const clients = this._initializeClients();
            const feePayer = await clients.paymaster.getPayerSigner();
            const timestamp = await getBlockchainTimestamp(clients.connection);
            const credentialHash = asCredentialHash(getCredentialHash(this._wallet.credentialId));

            const message = await this._buildAuthorizationMessage(
                clients.smartWallet,
                instructions,
                feePayer.signer_address,
                timestamp,
                credentialHash
            );

            const latest = await clients.connection.getLatestBlockhash();
            const signResult = await this._signWithDialog(message, instructions, latest.blockhash, feePayer.signer_address);

            return await this._executeSmartWalletTransaction(
                clients,
                instructions,
                signResult,
                feePayer.signer_address,
                timestamp,
                credentialHash
            );

        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signTransaction<T extends Transaction | VersionedTransaction>(_transaction: T): Promise<T> {
        throw new WalletSignTransactionError('Lazorkit Wallet does not support signTransaction. Please use sendTransaction or signAndSendTransaction.');
    }

    async signAllTransactions<T extends Transaction | VersionedTransaction>(_transactions: T[]): Promise<T[]> {
        throw new WalletSignTransactionError('Lazorkit Wallet does not support signAllTransactions. Please use sendTransaction or signAndSendTransaction.');
    }

    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        try {
            if (!this._wallet || !this._publicKey) throw new WalletDisconnectedError();

            const clients = this._initializeClients();
            const latest = await clients.connection.getLatestBlockhash();

            const signResult = await this._signWithDialog(message, [], latest.blockhash, this._publicKey.toBase58());
            return new Uint8Array(Buffer.from(signResult.signature, 'base64'));

        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _initializeClients() {
        const connection = new Connection(this._config.rpcUrl);
        const paymaster = new KoraClient({
            rpcUrl: this._config.paymasterConfig.paymasterUrl,
            apiKey: this._config.paymasterConfig.apiKey,
        });
        const smartWallet = new LazorkitClient(connection);
        return { connection, paymaster, smartWallet };
    }

    private _prepareInstructions(transaction: Transaction | VersionedTransaction): TransactionInstruction[] {
        if ('version' in transaction) {
            return transaction.message.compiledInstructions.map((ix) => {
                return new TransactionInstruction({
                    keys: ix.accountKeyIndexes.map((keyIndex) => {
                        return {
                            pubkey: transaction.message.staticAccountKeys[keyIndex],
                            isSigner: transaction.message.isAccountSigner(keyIndex),
                            isWritable: transaction.message.isAccountWritable(keyIndex),
                        };
                    }),
                    programId: new PublicKey(transaction.message.staticAccountKeys[ix.programIdIndex]),
                    data: Buffer.from(ix.data),
                });
            });
        } else {
            return [...transaction.instructions];
        }
    }

    private async _buildAuthorizationMessage(
        smartWallet: LazorkitClient,
        instructions: TransactionInstruction[],
        feePayerAddress: string,
        timestamp: number,
        credentialHash: CredentialHash
    ): Promise<Uint8Array> {
        return await smartWallet.buildAuthorizationMessage({
            action: {
                type: SmartWalletAction.CreateChunk,
                args: {
                    policyInstruction: null,
                    cpiInstructions: instructions,
                },
            },
            payer: new anchor.web3.PublicKey(feePayerAddress),
            smartWallet: this._publicKey!,
            passkeyPublicKey: this._wallet!.passkeyPubkey,
            timestamp: new anchor.BN(timestamp),
            credentialHash: credentialHash,
        });
    }

    private async _signWithDialog(
        message: Uint8Array,
        instructions: TransactionInstruction[],
        recentBlockhash: string,
        payerKey: string
    ): Promise<SignResult> {
        const messageBase64 = Buffer.from(message).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, ''); // Fix base64url padding

        const dialogManager = this._createDialogManager();
        try {
            const messageV0 = new anchor.web3.TransactionMessage({
                payerKey: new anchor.web3.PublicKey(payerKey),
                recentBlockhash: recentBlockhash,
                instructions: instructions,
            }).compileToV0Message();

            const transaction = new anchor.web3.VersionedTransaction(messageV0);
            const base64Tx = Buffer.from(transaction.serialize()).toString("base64");

            return await dialogManager.openSign(messageBase64, base64Tx, this._wallet!.credentialId);
        } finally {
            dialogManager.destroy();
        }
    }

    private async _executeSmartWalletTransaction(
        clients: { paymaster: KoraClient, smartWallet: LazorkitClient },
        instructions: TransactionInstruction[],
        signResult: SignResult,
        feePayerAddress: string,
        timestamp: number,
        credentialHash: CredentialHash
    ): Promise<TransactionSignature> {
        const createDeferredExecutionTxn = await clients.smartWallet.createChunkTxn({
            payer: new anchor.web3.PublicKey(feePayerAddress),
            smartWallet: this._publicKey!,
            passkeySignature: {
                passkeyPublicKey: asPasskeyPublicKey(this._wallet!.passkeyPubkey),
                signature64: signResult.signature,
                clientDataJsonRaw64: signResult.clientDataJsonBase64,
                authenticatorDataRaw64: signResult.authenticatorDataBase64,
            },
            policyInstruction: null,
            cpiInstructions: instructions,
            timestamp,
            credentialHash,
        }, { useVersionedTransaction: true });

        await clients.paymaster.signAndSendTransaction({
            transaction: Buffer.from((createDeferredExecutionTxn as VersionedTransaction).serialize()).toString('base64'),
            signer_key: feePayerAddress,
        });

        const executeDeferredTransactionTxn = await clients.smartWallet.executeChunkTxn(
            {
                payer: new anchor.web3.PublicKey(feePayerAddress),
                smartWallet: this._publicKey!,
                cpiInstructions: instructions,
            },
            { useVersionedTransaction: true }
        );

        const signature = (await clients.paymaster.signAndSendTransaction({
            transaction: Buffer.from((executeDeferredTransactionTxn as VersionedTransaction).serialize()).toString('base64'),
            signer_key: feePayerAddress,
        })) as any;

        return signature.signature;
    }
}

// ============================================================================
// Wallet Standard Implementation
// ============================================================================
