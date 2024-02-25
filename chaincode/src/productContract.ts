import { Context, Contract } from 'fabric-contract-api';
import { IIdentity } from './interfaces/IIndentity';
import { IProduct } from './interfaces/IProduct';
import { IBalance } from './interfaces/IBalance';
import { ISales } from './interfaces/ISales';

const tslog = require("tslog");

const log = new tslog.Logger({
    name: 'ProductContract'
});

const productPrefix = "product";
const salesPrefix = "sales";
const balancePrefix = "balance";

const ALLOWED_MSPS_FOR_CREATE_PRODUCTS = ["SonyMSP"];
const ALLOWED_MSPS_FOR_BUY_PRODUCTS = ["MarketplaceMSP"];

export class ProductContract extends Contract {
    async getMyIdentity(ctx: Context) {
        const myIdentity: IIdentity =
        {
            "MSPID": `${ctx.clientIdentity.getMSPID()}`,
            "ID": `${ctx.clientIdentity.getID()}`
        }
        return JSON.stringify(myIdentity);
    }

    async createProduct(ctx: Context, id: string, name: string, description: string, price: number, quantity: number) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can create products`);
        }

        if (isNaN(price)) {
            throw new Error("Price must be a number");
        }

        const product: IProduct = {
            "id": id,
            "name": name,
            "description": description,
            "price": price,
            "quantity": quantity,
            "createdBy": myIdentity.ID
        };
        const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
        const currentProductJSON = await ctx.stub.getState(productKey);
        if (currentProductJSON && currentProductJSON.length > 0) {
            throw new Error(`Product with id ${id} already exists`);
        }
        await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
        return JSON.stringify(product);
    }

    async getProduct(ctx: Context, id: string) {
        const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
        const productJSON = await ctx.stub.getState(productKey);
        if (!productJSON || productJSON.length === 0) {
            throw new Error(`Product with id ${id} does not exist`);
        }
        const product: IProduct = JSON.parse(productJSON.toString());
        return JSON.stringify(product);
    }

    async getAllProducts(ctx: Context) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(productPrefix, []);
        const allResults = [];
        let res = await iterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                const strValue = res.value.value.toString();
                let record: IProduct;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    throw new Error(`Failed to parse ${strValue} to JSON: ${err}`);
                }
                allResults.push(record);
            }
            res = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    async updateProduct(ctx: Context, id: string, name: string, description: string, price: number, quantity: number) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can update products`);
        }
        if (isNaN(price)) {
            throw new Error("Price must be a number");
        }
        const product: IProduct = {
            "id": id,
            "name": name,
            "description": description,
            "price": price,
            "quantity": quantity,
            "createdBy": myIdentity.ID
        };
        const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
        const currentProductJSON = await ctx.stub.getState(productKey);
        if (!currentProductJSON || currentProductJSON.length === 0) {
            throw new Error(`Product with id ${id} does not exist`);
        }
        const currentProduct: IProduct = JSON.parse(currentProductJSON.toString());
        if (currentProduct.createdBy !== myIdentity.ID) {
            throw new Error(`Only product created by '${currentProduct.createdBy} can update`);
        }
        await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(product)));
        return JSON.stringify(product);
    }

    async deleteProduct(ctx: Context, id: string) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can delete products`);
        }
        const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
        const currentProductJSON = await ctx.stub.getState(productKey);
        if (!currentProductJSON || currentProductJSON.length === 0) {
            throw new Error(`Product with id ${id} does not exist`);
        }
        const currentProduct: IProduct = JSON.parse(currentProductJSON.toString());
        if (currentProduct.createdBy !== myIdentity.ID) {
            throw new Error(`Only product created by '${currentProduct.createdBy} can delete`);
        }
        await ctx.stub.deleteState(productKey);
        return `Product with id ${id} deleted`;
    }

    async getMyBalance(ctx: Context) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can get balance`);
        }
        const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
        let balanceJSON = await ctx.stub.getState(balanceKey);
        if (!balanceJSON || balanceJSON.length === 0) {
            return JSON.stringify({ "value": 0 });
        } else {
            const balance: IBalance = JSON.parse(balanceJSON.toString());
            return JSON.stringify(balance);
        }
    }

    async addBalance(ctx: Context, balanceToAdd: number) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can set balance`);
        }
        if (isNaN(balanceToAdd)) {
            throw new Error("Balance must be a number");
        }
        const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
        const currentBalanceJSON = await ctx.stub.getState(balanceKey);
        let newBalance: number = balanceToAdd;

        if (currentBalanceJSON && currentBalanceJSON.length > 0) {
            const currentBalance: IBalance = JSON.parse(currentBalanceJSON.toString());
            newBalance = (Number(currentBalance.value) + Number(balanceToAdd));
        }

        const balance: IBalance = {
            "value": newBalance
        }
        await ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balance)));

        return JSON.stringify({
            "MSPID": myIdentity.MSPID,
            "ID": myIdentity.ID,
            "balance": newBalance
        });
    }

    async setMyBalance(ctx: Context, balanceToSet: number) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can set balance`);
        }
        if (isNaN(balanceToSet)) {
            throw new Error("Balance must be a number");
        }
        const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);

        const balance: IBalance = {
            "value": balanceToSet
        }
        await ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify(balance)));

        return JSON.stringify(balance);
    }

    async buyProduct(ctx: Context, id: string, quantity: number) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_BUY_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_BUY_PRODUCTS}' can buy products`);
        }
        if (isNaN(quantity)) {
            throw new Error("Quantity must be a number");
        }
        const productKey = ctx.stub.createCompositeKey(productPrefix, [id]);
        const currentProductJSON = await ctx.stub.getState(productKey);
        if (!currentProductJSON || currentProductJSON.length === 0) {
            throw new Error(`Product with id ${id} does not exist`);
        }
        const currentProduct: IProduct = JSON.parse(currentProductJSON.toString());
        if (Number(currentProduct.quantity) < Number(quantity)) {
            throw new Error(`Only ${currentProduct.quantity} products left in stock`);
        }
        const balanceKey = ctx.stub.createCompositeKey(balancePrefix, [myIdentity.MSPID]);
        const currentBalanceJSON = await ctx.stub.getState(balanceKey);
        if (!currentBalanceJSON || currentBalanceJSON.length === 0) {
            throw new Error(`You don't have enough balance to buy ${quantity} products`);
        }
        const currentBalance: IBalance = JSON.parse(currentBalanceJSON.toString());
        if (Number(currentBalance.value) < Number(quantity) * Number(currentProduct.price)) {
            throw new Error(`You don't have enough balance to buy ${quantity} products`);
        }
        const newBalance = Number(currentBalance.value) - Number(quantity) * Number(currentProduct.price);
        await ctx.stub.putState(balanceKey, Buffer.from(JSON.stringify({ "MSPID": myIdentity.MSPID, "ID": myIdentity.ID, "balance": newBalance })));

        currentProduct.quantity = currentProduct.quantity - quantity;
        await ctx.stub.putState(productKey, Buffer.from(JSON.stringify(currentProduct)));

        const salesId = ctx.stub.getTxID() + myIdentity.MSPID + id + quantity;
        const saleskey = ctx.stub.createCompositeKey(salesPrefix, [salesId]);
        const sales: ISales = {
            "id": salesId,
            "MSPID": myIdentity.MSPID,
            "quantity": quantity,
            "buyer": myIdentity.ID,
            "price": currentProduct.price
        }
        await ctx.stub.putState(saleskey, Buffer.from(JSON.stringify(sales)));
        return JSON.stringify(sales);
    }

    async getAllSales(ctx: Context) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can get sales`);
        }
        const salesList: ISales[] = [];
        const salesIterator = await ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);

        for (let responseRange = await salesIterator.next(); !responseRange.done; responseRange = await salesIterator.next()) {
            const salesValue = responseRange.value?.value?.toString();
            if (salesValue) {
                salesList.push(JSON.parse(salesValue) as ISales);
            }
        }
        await salesIterator.close();
        return JSON.stringify(salesList);
    }

    async getMySales(ctx: Context, id: string) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can get sales`);
        }
        const salesIterator = await ctx.stub.getStateByPartialCompositeKey(salesPrefix, [id]);
        const salesList: ISales[] = [];
        for (let responseRange = await salesIterator.next(); !responseRange.done; responseRange = await salesIterator.next()) {
            const salesValue = responseRange.value?.value?.toString();
            if (salesValue) {
                salesList.push(JSON.parse(salesValue) as ISales);
            }
        }
        await salesIterator.close();
        return JSON.stringify(salesList);
    }

    async deleteAllSales(ctx: Context) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can delete sales`);
        }
        const salesIterator = await ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);
        for (let responseRange = await salesIterator.next(); !responseRange.done; responseRange = await salesIterator.next()) {
            await ctx.stub.deleteState(responseRange.value.key);
        }
        await salesIterator.close();
        return "All sales deleted";
    }

    async cleanChaincode(ctx: Context) {
        const myIdentity: IIdentity = JSON.parse(await this.getMyIdentity(ctx));
        const allowed = ALLOWED_MSPS_FOR_CREATE_PRODUCTS.includes(myIdentity.MSPID);
        if (!allowed) {
            throw new Error(`Only '${ALLOWED_MSPS_FOR_CREATE_PRODUCTS}' can clean chaincode`);
        }
        let iterator = await ctx.stub.getStateByPartialCompositeKey(productPrefix, []);
        for (let responseRange = await iterator.next(); !responseRange.done; responseRange = await iterator.next()) {
            await ctx.stub.deleteState(responseRange.value.key);
        }
        await iterator.close();
        iterator = await ctx.stub.getStateByPartialCompositeKey(balancePrefix, []);
        for (let responseRange = await iterator.next(); !responseRange.done; responseRange = await iterator.next()) {
            await ctx.stub.deleteState(responseRange.value.key);
        }
        await iterator.close();
        iterator = await ctx.stub.getStateByPartialCompositeKey(salesPrefix, []);
        for (let responseRange = await iterator.next(); !responseRange.done; responseRange = await iterator.next()) {
            await ctx.stub.deleteState(responseRange.value.key);
        }
        await iterator.close();
        return "Chaincode cleaned";
    }
}