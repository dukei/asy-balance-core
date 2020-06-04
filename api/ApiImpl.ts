/* Для апи нужны следующие параметры, определенные в глобальном скоупе:
  
var g_AnyBalanceApiParams = {
	  nAccountID: %ACCOUNT_ID%, //Целое число - идентификатор аккаунта, для которого идет запрос
      preferences: %PREFERENCES%, //Настройки аккаунта, логин, пароль, counter0-N.
      //signature: '%RPC_SIGNATURE%', //Сигнатура, которая будет определять RPC вызов для функции prompt или prompt_placeholder (необязательно, если используется api)
      //debugmode: false, //Отладочный режим, использование плейсхолдеров и все счетчики требуются 
      //prompt_placeholder: null, //Вызов этой функции для RPC,
      //trace_placeholder: null, //Вызов этой функции для трейсов в отладочном режиме
      //setResult_placeholder: null,  //Вызов этой функции для результата в отладочном режиме
      //api: window._AnyBalanceAPI //Объект реализации апи (необязательно, если его нет, то будет использовано RPC) 
};

*/

import {
	AsyAuthParams,
	AsyBalanceApi, AsyBalanceParams,
	AsyBalancePreferences,
	AsyBalanceResult,
	AsyBalanceResultError,
	AsyBalanceUserErrorParam,
	AsyCapabilities,
	AsyCookie,
	AsyCookieExt,
	AsyResponse, AsyResponseInterface,
	AsyRetrieveOptions,
	CallErrorResponse,
	CallResponse,
	CallSuccessResponse,
	CookieParams,
	HTTP_METHOD,
	OPTIONS,
	OptionsParam,
	StringBundle,
	StringTuple
} from "./api";

import {encode, decode} from "base64-arraybuffer";

const reCounterLastWord = /\.[^.]*$/;
const cookiesParamName = '!@#AB_COOKIES';

class AsyBalanceResultErrorImpl implements AsyBalanceResultError {
	constructor(message: string, e?: Error) {
		this.e = e;
		this.message = message;
		if(e && (!e.name || !/AnyBalance/i.test(e.name))){
			this.investigate = true;
			this.unhandled = true;
		}
	}

	readonly e?: Error;
	readonly error = true;
	investigate?: boolean;
	readonly message: string;
	unhandled?: boolean;
}

class AsyBalanceUserError extends Error {
	public name: string = 'AnyBalanceApiUserError';
	public ex?: AsyBalanceUserErrorParam;

	public constructor(message: string, ex?: AsyBalanceUserErrorParam){
		super(message);
		this.ex = ex;
	}
}

class AsyBalanceSystemError extends Error{
	public name: string;

	constructor(msg: string){
		super(msg);
		this.name = 'AnyBalanceApiError';
	}
}

class AsyResponseObject implements AsyResponse{

    getString(): string {
    	const body = this.data.body;
		let rets: string;
		if(typeof body === 'string'){
			rets = body;
		}else if(body instanceof ArrayBuffer){
			rets = encode(body);
		}else{
			throw new AsyBalanceSystemError(`Unknown type of response from ${this.url}`);
		}
		return rets;
    }

    getBuffer(): ArrayBuffer {
		const body = this.data.body;
		let retb: ArrayBuffer;
		if(typeof body === 'string'){
			retb = decode(body);
		}else if(body instanceof ArrayBuffer){
			retb = body;
		}else{
			throw new AsyBalanceSystemError(`Unknown type of response from ${this.url}`);
		}
		return retb;
    }

    getJson(): any {
    	return JSON.parse(this.getString());
	}

    getLastUrl(): string {
    	return this.data.url;
	}

    getLastStatusString(): string {
        return this.data.status;
    }

    getLastStatusCode(): number {
		const matches = this.data.status.match(/\S+\s+(\d+)/);
		if(!matches) return 0;
		return parseInt(matches[1]);
    }

		/**
		 * Get value of the first header with the specified name
		 * @param name
		 */
	public getLastResponseHeader(name: string): string | false {
		var headers = this.data.headers;
		name = name.toLowerCase();
		for(let i=0; i<headers.length; ++i){
			const header = headers[i];
			if(header[0].toLowerCase() == name)
				return header[1];
		}
		return false;
	}

    getLastResponseHeaders(): StringTuple[] {
        return this.data.headers;
    }

