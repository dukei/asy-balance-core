import https from 'https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import request from "request";
 
const info = {
    host: 'br41.nordvpn.com',
    userId: 'your-name@gmail.com',
    password: 'abcdef12345124'
};
//const agent = new SocksProxyAgent('socks5://suautu:vJclUrTHvf@171.22.181.183:24532/');
const agent = new SocksProxyAgent('socks5://localhost:9150/');
 
https.get('https://jsonip.org', { agent }, (res) => {
    console.log('https:', res.headers);
    res.pipe(process.stdout);
});

let options = {
    uri: 'https://jsonip.org',
    agent: agent,
    headers: {
        'User-Agent': 'Request-Promise'
    }
}

request(options, (err: any, response: request.Response, body: any) => {
    if (err)
        console.error('\nrequest: ', err);
    else
        console.log('\nrequest: ', response.body);
});
