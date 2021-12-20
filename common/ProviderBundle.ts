import ProviderFiles, {ProviderFilesMaker} from "./ProviderFiles";
import XmlJS, {ElementCompact, Element} from 'xml-js';
import log from "./log";
import {
    AsyBalanceInnerResultApi, AsyBalanceInnerRetrieveApi,
    AsyBalanceInnerStorageApi,
    AsyBalanceInnerTraceApi,
    AsyBalancePreferences, AsyBalanceResult
} from "../api/api";
import AsyBalanceImpl from "../api/ApiInnerImpl";
import AsyBalanceNodeStorageImpl from "../api/ApiInnerStorageImpl";
import AsyBalance from "../api/ApiImpl";
import crypto from 'crypto';
import AsyBalanceResultImpl from "../api/ApiInnerResultImpl";
import AsyBalanceTraceImpl from "../api/ApiInnerTraceImpl";

function getText(element: ElementCompact): string | undefined{
    function pushTo(texts: Array<string|number>, value: string | number | Array<string>){
       if(Array.isArray(value)){
           texts.push.apply(texts, value.map(v => v.trim()));
       }else{
           texts.push(value.toString().trim());
       }
    }

    let texts: Array<string|number> = [];
    if(element._text !== undefined){
        pushTo(texts, element._text);
    }
    if(element._cdata !== undefined){
        pushTo(texts, element._cdata);
    }

    return texts.length ? texts.join(' ') : undefined;
}

export type ExecutionParams = {
    task?: string
    accId?: string
    preferences?: AsyBalancePreferences
    apiStorage?: AsyBalanceInnerStorageApi
    apiResult?: AsyBalanceInnerResultApi
    apiTrace?: AsyBalanceInnerTraceApi
    apiRetrieve?: AsyBalanceInnerRetrieveApi
    converter_main?: (data: AsyBalanceResult) => AsyBalanceResult
    proxy?: string
    timeout?: number
    outer?: object
}

export class AsyBalanceProvider {
    public readonly name: string;
    public readonly id: string;
    public readonly version: number;
    public readonly description: string;

    private files: ProviderFiles;
    private readonly manifest: ElementCompact;
    private script?: string;

    private constructor(files: ProviderFiles, manifest: string) {
        this.files = files;

        const mdom: ElementCompact = XmlJS.xml2js(manifest, {compact: true});
        const mprov = mdom.provider;
        this.manifest = mprov;

        this.name = getText(mprov.name)!;
        this.id = getText(mprov.id)!;
        this.description = getText(mprov.description)!;
        this.version = +mprov.id._attributes.version;
    }

    public static async create(filePathOrBuffer: string | Buffer): Promise<AsyBalanceProvider>{
        let files = ProviderFilesMaker.createFrom(filePathOrBuffer);
        let manifest = await files.getManifest();
        return new AsyBalanceProvider(files, manifest);
    }

    public async getScript(): Promise<string>{
        if(this.script)
            return this.script;

        let jsfiles = this.manifest.files.js;
        let scripts: Array<string> = [];
        if(Array.isArray(jsfiles)){
            scripts.push.apply(scripts, jsfiles.map(o => getText(o)!));
        }else{
            scripts.push(getText(jsfiles)!)
        }

        let scriptContents = [];

        for(let name of scripts){
            scriptContents.push(await this.files.getText(name));
        }

        this.script = scriptContents.join('\n')
        return this.script;
    }

    public async getPreferences(): Promise<string|null>{
        let elem = this.manifest.files.preferences;
        if(!elem)
            return null;
        let fname = getText(elem);
        if(!fname)
            return null;
        return await this.files.getText(fname);
    }

    public getCounters(): string{
        let xml = XmlJS.js2xml(this.manifest.counters, {compact: true});
        return xml;
    }

    public async getIcon(): Promise<Buffer|null>{
        let elem = this.manifest.files.icon;
        if(!elem)
            return null;
        let fname = getText(elem);
        if(!fname)
            return null;
        return await this.files.getFile(fname);
    }

    public async getMaskedPreferences(): Promise<string[]> {
        let elem = this.manifest.files.preferences;
        if(!elem)
            return [];
        let fname = getText(elem);
        if(!fname)
            return [];
        let prefs = await this.files.getText(fname);
        if(!prefs)
            return [];
        let prefsElem = XmlJS.xml2js(prefs, {compact: false}) as Element;

        let maskElements = this.findElements(prefsElem, elem => elem.name === 'EditTextPreference' && /password/i.test(elem.attributes?.inputType + ''));
        return maskElements.map(e => e.attributes?.key + '');
    }

    private findElements(elem: Element, pred: (elem: Element) => boolean): Element[] {
        const ret: Element[] = [];
        if(pred(elem))
            ret.push(elem);
        if(elem.elements) {
            for (let e of elem.elements){
                const ret1 = this.findElements(e, pred);
                if(ret1.length)
                    ret.push.apply(ret, ret1);
            }
        }
        return ret;
    }

    public async execute(params: ExecutionParams): Promise<AsyBalanceResult[]>{
        const accId = params.accId || crypto.createHash('md5').update(JSON.stringify(params.preferences) || 'undefined').digest('hex');
        const logName = `ID:${accId} (${this.id})`;

        log.info('About to execute account ' + logName);

        let asimpl = new AsyBalanceImpl({
            proxy: params.proxy
        });

        let stimpl = params.apiStorage || new AsyBalanceNodeStorageImpl(accId);
        let rtimpl = new AsyBalanceResultImpl(params.apiResult);
        let trimpl = params.apiTrace || new AsyBalanceTraceImpl();

        let AnyBalance = new AsyBalance({
            api: asimpl,
            apiStorage: stimpl,
            apiResult: rtimpl,
            apiTrace: trimpl,
            apiRetrieve: params.apiRetrieve,
            preferences: params.preferences,
        });

        const {VM} = require('vm2');

        const vm = new VM({
            timeout: params.timeout || 3000000,
            sandbox: {
                AnyBalance: AnyBalance,
                Outer: params.outer
            }
        });

        let script = await this.getScript();

        log.info('Starting account ' + logName);

        try {
            //В случае использования browserify main объявляется как global.main.
            // Для подхватывания её нужно объявить main почему-то
            await vm.run(`${script}
                var main=global.main;
                (async()=>{
                    await AnyBalance.execute(() => main(${JSON.stringify(params.task)}));
                })();
	        `);

            log.info("Account " + logName + " finished successfully!");
        }catch(e: any){
            log.error("Account " + logName + " execution error: " + e.stack);
        }

        return rtimpl.getResults();

    }

}