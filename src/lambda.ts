import { S3 } from 'aws-sdk'
import { spawn, execSync } from 'child_process'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const s3 = new S3({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
})
const uploadS3 = new S3({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.UPLOAD_S3_SECRET_KEY
    }
})

const ffmpegPath = '/opt/bin/ffmpeg'

type EncodeVideoArgs = {
    bucket: string

    /** videos/{token}/{filename} */
    videoKey: string
    /** HH:mm:ss */
    startTime: string
    /** HH:mm:ss */
    duration: string

    /** ts 파일 suffix 번호 */
    tsSubSuffix: string
}
export const encodeVideo = async ({ bucket, videoKey, startTime, duration, tsSubSuffix }: EncodeVideoArgs) => {
    
    const _s3 = bucket === 'bucket-wxsyy6' ? s3 : uploadS3

    console.log({ bucket, videoKey, startTime, duration, tsSubSuffix })

    const stream = _s3.getObject({
        Bucket: bucket,
        Key: videoKey
    }).createReadStream();
    
    await new Promise((resolve, reject) => {
        console.time('ENCODING')

        execSync('rm -rf /tmp/videos && mkdir /tmp/videos')

        const mpeg_process = spawn(ffmpegPath, [
            ...(startTime == '00:00:00' ? [] : ['-ss', startTime]),
            '-i', '-',
            '-t', duration,
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-hls_time', '10',
            '-hls_list_size', '0',
            '-hls_segment_filename', `/tmp/videos/index-${tsSubSuffix}-%d.ts`,
            '-f', 'hls',
            `/tmp/videos/index-${tsSubSuffix}.m3u8`
        ])
    
        mpeg_process.on('close', () => {
            console.log('인코딩 완료')
            resolve(null)
        })

        mpeg_process.stdin.on('error', () => {
            console.warn('mpeg process stdin 입력 중간에 끊김')
        })

        mpeg_process.stderr.pipe(process.stdout)

        stream.pipe(mpeg_process.stdin)
    })

    const filenames = fs.readdirSync('/tmp/videos')
    const files: { buf: Buffer, filename: string }[] = []
    await Promise.all(filenames.map(async (filename, idx) => {
        const buf = await fs.promises.readFile(`/tmp/videos/${filename}`)
        files[idx] = { buf, filename }
    }))

    console.info(`ts, m3u8 파일 ${files.length} 개 업로드 시작`)
    for(const { filename, buf } of files){
        const md5 = crypto.createHash('md5').update(buf).digest('base64')

        await _s3.putObject({
            Bucket: bucket,
            Key: path.join(videoKey.split('/').slice(0, -1).join('/'), filename),
            Body: buf,
            ContentType: filename.endsWith('.m3u8') ? 'application/x-mpegURL' : 'application/octet-stream',
            ContentMD5: md5
        }).promise()
        
        console.info(`ts 파일 ${filename} 업로드 완료`)
    }
    console.info(`ts, m3u8 파일 ${files.length} 개 업로드 완료`)

    return {
        m3u8: files.find(el => el.filename.endsWith('.m3u8')).buf.toString('hex')
    }
}
