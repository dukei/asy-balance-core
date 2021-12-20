import {AsyBalanceProvider} from "../common/ProviderBundle";
import AsyBalanceImpl from "../api/ApiInnerImpl";
import AsyBalance from "../api/ApiImpl";
import log from "../common/log";
import AsyBalanceResultImpl from "../api/ApiInnerResultImpl";
import AsyBalanceNodeStorageImpl from "../api/ApiInnerStorageImpl";
import AsyBalanceTraceImpl from "../api/ApiInnerTraceImpl";
import {AsyBalanceInnerRetrieveApi, AsyRetrieveOptions, StringCallResponse} from "../api/api";
import AsyBalanceRetrieveImpl from "../api/ApiInnerRetrieveImpl";

class ApiRetrieve extends AsyBalanceRetrieveImpl {
	async retrieveCode(options: string | AsyRetrieveOptions): Promise<StringCallResponse<string>> {
		console.log(JSON.stringify(options));
		return {payload: '2532'};
	}

}

(async() => {

	log.info("hi, logging!");
	let prov = await AsyBalanceProvider.create("C:\\krawlly\\providers-asy\\ab2-test-srv\\provider.zip");

	let asiri = new AsyBalanceResultImpl();
	let asisi = new AsyBalanceNodeStorageImpl("test");
	let asiti = new AsyBalanceTraceImpl();

	const result = await prov.execute({
		apiRetrieve: new ApiRetrieve(),
		apiResult: asiri,
		apiStorage: asisi,
		apiTrace: asiti,
		preferences: {
			login: 'captcha',
			password: 'pass'
		},
		accId: "sss",
	})

    console.log(result);
})();