    get headers(): StringTuple[] { return this.data.headers }
    get url(): string { return this.data.url }
    get status(): string { return this.data.status }
    get body(): string | ArrayBuffer { return this.data.body };

	constructor(private data: AsyResponseInterface){
	}
}

export default class AsyBalance implements AsyBalanceApi{
	#global: AsyBalanceParams;
	readonly #preferences: AsyBalancePreferences;
	#setResultCalled = false;
	#availableCounters?: {arr: string[], obj: {[name: string]: boolean}};
	#accountData: {[name: string]: any} | null = null;
	#accountDataPromise: Promise<string> | null = null;
	#accountDataDirty?: boolean;
	#loginSuccessful?: boolean;
	#execute_called = false;

	public Error = AsyBalanceUserError;

	public constructor(params: AsyBalanceParams){
		this.#global = params;
		this.#preferences = this.#global.preferences || {};
	}

	private async callAnyBalance<T>(name: string, args?: any[]): Promise<T>{
		if(!args) args = [];
		if(!this.#global.stringRPC)
			throw new Error('String gate not set!');
		let ret = await this.#global.stringRPC(this.#global.signature + JSON.stringify({method: name, params: args}));
		if(ret && typeof ret === 'string'){
			if(ret.charAt(0) == '{'){
				return this.checkCallResponse<T>(ret);
			}else{
				//Проблема, вернули просто строку. Скорее всего это ошибка.
				//Ошибка серьёзная, так что бросаем эксепшн в любом случае
				throw new AsyBalanceSystemError(ret);
			}
		}else{
			throw new AsyBalanceSystemError("Unexpected output from method '" + name + "': (" + (typeof ret) + ") " + JSON.stringify(ret).substr(0, 128));
		}
	}

	private async api_getLevel(): Promise<number> {
		const method = 'getLevel';
		if(this.#global.api) {
			const resp = await this.#global.api.getLevel();
			return this.checkCallResponse(resp);
		}
		return await this.callAnyBalance(method);
	}

	private async api_getCapabilities(): Promise<AsyCapabilities>{
		const method = 'getCapabilities';
		if(this.#global.api) {
			const resp = await this.#global.api.getCapabilities();
			return this.checkCallResponse(resp);
		}
		return await this.callAnyBalance(method);
	}

	/**
	 * Возвращает возможности этой реализации API
	 */
	public async getCapabilities(): Promise<AsyCapabilities>{
		return await this.api_getCapabilities();
	}

	private async api_trace(msg: string, callee: string): Promise<void>{
		const method = 'trace';
		if(this.#global.apiTrace) {
			const resp = await this.#global.apiTrace.trace(msg, callee);
			return this.checkCallResponse(resp);
		}
		return this.callAnyBalance(method, [msg, callee]);
	}

	private checkCallResponse<T>(resp: string|CallResponse<T>): T{
		if(typeof(resp) === 'string'){
			resp = JSON.parse(resp);
		}

		const respError = resp as CallErrorResponse;
		if(respError.error)
			throw new AsyBalanceSystemError(respError.message);

		const respSuccess = resp as CallSuccessResponse<T>;
		return respSuccess.payload;
	}

	private async api_requestPost(url: string, data: string | ArrayBuffer | StringBundle | null, headers: StringBundle | null, options: OptionsParam | null): Promise<AsyResponse>{
		const method = 'requestPost';
		let json: boolean = !!(data && !(typeof data === 'string') && !(data instanceof ArrayBuffer));
		let payload: AsyResponseInterface;

		if(this.#global.api){
			let resp: string | CallResponse<AsyResponseInterface>;
			if(this.#global.api_stringified) {
				let _headers: string = '';
				let _options: string = '';

				if (data instanceof ArrayBuffer) {
					data = encode(data);
					if (!options) options = {};
					options.requestCharset = 'base64';
				} else if (!data) {
					data = '';
				} else if (typeof data === 'object') {
					data = JSON.stringify(data);
				}

				if (headers)
					_headers = JSON.stringify(headers);

				if (options)
					_options = JSON.stringify(OPTIONS);

				resp = await this.#global.api.requestPost(url, data, json, _headers, _options);
			}else{
				resp = await this.#global.api.requestPost(url, data, json, headers, options);
			}

			payload = this.checkCallResponse<AsyResponseInterface>(resp);
		}else{
			if (data instanceof ArrayBuffer) {
				data = encode(data);
				if (!options) options = {};
				options.requestCharset = 'base64';
			}

			payload = await this.callAnyBalance<AsyResponseInterface>(method, [url, data, json, headers, options]);
		}

		return new AsyResponseObject(payload);
	}

	private async api_setAuthentication(name: string, pass: string, authscope: AsyAuthParams | null): Promise<void>{
		const method = 'setAuthentication';
		let _authscope = '';
		if(this.#global.api_stringified && authscope)
			_authscope = JSON.stringify(authscope);
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.setAuthentication(name, pass, _authscope || authscope));
		return this.callAnyBalance(method, [name, pass, authscope]);
	}

	private async api_clearAuthentication(): Promise<void>{
		const method = 'clearAuthentication';
		if(this.#global.api)
			this.checkCallResponse(await this.#global.api.clearAuthentication());
		return this.callAnyBalance(method);
	}

	private async api_sleep(ms: number): Promise<void>{
		const method = 'sleep';
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.sleep(ms));
		return this.callAnyBalance(method, [ms]);
	}

	private async api_setCookie(domain: string, name: string, value: string | null, params: AsyCookieExt | null): Promise<void>{
		const method = 'setCookie';
		let _params = '';
		if(this.#global.api_stringified && params)
			_params = JSON.stringify(params);
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.setCookie(domain, name, value, _params || params));
		return this.callAnyBalance(method, [domain, name, value, params]);
	}

	private async api_getCookies(): Promise<AsyCookie[]>{
		const method = 'getCookies';
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.getCookies());
		return this.callAnyBalance(method);
	}

	private async api_setResult(data: AsyBalanceResult): Promise<void>{
		const method = 'setResult';
		let _data: string = '';
		if(this.#global.api_stringified)
			_data = JSON.stringify(data);
		if(this.#global.apiResult)
			return this.checkCallResponse(await this.#global.apiResult.setResult(_data || data));

		return this.callAnyBalance(method, [data]);
	}

	private replaceOptNames(data: {[key: string]: any}){
		const validated: { [key: string]: any } = {}, optionNames = OPTIONS;
		//Make option names right
		for(let opt in data){
			const name: string = optionNames[opt as keyof typeof OPTIONS] || opt;
			if(isObject(data[opt]))
				validated[name] = this.replaceOptNames(data[opt]);
			else
				validated[name] = data[opt];
		}
		return validated;
	}

	private async api_setOptions(data: OptionsParam): Promise<void>{
		const method = 'setOptions', validated = this.replaceOptNames(data);
		let _options: string = '';
		if(this.#global.api_stringified)
			_options = JSON.stringify(validated);
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.setOptions(_options || validated));
		return this.callAnyBalance(method, [validated]);
	}

	private async api_retrieveCode(comment: string, image: string, options: AsyRetrieveOptions | null): Promise<string>{
		const method = 'retrieveCode';
		let _options: string = '';
		if(this.#global.api_stringified && options)
			_options = JSON.stringify(options);
		if(this.#global.api)
			return this.checkCallResponse(await this.#global.api.retrieveCode(comment, image, _options || options));
		return this.callAnyBalance(method, [comment, image, options]);
	}

	private async api_loadData(): Promise<string>{
		const method = 'loadData';
		if(this.#global.apiStorage)
			return this.checkCallResponse(await this.#global.apiStorage.loadData());
		return this.callAnyBalance(method);
	}

	private async api_saveData(data: string): Promise<void>{
		const method = 'saveData';
		if(this.#global.apiStorage)
			return this.checkCallResponse(await this.#global.apiStorage.saveData(data));
		return this.callAnyBalance(method, [data]);
	}

	private initAvailableCounter(counter: string): void{
		do{
			if(counter){
				if(this.#availableCounters!.obj[counter])
					break; //already registered

				this.#availableCounters!.arr.push(counter);
				this.#availableCounters!.obj[counter] = true;

				if(counter.substr(-1) != '-'){
					//Если счетчик не оканчивается на -, значит, он не запрещен и надо включить все его частичные счетчики
					const counterIsComplex = reCounterLastWord.test(counter);
					counter = counter.replace(reCounterLastWord, '');
					if(counterIsComplex)
						continue;
				}
			}
			break;
		}while(true);
	}

	private initAvailableCounters(){
		if(this.#availableCounters)
			return;

		this.#availableCounters = {arr: [], obj: {}};

		let counters = this.#preferences.ab$counters, i;
		if(counters){
			//Новый формат каунтеров
			for(i=0; i<counters.length; ++i){
				this.initAvailableCounter(counters[i]);
			}
		}else{
			//Старый формат каунтеров
			//Just 20 as max counters number, but actual constant is defined in Java
			for(i=0; i<20; ++i){
				this.initAvailableCounter(this.#preferences['counter'+i]);
			}
		}
	}

	/**
	 * returns true if at least one of supplied counters is selected by a user for retrieving
	 *
	 * @param arrOrString can be string or array of strings
	 */
	public isAvailable(...arrOrString: string[] | string[][]): boolean{
		this.initAvailableCounters();

		for(let i=0; i<arrOrString.length; ++i){
			const arg = arrOrString[i];
			if(Array.isArray(arg) ? this.isAvailable(...arg) : this.isAvailable1(arg as string))
				return true;
		}

		return false;
	}

	private isAvailable1(counter: string): boolean{
		let obj = this.#availableCounters!.obj, counterIsComplex;
		if(obj['--auto--'] || //Если хоть один автоматический каунтер заявлен, то получаем все каунтеры.
			this.#availableCounters!.arr.length == 0)
			return true; //Если не задан ни один каунтер, значит, разрешены все

		//Проверим, что не только каунтер присутствует в списке, но и разрешена вся иерархия (каунтер+),
		//Или запрещена вся иерархия (каунтер-)
		do{
			//Точное сравнение только для полного каунтера, а с + можно и частичные сравнивать
			if((!counterIsComplex && obj[counter]) || obj[counter + '+'])
				return true; //Разрешен или разрешен со всей иерархией
			if(obj[counter + '-'])
				return false; //Явно запрещен
			counterIsComplex = reCounterLastWord.test(counter);
			counter = counter.replace(reCounterLastWord, '');
		}while(counterIsComplex);

		//Проверили все счетчики, среди заданного списка они не матчатся.
		//Но может, мы разрешили всё, кроме? Проверим.
		if(obj['+']) //'+' - разрешены все счетчики, кроме тех, что '-'
			return true;

		return false;
	}

	private async getCookiesImpl(): Promise<AsyCookie[]>{
		return await this.api_getCookies();
	}

	/**
	 * Set cookie for this session
	 * @param domain
	 * @param name
	 * @param value
	 * @param params
	 */
	public async setCookie(domain: string, name: string, value?: string | null, params?: CookieParams): Promise<void>{
		return await this.api_setCookie(domain, name, value || null, params || null);
	}

	private async loadDataImpl(): Promise<string>{
		return await this.api_loadData();
	}

	private async saveDataImpl(data: string): Promise<void>{
		return await this.api_saveData(data);
	}

	private async initData(){
		if(this.#accountData === null) {
			this.#accountDataPromise = this.loadDataImpl();
			const data = await this.#accountDataPromise;
			if(!this.#accountData) {
				this.#accountDataPromise = null;
				this.#accountData = data ? JSON.parse(data) : {};
			}
		}
	}

	/**
	 * Получает сохраненные при аккаунте данные
	 * @param name
	 * @param defaultValue
	 */
	public async getData(name: string, defaultValue?: any): Promise<any>{
		await this.initData();
		return this.#accountData![name] === undefined ? defaultValue : this.#accountData![name];
	}

	/**
	 * Устанавливает сохраняемые при аккаунте данные
	 * @param name
	 * @param value
	 */
	public async setData(name: string, value?: any): Promise<void>{
		await this.initData();
		if(this.#accountData![name] !== value){
			this.#accountDataDirty = true;
			this.#accountData![name] = value;
		}
	}

	/**
	 * Физически сохраняет все данные в аккаунт, если они были модифицированы
	 * @param forceSave
	 */
	public async saveData(forceSave?: boolean): Promise<void>{
		await this.initData();
		if(this.#accountDataDirty || forceSave)
			await this.saveDataImpl(JSON.stringify(this.#accountData));
		this.#accountDataDirty = false;
	}

	public clearData(): void{
		this.#accountData = {};
		this.#accountDataDirty = true;
	}

	public isDataDirty(): boolean{
		return !!this.#accountDataDirty;
	}

	/**
	 * Сохраняет все куки на будущее
	 */
	public async saveCookies(paramName?: string): Promise<void>{
		this.#accountDataDirty = true;
		await this.setData(paramName || cookiesParamName, await this.getCookiesImpl());
	}

	/**
	 * Восстанавливает все ранее сохраненные куки
	 */
	public async restoreCookies(paramNameOrCookies?: string|AsyCookie[]){
		let cookies = Array.isArray(paramNameOrCookies)
			? paramNameOrCookies
			: await this.getData(paramNameOrCookies || cookiesParamName, []);

		for(var i=0; i<cookies.length; ++i){
			var cookie = cookies[i];
			await this.setCookie(cookie.domain, cookie.name, cookie.value, cookie);
		}
	}

	/**
	 * Get AnyBalance API version
	 */
	public async getLevel(): Promise<number>{
		return this.api_getLevel();
	}

	/**
	 * Write message to an account log
	 * This log can be viewed in AnyBalance program
	 * Useful for debugging
	 *
	 * @param msg - message
	 * @param caller - context hint
	 */
	public async trace(msg: string, caller?: string): Promise<void>{
		await this.api_trace(msg, caller || 'trace');
	}

	/**
	 * Sends get request
	 * @param url
	 * @param headers
	 * @param options
	 */
	public async requestGet(url: string, headers?: StringBundle, options?: OptionsParam): Promise<AsyResponse>{
		if(!options)
			options = {};
		if(!options.httpMethod)
			options.httpMethod = HTTP_METHOD.GET;

		return this.requestPost(url, null, headers, options);
	}

	/**
	 * Sends post request
	 * @param url
	 * @param data
	 * @param headers
	 * @param options
	 */
	public async requestPost(url: string, data?: string | ArrayBuffer | StringBundle | null, headers?: StringBundle, options?: OptionsParam): Promise<AsyResponse>{
		const response = await this.api_requestPost(url, data || null, headers || null, options || null);
		return response;
	}
	/**
	 * Set authentication parameters for this session
	 * These parameters apply for all subsequent requests
	 * @param name
	 * @param pass
	 * @param authscope
	 */
	public async setAuthentication(name: string, pass: string, authscope?: AsyAuthParams): Promise<void>{
		return await this.api_setAuthentication(name, pass, authscope || null);
	}

	/**
	 * Get all cookies for this session
	 */
	public async getCookies(): Promise<AsyCookie[]> {
		return this.getCookiesImpl();
	}

	/**
	 * Get cookie value by name
	 * @param name
	 * @param params
	 */
	public async getCookie(name: string, params?: CookieParams): Promise<string | false>{
		if(params && !isObject(params))
			throw new AsyBalanceUserError('getCookie: params argument should be null or object!');
		const path = (params && params.path);
		const domain = (params && params.domain);
		const allcookies = (params && params.allcookies) || await this.getCookiesImpl();

		for(let i=0; i<allcookies.length; ++i){
			var cookie = allcookies[i];
			if(cookie.name != name)
				continue;
			if(domain && (!cookie.domain || domain.toLowerCase().indexOf(cookie.domain) != 0))
				continue;
			if(path && (!cookie.path || path.indexOf(cookie.path) != 0))
				continue;
			return cookie.value!;
		}

		return false;
	}

	/**
	 * retrieves graphical or sms code
	 * @param comment
	 * @param image
	 * @param options
	 */
	public async retrieveCode(comment: string, image?: string | null, options?: AsyRetrieveOptions): Promise<string>{
		return await this.api_retrieveCode(comment, image || '', options || null);
	}

	/**
	 * Clears authentication parameters in this session
	 */
	public async clearAuthentication(): Promise<void>{
		return await this.api_clearAuthentication();
	}

	/**
	 * returns true is setResult has already been called in this session
	 */
	public isSetResultCalled(): boolean{
		return this.#setResultCalled;
	}

	//Sets result of counters retrieval
	//data is object containing all counters
	//you must specify 'success': true or 'error': true for AnyBalance can distinguish results between success and error
	public async setResult(data: AsyBalanceResult): Promise<void>{
		if (this.isDataDirty()) {
			await this.api_trace("WARNING: setResult is called without saving data!", "setResult");
		}
		if (this.#setResultCalled)
			return;
		this.#setResultCalled = true;
		if (this.#global.converter_main) {
			try {
				data = this.#global.converter_main(data); //Calling converter if it exists
			} catch (e) {
				//Экспешны не должны выходить из setResult
				data = this.errorToResult(e);
			}
		}
		await this.api_setResult(data);
	}

	public errorToResult(e: any): AsyBalanceResult{
		let result: AsyBalanceResult;
		if (e && e.name === 'AnyBalanceApiError') {
			result = new AsyBalanceResultErrorImpl(e.message);
		} else if (e && e.name === 'AnyBalanceApiUserError') {
			result = new AsyBalanceResultErrorImpl(e.message, e);
		} else {
			let message = 'Unhandled exception in user script:';
			if(e && typeof e === 'object'){
				message += '\nname: ' + e.name + '\nmessage: ' + e.message;
				for (var key in e) {
					if(/^(name|message|stack)$/.test(key))
						continue; //The intrinsic properties not always enumerable, so let's force necessary ones
					message += '\n' + key + ': ' + (e as any)[key];
				}
				if(e.stack)
					message += '\nCall stack:\n' + e.stack;
			}else{
				message = '' + e;
			}
			result =  new AsyBalanceResultErrorImpl(message, new AsyBalanceUserError(message, e));
		}
		return result;
	}

	/**
	 * Options for setOptions
	 */
	public static OPTIONS = OPTIONS;

	/**
	 * Sets several options for api
	 *
	 * @param data {option: value, option: value, ...}
	 */
	public async setOptions(data: OptionsParam): Promise<void>{
		return await this.api_setOptions(data);
	}

	/**
	 * Suspend execution by specified number of milliseconds
	 */
	public async sleep(ms: number): Promise<void>{
		return await this.api_sleep(ms);
	}

	/**
	 * returns array of strings - names of user selected counters in user order
	 */
	public getAvailableCounters(): string[]{
		this.initAvailableCounters();
		return this.#availableCounters!.arr;
	}

	public async setDefaultCharset(charset: string): Promise<void>{
		const obj: OptionsParam = {[OPTIONS.DEFAULT_CHARSET]: charset};
		return await this.api_setOptions(obj);
	}

	/**
	 *  Устанавливает флаг, что логин удался, то есть, последующие вызовы могут использовать залогиненность
	 */
	public setLoginSuccessful(): void{
		this.#loginSuccessful = true;
	}

	getPreferences(): AsyBalancePreferences {
		return this.#global.preferences || {};
	}

	isObject(obj: any): boolean{
		return isObject(obj);
	}

	public async execute(main: () => Promise<void>): Promise<void> {
		if(this.#execute_called)
			return Promise.resolve();

		this.#execute_called = true;

		const preferences = this.getPreferences();
		const countersSet = preferences.ab$countersSet;

		const handleSetResultNotCalled = () => {
			if (!this.#setResultCalled) {
				//Это является ошибкой только в синхронном режиме.
				this.setResult({
					error : true,
					message : "main() exited without calling setResult()"
				});
			}
		};

		try {
			if (countersSet) {
				//Набор каунтеров, надо запускать несколько раз
				for (let i = 0; i < countersSet.length; ++i) {
					preferences.ab$countersSetIndex = i;
					preferences.ab$counters = countersSet[i];
					this.#availableCounters = undefined;
					this.#setResultCalled = false;
					try {
						await main();
					} catch (e) {
						await this.setResult(this.errorToResult(e));
						if (e && e.fatal) {
							this.trace('Caught fatal error, breaking iterations');
							break;
						}
						if (!this.#loginSuccessful) {
							this.trace('Login was not successful, breaking iterations');
							break;
						}
					}
					handleSetResultNotCalled();
				}
			} else {
				await main(); // This is the starting point of user script
			}
		}catch(e){
			await this.setResult(this.errorToResult(e));
		}finally{
			handleSetResultNotCalled();
		}
	}

	decodeBase64(str: string): ArrayBuffer {
		return decode(str);
	}

	encodeBase64(buf: ArrayBuffer): string {
		return encode(buf);
	}
}

function isObject ( obj: any ): boolean {
	return obj && typeof(obj) === 'object' && !Array.isArray(obj);
}
