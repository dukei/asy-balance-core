import ProviderConsts from "./ProviderConsts";
import * as fs from 'fs';
import path from "path";
import AdmZip from "adm-zip";

export default interface ProviderFiles{
    getManifest(): Promise<string>
    getFile(name: string): Promise<Buffer>
    getText(name: string): Promise<string>
}

export class ProviderFilesMaker{
    public static createFrom(fileNameOrRawData: Buffer|string): ProviderFiles{
        if(typeof(fileNameOrRawData) === 'string'){
            if(fs.lstatSync(fileNameOrRawData).isDirectory()){
                return new ProviderFilesFS(fileNameOrRawData);
            }else{
                return new ProviderFilesZip(fileNameOrRawData);
            }
        }else{
            return new ProviderFilesZip(fileNameOrRawData);
        }
    }
}

export class ProviderFilesFS implements ProviderFiles{
    private readonly basedir: string;

    constructor(basedir: string){
        this.basedir = basedir;
    }

    async getFile(name: string): Promise<Buffer> {
        return fs.promises.readFile(path.join(this.basedir, name));
    }

    async getText(name: string): Promise<string> {
        let buf = await this.getFile(name);
        return buf.toString('utf-8');
    }

    async getManifest(): Promise<string> {
        return this.getText(ProviderConsts.MANIFEST_NAME);
    }
}

export class ProviderFilesZip implements ProviderFiles{
    private zip: AdmZip;
    constructor(fileNameOrRawData: Buffer|string) {
        this.zip = new AdmZip(fileNameOrRawData)
    }

    async getFile(name: string): Promise<Buffer> {
        const entry = this.zip.getEntry(name);
        if(!entry)
            throw new Error("Can not find zip entry \"" + name + "\"");
        return Promise.resolve(entry.getData());
    }

    async getManifest(): Promise<string> {
        return this.getText(ProviderConsts.MANIFEST_NAME);
    }

    async getText(name: string): Promise<string> {
        const buf = await this.getFile(name);
        return buf.toString('utf-8');
    }
}