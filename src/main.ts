import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';
import { HowLong } from './type.js';
import { checkurl, howlong } from './url.js';

const app = express.Router();



const history = new Map<string, HowLong>();


ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const makeHash = (...token:string[]) => {
    const secret = 'rockman';
    return crypto.createHmac('sha256', secret).update(token.join('')).digest('hex');
}

const main = async () => {
    try{
        await fs.promises.stat('./videos');
    } catch(err){
        await fs.promises.mkdir('./videos');
    }
};

const historyDelete = token => async () => {
    const a = history.get(token);
    history.delete(token);
    a.size = a.set.size;
    a.time = null;
    try{
        await fetch(howlong, {
            method:'POST',
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify(a)
        });
    } catch(err){
        console.error(err);
    }
};

main();

const tokens = new Set<string>();
app.use('/node_modules', express.static('./node_modules'));
app.use('/videodata', (req, res, next) => {
    if(req.path.match(/\.(m3u8|ts)$/)){
        const arr = req.path.split('/');
        const token = arr[1];
        const url = decodeURIComponent(`/${arr.slice(3, -1).join('/')}`);
        const hash = makeHash(token, url);
        if(hash === arr[2]){
            const name = decodeURIComponent(arr.slice(-1)[0]);
            const obj = history.get(token);
            obj.set.add(name);
            res.sendFile(name, {
                root:`./videos${url}`
            });
        }  
    } else {
        res.redirect('/video/error');
    }
});
tokens.add('ca2e3b98d61c6c924bbfb20dacbb0358ac64827925653958d895d9f73c0d9454');
const workQ:string[] = [];
let isload = false;
const setHls = (url:string) => {
    if(isload){
        workQ.push(url);
    } else {
        isload = true;
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
            isload = false;
            await fs.promises.rename(`${url}.temp`, url);
            if(workQ.length > 0) setHls(workQ.pop() as string);
            console.timeEnd('X');
        }).on('error', err => {
            console.error(err);
            isload = false;
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
            if(token !== 'admin'){
                const resp = await fetch(`${checkurl}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}`);
                data = await resp.json();
            }
            
            if(data.data && data.success){
                const hash = makeHash(token, decodeURIComponent(url));
                let str = await fs.promises.readFile('./view/video.html', { encoding:'utf-8' });
                str = str.replace('\"{{url}}\"', `\"https://in-coding.kro.kr/video/videodata/${token}/${hash}${url}/index.m3u8\"`);
                str = str.replace('\"{{token}}\"', `\"${token}\"`);
                const dir = await fs.promises.readdir(`./videos${url}`);
                const obj:HowLong = {
                    user_id:token,
                    set:new Set<string>(),
                    length:dir.length - 2,
                    size:0,
                    time:setTimeout(historyDelete(token), 10000),
                    material_id: url.slice(1)
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
            obj.time = setTimeout(historyDelete(obj.user_id), 10000);
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

app.post('/upload', async (req, res) => {
    const tk = req.query.token as string;
    const hash = makeHash(tk);
    if(tokens.has(hash)){
        const url = `./videos${req.query.url as string}`;
        const arr = url.split('/');
        for(let i = 1; i <= arr.length; i++){
            const temp = arr.slice(0, i).join('/');
            try{
                await fs.promises.stat(temp);
            } catch(err){
                await fs.promises.mkdir(temp);
            }
        }
        const dirs = await fs.promises.readdir(url);
        const workArr = [];
        for(let i of dirs){
            workArr.push(fs.promises.rm(`${url}/${i}`));
        }
        await Promise.all(workArr);
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
});

export default app;