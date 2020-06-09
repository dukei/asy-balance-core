import {AsyBalanceInnerRetrieveApi, AsyRetrieveOptions, StringCallResponse} from "./api";

export default class AsyBalanceRetrieveImpl implements AsyBalanceInnerRetrieveApi{
    retrieveCode(options: string | AsyRetrieveOptions): Promise<StringCallResponse<string>> {
        throw new Error('Not implemented!');
    }
}