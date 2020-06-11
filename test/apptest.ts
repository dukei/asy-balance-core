import {AsyBalanceProvider} from "../common/ProviderBundle";
import AsyBalanceImpl from "../api/ApiInnerImpl";
import AsyBalance from "../api/ApiImpl";
import log from "../common/log";
import AsyBalanceResultImpl from "../api/ApiInnerResultImpl";
import AsyBalanceNodeStorageImpl from "../api/ApiInnerStorageImpl";
import AsyBalanceTraceImpl from "../api/ApiInnerTraceImpl";

(async() => {
	let asimpl = new AsyBalanceImpl({
//        proxy: 'socks5://localhost:9150/'
    });

	log.info("hi, logging!");
	let prov = await AsyBalanceProvider.create("C:\\SrcRep\\asy-balance-providers\\ab2-test-tor\\provider.zip");

	let asiri = new AsyBalanceResultImpl();
	let asisi = new AsyBalanceNodeStorageImpl("test");
	let asiti = new AsyBalanceTraceImpl();
	let AnyBalance = new AsyBalance({
		api: asimpl,
		apiStorage: asisi,
		apiResult: asiri,
		apiTrace: asiti,
		preferences: undefined,
	});

	const {VM} = require('vm2');

	const vm = new VM({
		timeout: 3000000,
		sandbox: {
			AnyBalance: AnyBalance
		}
	});

	let script = await prov.getScript();


	//console.log(script);

    await vm.run(`${script}(async()=>{
            await AnyBalance.execute(main);
    	})();
	`);

    console.log(asiri.getResults());
})();