export interface Config {
    channelName: string;
    chaincodeName: string;
    mspId: string;
    caName: string;
    hlfUser: string;
    networkConfig: string;
    port: number;
}

export const config: Config = {
    channelName: process.env.CHANNEL_NAME || "",
    chaincodeName: process.env.CHAINCODE_NAME || "",
    mspId: process.env.MSP_ID || "",
    caName: process.env.CA_NAME || "",
    hlfUser: process.env.HLF_USER || "",
    networkConfig: process.env.NETWORK_CONFIG || "",
    port: process.env.PORT ? Number(process.env.PORT) : 3000
};

export function checkConfig() {
    if (!config.channelName || config.channelName === "") {
        throw new Error("CHANNEL_NAME is not set");
    }
    if (!config.chaincodeName || config.chaincodeName === "") {
        throw new Error("CHAINCODE_NAME is not set");
    }
    if (!config.mspId || config.mspId === "") {
        throw new Error("MSP_ID is not set");
    }
    if (!config.caName || config.caName === "") {
        throw new Error("CA_NAME is not set");
    }
    if (!config.hlfUser || config.hlfUser === "") {
        throw new Error("HLF_USER is not set");
    }
    if (!config.networkConfig || config.networkConfig === "") {
        throw new Error("NETWORK_CONFIG is not set");
    }
}