/**
 *  Проверяет, является ли объект массивом
 */
import {
    AsyAuthParams,
    AsyBalanceInnerApi,
    AsyCapabilities,
    AsyCookie,
    AsyCookieExt,
    AsyResponseInterface,
    AsyRetrieveOptions,
    OPTIONS,
    OptionsParam,
    StringBundle,
    StringCallResponse,
    StringMap,
    StringTuple
} from "./api";

import request, {CookieJar} from "request";
import * as tough from "tough-cookie";
import * as util from "util";
import iconv from "iconv-lite";

const NodePersist = require('node-persist');
const Charset = require('charset');

const DEFAULT_CHARSET = "utf-8";

function isObject ( obj: any ) {
    return obj && typeof(obj) === 'object' && !Array.isArray(obj);
}

function abd_getOption(options: OptionsParam, option: OPTIONS, domain: string){
    var domains = options.perDomain;
    if(!domains || !domain)
        return options[option];

    //Если такой домен есть и там есть эта опция, возвращаем прям его
    var domainO = domains[domain];
    if(domainO && domainO[option] !== undefined)
        return domainO[option];

    //В противном случае придется матчить регулярными выражениями, а они берутся в /
    for(var dom in domains){
        const dominfo = domains[dom];
        if(dom.startsWith('.')) //Если домен начинается с точки, это все поддомены этого домена
            dom = '/' + dom.replace(/\./g, '\\.') + '$/';
        var matches = dom.match(/^\/(.*)\/$/);
        if(!matches)
            continue; //ЭТо не паттерн
        var re = new RegExp(matches[1], 'i');
        if(re.test(domain)){
            domainO = dominfo;
            if(domainO && domainO[option] !== undefined)
                return domainO[option];
        }
    }

    return options[option];
}

function joinOptions(optionBase: OptionsParam, optionNew: OptionsParam): void {
    for (let option in optionNew) {
        let val = optionNew[option];
        if (val === null) {
            delete optionBase[option];
        } else if (optionBase[option] === undefined || !isObject(val)) {
            if(!isObject(val)) {
                optionBase[option] = val;
            }else{
                let v = optionBase[option];
                if(!isObject(v))
                    v = {};
                optionBase[option] = v;
                joinOptions(v, val);
            }
        } else {
            joinOptions(optionBase[option], val);
        }
    }
}

function joinOptionsToNew(optionBase: OptionsParam, optionNew: OptionsParam): OptionsParam {
    let o = JSON.parse(JSON.stringify(optionBase));
    joinOptions(o, optionNew);
    return o;
}

export default class AsyBalanceImpl implements AsyBalanceInnerApi{
    private readonly request: request.RequestAPI<request.Request, request.CoreOptions, request.RequiredUriUrl>;
    private readonly cookieStore = new tough.MemoryCookieStore();
    private readonly cookieJar: CookieJar;
    private storage?: any;
    private options: OptionsParam = {};
    private auth?: { pass: string; user: string };

    constructor(params: {
        accId?: string
        proxy?: string
    } = {}){
        if(params.accId) {
            this.storage = NodePersist.create({
                dir: 'asybalance'
            })
        }
        this.options.proxy = params.proxy;
        this.cookieJar = request.jar(this.cookieStore);
        this.request = request.defaults({
            jar: this.cookieJar,
            gzip: true,
            encoding: null,
            strictSSL: false,
            forever: true,
        })
    }

    clearAuthentication(): Promise<StringCallResponse<void>> {
        this.auth = undefined;
        return Promise.resolve({payload: undefined});
    }

    getCapabilities(): Promise<StringCallResponse<AsyCapabilities>> {
        return Promise.resolve({payload: {}});
    }

    async getCookies(): Promise<StringCallResponse<AsyCookie[]>> {
        let cookies = await util.promisify(this.cookieStore.getAllCookies.bind(this.cookieStore))();
        let outCookies: AsyCookie[] = [];
        for(let c of cookies){
            let domain = c.domain;
            if(c.hostOnly === false && domain)
                domain = '.' + domain;

            let expires: string | undefined = undefined;
            if(c.expires instanceof Date && !isNaN(c.expires.getTime()))
                expires = c.expires.toDateString();

            outCookies.push({
                name: c.key,
                value: c.value,
                domain: domain || '',
                expires: expires,
                httpOnly: c.httpOnly,
                secure: c.secure,
                path: c.path || '/',
                persistent: !!expires
            });
        }
        return {payload: outCookies};
    }

    getLevel(): Promise<StringCallResponse<number>> {
        return Promise.resolve({payload: 1});
    }

