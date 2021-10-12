import path from 'path'
import express from 'express';
import { Readable } from 'stream'

import * as s3 from './s3'
import { tokens } from './token'
import { validateHash, validateToken, validateURL } from './middleware'
import { getVideoLength } from './ffmpeg'
import { isInEncoding, startEncode } from './encode'

import { logger } from '../utils/logger'

const app = express.Router();

app.get('/uploadmessage', validateToken, (req, res) => {
    const hash = req.query.token as string;
    tokens.add(hash, 5 * 60 * 1000);

    res.end('success');
});

/**
 * POST /user/upload
 * query {
 *  url: string
 *  token: string
 *  time: number
 * }
 */
app.post('/upload', validateToken, validateHash, validateURL, async (req, res) => {

    const { url, token: userId } = req.query as Record<string, string>
    const videoId = url.slice(1)
    const key = path.join(process.env.FORM_UPLOAD_PATH, userId, videoId, 'index.mp4')

    if(isInEncoding(key)) {
        res.status(400).end('해당 파일이 인코딩 중입니다.')
        return;
    }

    const videoToS3Stream = Readable.from(req.body)
    const videoToProbeStream = Readable.from(req.body)

    const { stream, promise } = s3.getObjectWriteStream(s3.getUploadS3Context(), key)
    videoToS3Stream.pipe(stream)

    const duration = await getVideoLength(videoToProbeStream)

    try{
        logger.info(`유저 ${userId} 비디오 ${url} 업로드 시작`)
        await promise
        
        logger.info(`유저 ${userId} 비디오 ${url} 업로드 성공`)
    } catch(err){
        logger.error(`비디오 업로드 중 에러 ${err.message}`)
        logger.error(err)
        res.status(500).end('error')
        return;
    } finally {
        videoToS3Stream.destroy()
        videoToProbeStream.destroy()
        req.body = null
    }
    
    res.status(200).json({
        success: true,
        data: `https://${s3.getUploadS3Context().bucket}.s3.ap-northeast-2.amazonaws.com/${key}`
    })

    startEncode(s3.getUploadS3Context(), { duration, key })
    .catch(err => {
        logger.error(`유저 ${userId} 업로드한 ${videoId} startEncode 함수 호출 중 에러`)
        logger.error(err)
    })
});

export default app;