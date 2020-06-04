export interface AsyBalanceResultError {
    readonly error: true;
    readonly message: string;
    readonly e?: Error;
    readonly investigate?: boolean;
    readonly unhandled?: boolean;
}

export interface AsyBalanceResultSuccess {
    readonly success: true
    [name: string]: any
}

export type AsyBalanceResult = AsyBalanceResultError | AsyBalanceResultSuccess


export interface AsyBalanceInnerApi {
    requestPost(url: string, data: string|StringBundle|ArrayBuffer|null, json: boolean, headers: string|StringBundle|null, options: string|OptionsParam|null): Promise<StringCallResponse<AsyResponseInterface>>

    getLevel(): Promise<StringCallResponse<number>>;
    setAuthentication(name: string, pass: string, authParams: string | AsyAuthParams | null): Promise<StringCallResponse<void>>;
    clearAuthentication(): Promise<StringCallResponse<void>>;
    setCookie(domain: string, name: string, value: string | null, params: string | AsyCookieExt | null): Promise<StringCallResponse<void>>
    getCookies(): Promise<StringCallResponse<AsyCookie[]>>

    setOptions(strOption: string | OptionsParam): Promise<StringCallResponse<void>>;

    sleep(ms: number): Promise<StringCallResponse<void>>;

    retrieveCode(comment: string, image: string, options: string | AsyRetrieveOptions | null): Promise<StringCallResponse<string>>;

    getCapabilities(): Promise<StringCallResponse<AsyCapabilities>>;
}

export interface AsyBalanceInnerStorageApi{
    loadData(): Promise<StringCallResponse<string>>;
    saveData(data: string): Promise<StringCallResponse<void>>;
}

export interface AsyBalanceInnerResultApi{
    setResult(data: string | AsyBalanceResult): Promise<StringCallResponse<void>>;
}

export interface AsyBalanceInnerTraceApi{
    trace(msg: string, callee: string): Promise<StringCallResponse<void>>;
}

export interface AsyBalanceApi {
    getPreferences(): AsyBalancePreferences;
    /**
     * Возвращает возможности этой реализации API
     */
    getCapabilities(): Promise<AsyCapabilities>;

    /**
     * returns true if at least one of supplied counters is selected by a user for retrieving
     *
     * @param arrOrString can be string or array of strings
     */
    isAvailable(...arrOrString: string[] | string[][]): boolean;

    /**
     * Set cookie for this session
     * @param domain
     * @param name
     * @param value
     * @param params
     */
    setCookie(domain: string, name: string, value?: string | null, params?: AsyCookieExt): Promise<void>;

    /**
     * Получает сохраненные при аккаунте данные
     * @param name
     * @param defaultValue
     */
    getData(name: string, defaultValue?: any): Promise<any>;

    /**
     * Устанавливает сохраняемые при аккаунте данные
     * @param name
     * @param value
     */
    setData(name: string, value?: any): void;

    /**
     * Физически сохраняет все данные в аккаунт, если они были модифицированы
     * @param forceSave
     */
    saveData(forceSave?: boolean): void;

    clearData(): void;

    isDataDirty(): void;

    /**
     * Сохраняет все куки на будущее
     */
    saveCookies(paramName?: string): Promise<void>;

    /**
     * Восстанавливает все ранее сохраненные куки
     */
    restoreCookies(paramNameOrCookies?: string | AsyCookie[]): Promise<void>;

    /**
     * Get AnyBalance API version
     */
    getLevel(): Promise<number>;

    /**
     * Write message to an account log
     * This log can be viewed in AnyBalance program
     * Useful for debugging
     *
     * @param msg - message
     * @param caller - context hint
     */
    trace(msg: string, caller: string): Promise<void>;

    requestGet(url: string, headers?: StringBundle | null, options?: OptionsParam | null): Promise<AsyResponse>;

    /**
     * Sends post request
     * @param url
     * @param data
     * @param headers
     * @param options
     */
    requestPost(url: string, data?: string | ArrayBuffer | StringBundle | null, headers?: StringBundle | null, options?: OptionsParam | null): Promise<AsyResponse>;

    /**
     * Set authentication parameters for this session
     * These parameters apply for all subsequent requests
     * @param name
     * @param pass
     * @param authscope
     */
    setAuthentication(name: string, pass: string, authscope?: AsyAuthParams): Promise<void>;

    /**
     * Get all cookies for this session
     */
    getCookies(): Promise<AsyCookie[]>;

    /**
     * Get cookie value by name
     * @param name
     * @param params
     */
    getCookie(name: string, params?: CookieParams): Promise<string | false>;

    /**
     * retrieves graphical or sms code
     * @param comment
     * @param image
     * @param options
     */
    retrieveCode(comment: string, image?: string | null, options?: RetrieveParams): Promise<string>;

    /**
     * Clears authentication parameters in this session
     */
    clearAuthentication(): Promise<void>;

    /*
     * returns true is setResult has already been called in this session
     */
    isSetResultCalled(): boolean;

    //Sets result of counters retrieval
    //data is object containing all counters
    //you must specify 'success': true or 'error': true for AnyBalance can distinguish results between success and error
    setResult(data: AsyBalanceResult): Promise<void>;

    /**
     * Sets several options for api
     *
     * @param data {option: value, option: value, ...}
     */
    setOptions(data: OptionsParam): Promise<void>;