    async requestPost(url: string, data: string|ArrayBuffer|StringBundle|null, json: boolean, headers: string|StringBundle|null, options: string|OptionsParam|null): Promise<StringCallResponse<AsyResponseInterface>> {
        //приводим тип опций
        let _options: OptionsParam = {};
        if(typeof(options) === 'string')
            _options = JSON.parse(options);
        else if(options !== null){
            _options = options;
        }

        //приводим тип хедеров
        let _headers: StringMap = {};
        if(typeof(headers) === 'string'){
            headers = JSON.parse(headers);
        }
        if(headers !== null){
            if(Array.isArray(_headers)){
                for(let h of _headers){
                    _headers[h[0]] = h[1];
                }
            }else{
                _headers = headers as StringMap;
            }
        }

        let domatch = /:\/\/([^\/]+)/.exec(url), domain = domatch && domatch[1];
        if (!domain)
            throw new Error("Malformed url for request: " + url);

        let local_options = _options.options ? joinOptionsToNew(this.options, _options.options): this.options;
        let method = _options[OPTIONS.HTTP_METHOD] || abd_getOption(local_options, OPTIONS.HTTP_METHOD, domain) || 'POST';
        let defCharset = abd_getOption(local_options, OPTIONS.DEFAULT_CHARSET, domain) || DEFAULT_CHARSET;
        let input_charset = abd_getOption(local_options, OPTIONS.REQUEST_CHARSET, domain) || defCharset;

        let _data: Buffer;
        if(data && !/^utf-8|base64|binary$/i.test(input_charset))
            throw new Error('Only UTF-8, base64 or binary request charset is supported!');

        if(json || (data && typeof(data) !== 'string')){
            let _d: StringBundle = {};
            if(json && typeof(data) === 'string') {
                _d = JSON.parse(data);
            }else if(data !== null){
                _d = data as StringBundle;
            }

            if(Array.isArray(_d)){
                const __d: StringTuple[] = _d;
                _data = Buffer.from(__d.map((t => encodeURIComponent(t[0]) + '=' + encodeURIComponent(t[1]))).join('&'), "utf-8");
            }else{
                const __d: StringMap = _d;
                _data = Buffer.from(Object.keys(__d as StringMap).map(n => encodeURIComponent(n) + '=' + encodeURIComponent(__d[n])).join('&'), "utf-8");
            }
            if(!_headers['Content-Type'])
                _headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }else if((data as any) instanceof ArrayBuffer){
            _data = Buffer.from(data as any as ArrayBuffer);
        }else if(data && input_charset === 'base64'){
            _data = Buffer.from(data, 'base64');
        }else if(data){
            _data = Buffer.from(data, 'utf-8');
        }

        let proxy = abd_getOption(local_options, OPTIONS.PROXY, domain);

        let response: request.Response = await new Promise((resolve, reject) => {
            this.request({
                url: url,
                method: method,
                headers: _headers,
                body: _data,
                auth: this.auth,
                proxy: proxy,
            }, (err: any, response: request.Response, body: any) => {
                if(err)
                    reject(err);
                resolve(response);
            });
        });

        let body: Buffer = response.body;
        if(/image\//.test(response.headers["content-type"] || ''))
            defCharset = 'base64'; //По-умолчанию, картинки в base64

        let charset = abd_getOption(local_options, OPTIONS.FORCE_CHARSET, domain) || Charset(response.headers, body) || defCharset;
        let output: string|ArrayBuffer;
        if(charset === 'base64') {
            output = body.toString('base64');
        }else if(charset === 'binary') {
            output = body.buffer;
        }else{
            if (!iconv.encodingExists(charset))
                charset = charset.replace('windows-', 'windows');
            if (!iconv.encodingExists(charset))
                throw new Error('Unknown encoding: ' + charset);
            output = iconv.decode(body, charset);
        }

        let headersOut: StringTuple[] = [];
        for(let i=0; i<response.rawHeaders.length; i+=2){
            headersOut.push([response.rawHeaders[i], response.rawHeaders[i+1]]);
        }

        let params: AsyResponseInterface = {
            status: 'HTTP/' + response.httpVersion + ' ' + response.statusCode + ' ' + response.statusMessage,
            headers: headersOut,
            url: response.request.uri.href,
            body: output,
        };

        return {payload: params}
    }

    async retrieveCode(comment: string, image: string, options: string | AsyRetrieveOptions | null): Promise<StringCallResponse<string>> {
        throw new Error("Not implemented");
    }

    setAuthentication(name: string, pass: string, authscope: string | AsyAuthParams | null): Promise<StringCallResponse<void>> {
        this.auth = {
            user: name,
            pass: pass
        };
        return Promise.resolve({payload: undefined});
    }

    setCookie(domain: string, name: string, value: string | null, params: string | AsyCookieExt | null): Promise<StringCallResponse<void>> {
        let _params: AsyCookieExt = typeof(params) === 'string' ? JSON.parse(params) : params || {};
        let expires = null;
        if(value === null)
            expires = new Date(1);
        else if(_params.expires)
            expires = new Date(_params.expires);

        let cookieProps: tough.Cookie.Properties = {
            key: name,
            value: value || undefined,
            expires: expires || new Date(Infinity),
            httpOnly: _params.httpOnly,
            domain: domain,
            path: _params.path,
            secure: _params.secure,
            hostOnly: true,
        };

        if(domain.startsWith('.')){
            cookieProps.hostOnly = false;
            domain = domain.substr(1);
            cookieProps.domain = domain;
        }

        let cookie = new tough.Cookie(cookieProps);

        this.cookieJar.setCookie(cookie, 'https://' + domain + (_params.path || ''));
        return Promise.resolve({payload: undefined});
    }

    setOptions(options: string | OptionsParam): Promise<StringCallResponse<void>> {
        let _options: OptionsParam;
        if(typeof options === 'string')
            _options = JSON.parse(options);
        else
            _options = options;

        joinOptions(this.options, _options);
        return Promise.resolve({payload: undefined});
    }

    async sleep(ms: number): Promise<StringCallResponse<void>> {
        await require('sleep-promise')(ms);
        return Promise.resolve({payload: undefined});
    }
}