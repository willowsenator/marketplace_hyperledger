"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductContract = void 0;
const fabric_contract_api_1 = require("fabric-contract-api");
const tslog = require("tslog");
const log = new tslog.Logger({
    name: 'ProductContract'
});
const productPrefix = "product";
const salesPrefix = "sales";
const balancePrefix = "balance";
const ALLOWED_MSPS_FOR_CREATE_PRODUCTS = ["SonyMSP"];
const ALLOWED_MSPS_FOR_BUY_PRODUCTS = ["MarketplaceMSP"];
class ProductContract extends fabric_contract_api_1.Contract {
    getMyIdentity(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = {
                "MSPID": `${ctx.clientIdentity.getMSPID()}`,
                "ID": `${ctx.clientIdentity.getID()}`
            };
            return JSON.stringify(myIdentity);
        });
    }
    createProduct(ctx, id, name, description, price, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can create products`);
            }
            if (isNaN(price)) {
                throw new Error("Price must be a number");
            }
            const product = {
                "id": id,
                "name": name,
                "description": description,
                "price": price,
                "quantity": quantity,
                "createdBy": myIdentity.ID
            };
            const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
            const currentProductJSON = yield ctx.stub.getState(productKey);
            if (currentProductJSON && currentProductJSON.length > 0) {
                throw new Error(`Product with id ${id} already exists`);
            }
            yield ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
            return JSON.stringify(product);
        });
    }
    getProduct(ctx, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
            const productJSON = yield ctx.stub.getState(productKey);
            if (!productJSON || productJSON.length === 0) {
                throw new Error(`Product with id ${id} does not exist`);
            }
            const product = JSON.parse(productJSON.toString());
            return JSON.stringify(product);
        });
    }
    getAllProducts(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const iterator = yield ctx.stub.getStateByPartialCompositeKey(productPrefix, []);
            const allResults = [];
            let res = yield iterator.next();
            while (!res.done) {
                if (res.value && res.value.value.toString()) {
                    const strValue = res.value.value.toString();
                    let record;
                    try {
                        record = JSON.parse(strValue);
                    }
                    catch (err) {
                        throw new Error(`Failed to parse ${strValue} to JSON: ${err}`);
                    }
                    allResults.push(record);
                }
                res = yield iterator.next();
            }
            return JSON.stringify(allResults);
        });
    }
    updateProduct(ctx, id, name, description, price, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can update products`);
            }
            if (isNaN(price)) {
                throw new Error("Price must be a number");
            }
            const product = {
                "id": id,
                "name": name,
                "description": description,
                "price": price,
                "quantity": quantity,
                "createdBy": myIdentity.ID
            };
            const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
            const currentProductJSON = yield ctx.stub.getState(productKey);
            if (!currentProductJSON || currentProductJSON.length === 0) {
                throw new Error(`Product with id ${id} does not exist`);
            }
            const currentProduct = JSON.parse(currentProductJSON.toString());
            if (currentProduct.createdBy !== myIdentity.ID) {
                throw new Error(`Only product created by '${currentProduct.createdBy} can update`);
            }
            yield ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
            return JSON.stringify(product);
        });
    }
    deleteProduct(ctx, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can delete products`);
            }
            const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
            const currentProductJSON = yield ctx.stub.getState(productKey);
            if (!currentProductJSON || currentProductJSON.length === 0) {
                throw new Error(`Product with id ${id} does not exist`);
            }
            const currentProduct = JSON.parse(currentProductJSON.toString());
            if (currentProduct.createdBy !== myIdentity.ID) {
                throw new Error(`Only product created by '${currentProduct.createdBy} can delete`);
            }
            yield ctx.stub.deleteState(productKey);
            return `Product with id ${id} deleted`;
        });
    }
    getMyBalance(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can get balance`);
            }
            const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
            let balanceJSON = yield ctx.stub.getState(balanceKey);
            if (!balanceJSON || balanceJSON.length === 0) {
                return JSON.stringify({ "value": 0 });
            }
            else {
                const balance = JSON.parse(balanceJSON.toString());
                return JSON.stringify(balance);
            }
        });
    }
    addBalance(ctx, balanceToAdd) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can set balance`);
            }
            if (isNaN(balanceToAdd)) {
                throw new Error("Balance must be a number");
            }
            const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
            const currentBalanceJSON = yield ctx.stub.getState(balanceKey);
            let newBalance = balanceToAdd;
            if (currentBalanceJSON && currentBalanceJSON.length > 0) {
                const currentBalance = JSON.parse(currentBalanceJSON.toString());
                newBalance = (Number(currentBalance.value) + Number(balanceToAdd));
            }
            const balance = {
                "value": newBalance
            };
            yield ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balance)));
            return JSON.stringify({
                "MSPID": myIdentity.MSPID,
                "ID": myIdentity.ID,
                "balance": newBalance
            });
        });
    }
    setMyBalance(ctx, balanceToSet) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can set balance`);
            }
            if (isNaN(balanceToSet)) {
                throw new Error("Balance must be a number");
            }
            const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
            const balance = {
                "value": balanceToSet
            };
            yield ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balance)));
            return JSON.stringify(balance);
        });
    }
    buyProduct(ctx, id, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can buy products`);
            }
            if (isNaN(quantity)) {
                throw new Error("Quantity must be a number");
            }
            const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
            const currentProductJSON = yield ctx.stub.getState(productKey);
            if (!currentProductJSON || currentProductJSON.length === 0) {
                throw new Error(`Product with id ${id} does not exist`);
            }
            const currentProduct = JSON.parse(currentProductJSON.toString());
            if (Number(currentProduct.quantity) < Number(quantity)) {
                throw new Error(`Only ${currentProduct.quantity} products left in stock`);
            }
            const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
            const currentBalanceJSON = yield ctx.stub.getState(balanceKey);
            if (!currentBalanceJSON || currentBalanceJSON.length === 0) {
                throw new Error(`You don't have enough balance to buy ${quantity} products`);
            }
            const currentBalance = JSON.parse(currentBalanceJSON.toString());
            if (Number(currentBalance.value) < Number(quantity) * Number(currentProduct.price)) {
                throw new Error(`You don't have enough balance to buy ${quantity} products`);
            }
            const newBalance = Number(currentBalance.value) - Number(quantity) * Number(currentProduct.price);
            yield ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify({ "MSPID": myIdentity.MSPID, "ID": myIdentity.ID, "balance": newBalance })));
            currentProduct.quantity = currentProduct.quantity - quantity;
            yield ctx.stub.putState(productKey, Buffer.from(JSON.stringify(currentProduct)));
            const salesId = ctx.stub.getTxID() + myIdentity.MSPID + id + quantity;
            const saleskey = ctx.stub.createCompositeKey(salesPrefix, [salesId]);
            const sales = {
                "id": salesId,
                "MSPID": myIdentity.MSPID,
                "quantity": quantity,
                "buyer": myIdentity.ID,
                "price": currentProduct.price
            };
            yield ctx.stub.putState(saleskey, Buffer.from(JSON.stringify(sales)));
            return JSON.stringify(sales);
        });
    }
    getAllSales(ctx) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can get sales`);
            }
            const salesList = [];
            const salesIterator = yield ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);
            for (let responseRange = yield salesIterator.next(); !responseRange.done; responseRange = yield salesIterator.next()) {
                const salesValue = (_b = (_a = responseRange.value) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.toString();
                if (salesValue) {
                    salesList.push(JSON.parse(salesValue));
                }
            }
            yield salesIterator.close();
            return JSON.stringify(salesList);
        });
    }
    getMySales(ctx, id) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can get sales`);
            }
            const salesIterator = yield ctx.stub.getStateByPartialCompositeKey(salesPrefix, [id]);
            const salesList = [];
            for (let responseRange = yield salesIterator.next(); !responseRange.done; responseRange = yield salesIterator.next()) {
                const salesValue = (_b = (_a = responseRange.value) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.toString();
                if (salesValue) {
                    salesList.push(JSON.parse(salesValue));
                }
            }
            yield salesIterator.close();
            return JSON.stringify(salesList);
        });
    }
    deleteAllSales(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can delete sales`);
            }
            const salesIterator = yield ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);
            for (let responseRange = yield salesIterator.next(); !responseRange.done; responseRange = yield salesIterator.next()) {
                yield ctx.stub.deleteState(responseRange.value.key);
            }
            yield salesIterator.close();
            return "All sales deleted";
        });
    }
    cleanChaincode(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            const myIdentity = JSON.parse(yield this.getMyIdentity(ctx));
            const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
            if (!allowed) {
                throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can clean chaincode`);
            }
            let iterator = yield ctx.stub.getStateByPartialCompositeKey(productPrefix, []);
            for (let responseRange = yield iterator.next(); !responseRange.done; responseRange = yield iterator.next()) {
                yield ctx.stub.deleteState(responseRange.value.key);
            }
            yield iterator.close();
            iterator = yield ctx.stub.getStateByPartialCompositeKey(balancePrefix, []);
            for (let responseRange = yield iterator.next(); !responseRange.done; responseRange = yield iterator.next()) {
                yield ctx.stub.deleteState(responseRange.value.key);
            }
            yield iterator.close();
            iterator = yield ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);
            for (let responseRange = yield iterator.next(); !responseRange.done; responseRange = yield iterator.next()) {
                yield ctx.stub.deleteState(responseRange.value.key);
            }
            yield iterator.close();
            return "Chaincode cleaned";
        });
    }
}
exports.ProductContract = ProductContract;
//# sourceMappingURL=productContract.js.map