    /**
     * Suspend execution by specified number of milliseconds
     */
    sleep(ms: number): Promise<void>;

    /**
     * returns array of strings - names of user selected counters in user order
     */
    getAvailableCounters(): string[];

    setDefaultCharset(charset: string): Promise<void>;

    /**
     *  Устанавливает флаг, что логин удался, то есть, последующие вызовы могут использовать залогиненность
     */
    setLoginSuccessful(): void;

    execute(main: () => Promise<void>): Promise<void>;

    encodeBase64(buf: ArrayBuffer): string;
    decodeBase64(str: string): ArrayBuffer;
}

export type AsyBalancePreferences = {[name: string]: any};

export type AsyBalanceParams = {
    preferences?: AsyBalancePreferences,
    signature?: string,
    stringRPC?: (str: string) => Promise<string | null>,
    api_stringified?: boolean,
    api?: AsyBalanceInnerApi,
    apiStorage?: AsyBalanceInnerStorageApi,
    apiResult?: AsyBalanceInnerResultApi,
    apiTrace?: AsyBalanceInnerTraceApi,
    converter_main?: (data: AsyBalanceResult) => AsyBalanceResult,
}

export type AsyBalanceUserErrorParam = {allow_retry?: boolean, fatal?: boolean, [name: string]: any};

export type CookieParams = {
    path?: string
    domain?: string
    allcookies?: AsyCookie[]
}

export enum RetrieveInputType {
    number = 'number',
    text = 'text',
    textEmailAddress = 'textEmailAddress',
}

export type RetrieveParams = {
    inputType: RetrieveInputType
    time: number
}

export type AsyCookieBase = {
    name: string
    domain: string
    value?: string
}

export type AsyCookieExt = {
    path?: string
    persistent?: boolean
    expires?: string
    secure?: boolean
    httpOnly?: boolean
}

export type AsyCookie = AsyCookieBase & AsyCookieExt;

export enum OPTIONS {
    OPTIONS = "options", //override to default options
    DEFAULT_CHARSET = "defaultCharset", //default charset for responses
    FORCE_CHARSET = "forceCharset", //forced charset for responses
    REQUEST_CHARSET = "requestCharset", //charset for POST body
    PROXY = "proxy", //https proxy for requests
    SSL_ENABLED_PROTOCOLS = "sslEnabledProtocols", //[string, string,...]
    SSL_ENABLED_PROTOCOLS_ADD = "sslEnabledProtocolsAdd", //[string, string,...]
    SSL_ENABLED_PROTOCOLS_REMOVE = "sslEnabledProtocolsRemove", //[string, string,...]
    SSL_ENABLED_CIPHER_SUITES = "sslEnabledCipherSuites", //[string, string,...]
    SSL_ENABLED_CIPHER_SUITES_ADD = "sslEnabledCipherSuitesAdd", //[string, string,...]
    SSL_ENABLED_CIPHER_SUITES_REMOVE = "sslEnabledCipherSuitesRemove", //[string, string,...]
    PER_DOMAIN = "perDomain", //[{string => {options}, ...]
    HTTP_METHOD = "httpMethod", //POST|GET|PUT|DELETE|OPTIONS|TRACE|HEAD
}

export enum HTTP_METHOD {
    GET= 'GET',
    POST = 'POST',
    OPTIONS = 'OPTIONS',
    DELETE = 'DELETE',
    PUT = 'PUT',
    HEAD = 'HEAD',
}

export type StringTuple = [string, string]
export type StringMap = {[name: string]: string}
export type StringBundle = StringTuple[] | StringMap

type OptionsParamSimple = {
    [OPTIONS.DEFAULT_CHARSET]?: string,
    [OPTIONS.FORCE_CHARSET]?: string,
    [OPTIONS.REQUEST_CHARSET]?: string,
    [OPTIONS.HTTP_METHOD]?: HTTP_METHOD,
    [OPTIONS.PROXY]?: string,
    [name: string]: any,
}

export type OptionsParam = {
    [OPTIONS.PER_DOMAIN]?: {[domain: string]: OptionsParamSimple},
    [OPTIONS.OPTIONS]?: OptionsParamSimple
} & OptionsParamSimple;

export type CallErrorResponse = {
    error: true,
    message: string
}

export type CallSuccessResponse<T> = {
    payload: T
}

export type CallResponse<T> = CallErrorResponse | CallSuccessResponse<T>;

export type StringCallResponse<T> = string | CallResponse<T>;

export type AsyCapabilities = {

}

export type AsyRetrieveOptions = {
    inputType?: string,
    time?: number
}

export type AsyAuthParams = {

}

export interface AsyResponseInterface{
    readonly headers: StringTuple[]
    readonly url: string
    readonly status: string
    readonly body: string | ArrayBuffer
}

export interface AsyResponse extends AsyResponseInterface{
    getString(): string;
    getBuffer(): ArrayBuffer;
    getJson(): any;

    /**
     * Get the last response url
     */
    getLastUrl(): string;

    /**
     * Get the last response status string
     */
    getLastStatusString(): string;

    /**
     * Get the last response integer status code
     */
    getLastStatusCode(): number;

    /**
     * Get the array of last response headers [[name, value], ...]
     */
    getLastResponseHeaders(): StringTuple[];

    /**
     * Get value of the first header with the specified name
     * @param name
     */
    getLastResponseHeader(name: string): string | false;

}
