import {AsyBalanceInnerResultApi, AsyBalanceResult, StringCallResponse} from "./api";

export default class AsyBalanceResultImpl implements AsyBalanceInnerResultApi{
    private result: AsyBalanceResult[] = [];

    public constructor(private impl?: AsyBalanceInnerResultApi) {
    }

    async setResult(data: string | AsyBalanceResult): Promise<StringCallResponse<void>> {
        const result = typeof data === 'string' ? JSON.parse(data) : data;
        this.result.push(result);

        if(this.impl)
            await this.impl.setResult(data);
        return Promise.resolve({payload: undefined});
    }

    public getResults(): AsyBalanceResult[]{
        return this.result;
    }
}