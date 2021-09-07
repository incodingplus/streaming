import path from 'path'
import express from 'express';
import { Readable } from 'stream'

import * as fetch from './fetch'
import { HowLong, Finish } from './type';
import { setToBase, makeHash } from './algorithm';
import { AutoRemoveMap } from './autoRemove';
import * as s3 from './s3'
import { getViewHTML } from './view'
import { tokens } from './token'
import { validateHash, validateToken, validateURL } from './middleware'
import { getVideoLength } from './ffmpeg'
import { isInEncoding, startEncode } from './encode'

const app = express.Router();

const history = new AutoRemoveMap<string, HowLong>();

history.on('set', () => {
    console.debug('history 추가됨')
})
history.on('delete', () => {
    console.debug('history 삭제됨')
})
history.on('resetTimeout', () => {
    console.debug('history resetTimeout')
})

const sendWatchStatus = async ({ set, length, files, user_id, material_id, ms, dev }: HowLong) => {
    try{
        const request = dev === 'dev' ? process.env.DEV_FINISH : process.env.FINISH;
        const status = setToBase({ set, length, files });
        const obj: Finish = {
            user_id: user_id,
            material_id: material_id,
            length: length,
            status,
            ms: Date.now() - ms
        };
        await fetch.post(request, obj);

        console.info('영상 시청상태 전송 성공', obj)
    } catch(err){
        console.error(`시청 상태 전송 실패 : ${err.message}`, { set, length, files, user_id, material_id, ms, dev })
        console.error(err);
    }
}
history.on('delete', sendWatchStatus)

// const deleteAll = async (url: string, except: string[] = []) => {
//     const dirs = await fs.promises.readdir(url);
//     const workArr = [];
//     for(let i of dirs){
//         if(except.every(v => v !== i))
//             workArr.push(fs.promises.rm(`${url}/${i}`));
//     }
//     await Promise.all(workArr);
// };

// /video/videodata/:token/:hash/:url/:filename
app.get('/videodata/:token/:hash/:url/:filename', async (req, res) => {
    const { token, hash, url, filename } = req.params
    
    if(/\.(m3u8|ts)$/.test(filename)) {
        console.debug(`token ${token} ${url}/${filename} 영상 데이터 요청`)

        const newHash = makeHash(token, decodeURIComponent(`/${url}`));
        if(hash !== newHash) {
            res.redirect('/video/error')
            return
        }

        if(history.has(token)){
            const obj = history.get(token);
            obj.set.add(filename);
        }

        try {
            const objectKey = path.join(process.env.VIDEO_PATH, url, filename)
            const file = await s3.getObject(objectKey)
            res.send(file)
        } catch(err) {
            console.error(err)
            res.redirect('/video/error')
        }
    } else {
        res.redirect('/video/error');
    }
});

/**
 * post /video/view
 * body {
 *  token: string
 *  url: string
 * }
 */
app.post('/view', async (req, res) => {
    const token = req.body.token as string;
    const url = req.body.url as string;

    if(/^\/.*$/.test(url) == false) {
        res.status(400).end('bad')
        return
    }

    if(token && url){
        console.debug(`token ${token} ${url} 영상 페이지 요청`);
        try{
            let data = {
                data:true,
                success:true
            };
            const dev: 'dev'|'' = req.body.dev === 'dev' ? 'dev' : '';

            if(token !== '7b3fcee5b1aa32ee5ca8144671816e2534cf2335b5efa3b83af5a902c992b6d9'){
                console.debug(`token ${token} ${url} 권한 체크`);
                const checkUrl = dev === 'dev' ? process.env.DEV_CHECK_URL : process.env.CHECK_URL;
                const resp = await fetch.get(`${checkUrl}?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url.slice(1))}`);
                data = await resp.json();
            }
            
            if(data.data && data.success){
                const hash = makeHash(token, decodeURIComponent(url));
                let str = await getViewHTML()
                str = str.replace('\"{{url}}\"', `\"/video/videodata/${token}/${hash}${url}/index.m3u8\"`);
                str = str.replace('\"{{token}}\"', `\"${token}\"`);

                const list = await s3.listObject(path.join(process.env.VIDEO_PATH, url, '/'))
                const m3u8 = await s3.getObject(path.join(process.env.VIDEO_PATH, url, 'index.m3u8'))
                console.log(`history 있는지 : ${history.has(token)}`);
                if(history.has(token)){
                    history.delete(token)
                }

                const obj: HowLong = {
                    user_id: token,
                    set: new Set<string>(),
                    files: m3u8.toString().split('\n').filter(el => /\.ts$/.test(el.trim())).map(el => el.trim()),
                    length: list.length - 2,
                    material_id: url.slice(1),
                    ms: Date.now(),
                    dev
                };
                history.set(token, obj, 1000 * 10)
                res.send(str).end();
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
        root: path.resolve(__dirname, '../../view')
    });
});

/**
 * /video/keepalive
 * query {
 *  token: string
 * }
 **/ 
app.get('/keepalive', validateToken, (req, res) => {
    const token = req.query.token as string;
    if(history.has(token)) {
        console.debug(`token ${token} keepalive`);
        history.resetTimeout(token, 1000 * 10)
        res.status(200).end('good')
    } else {
        res.status(404).end('bad')
    }
});

app.get('/uploadmessage', validateToken, (req, res) => {
    const hash = req.query.token as string;
    tokens.add(hash, 5 * 60 * 1000);

    res.end('success');
});



// app.get('/delete', validateToken, validateHash, validateURL, async (req, res) => {
//     const url = `${ENV.get('video')}${req.query.url}`;
//     try{
//         await fs.promises.stat(url);
//         await deleteAll(url);
//         await fs.promises.rmdir(url);
//         res.end('good');
//         return;
//     } catch(err){
//         console.log(err);
//         res.status(404);
//         res.end('해당 url 없음');
//     }
// });

/**
 * POST /video/upload
 * query {
 *  url: string
 *  token: string
 *  time: number
 * }
 */
app.post('/upload', validateToken, validateHash, validateURL, async (req, res) => {

    const { url } = req.query as Record<string, string>
    const videoId = url.slice(1)
    const key = path.join(process.env.VIDEO_PATH, videoId, 'index.mp4')

    if(isInEncoding(key)) {
        res.status(400).end('해당 파일이 인코딩 중입니다.')
        return;
    }

    const videoToS3Stream = Readable.from(req.body)
    const videoToProbeStream = Readable.from(req.body)

    const { stream, promise } = s3.getObjectWriteStream(key)
    videoToS3Stream.pipe(stream)

    const duration = await getVideoLength(videoToProbeStream)

    try{
        console.info(`비디오 ${url} 업로드 시작`)
        await promise
        
        console.info(`비디오 ${url} 업로드 성공`)
    } catch(err){
        console.error(`비디오 업로드 중 에러 ${err.message}`)
        console.error(err)
        res.status(500).end('error')
        return;
    }
    
    res.status(200).end('upload success')

    startEncode({ duration, key })
    .catch(err => {
        console.error('startEncode 함수 호출 중 에러')
        console.error(err)
    })
});

export default app;