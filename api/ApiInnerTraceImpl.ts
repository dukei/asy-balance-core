import {AsyBalanceInnerTraceApi, StringCallResponse} from "./api";

export default class AsyBalanceTraceImpl implements AsyBalanceInnerTraceApi{
    trace(msg: string, callee: string): Promise<StringCallResponse<void>> {
        console.log(callee, msg)
        return Promise.resolve({payload: undefined});
    }
}