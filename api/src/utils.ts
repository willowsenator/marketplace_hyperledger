import { ConnectOptions, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import * as grpc from '@grpc/grpc-js';
import * as crypto from 'crypto';

export async function createGrpcConnection(peerEndpoint: string, rootCert: Buffer): Promise<grpc.Client> {
    const tlsCredentials = grpc.credentials.createSsl(rootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {});
}


export async function newConnectionOptions(
    client: grpc.Client,
    mspId: string,
    credentials: Uint8Array,
    privateKeyPem: string
): Promise<ConnectOptions> {
    return {
        client,
        identity: await newIdentity(mspId, credentials),
        signer: await newSigner(privateKeyPem),
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 };
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 };
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 };
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 };
        }
    };
}

export async function newIdentity(mspId: string, credentials: Uint8Array): Promise<Identity> {
    return {
        mspId,
        credentials
    };
}

export async function newSigner(privateKeyPem: string): Promise<Signer> {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

