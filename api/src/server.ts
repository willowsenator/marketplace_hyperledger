import { connect } from '@hyperledger/fabric-gateway';
import { config, checkConfig } from "./config";
import { User } from 'fabric-common';
import express from "express";
import { Logger } from "tslog";
import * as yaml from "yaml";
import * as fs from "fs";
import * as _ from "lodash";
import FabricCAServices, { IServiceResponse } from "fabric-ca-client";
import { createGrpcConnection, newConnectionOptions } from "./utils";

const log = new Logger({ name: "product-api" });
const main = async () => {
    checkConfig();

    log.info(`Channel: ${config.channelName}`);
    log.info(`Chaincode: ${config.chaincodeName}`);
    log.info(`MSP: ${config.mspId}`);
    log.info(`CA: ${config.caName}`);
    log.info(`HLF User: ${config.hlfUser}`);
    log.info(`Network Config: ${config.networkConfig}`);
    log.info(`Port: ${config.port}`);

    const networkConfig = yaml.parse(await fs.readFileSync(config.networkConfig, "utf8"));
    const peerNames = _.get(networkConfig, `organizations.${config.mspId}.peers`);
    if (!peerNames) {
        throw new Error(`No peers found for MSP ${config.mspId}`);
    }

    const peer = networkConfig.peers[peerNames[0]];
    let peerUrl: string = _.get(peer, 'url').replace("grpcs://", "");
    let peerCACert: string = _.get(peer, 'tlsCACerts.pem');

    if (!peerUrl || !peerCACert) {
        throw new Error(`Peer URL or CA cert not found for MSP ${config.mspId}`);
    }

    const ca = networkConfig.certificateAuthorities[config.caName];
    if (!ca) {
        throw new Error(`CA not found for MSP ${config.mspId}`);
    }

    const caUrl = ca.url;
    log.info(`CA URL: ${caUrl}`);

    const fabricCAServices = new FabricCAServices(caUrl, {
        trustedRoots: [ca.tlsCACerts.pem[0]],
        verify: true
    }, ca.caName);

    const identityService = fabricCAServices.newIdentityService();
    const registrarUserResponse = await fabricCAServices.enroll({
        enrollmentID: ca.registrar.enrollId,
        enrollmentSecret: ca.registrar.enrollSecret
    });

    const registrar = User.createUser(
        ca.registrar.enrollId,
        ca.registrar.enrollSecret,
        config.mspId,
        registrarUserResponse.certificate,
        registrarUserResponse.key.toBytes()
    );

    const hlfUser = _.get(networkConfig, `organizations.${config.mspId}.users.${config.hlfUser}`);
    const userCertificate = _.get(hlfUser, 'cert.pem');
    const userKey = _.get(hlfUser, 'key.pem');

    if (!userCertificate || !userKey) {
        throw new Error(`User certificate or key not found for MSP ${config.mspId}`);
    }


    const grpcConn = await createGrpcConnection(peerUrl, Buffer.from(peerCACert));
    const connectionOptions = await newConnectionOptions(grpcConn, config.mspId, Buffer.from(userCertificate), userKey);

    const gateway = connect(connectionOptions);

    const network = await gateway.getNetwork(config.channelName);
    const contract = network.getContract(config.chaincodeName);


    const app = express();
    app.use(express.json());
    app.use((req: any, res: { header: (arg0: string, arg1: string) => void; }, next: () => void) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    const users: any = {};
    app.post("/signup", async (req, res) => {
        const { username, password } = req.body;

        let identityFound: IServiceResponse;

        try {
            identityFound = await identityService.getOne(username, registrar);
            if (identityFound) {
                res.status(400);
                res.send("Identity already taken");
                return;
            }
        } catch (err) {
            log.info(`Identity not found. registering ${username}`);

            await fabricCAServices.register({
                enrollmentID: username,
                enrollmentSecret: password,
                affiliation: "",
                maxEnrollments: -1,
                attrs: [
                ],
                role: "client"
            }, registrar);
            res.status(201);
            res.send("OK");
        }

    });

    app.post("/login", async (req, res) => {
        const { username, password } = req.body;
        const identityFound = await identityService.getOne(username, registrar);
        if (!identityFound) {
            res.status(400);
            res.send("Identity not found");
            return;
        }

        const r = await fabricCAServices.enroll({
            enrollmentID: username,
            enrollmentSecret: password
        });

        users[username] = r;

        res.status(200);
        res.send("OK");
    });

    app.use(async (req, res, next) => {
        (req as any).contract = contract;
        try {
            log.info(Object.keys(users));
            const user = req.header("x-user") as string;
            if (user && users[user]) {
                log.info(`Using user: ${user}`);
                const connectionOptions = await newConnectionOptions(grpcConn,
                    config.mspId, Buffer.from(users[user].certificate),
                    users[user].key.toBytes());

                const gateway = connect(connectionOptions);
                const network = gateway.getNetwork(config.channelName);
                (req as any).contract = network.getContract(config.chaincodeName);
            }
            next();
        } catch (err) {
            log.error(err);
            next(err);
        }
    });

    app.post('/evaluate', async (req, res) => {
        try {
            const fcn = req.body.fcn;
            const responseBuffer = await (req as any).contract.evaluateTransaction(fcn, ...(req.body.args || []));
            const result = Buffer.from(responseBuffer).toString();
            res.status(200);
            res.send(result);
        } catch (err: any) {
            log.error(err);
            res.status(400);
            res.send(err.details && err.details.length ? err.details : err.message);
        }
    });

    app.post('/submit', async (req, res) => {
        try {
            const fcn = req.body.fcn;
            const responseBuffer = await (req as any).contract.submitTransaction(fcn, ...(req.body.args || []));
            const result = Buffer.from(responseBuffer).toString();
            res.status(200);
            res.send(result);
        } catch (err: any) {
            log.error(err);
            res.status(400);
            res.send(err.details && err.details.length ? err.details : err.message);
        }
    });

    const port = config.port;
    app.listen(port, () => {
        log.info(`Server is listening on port ${port}`);
    });
}

main();