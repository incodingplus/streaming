import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';
import { HowLong, Finish } from './type.js';
import { check_url, dev_check_url, finish, dev_finish } from './url.js';

const app = express.Router();

const tokens = new Set<string>();

const history = new Map<string, HowLong>();
tokens.add('ca2e3b98d61c6c924bbfb20dacbb0358ac64827925653958d895d9f73c0d9454');
const workQ:string[] = [];
let isload = '';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const setToBase = (set:HowLong):string => {
    const arr:number[] = Array(Math.floor(set.length / 6) * 6).fill(0);
    const result:string[] = [];
    for(let i of set.set){
        const match = i.match(/^index(\d+)\.ts$/);
        if(match){
            arr[Number(match[1])] = 1;
        }
    }
    let k:number = 0;
    for(let i = 0; i < arr.length; i++){
        k = 2 * k + arr[i];
        if(i % 6 === 5){
            result.push(b64[k]);
            k = 0;
        }
    }
    return result.join('');
};

const binToBase = (arr:number[]):string => {
    arr.push(...Array(6 - ((arr.length + 5) % 6 + 1)).fill(0));
    const result:string[] = [];
    let k:number = 0;
    for(let i = 0; i < arr.length; i++){
        k = 2 * k + arr[i];
        if(i % 6 === 5){
            result.push(b64[k]);
            k = 0;
        }
    }
    return result.join('');
};

const baseToBin = (str:string):number[] => {
    const arr:number[] = [];
    for(let i = 0; i < str.length; i++){
        let num = b64.indexOf(str[i]);
        for(let j = 0; j < 6; j++){
            const n = num % 2;
            arr[(i + 1) * 6 - j - 1] = n;
            num = Math.floor(num / 2);
        }
    }
    return arr;
}

const makeHash = (...token:string[]) => {
    const secret = 'rockman';
    return crypto.createHmac('sha256', secret).update(token.join('')).digest('hex');
};

const main = async () => {
    try{
        await fs.promises.stat('./videos');
    } catch(err){
        await fs.promises.mkdir('./videos');
    }
    try{
        await fs.promises.stat('./logs');
    } catch(err){
        await fs.promises.mkdir('./logs');
    }
    try{
        const dir = await fs.promises.readdir('./videos');
        await fs.promises.writeFile(`./logs/${Date.now()}.json`, JSON.stringify(dir), {encoding:'utf-8'});
        for(let i of dir){
            if(i.search(/\.temp$/) > -1){
                await deleteAll(`./videos/${i}`, ['index.mp4']);
                const little = await fs.promises.readdir(`./videos/${i}`);
                if(little.length === 0){
                    await fs.promises.rmdir(`./videos/${i}`);
                }
                workQ.push(`./videos/${i.replace(/\.temp$/, '')}`);
            }
        }
        if(workQ.length !== 0)
            setHls(workQ.pop());
    } catch(err){
        console.error(err);
    }
};

const historyDelete = (token:string, dev:string = '') => async () => {
    if(history.has(token)){
        const a = history.get(token);
        history.delete(token);
        clearTimeout(a.time);
        a.time = null;
        try{
            let request = finish;
            if(dev === 'dev'){
                request = dev_finish
            }
            const status = setToBase(a);
            const obj:Finish = {
                user_id: a.user_id,
                material_id: a.material_id,
                length: a.length,
                status
            };
            await fetch(request, {
                method:'POST',
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(obj)
            });
            console.log(a);
        } catch(err){
            console.error(err);
        }
    } else {
        console.log('history 관리 문제');
    }
    
};

const deleteAll = async (url:string, except:string[] = []) => {
    const dirs = await fs.promises.readdir(url);
    const workArr = [];
    for(let i of dirs){
        if(except.every(v => v !== i))
            workArr.push(fs.promises.rm(`${url}/${i}`));
    }
    await Promise.all(workArr);
};

main();
app.use('/node_modules', express.static('./node_modules'));
app.use('/videodata', (req, res, next) => {
    if(req.path.match(/\.(m3u8|ts)$/)){
        const arr = req.path.split('/');
        const token = arr[1];
        const url = decodeURIComponent(`/${arr.slice(3, -1).join('/')}`);
        const hash = makeHash(token, url);
        if(hash === arr[2]){
            const name = decodeURIComponent(arr.slice(-1)[0]);
            if(history.has(token)){
                const obj = history.get(token);
                obj.set.add(name);
            }
            res.sendFile(name, {
                root:`./videos${url}`
            });
        }  
    } else {
        res.redirect('/video/error');
    }
});
const setHls = (url:string) => {
    if(isload){
        workQ.push(url);
    } else {
        isload = url;
        console.time('X');
        ffmpeg(`${url}.temp/index.mp4`).addOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ]).output(`${url}.temp/index.m3u8`).on('progress', e => {
            console.log(e.timemark);
        }).on('end', async () => {
            isload = '';
            try{
                await fs.promises.stat(url);
                await deleteAll(url);
                await fs.promises.rmdir(url);
            } catch(err){
                
            } finally{
                await fs.promises.rename(`${url}.temp`, url);
                console.timeEnd('X');
                if(workQ.length > 0) setHls(workQ.pop() as string);
            }
        }).on('error', async err => {
            console.error(err);
            try{
                await deleteAll(`${url}.temp`);
                await fs.promises.rmdir(`${url}.temp`);
            }catch(err){
                console.error(err);
            }
            console.timeEnd('X');
            isload = '';
            if(workQ.length > 0) setHls(workQ.pop() as string);
        }).run();
    }
};


