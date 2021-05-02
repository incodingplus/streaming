import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import { HowLong, Finish } from './type.js';
import { setToBase, makeHash } from './algorithm.js';

const ENV = new Map<string, string>();

const app = express.Router();

export const tokens = new Set<string>();

const history = new Map<string, HowLong>();
tokens.add('7b3fcee5b1aa32ee5ca8144671816e2534cf2335b5efa3b83af5a902c992b6d9');
const workQ:string[] = [];
let isload = '';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const main = async () => {
    try{
        const datas = JSON.parse(await fs.promises.readFile('./env.json', {encoding:'utf-8'}));
        for(let [i, v] of Object.entries(datas)){
            console.log(v);
            ENV.set(i, v as string);
        }
    } catch(err){
        console.error(err);
        return Error(err);
    }
    try{
        await fs.promises.stat(ENV.get('video'));
    } catch(err){
        await fs.promises.mkdir(ENV.get('video'));
    }
    // try{
    //     await fs.promises.stat('./logs');
    // } catch(err){
    //     await fs.promises.mkdir('./logs');
    // }
    try{
        const dir = await fs.promises.readdir(ENV.get('video'));
        // await fs.promises.writeFile(`./logs/${Date.now()}.json`, JSON.stringify(dir), {encoding:'utf-8'});
        for(let i of dir){
            if(i.search(/\.temp$/) > -1){
                await deleteAll(`${ENV.get('video')}/${i}`, ['index.mp4']);
                const little = await fs.promises.readdir(`${ENV.get('video')}/${i}`);
                if(little.length === 0){
                    await fs.promises.rmdir(`${ENV.get('video')}/${i}`);
                }
                workQ.push(`${ENV.get('video')}/${i.replace(/\.temp$/, '')}`);
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
            let request = ENV.get('finish');
            if(dev === 'dev'){
                request = ENV.get('dev_finish');
            }
            const status = setToBase(a);
            const obj:Finish = {
                user_id: a.user_id,
                material_id: a.material_id,
                length: a.length,
                status,
                ms: Date.now() - a.ms
            };
            await fetch(request, {
                method:'POST',
                headers:{
                    'Content-Type':'application/json'
                },
                body:JSON.stringify(obj)
            });
            console.log(obj);
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
                root:`${ENV.get('video')}${url}`
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
            if(token !== '7b3fcee5b1aa32ee5ca8144671816e2534cf2335b5efa3b83af5a902c992b6d9'){
                if(dev === 'dev'){
                    const resp = await fetch(`${ENV.get('dev_check_url')}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url.slice(1))}`);
                    data = await resp.json();
                } else {
                    const resp = await fetch(`${ENV.get('check_url')}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url.slice(1))}`);
                    data = await resp.json();
                }
            }
            
            if(data.data && data.success){
                const hash = makeHash(token, decodeURIComponent(url));
                let str = await fs.promises.readFile('./view/video.html', { encoding:'utf-8' });
                str = str.replace('\"{{url}}\"', `\"/video/videodata/${token}/${hash}${url}/index.m3u8\"`);
                str = str.replace('\"{{token}}\"', `\"${token}\"`);
                const dir = await fs.promises.readdir(`${ENV.get('video')}${url}`);
                console.log(`history 있는지 : ${history.has(token)}`);
                if(history.has(token)){
                    await historyDelete(token, dev)();
                }
                const obj:HowLong = {
                    user_id:token,
                    set:new Set<string>(),
                    length:dir.length - 2,
                    time:setTimeout(historyDelete(token, dev), 10000),
                    material_id: url.slice(1),
                    ms:Date.now(),
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

app.get('/error', (req, res) => {
    res.sendFile('error.html', {
        root:'./view'
    });
});

//token 체크
app.use('/', (req, res, next) => {
    if(req.query.token){
        next();
    } else {
        res.status(404);
        res.end('token이 빠져있음');
    }
});

app.get('/keepalive', (req, res) => {
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
});

app.get('/uploadmessage', (req, res) => {
    const hash = req.query.token as string;
    tokens.add(hash);
    setTimeout(() => {
        tokens.delete(hash);
    }, 5 * 60 * 1000);
    res.end('success');
});

//time 및 hash 체크
app.use('/', (req, res, next) => {
    if(req.query.time){
        const tk = req.query.token as string;
        const time = req.query.time as string;
        const hash = makeHash(tk, time);
        if(tokens.has(hash)){
            next();
        } else {
            res.status(404);
            res.end('잘못된 토큰');
        }
    } else {
        res.status(404);
        res.end('time이 빠져있음');
    }
});

app.get('/get', async (req, res) => {
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
    const dir = await fs.promises.readdir(`${ENV.get('video')}`);
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
});


//url체크
app.use('/', (req, res, next) => {
    if(req.query.url){
        const raw = req.query.url as string;
        if(raw.search(/\.temp$/) === -1){
            next();
        } else {
            res.status(404);
            res.end('잘못된 url');
        }
    } else {
        res.status(404);
        res.end('url이 빠져있음');
    }
});

app.get('/delete', async (req, res) => {
    const url = `${ENV.get('video')}${req.query.url}`;
    try{
        await fs.promises.stat(url);
        await deleteAll(url);
        await fs.promises.rmdir(url);
        res.end('good');
        return;
    } catch(err){
        console.log(err);
        res.status(404);
        res.end('해당 url 없음');
    }
});

app.post('/upload', async (req, res) => {
    const url = `${ENV.get('video')}${req.query.url}`;
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
    res.send('upload success');
    req.pipe(w);
    req.on('end', () => {
        setHls(url);
    });
});

export default app;