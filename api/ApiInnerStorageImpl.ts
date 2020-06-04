
import {AsyBalanceInnerStorageApi, StringCallResponse} from "./api";
import * as NodePersist from "node-persist";

const storage_config: NodePersist.InitOptions = {
    dir: 'asybalance'
};

export default class AsyBalanceNodeStorageImpl implements AsyBalanceInnerStorageApi{
    private storage?: NodePersist.LocalStorage;
    private storagePromise?: Promise<NodePersist.InitOptions>;

    constructor(private accId: string){}

    async initStorage(){
        if(!this.storage){
            this.storage = NodePersist.create(storage_config);
            if(!this.storagePromise)
                this.storagePromise = NodePersist.init();
            await this.storagePromise;
            this.storagePromise = undefined;
        }
    }

    async loadData(): Promise<StringCallResponse<string>> {
        if(!this.storage)
            await this.initStorage();
        let item = await this.storage!.getItem(this.accId);
        return Promise.resolve({payload: item});
    }

    async saveData(data: string): Promise<StringCallResponse<void>> {
        if(!this.storage)
            await this.initStorage();
        await this.storage!.setItem(this.accId, data);
        return Promise.resolve({payload: undefined});
    }

}