app.post('/view', async (req, res) => {
    console.log(req.body)
    if(req.body.token && req.body.url){
        const token = req.body.token as string;
        const url = req.body.url as string;
        console.log(url, token);
        try{
            let data = {
                data:true,
                success:true
            };
            let dev = req.body.dev === 'dev' ? 'dev' : '';
            if(token !== 'admin'){
                if(dev === 'dev'){
                    const resp = await fetch(`${dev_check_url}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url.slice(1))}`);
                    data = await resp.json();
                } else {
                    const resp = await fetch(`${check_url}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url.slice(1))}`);
                    data = await resp.json();
                }
            }
            
            if(data.data && data.success){
                const hash = makeHash(token, decodeURIComponent(url));
                let str = await fs.promises.readFile('./view/video.html', { encoding:'utf-8' });
                str = str.replace('\"{{url}}\"', `\"https://in-coding.kro.kr/video/videodata/${token}/${hash}${url}/index.m3u8\"`);
                str = str.replace('\"{{token}}\"', `\"${token}\"`);
                const dir = await fs.promises.readdir(`./videos${url}`);
                console.log(`history 있는지 : ${history.has(token)}`);
                if(history.has(token)){
                    historyDelete(token, dev);
                }
                const obj:HowLong = {
                    user_id:token,
                    set:new Set<string>(),
                    length:dir.length - 2,
                    time:setTimeout(historyDelete(token, dev), 10000),
                    material_id: url.slice(1),
                    dev
                };
                history.set(token, obj);
                res.end(str);
                return;
            }
        }catch(err){
            res.redirect('/video/error');
            return;
        }
    }
    res.redirect('/video/error');
});


app.get('/keepalive', (req, res) => {
    if(req.query.token){
        const obj = history.get(req.query.token as string);
        if(obj){
            clearTimeout(obj.time);
            obj.time = setTimeout(historyDelete(obj.user_id, obj.dev), 10000);
            res.status(200);
            res.end('good');
        } else {
            res.status(404);
            res.end('bad');
        }
    }
});

app.get('/error', (req, res) => {
    res.sendFile('error.html', {
        root:'./view'
    });
});

app.get('/uploadmessage', (req, res) => {
    const hash = req.query.token as string;
    tokens.add(hash);
    setTimeout(() => {
        tokens.delete(hash);
    }, 5 * 60 * 1000);
    res.end('success');
});

app.get('/get', async (req, res) => {
    if(req.query.token && req.query.time){
        const tk = req.query.token as string;
        const time = req.query.time as string;
        const hash = makeHash(tk, time);
        if(tokens.has(hash)){
            const obj = {
                처리중:[],
                목록:[],
            };
            let start = Number(req.query.start);
            let limit = Number(req.query.limit);
            let isall = Number(req.query.isall);
            if(isNaN(start)){
                start = 0;
            }
            if(isNaN(limit)){
                limit = Infinity;
            }
            if(isNaN(isall) || isall > 2){
                isall = 0;
            }
            const dir = await fs.promises.readdir(`./videos`);
            let k = 0;
            const arr = ['처리중', '목록'];
            for(let i = start; i < dir.length; i++){
                if(isall === 1 && dir[i].search(/\.temp$/) > -1 || isall === 2 && dir[i].search(/\.temp$/) === -1){
                    continue;
                }
                k++;
                obj[arr[+!(dir[i].search(/\.temp/) + 1)]].push(dir[i]);
                if(limit <= k){
                    break;
                }
            }
            res.json(obj);
            return;
        }
    }
    res.status(404);
    res.end('bad');
})

app.get('/delete', async (req, res) => {
    if(req.query.token && req.query.time && req.query.url){
        const tk = req.query.token as string;
        const time = req.query.time as string;
        const raw = req.query.url as string;
        const hash = makeHash(tk, time);
        if(tokens.has(hash) && raw.search(/\.temp$/) === -1){
            const url = `./videos${raw}`;
            try{
                await fs.promises.stat(url);
                await deleteAll(url);
                await fs.promises.rmdir(url);
                res.end('good');
                return;
            } catch(err){
                console.log(err);
            }
        }
    }
    res.status(404);
    res.end('bad');
});

app.post('/upload', async (req, res) => {
    if(req.query.token && req.query.url && req.query.time){
        const tk = req.query.token as string;
        const time = req.query.time as string;
        const raw = req.query.url as string;
        const hash = makeHash(tk, time);
        if(tokens.has(hash) && raw.search(/\.temp$/) === -1){
            const url = `./videos${raw}`;
            const arr = url.split('/');
            for(let i = 1; i <= arr.length; i++){
                const temp = arr.slice(0, i).join('/');
                try{
                    await fs.promises.stat(temp);
                } catch(err){
                    await fs.promises.mkdir(temp);
                }
            }
            await deleteAll(url);
            const find = workQ.indexOf(url);
            if(find > -1){
                try{
                    await fs.promises.stat(`${url}.temp`);
                    await deleteAll(`${url}.temp`);
                    await fs.promises.rmdir(`${url}.temp`);
                } catch(err){
                    console.log('이상현상');
                }
                workQ.splice(find, 1);
            }
            if(isload === url){
                res.status(404);
                res.end('already encoding video');
                await fs.promises.rmdir(url);
                return;
            }
            await fs.promises.rename(url, `${url}.temp`);
            const w = fs.createWriteStream(`${url}.temp/index.mp4`);
            req.pipe(w);
            req.on('end', () => {
                res.send('upload success');
                setHls(url);
            });
        } else {
            res.status(404);
            res.end('bad');
        }
    } else {
        res.status(404);
        res.end('bad');
    }
});

export default app;